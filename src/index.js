const fs = require('fs');
const core = require('@actions/core');
const github = require('@actions/github');
const { toHtml, getSummaryLine } = require('./parse');
const { toMarkdown } = require('./junitXml');

const main = async () => {
  const token = core.getInput('github-token');
  const title = core.getInput('title') || 'Coverage Report';
  const badgeTitle = core.getInput('badge-title') || 'Coverage';
  const hideBadge = core.getInput('hide-badge') || false;
  const hideReport = core.getInput('hide-report') || false;
  const covFile = core.getInput('pytest-coverage') || './pytest-coverage.txt';
  const xmlFile = core.getInput('junitxml-path') || './pytest.xml';
  const xmlTitle = core.getInput('junitxml-title') || 'JUnit Tests Results';
  const { context } = github;

  // suports absolute path like '/tmp/pytest-coverage.txt'
  const covFilePath = covFile.startsWith('/')
    ? covFile
    : `${process.env.GITHUB_WORKSPACE}${covFile}`;

  const content = fs.readFileSync(covFilePath, 'utf8');
  if (!content) {
    console.log(`No coverage report found at '${covFile}', exiting...`);
    return;
  }

  const options = {
    repository: context.payload.repository.full_name,
    prefix: `${process.env.GITHUB_WORKSPACE}/`,
    title,
    badgeTitle,
    hideBadge,
    hideReport,
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

  let finalHtml = toHtml(content, options);

  // suports absolute path like '/tmp/pytest.xml'
  const xmlFilePath = covFile.startsWith('/')
    ? xmlFile
    : `${process.env.GITHUB_WORKSPACE}${xmlFile}`;

  const contentXml = fs.readFileSync(xmlFilePath, 'utf8');
  if (contentXml) {
    const summary = toMarkdown(contentXml, options);
    finalHtml += summary;
  } else {
    console.log(`No junitxml file found at '${xmlFile}', skipping...`);
  }

  const octokit = github.getOctokit(token);

  if (context.eventName === 'pull_request') {
    await octokit.issues.createComment({
      repo: context.repo.repo,
      owner: context.repo.owner,
      issue_number: context.payload.pull_request.number,
      body: finalHtml,
    });
  } else if (context.eventName === 'push') {
    await octokit.repos.createCommitComment({
      repo: context.repo.repo,
      owner: context.repo.owner,
      commit_sha: options.commit,
      body: finalHtml,
    });
  }

  const summaryLine = getSummaryLine(content);
  console.log(`Published ${title}. ${summaryLine}.`);
};

main().catch((err) => {
  console.log(err);
  core.setFailed(err.message);
});
