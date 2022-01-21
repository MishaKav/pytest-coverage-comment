const xml2js = require('xml2js');
const core = require('@actions/core');
const { getPathToFile, getContentFile } = require('./utils');

const getXmlContent = (options) => {
  const { xmlFile } = options;

  try {
    const xmlFilePath = getPathToFile(xmlFile);

    if (xmlFilePath) {
      const content = getContentFile(xmlFilePath);

      return content;
    }
  } catch (error) {
    core.error(`Could not get the xml string successfully.`, error);
  }

  return null;
};

// return parsed xml
const getParsedXml = (options) => {
  const content = getXmlContent(options);

  if (content) {
    return getSummary(content);
  }

  return '';
};

// return summary report in markdown format
const getSummaryReport = (options) => {
  try {
    const parsedXml = getParsedXml(options);

    if (parsedXml) {
      return toMarkdown(parsedXml, options);
    }
  } catch (error) {
    core.error(`Error on generating summary report`, error);
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
    core.warning(`JUnitXml file is not XML or not well formed`);
    return '';
  }

  return parser.resultObject.testsuites.testsuite[0]['$'];
};

const getTestCases = (data) => {
  if (!data || !data.length) {
    return null;
  }

  const parser = new xml2js.Parser();

  const parsed = parser.parseString(data);
  if (!parsed) {
    core.warning(`JUnitXml file is not XML or not well formed`);
    return '';
  }

  return parser.resultObject.testsuites.testsuite[0].testcase;
};

const getNotSuccessTest = (options) => {
  const initData = { count: 0, failures: [], errors: [], skipped: [] };

  try {
    const content = getXmlContent(options);

    if (content) {
      const testCaseToOutput = (testcase) => {
        const { classname, name } = testcase['$'];
        return { classname, name };
      };

      const testcases = getTestCases(content);

      const failures = testcases.filter((t) => t.failure).map(testCaseToOutput);
      const errors = testcases.filter((t) => t.error).map(testCaseToOutput);
      const skipped = testcases.filter((t) => t.skipped).map(testCaseToOutput);

      return {
        failures,
        errors,
        skipped,
        count: failures.length + errors.length + skipped.length,
      };
    }
  } catch (error) {
    core.warning(`Could not get notSuccessTestInfo successfully.`, error);
  }

  return initData;
};

// convert summary from junitxml to md
const toMarkdown = (summary, options) => {
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

module.exports = { getSummaryReport, getParsedXml, getNotSuccessTest };
