import * as core from '@actions/core';
import * as github from '@actions/github';
import { getCoverageReport } from './parse';
import { getCoverageXmlReport } from './parseXml';
import { getSummaryReport, getParsedXml, getNotSuccessTest } from './junitXml';
import { getMultipleReport } from './multiFiles';
import type { Options, ChangedFiles } from './types';

const MAX_COMMENT_LENGTH = 65536;
const MAX_SUMMARY_LENGTH = 1024 * 1024; // 1MB limit for GitHub step summary
const FILE_STATUSES = Object.freeze({
  ADDED: 'added',
  MODIFIED: 'modified',
  REMOVED: 'removed',
  RENAMED: 'renamed',
});

/**
 * Resolves a potential tag object SHA to the underlying commit SHA.
 * For annotated tags, GitHub's push event payload.after contains the tag object SHA,
 * not the commit SHA. This function detects tag pushes and resolves them to commits.
 */
export const resolveCommitSha = async (
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  sha: string,
  ref: string,
): Promise<string> => {
  // Check if this is a tag push
  if (ref && ref.startsWith('refs/tags/')) {
    try {
      core.info(`Detected tag push: ${ref}`);
      core.info(`Attempting to resolve SHA: ${sha}`);

      // Try to get the tag object
      const { data: tag } = await octokit.rest.git.getTag({
        owner,
        repo,
        tag_sha: sha,
      });

      // If it's an annotated tag, it will have an object field pointing to the commit
      if (tag && tag.object && tag.object.sha) {
        core.info(`Resolved annotated tag to commit: ${tag.object.sha}`);
        return tag.object.sha;
      }
    } catch (error) {
      // If getTag fails, it might be a lightweight tag or direct commit
      // In this case, the SHA is already a commit SHA
      // prettier-ignore
      core.info(`SHA is not an annotated tag object, using as commit SHA: ${sha}`);
      core.debug(`Error details: ${(error as Error).message}`);
    }
  }

  // Return original SHA if not a tag or if it's a lightweight tag
  return sha;
};

export const truncateSummary = (content: string, maxLength: number): string => {
  if (content.length <= maxLength) {
    return content;
  }

  // prettier-ignore
  const truncationMessage = '\n\n**Warning: Summary truncated due to GitHub\'s 1MB limit**';
  const messageLength = truncationMessage.length;
  // prettier-ignore
  const truncatedContent = content.substring(0, maxLength - messageLength - 100); // Leave some buffer

  // Try to find a good break point (end of line or closing tag)
  const lastNewline = truncatedContent.lastIndexOf('\n');
  const lastClosingTag = truncatedContent.lastIndexOf('</');
  const breakPoint = Math.max(lastNewline, lastClosingTag);

  // If we found a good break point
  if (breakPoint > maxLength * 0.8) {
    return truncatedContent.substring(0, breakPoint) + truncationMessage;
  }

  return truncatedContent + truncationMessage;
};

const handlePermissionError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any,
  context: typeof github.context,
): void => {
  if (error?.status !== 403) {
    core.setFailed(`Failed to create/update comment: ${error.message}`);
    throw error;
  }

  const isForkPR =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (context?.payload?.pull_request as any)?.head?.repo?.fork === true;
  const lines = ['Permission denied when trying to create/update comment.', ''];

  if (isForkPR) {
    lines.push(
      'This PR is from a fork. GitHub restricts the GITHUB_TOKEN to read-only',
      'for fork PRs triggered by the `pull_request` event.',
      '',
      'To fix this, use the `pull_request_target` event instead:',
      '',
      '```yaml',
      'on:',
      '  pull_request_target:',
      '    types: [opened, synchronize, reopened]',
      '',
      'permissions:',
      '  contents: read',
      '  pull-requests: write',
      '```',
      '',
      'Note: `pull_request_target` runs in the context of the base branch.',
      'Be cautious when checking out fork code — never run untrusted code',
      'from the fork with elevated permissions.',
      '',
      'For more information, see:',
      'https://github.com/MishaKav/pytest-coverage-comment#fork-prs',
    );
  } else {
    const eventName = context?.eventName || 'this event';
    lines.push(
      'This error usually occurs because the GITHUB_TOKEN lacks necessary permissions.',
      '',
      'To fix this, add a permissions block to your workflow:',
      '',
      '```yaml',
      'permissions:',
      '  contents: read        # For checkout and comparing commits',
      '  pull-requests: write  # For creating/updating PR comments',
      '```',
      '',
      `For ${eventName === 'push' ? 'push events creating commit comments' : 'pull request events and more information'}, see:`,
      'https://github.com/MishaKav/pytest-coverage-comment#comment-not-appearing',
    );
  }

  core.setFailed(lines.join('\n'));
  throw error;
};

