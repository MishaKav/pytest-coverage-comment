const core = require('@actions/core');
const github = require('@actions/github');
const { getCoverageReport } = require('./parse');
const { getSummaryReport } = require('./junitXml');

const WATERMARK = '<!-- Pytest Coverage Comment -->\n';

const main = async () => {
  const token = core.getInput('github-token');
  const title = core.getInput('title') || 'Coverage Report';
  const badgeTitle = core.getInput('badge-title') || 'Coverage';
  const hideBadge = core.getInput('hide-badge') || 'false';
  const hideReport = core.getInput('hide-report') || 'false';
  const covFile =
    core.getInput('pytest-coverage-path') || './pytest-coverage.txt';
  const xmlFile = core.getInput('junitxml-path') || '';
  const xmlTitle = core.getInput('junitxml-title') || 'JUnit Tests Results';
  const { context } = github;
  let finalHtml = '';

  const options = {
    repository: context.payload.repository.full_name,
    prefix: `${process.env.GITHUB_WORKSPACE}/`,
    covFile,
    xmlFile,
    title,
    badgeTitle,
    hideBadge: hideBadge == 'true',
    hideReport: hideReport == 'true',
    xmlTitle,
  };

  if (context.eventName === 'pull_request') {
    options.commit = context.payload.pull_request.head.sha;
    options.head = context.payload.pull_request.head.ref;
    options.base = context.payload.pull_request.base.ref;
  } else if (context.eventName === 'push') {
    options.commit = context.payload.after;
    options.head = context.ref;
  }

  const { html, coverage } = getCoverageReport(options);
  const summaryReport = getSummaryReport(options);

  finalHtml += html;
  finalHtml += finalHtml.length ? `\n\n${summaryReport}` : summaryReport;

  if (!finalHtml) {
    console.log('Nothing to report');
    return;
  }

  const octokit = github.getOctokit(token);

  if (context.eventName === 'pull_request') {
    await octokit.issues.createComment({
      repo: context.repo.repo,
      owner: context.repo.owner,
      issue_number: context.payload.pull_request.number,
      body: WATERMARK + finalHtml,
    });
  } else if (context.eventName === 'push') {
    await octokit.repos.createCommitComment({
      repo: context.repo.repo,
      owner: context.repo.owner,
      commit_sha: options.commit,
      body: WATERMARK + finalHtml,
    });
  }

  if (coverage) {
    core.setOutput('coverage', coverage);
    console.log(`Published ${title}. Total coverage ${coverage}.`);
  }
};

main().catch((err) => {
  console.log(err);
  core.setFailed(err.message);
});
