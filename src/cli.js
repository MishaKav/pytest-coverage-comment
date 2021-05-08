const fs = require('fs');
const path = require('path');
const { toHtml } = require('./parse');
const { toMarkdown } = require('./junitXml');

const main = async () => {
  const covFile = process.argv[2];
  const xmlFile = process.argv[3];
  const prefix = path.dirname(path.dirname(path.resolve(covFile))) + '/';

  const options = {
    repository: 'MishaKav/pytest-coverage-comment',
    commit: 'f9d42291812ed03bb197e48050ac38ac6befe4e5',
    prefix,
    head: 'feat/test',
    base: 'main',
    title: 'Coverage Report',
    badgeTitle: 'Coverage',
    hideBadge: false,
    hideReport: false,
    xmlTitle: 'JUnit Tests Results2',
  };

  // suports absolute path like '/tmp/pytest-coverage.txt'
  const covFilePath = covFile.startsWith('/')
    ? covFile
    : `${__dirname}/${covFile}`;
  const content = fs.readFileSync(covFilePath, 'utf8');
  const result = toHtml(content, options);

  const resultFile = __dirname + '/tmp/coverage.md';
  fs.writeFileSync(resultFile, result);
  console.log(resultFile);

  // suports absolute path like '/tmp/pytest-coverage.txt'
  const xmlFilePath = covFile.startsWith('/')
    ? xmlFile
    : `${__dirname}/${xmlFile}`;

  const contentXml = fs.readFileSync(xmlFilePath, 'utf8');
  const summary = toMarkdown(contentXml, options);

  const resultXmlFile = __dirname + '/tmp/junitxml.md';
  fs.writeFileSync(resultXmlFile, summary);
  console.log(resultXmlFile);
};

main().catch(function (err) {
  console.log(err);
  process.exit(1);
});