const createOrEditComment = async (
  octokit: ReturnType<typeof github.getOctokit>,
  repo: string,
  owner: string,
  issue_number: number,
  body: string,
  WATERMARK: string,
  context: typeof github.context,
): Promise<void> => {
  try {
    // Now decide if we should issue a new comment or edit an old one
    const { data: comments } = await octokit.rest.issues.listComments({
      repo,
      owner,
      issue_number,
    });

    const comment = comments.find((c: { body?: string }) =>
      c.body?.startsWith(WATERMARK),
    );

    if (comment) {
      core.info('Found previous comment, updating');
      await octokit.rest.issues.updateComment({
        repo,
        owner,
        comment_id: comment.id,
        body,
      });
    } else {
      core.info('No previous comment found, creating a new one');
      await octokit.rest.issues.createComment({
        repo,
        owner,
        issue_number,
        body,
      });
    }
  } catch (error) {
    handlePermissionError(error, context);
  }
};

const main = async (): Promise<void> => {
  const token = core.getInput('github-token', { required: true });
  const title = core.getInput('title', { required: false });
  const badgeTitle = core.getInput('badge-title', { required: false });
  const hideBadge = core.getBooleanInput('hide-badge', { required: false });
  const hideReport = core.getBooleanInput('hide-report', { required: false });
  const createNewComment = core.getBooleanInput('create-new-comment', {
    required: false,
  });
  const hideComment = core.getBooleanInput('hide-comment', { required: false });
  const hideEmoji = core.getBooleanInput('hide-emoji', { required: false });
  const xmlSkipCovered = core.getBooleanInput('xml-skip-covered', {
    required: false,
  });
  const reportOnlyChangedFiles = core.getBooleanInput(
    'report-only-changed-files',
    { required: false },
  );
  const removeLinkFromBadge = core.getBooleanInput('remove-link-from-badge', {
    required: false,
  });
  const removeLinksToFiles = core.getBooleanInput('remove-links-to-files', {
    required: false,
  });
  const removeLinksToLines = core.getBooleanInput('remove-links-to-lines', {
    required: false,
  });
  const textInsteadBadge = core.getBooleanInput('text-instead-badge', {
    required: false,
  });
  const uniqueIdForComment = core.getInput('unique-id-for-comment', {
    required: false,
  });
  const defaultBranch = core.getInput('default-branch', { required: false });
  const covFile = core.getInput('pytest-coverage-path', { required: false });
  const issueNumberInput = core.getInput('issue-number', { required: false });
  const covXmlFile = core.getInput('pytest-xml-coverage-path', {
    required: false,
  });
  const pathPrefix = core.getInput('coverage-path-prefix', { required: false });
  const xmlFile = core.getInput('junitxml-path', { required: false });
  const xmlTitle = core.getInput('junitxml-title', { required: false });
  const multipleFiles = core.getMultilineInput('multiple-files', {
    required: false,
  });
  const { context } = github;
  const { repo, owner } = context.repo;
  const { eventName, payload } = context;
  const serverUrl = context.serverUrl || 'https://github.com';

  core.info(`Uses Github URL: ${serverUrl}`);
  const watermarkUniqueId = uniqueIdForComment
    ? `| ${uniqueIdForComment} `
    : '';
  const WATERMARK = `<!-- Pytest Coverage Comment: ${context.job} ${watermarkUniqueId}-->\n`;
  let finalHtml = '';

  const options: Options = {
    token,
    repository:
      github.context.payload.repository?.full_name || `${owner}/${repo}`,
    prefix: `${process.env.GITHUB_WORKSPACE}/`,
    pathPrefix,
    covFile,
    covXmlFile,
    xmlFile,
    title,
    badgeTitle,
    hideBadge,
    hideReport,
    createNewComment,
    hideComment,
    hideEmoji,
    xmlSkipCovered,
    reportOnlyChangedFiles,
    removeLinkFromBadge,
    removeLinksToFiles,
    removeLinksToLines,
    textInsteadBadge,
    defaultBranch,
    xmlTitle,
    multipleFiles,
  };

  options.repoUrl =
    payload.repository?.html_url || `${serverUrl}/${options.repository}`;

  // Initialize octokit early so we can use it for tag resolution
  const octokit = github.getOctokit(token);

  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    options.commit = payload.pull_request!.head.sha;
    options.head = payload.pull_request!.head.ref;
    options.base = payload.pull_request!.base.ref;
  } else if (eventName === 'push') {
    // For annotated tags, payload.after contains the tag object SHA, not the commit SHA
    // Resolve it to the actual commit SHA
    options.commit = await resolveCommitSha(
      octokit,
      owner,
      repo,
      payload.after as string,
      context.ref,
    );
    options.head = context.ref;
  } else if (eventName === 'workflow_dispatch') {
    options.commit = context.sha;
    options.head = context.ref;
  } else if (eventName === 'workflow_run') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options.commit = (payload as any).workflow_run.head_sha;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options.head = (payload as any).workflow_run.head_branch;
  }

  if (options.reportOnlyChangedFiles) {
    const changedFiles = await getChangedFiles(options, issueNumberInput);
    options.changedFiles = changedFiles;

    // when github event is different from `pull_request`, `workflow_dispatch`, `workflow_run` or `push`
    if (!changedFiles) {
      options.reportOnlyChangedFiles = false;
    }
  }

  let report = options.covXmlFile
    ? getCoverageXmlReport(options)
    : getCoverageReport(options);

  if (!report) {
    report = { html: '', coverage: null, color: 'red' };
  }

  const { coverage, color } = report as {
    coverage: unknown;
    color: string;
    html: string;
    warnings?: number;
  };
  let { html } = report as { html: string };
  const warnings = (report as { warnings?: number }).warnings;
  const summaryReport = getSummaryReport(options);

  if (summaryReport) {
    core.setOutput('coverageHtml', summaryReport);
  }

  if (html) {
    const newOptions = { ...options, commit: defaultBranch };
    const output = newOptions.covXmlFile
      ? getCoverageXmlReport(newOptions)
      : getCoverageReport(newOptions);
    if (output) {
      core.setOutput('coverageHtml', output.html);
    }
  }

  // set to output junitxml values
  if (summaryReport) {
    const parsedXml = getParsedXml(options);
    if (parsedXml) {
      const { errors, failures, skipped, tests, time } = parsedXml;
      const valuesToExport = { errors, failures, skipped, tests, time };

      Object.entries(valuesToExport).forEach(([key, value]) => {
        core.info(`${key}: ${value}`);
        core.setOutput(key, value);
      });

      const notSuccessTestInfo = getNotSuccessTest(options);
      core.setOutput('notSuccessTestInfo', JSON.stringify(notSuccessTestInfo));
    }
    core.setOutput('summaryReport', JSON.stringify(summaryReport));
  }

  let multipleFilesHtml = '';
  if (multipleFiles && multipleFiles.length) {
    multipleFilesHtml = `\n\n${getMultipleReport(options)}`;
  }

  if (
    !options.hideReport &&
    html.length + summaryReport.length > MAX_COMMENT_LENGTH &&
    eventName != 'workflow_dispatch' &&
    eventName != 'workflow_run'
  ) {
    // generate new html without report
    const warningsArr = [
      `Your comment is too long (maximum is ${MAX_COMMENT_LENGTH} characters), coverage report will not be added.`,
      'Try one/some of the following options:',
      '- Add "--cov-report=term-missing:skip-covered" to pytest command',
      '- Add "hide-report: true" to hide detailed coverage table',
      '- Add "report-only-changed-files: true" to show only changed files',
      '- Add "xml-skip-covered: true" to hide files with 100% coverage',
      '- Switch to "multiple-files" mode',
    ];

    if (!options.removeLinksToFiles) {
      // prettier-ignore
      warningsArr.push('- Add "remove-links-to-files: true" to remove file links');
    }

    if (!options.removeLinksToLines) {
      // prettier-ignore
      warningsArr.push('- Add "remove-links-to-lines: true" to remove line number links');
    }
    core.warning(warningsArr.join('\n'));
    report = options.covXmlFile
      ? getCoverageXmlReport({ ...options, hideReport: true })
      : getCoverageReport({ ...options, hideReport: true });

    if (!report) {
      report = { html: '', coverage: null, color: 'red' };
    }
    html = (report as { html: string }).html;
  }

  finalHtml += html;
  finalHtml += finalHtml.length ? `\n\n${summaryReport}` : summaryReport;
  finalHtml += multipleFilesHtml
    ? `\n\n${multipleFilesHtml}`
    : multipleFilesHtml;
  core.setOutput('summaryReport', JSON.stringify(finalHtml));

  if (coverage && typeof coverage === 'string') {
    core.startGroup(options.covFile);
    core.info(`coverage: ${coverage}`);
    core.info(`color: ${color}`);
    core.info(`warnings: ${warnings}`);

    core.setOutput('coverage', coverage);
    core.setOutput('color', color);
    core.setOutput('warnings', warnings);
    core.endGroup();
  }

  // support for output for `pytest-xml-coverage-path`
  if (
    coverage &&
    typeof coverage === 'object' &&
    (coverage as { cover?: string }).cover
  ) {
    core.startGroup(options.covXmlFile);
    core.info(`coverage: ${(coverage as { cover: string }).cover}`);
    core.info(`color: ${color}`);

    core.setOutput('coverage', (coverage as { cover: string }).cover);
    core.setOutput('color', color);
    core.endGroup();
  }

  if (!finalHtml || options.hideComment) {
    core.info('Nothing to report');
    return;
  }
  const body = WATERMARK + finalHtml;

  const issue_number = payload.pull_request
    ? payload.pull_request.number
    : issueNumberInput
      ? parseInt(issueNumberInput)
      : 0;

  if (eventName === 'push') {
    core.info('Create commit comment');
    try {
      await octokit.rest.repos.createCommitComment({
        repo,
        owner,
        commit_sha: options.commit!,
        body,
      });
    } catch (error) {
      handlePermissionError(error, context);
    }
  } else if (
    eventName === 'pull_request' ||
    eventName === 'pull_request_target'
  ) {
    if (createNewComment) {
      core.info('Creating a new comment');

      try {
        await octokit.rest.issues.createComment({
          repo,
          owner,
          issue_number,
          body,
        });
      } catch (error) {
        handlePermissionError(error, context);
      }
    } else {
      await createOrEditComment(
        octokit,
        repo,
        owner,
        issue_number,
        body,
        WATERMARK,
        context,
      );
    }
  } else if (
    eventName === 'workflow_dispatch' ||
    eventName === 'workflow_run'
  ) {
    const truncatedBody = truncateSummary(body, MAX_SUMMARY_LENGTH);
    if (body.length > MAX_SUMMARY_LENGTH) {
      // prettier-ignore
      core.warning(`GitHub step summary was truncated from ${body.length} to ${truncatedBody.length} characters due to the 1MB limit.`);
    }
    await core.summary.addRaw(truncatedBody, true).write();
    if (!issueNumberInput) {
      // prettier-ignore
      core.warning(`To use this action on a \`${eventName}\`, you need to pass a pull request number.`)
    } else {
      if (createNewComment) {
        core.info('Creating a new comment');
        try {
          await octokit.rest.issues.createComment({
            repo,
            owner,
            issue_number,
            body,
          });
        } catch (error) {
          handlePermissionError(error, context);
        }
      } else {
        await createOrEditComment(
          octokit,
          repo,
          owner,
          issue_number,
          body,
          WATERMARK,
          context,
        );
      }
    }
  } else {
    if (!options.hideComment) {
      // prettier-ignore
      core.warning(`This action supports comments only on \`pull_request\`, \`pull_request_target\`, \`push\`, \`workflow_run\` and \`workflow_dispatch\`  events. \`${eventName}\` events are not supported.\nYou can use the output of the action.`)
    }
  }
};

