const xml2js = require('xml2js');
const { getPathToFile, getContentFile } = require('./utils');

// return summary report in markdown format
const getSummaryReport = (options) => {
  const { xmlFile } = options;

  try {
    const xmlFilePath = getPathToFile(xmlFile);

    if (xmlFilePath) {
      const content = getContentFile(xmlFilePath);

      if (content) {
        return toMarkdown(content, options);
      }
    }
  } catch (error) {
    console.log(`Error: on generating summary report`, error);
  }

  return '';
};

// get summary from junitxml
const getSummary = (data) => {
  if (!data || !data.length) {
    return null;
  }

  const parser = new xml2js.Parser();

  const parsed = parser.parseString(data);
  if (!parsed) {
    console.log(`JUnitXml file is not XML or not well formed`);
    return '';
  }

  return parser.resultObject.testsuites.testsuite[0]['$'];
};

// convert summary from junitxml to md
const toMarkdown = (data, options) => {
  const summary = getSummary(data);

  const { errors, failures, skipped, tests, time } = summary;
  const table = `| Tests | Skipped | Failures | Errors | Time |
| ----- | ------- | -------- | -------- | ------------------ |
| ${tests} | ${skipped} :zzz: | ${failures} :x: | ${errors} :fire: | ${time}s :stopwatch: |
`;

  if (options.xmlTitle) {
    return `## ${options.xmlTitle}
${table}`;
  }

  return table;
};

module.exports = { getSummaryReport };
