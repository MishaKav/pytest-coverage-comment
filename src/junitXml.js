const xml2js = require('xml2js');
const core = require('@actions/core');
const { getContent } = require('./utils');

// return parsed xml
const getParsedXml = (options) => {
  const content = getContent(options.xmlFile);

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
    core.error(`Error generating summary report. ${error.message}`);
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
    core.warning(`JUnitXml file is not XML or not well-formed`);
    return '';
  }

  const summary = { errors: 0, failures: 0, skipped: 0, tests: 0, time: 0 };
  for (const testsuite of parser.resultObject.testsuites.testsuite) {
    const { errors, failures, skipped, tests, time } = testsuite['$'];
    summary.errors += +errors;
    summary.failures += +failures;
    summary.skipped += +skipped;
    summary.tests += +tests;
    summary.time += +time;
  }
  return summary;
};

const getTestCases = (data) => {
  if (!data || !data.length) {
    return null;
  }

  const parser = new xml2js.Parser();

  const parsed = parser.parseString(data);
  if (!parsed) {
    core.warning(`JUnitXml file is not XML or not well-formed`);
    return '';
  }

  return parser.resultObject.testsuites.testsuite.map((t) => t.testcase).flat();
};

const getNotSuccessTest = (options) => {
  const initData = { count: 0, failures: [], errors: [], skipped: [] };

  try {
    const content = getContent(options.xmlFile);

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
      `Could not get notSuccessTestInfo successfully. ${error.message}`,
    );
  }

  return initData;
};

// convert summary from junitxml to md
const toMarkdown = (summary, options) => {
  const { errors, failures, skipped, tests, time } = summary;
  const displayTime =
    time > 60 ? `${(time / 60) | 0}m ${time % 60 | 0}s` : `${time.toFixed(3)}s`;
  const table = `| Tests | Skipped | Failures | Errors | Time |
| ----- | ------- | -------- | -------- | ------------------ |
| ${tests} | ${skipped} :zzz: | ${failures} :x: | ${errors} :fire: | ${displayTime} :stopwatch: |
`;

  if (options.xmlTitle) {
    return `## ${options.xmlTitle}
${table}`;
  }

  return table;
};

module.exports = { getSummaryReport, getParsedXml, getNotSuccessTest };
