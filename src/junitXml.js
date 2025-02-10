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
  summary.notSuccessTestInfo = getNotSuccessTest(data);

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

const getNotSuccessTest = (data) => {
  const initData = { count: 0, failures: [], errors: [], skipped: [] };

  try {

    if (data) {
      const testCaseToOutput = (testcase) => {
        const { classname, name } = testcase['$'];
        const failure = testcase.failure ? testcase.failure[0] : null;
        const error = testcase.error ? testcase.error[0] : null;
        const skipped = testcase.skipped ? testcase.skipped[0] : null;
        const message = failure ? failure['_'] : error ? error['_'] : skipped ? skipped['_'] : null;

        return { classname, name, failure, error, skipped, message };
      };

      const testcases = getTestCases(data);

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

  // Summary table
  const table = `| Tests | Skipped | Failures | Errors | Time |
| ----- | ------- | -------- | -------- | ------------------ |
| ${tests} | ${skipped} :zzz: | ${failures} :x: | ${errors} :fire: | ${displayTime} :stopwatch: |
`;

  // Combine and sort all non-success tests
  const allNonSuccessTests = [
    ...summary.notSuccessTestInfo.failures.map(f => ({ ...f, type: ':x: Failure' })),
    ...summary.notSuccessTestInfo.errors.map(e => ({ ...e, type: ':fire: Error' })),
    ...summary.notSuccessTestInfo.skipped.map(s => ({ ...s, type: ':zzz: Skipped' }))
  ];

  // Detailed non-success tests section
  let nonSuccessDetails = '';
  if (allNonSuccessTests.length > 0) {
    const detailedTestsList = allNonSuccessTests.map(test => 
      `- ${test.type} **${test.name}** (${test.classname})
  \`${test.message ? test.message.replace(/\n/g, ' ').replace(/\|/g, '\\|') : 'No message'}\``
    ).join('\n');

    nonSuccessDetails = `
<details>
<summary>:warning: Detailed Non-Success Tests (${allNonSuccessTests.length})</summary>

${detailedTestsList}
</details>
`;
  }

  // Combine sections
  let output = table + nonSuccessDetails;

  if (options.xmlTitle) {
    output = `## ${options.xmlTitle}\n${output}`;
  }

  return output;
};

module.exports = { getSummaryReport, getParsedXml };
