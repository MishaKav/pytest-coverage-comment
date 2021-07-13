const core = require('@actions/core');
const github = require('@actions/github');
const { getCoverageReport } = require('./parse');
const { getSummaryReport } = require('./junitXml');
const { getMultipleReport } = require('./multiFiles');

const main = async () => {
  const token = core.getInput('github-token', { required: true });
  const title = core.getInput('title', { required: false });
  const badgeTitle = core.getInput('badge-title', { required: false });
  const hideBadge = core.getBooleanInput('hide-badge', { required: false });
  const hideReport = core.getBooleanInput('hide-report', { required: false });
  const createNewComment = core.getBooleanInput('create-new-comment', {
    required: false,
  });
  const covFile = core.getInput('pytest-coverage-path', { required: false });
  const xmlFile = core.getInput('junitxml-path', { required: false });
  const xmlTitle = core.getInput('junitxml-title', { required: false });
  const multipleFiles = core.getMultilineInput('multiple-files', {
    required: false,
  });
  const { context } = github;
  const { repo, owner } = context.repo;
  const WATERMARK = `<!-- Pytest Coverage Comment: ${context.job} -->\n`;
  let finalHtml = '';

  const options = {
    repository: context.payload.repository.full_name,
    prefix: `${process.env.GITHUB_WORKSPACE}/`,
    covFile,
    xmlFile,
    title,
    badgeTitle,
    hideBadge,
    hideReport,
    createNewComment,
    xmlTitle,
    multipleFiles,
  };

  if (context.eventName === 'pull_request') {
    options.commit = context.payload.pull_request.head.sha;
    options.head = context.payload.pull_request.head.ref;
    options.base = context.payload.pull_request.base.ref;
  } else if (context.eventName === 'push') {
    options.commit = context.payload.after;
    options.head = context.ref;
  }

  if (multipleFiles && multipleFiles.length) {
    finalHtml += getMultipleReport(options);
  } else {
    const { html, coverage, color } = getCoverageReport(options);
    const summaryReport = getSummaryReport(options);

    finalHtml += html;
    finalHtml += finalHtml.length ? `\n\n${summaryReport}` : summaryReport;

    if (coverage) {
      core.setOutput('coverage', coverage);
      core.setOutput('color', color);
      console.log(
        `Publishing ${title}. Total coverage: ${coverage}. Color: ${color}`
      );
    }
  }

  if (!finalHtml) {
    console.log('Nothing to report');
    return;
  }
  const body = WATERMARK + finalHtml;
  const octokit = github.getOctokit(token);

  const issue_number = context.payload.pull_request
    ? context.payload.pull_request.number
    : 0;

  if (context.eventName === 'push') {
    console.log('Create commit comment');
    await octokit.repos.createCommitComment({
      repo,
      owner,
      commit_sha: options.commit,
      body,
    });
  }

  if (context.eventName === 'pull_request') {
    if (createNewComment) {
      console.log('Creating a new comment');

      await octokit.issues.createComment({
        repo,
        owner,
        issue_number,
        body,
      });
    } else {
      // Now decide if we should issue a new comment or edit an old one
      const { data: comments } = await octokit.issues.listComments({
        repo,
        owner,
        issue_number,
      });

      const comment = comments.find(
        (c) =>
          c.user.login === 'github-actions[bot]' && c.body.startsWith(WATERMARK)
      );

      if (comment) {
        console.log('Founded previous commit, updating');
        await octokit.issues.updateComment({
          repo,
          owner,
          comment_id: comment.id,
          body,
        });
      } else {
        console.log('No previous commit founded, creating a new one');
        await octokit.issues.createComment({
          repo,
          owner,
          issue_number,
          body,
        });
      }
    }
  }
};

main().catch((err) => {
  console.log(err);
  core.setFailed(err.message);
});
