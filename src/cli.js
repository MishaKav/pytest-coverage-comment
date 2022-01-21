const fs = require('fs');
const path = require('path');
const { getCoverageReport } = require('./parse');
const {
  getSummaryReport,
  getParsedXml,
  getNotSuccessTest,
} = require('./junitXml');
const { getMultipleReport } = require('./multiFiles');

/*  
  Usefull git commands
  git tag -a -m "Export coverage example" v1.1.7 && git push --follow-tags 
  git tag -d v1.0 
  git tag -d origin v1.0  

  # remove all workflows from repo
  gh api repos/MishaKav/pytest-coverage-comment/actions/runs \
  | jq -r '.workflow_runs[] | select(.head_branch != "main") | "\(.id)"' \
  | gxargs -n1 -I '{}' gh api repos/MishaKav/pytest-coverage-comment/actions/runs/{} -X DELETE --silent

  # remove all local branches
  git branch | grep -v "main" | xargs git branch -D
*/

const getPathToFile = (pathToFile) => {
  if (!pathToFile) {
    return null;
  }

  // suports absolute path like '/tmp/pytest-coverage.txt'
  return pathToFile.startsWith('/') ? pathToFile : `${__dirname}/${pathToFile}`;
};

const main = async () => {
  const covFile = './../data/pytest-coverage_4.txt';
  const xmlFile = './../data/pytest_1.xml';
  const prefix = path.dirname(path.dirname(path.resolve(covFile))) + '/';
  const multipleFiles = [
    `My Title 1, ${getPathToFile(covFile)}, ${getPathToFile(xmlFile)}`,
    `My Title 2, ${getPathToFile(covFile).replace('_4', '_3')}, ${getPathToFile(
      xmlFile
    ).replace('_1', '_2')}`,
  ];

  let finalHtml = '';

  const options = {
    repository: 'MishaKav/pytest-coverage-comment',
    commit: 'f9d42291812ed03bb197e48050ac38ac6befe4e5',
    prefix,
    covFile: getPathToFile(covFile),
    xmlFile: getPathToFile(xmlFile),
    defaultBranch: 'main',
    head: 'feat/test',
    base: 'main',
    title: 'Coverage Report',
    badgeTitle: 'Coverage',
    hideBadge: false,
    hideReport: false,
    createNewComment: false,
    reportOnlyChangedFiles: true,
    hideComment: false,
    xmlTitle: '',
    // multipleFiles,
    changedFiles: {
      all: [
        'functions/example_completed/example_completed.py',
        'functions/example_manager/example_manager.py',
        'functions/example_manager/example_static.py',
      ],
    },
  };

  if (options.multipleFiles && options.multipleFiles.length) {
    finalHtml += getMultipleReport(options);
  } else {
    const { html } = getCoverageReport(options);
    const summaryReport = getSummaryReport(options);

    // set to output junitxml values
    if (summaryReport) {
      const parsedXml = getParsedXml(options);
      const { errors, failures, skipped, tests, time } = parsedXml;
      const valuesToExport = { errors, failures, skipped, tests, time };
      const notSuccessTestInfo = getNotSuccessTest(options);

      console.log('notSuccessTestInfo', JSON.stringify(notSuccessTestInfo));

      Object.entries(valuesToExport).forEach(([key, value]) => {
        console.log(key, value);
      });
    }

    finalHtml += html;
    finalHtml += finalHtml.length ? `\n\n${summaryReport}` : summaryReport;
  }

  if (!finalHtml || options.hideComment) {
    console.log('Nothing to report');
    return;
  }

  const resultFile = __dirname + '/../tmp/result.md';
  fs.promises.mkdir(__dirname + '/../tmp').catch(console.error);
  fs.writeFileSync(resultFile, finalHtml);
  console.log(resultFile);
};

main().catch(function (err) {
  console.log(err);
  process.exit(1);
});
