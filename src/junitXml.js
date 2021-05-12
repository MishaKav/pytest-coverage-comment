const xml2js = require('xml2js');

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

  return `## ${options.xmlTitle}

| Tests | Skipped | Failures | Errors   | Time               |
| ----- | ------- | -------- | -------- | ------------------ |
| ${tests} | ${skipped} :zzz: | ${failures} :x: | ${errors} :fire: | ${time}s :stopwatch: |`;
};

module.exports = { toMarkdown };
