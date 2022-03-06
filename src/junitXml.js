const xml2js = require('xml2js');
const core = require('@actions/core');
const { getPathToFile, getContentFile } = require('./utils');

const getXmlContent = (options, pathToXml = 'xmlFile') => {
  const { xmlFile, xmlFileMain } = options;
  const pathToFile = pathToXml === 'xmlFileMain' ? xmlFileMain : xmlFile;

  try {
    const xmlFilePath = getPathToFile(pathToFile);

    if (xmlFilePath) {
      const content = getContentFile(xmlFilePath);

      return content;
    }
  } catch (error) {
    core.error(`Could not get the xml string successfully. ${error.message}`);
  }

  return null;
};

// return parsed xml
const getParsedXml = (options) => {
  const content = getXmlContent(options);
  const contentMain = getXmlContent(options, 'xmlFileMain');

  const parsedXml = content ? getSummary(content) : null;
  const parsedXmlMain = contentMain ? getSummary(contentMain) : null;

  return { parsedXml, parsedXmlMain };
};

// return summary report in markdown format
const getSummaryReport = (options) => {
  try {
    const { parsedXml, parsedXmlMain } = getParsedXml(options);

    if (parsedXml) {
      return toMarkdown(parsedXml, options, parsedXmlMain);
    }
  } catch (error) {
    core.error(`Error on generating summary report. ${error.message}`);
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
    core.warning(
      `Could not get notSuccessTestInfo successfully. ${error.message}`
    );
  }

  return initData;
};

const getDiffValue = (newValue, oldValue) => {
  if (!oldValue || newValue === oldValue) {
    return newValue;
  }

  return `~~${oldValue}~~ **${newValue}**`;
};

// convert parsedXml from junitxml to md
const toMarkdown = (parsedXml, options, parsedXmlMain) => {
  const { errors, failures, skipped, tests, time } = parsedXml;
  const t = getDiffValue(tests, parsedXmlMain?.tests);
  const s = getDiffValue(skipped, parsedXmlMain?.skipped);
  const f = getDiffValue(failures, parsedXmlMain?.failures);
  const e = getDiffValue(errors, parsedXmlMain?.errors);
  const tt = getDiffValue(time, parsedXmlMain?.time);

  const table = `| Tests | Skipped | Failures | Errors | Time |
| ----- | ------- | -------- | -------- | ------------------ |
| ${t} | ${s} :zzz: | ${f} :x: | ${e} :fire: | ${tt}s :stopwatch: |
`;

  if (options.xmlTitle) {
    return `## ${options.xmlTitle}
${table}`;
  }

  return table;
};

module.exports = { getSummaryReport, getParsedXml, getNotSuccessTest };
