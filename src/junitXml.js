const xml2js = require('xml2js');
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
    console.log(`Error: Could not get the xml string successfully.`, error);
  }

  return null;
}

// return parsed xml
const getParsedXml = (options) => {
  content = getXmlContent(options);

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

  console.log('testsuites: ' + parser.resultObject.testsuites);

  return parser.resultObject.testsuites.testsuite[0]['$'];
};

const getNotSuccessTest = (options) => {

  let count = 0;
  let failures = [];
  let errors = [];
  let skipped = [];

  data = getXmlContent(options);

  if (!data || !data.length) {
    return {
      count,
      failures,
      errors,
      skipped,
    }
  }

  const parser = new xml2js.Parser();

  const parsed = parser.parseString(data);
  if (!parsed) {
    console.log(`JUnitXml file is not XML or not well formed`);

    return {
      count,
      failures,
      errors,
      skipped,
    }
  }

  testsuite = parser.resultObject.testsuites.testsuite[0];

  for (testcase of testsuite.testcase) {
    if ('failure' in testcase) {
      failures.push({
        'classname': testcase['$'].classname,
        'name': testcase['$'].name
      });
      count++;
    } else if ('error' in testcase) {
      errors.push({
        'classname': testcase['$'].classname,
        'name': testcase['$'].name
      });
      count++;
    } else if ('skipped' in testcase) {
      skipped.push({
        'classname': testcase['$'].classname,
        'name': testcase['$'].name
      });
      count++;
    }
  }

  return {
    count,
    failures,
    errors,
    skipped,
  }
}

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
