const fs = require('fs');
const path = require('path');
const { getCoverageReport } = require('./parse');
const { getSummaryReport } = require('./junitXml');

/*  
  Usefull git commands
  git tag -a -m "fisrt alpha release" v1.0 && git push --follow-tags 
  git tag -d v1.0 
  git tag -d origin v1.0  
*/

const getPathToFile = (pathToFile) => {
  if (!pathToFile) {
    return null;
  }

  // suports absolute path like '/tmp/pytest-coverage.txt'
  return pathToFile.startsWith('/') ? pathToFile : `${__dirname}/${pathToFile}`;
};

const main = async () => {
  const covFile = process.argv[2];
  const xmlFile = process.argv[3];
  const prefix = path.dirname(path.dirname(path.resolve(covFile))) + '/';
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
    hideReport: false,
    xmlTitle: 'JUnit Tests Results2',
  };

  const { html, coverage } = getCoverageReport(options);
  const summaryReport = getSummaryReport(options);

  finalHtml += html;
  finalHtml += finalHtml.length ? `\n\n${summaryReport}` : summaryReport;

  if (!finalHtml) {
    console.log('Nothing to report');
    return;
  }

  const resultFile = __dirname + '/../tmp/result.md';
  fs.promises.mkdir(__dirname + '/../tmp').catch(console.error);
  fs.writeFileSync(resultFile, finalHtml);
  console.log(`Published ${options.title}. Total coverage ${coverage}.`);
  console.log(resultFile);
};

main().catch(function (err) {
  console.log(err);
  process.exit(1);
});
