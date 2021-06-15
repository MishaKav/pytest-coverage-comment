const fs = require('fs');
const path = require('path');
const { getCoverageReport } = require('./parse');
const { getSummaryReport } = require('./junitXml');
const { getMultipleReport } = require('./multiFiles');

/*  
  Usefull git commands
  git tag -a -m "fisrt alpha release" v1.0 && git push --follow-tags 
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
    `My Title 2, ${getPathToFile(covFile).replace('_4', '_3')}, ${getPathToFile(xmlFile).replace('_1', '_2')}`,
  ];

  let finalHtml = '';

  const options = {
    repository: 'MishaKav/pytest-coverage-comment',
    commit: 'f9d42291812ed03bb197e48050ac38ac6befe4e5',
    prefix,
    covFile: getPathToFile(covFile),
    xmlFile: getPathToFile(xmlFile),
    head: 'feat/test',
    base: 'main',
    title: 'Coverage Report',
    badgeTitle: 'Coverage',
    hideBadge: false,
    hideReport: true,
    createNewComment: false,
    xmlTitle: '',
    multipleFiles,
  };

  if (multipleFiles && multipleFiles.length) {
    finalHtml += getMultipleReport(options);
  } else {
    const { html } = getCoverageReport(options);
    const summaryReport = getSummaryReport(options);

    finalHtml += html;
    finalHtml += finalHtml.length ? `\n\n${summaryReport}` : summaryReport;
  }

  if (!finalHtml) {
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
