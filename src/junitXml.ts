import * as xml2js from 'xml2js';
import * as core from '@actions/core';
import { getContent } from './utils';
import type {
  Options,
  JUnitSummary,
  TestCaseInfo,
  NotSuccessTestInfo,
  ParsedXml,
} from './types';

// return parsed xml
export const getParsedXml = (options: Options): JUnitSummary | null => {
  const content = getContent(options.xmlFile);

  if (content) {
    return getSummary(content);
  }

  return null;
};

// return summary report in markdown format
export const getSummaryReport = (options: Options): string => {
  try {
    const parsedXml = getParsedXml(options);

    if (parsedXml) {
      return toMarkdown(parsedXml, options);
    }
  } catch (error) {
    core.error(`Error generating summary report. ${(error as Error).message}`);
  }

  return '';
};

// get summary from junitxml
const getSummary = (data: string): JUnitSummary | null => {
  if (!data || !data.length) {
    return null;
  }

  const parser = new xml2js.Parser();

  let parseResult: ParsedXml = null;
  parser.parseString(data, (_err: Error | null, result: ParsedXml) => {
    parseResult = result;
  });

  if (!parseResult) {
    core.warning(`JUnitXml file is not XML or not well-formed`);
    return null;
  }

  const summary: JUnitSummary = {
    errors: 0,
    failures: 0,
    skipped: 0,
    tests: 0,
    time: 0,
  };
  for (const testsuite of parseResult.testsuites.testsuite) {
    const { errors, failures, skipped, tests, time } = testsuite['$'];
    summary.errors += +errors;
    summary.failures += +failures;
    summary.skipped += +skipped;
    summary.tests += +tests;
    summary.time += +time;
  }
  return summary;
};

const getTestCases = (data: string): ParsedXml[] | null => {
  if (!data || !data.length) {
    return null;
  }

  const parser = new xml2js.Parser();

  let parseResult: ParsedXml = null;
  parser.parseString(data, (_err: Error | null, result: ParsedXml) => {
    parseResult = result;
  });

  if (!parseResult) {
    core.warning(`JUnitXml file is not XML or not well-formed`);
    return null;
  }

  return parseResult.testsuites.testsuite
    .map((t: ParsedXml) => t.testcase)
    .flat();
};

export const getNotSuccessTest = (options: Options): NotSuccessTestInfo => {
  const initData: NotSuccessTestInfo = {
    count: 0,
    failures: [],
    errors: [],
    skipped: [],
  };

  try {
    const content = getContent(options.xmlFile);

    if (content) {
      const testCaseToOutput = (testcase: ParsedXml): TestCaseInfo => {
        const { classname, name } = testcase['$'];
        return { classname, name };
      };

      const testcases = getTestCases(content);

      if (!testcases) {
        return initData;
      }

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
      `Could not get notSuccessTestInfo successfully. ${(error as Error).message}`,
    );
  }

  return initData;
};

// convert summary from junitxml to md
const toMarkdown = (summary: JUnitSummary, options: Options): string => {
  const { errors, failures, skipped, tests, time } = summary;
  const displayTime =
    time > 60
      ? `${(time / 60) | 0}m ${(time % 60) | 0}s`
      : `${time.toFixed(3)}s`;
  const e = (emoji: string): string => (options.hideEmoji ? '' : ` ${emoji}`);
  const table = `| Tests | Skipped | Failures | Errors | Time |
| ----- | ------- | -------- | -------- | ------------------ |
| ${tests} | ${skipped}${e(':zzz:')} | ${failures}${e(':x:')} | ${errors}${e(':fire:')} | ${displayTime}${e(':stopwatch:')} |
`;

  if (options.xmlTitle) {
    return `## ${options.xmlTitle}\n${table}`;
  }

  return table;
};

export const exportedForTesting = {
  getSummary,
  getTestCases,
  toMarkdown,
};
