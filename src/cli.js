const fs = require('fs');
const path = require('path');
const { toHtml } = require('./parse');
const { toMarkdown } = require('./junitXml');
const { getContentFile } = require('./utils');

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
    head: 'feat/test',
    base: 'main',
    title: 'Coverage Report',
    badgeTitle: 'Coverage',
    hideBadge: false,
    hideReport: false,
    xmlTitle: 'JUnit Tests Results2',
  };

  const covFilePath = getPathToFile(covFile);
  const content = getContentFile(covFilePath);
  if (content) {
    finalHtml = toHtml(content, options);
  }

  if (xmlFile) {
    const xmlFilePath = getPathToFile(xmlFile);
    const contentXml = getContentFile(xmlFilePath);
    const summary = toMarkdown(contentXml, options);
    finalHtml += finalHtml.length ? `\n\n${summary}` : summary;
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
