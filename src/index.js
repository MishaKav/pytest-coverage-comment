const fs = require('fs');
const core = require('@actions/core');
const github = require('@actions/github');
const { toHtml, getSummaryLine } = require('./parse');

const main = async () => {
  const token = core.getInput('github-token');
  const title = core.getInput('title') || 'Coverage Report';
  const badgeTitle = core.getInput('badge-title') || 'Coverage';
  const hideBadge = core.getInput('hide-badge') || false;
  const covFile = core.getInput('pytest-coverage') || '/pytest-coverage.txt';
  const { context } = github;

  // suports absolute path like '/tmp/pytest-coverage.txt'
  const covFilePath = covFile.startsWith('/')
    ? covFile
    : `${process.env.GITHUB_WORKSPACE}/${covFile}`;

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
  };

  if (context.eventName === 'pull_request') {
    options.commit = context.payload.pull_request.head.sha;
    options.head = context.payload.pull_request.head.ref;
    options.base = context.payload.pull_request.base.ref;
  } else if (context.eventName === 'push') {
    options.commit = context.payload.after;
    options.head = context.ref;
  }

  const coverageHtml = toHtml(content, options);
  const summary = getSummaryLine(content);

  const octokit = github.getOctokit(token);

  if (context.eventName === 'pull_request') {
    await octokit.issues.createComment({
      repo: context.repo.repo,
      owner: context.repo.owner,
      issue_number: context.payload.pull_request.number,
      body: coverageHtml,
    });
  } else if (context.eventName === 'push') {
    await octokit.repos.createCommitComment({
      repo: context.repo.repo,
      owner: context.repo.owner,
      commit_sha: options.commit,
      body: coverageHtml,
    });
  }

  console.log(`Published ${title}. ${summary}.`);
};

main().catch((err) => {
  console.log(err);
  core.setFailed(err.message);
});