// generate object of all files that changed based on commit through Github API
const getChangedFiles = async (
  options: Options,
  pr_number: string,
): Promise<ChangedFiles | null> => {
  try {
    const { context } = github;
    const { eventName, payload } = context;
    const { repo, owner } = context.repo;
    const octokit = github.getOctokit(options.token);

    // Define the base and head commits to be extracted from the payload
    let base: string, head: string;

    switch (eventName) {
      case 'pull_request':
      case 'pull_request_target':
        base = payload.pull_request!.base.sha;
        head = payload.pull_request!.head.sha;
        break;
      case 'push':
        base = payload.before as string;
        // Use the resolved commit SHA from options instead of payload.after
        // This handles annotated tags correctly
        head = options.commit || (payload.after as string);
        break;
      case 'workflow_run':
      case 'workflow_dispatch': {
        const { data } = await octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: parseInt(pr_number),
        });

        base = data.base.label;
        head = data.head.label;
        break;
      }
      default:
        // prettier-ignore
        core.warning(`\`report-only-changed-files: true\` supports only on \`pull_request\`, \`workflow_run\`, \`workflow_dispatch\` and \`push\`. Other \`${eventName}\` events are not supported.`)
        return null;
    }

    core.startGroup('Changed files');
    // Log the base and head commits
    core.info(`Base commit: ${base}`);
    core.info(`Head commit: ${head}`);

    let response;
    // that is first commit, we cannot get diff
    if (base === '0000000000000000000000000000000000000000') {
      response = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: head,
      });
    } else {
      // https://developer.github.com/v3/repos/commits/#compare-two-commits
      response = await octokit.rest.repos.compareCommits({
        base,
        head,
        owner,
        repo,
      });
    }

    // Ensure that the request was successful.
    if (response.status !== 200) {
      core.setFailed(
        `The GitHub API for comparing the base and head commits for this ${eventName} event returned ${response.status}, expected 200. ` +
          "Please submit an issue on this action's GitHub repo.",
      );
    }

    // Get the changed files from the response payload.
    const files = response.data.files || [];
    const all: string[] = [],
      added: string[] = [],
      modified: string[] = [],
      removed: string[] = [],
      renamed: string[] = [],
      addedModified: string[] = [];

    for (const file of files) {
      const { filename: filenameOriginal, status } = file;
      const filename = filenameOriginal.replace(options.pathPrefix, '');

      all.push(filename);

      switch (status) {
        case FILE_STATUSES.ADDED:
          added.push(filename);
          addedModified.push(filename);
          break;
        case FILE_STATUSES.MODIFIED:
          modified.push(filename);
          addedModified.push(filename);
          break;
        case FILE_STATUSES.REMOVED:
          removed.push(filename);
          break;
        case FILE_STATUSES.RENAMED:
          renamed.push(filename);
          break;
        default:
          // prettier-ignore
          core.setFailed(`One of your files includes an unsupported file status '${status}', expected ${Object.values(FILE_STATUSES).join(',')}.`);
      }
    }

    core.info(`All: ${all.join(',')}`);
    core.info(`Added: ${added.join(', ')}`);
    core.info(`Modified: ${modified.join(', ')}`);
    core.info(`Removed: ${removed.join(', ')}`);
    core.info(`Renamed: ${renamed.join(', ')}`);
    core.info(`Added or modified: ${addedModified.join(', ')}`);

    core.endGroup();

    return {
      all,
      added,
      modified,
      removed,
      renamed,
      AddedOrModified: addedModified,
    };
  } catch (error) {
    core.setFailed((error as Error).message);
    return null;
  }
};

main().catch((err: Error) => {
  core.error(err);
  core.setFailed(err.message);
});
