import * as xml2js from 'xml2js';
import * as core from '@actions/core';
import { getContent } from './utils';
import type {
  Options,
  JUnitSummary,
  TestCaseInfo,
  NotSuccessTestInfo,
  FailedTest,
  ParsedXml,
} from './types';

const MAX_FAILURE_MESSAGE_LENGTH = 500;
const MAX_FAILURE_MESSAGE_LINES = 15;
const MAX_REASON_LENGTH = 120;
const MAX_TEST_NAME_LENGTH = 255;
export const MAX_FAILED_TESTS = 30;
// guard memory on huge failure outputs, rendering truncates far below this
const MAX_STORED_MESSAGE_LENGTH = 10000;
const ABSOLUTE_PATH_REGEX = /^(\/|[A-Za-z]:\/)/;
// pytest short-form location line, e.g. `tests/test_x.py:25: AssertionError`
const LOCATION_LINE_REGEX = /^(?!E\s|>\s)([^\s].*\.py):(\d+):(?:\s.*)?$/;
// python native traceback frame, e.g. `  File "tests/test_x.py", line 25, in test_x`
const NATIVE_FRAME_REGEX = /^\s*File "([^"]+)", line (\d+)/;
// pytest separator between traceback frames, a long `_ _ _ ...` line
const FRAME_SEPARATOR_REGEX = /^_ [_ ]*_$/;
const TEST_FILE_REGEX =
  /(^|[\\/])test_[^\\/]*\.py$|_test\.py$|(^|[\\/])tests?[\\/]/;
const INSTALLED_PACKAGES_REGEX = /(^|[\\/])(site-packages|dist-packages)[\\/]/;

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
  let errorMessage = '';
  parser.parseString(data, (err: Error | null, result: ParsedXml) => {
    if (err) {
      errorMessage = err.message;
    }
    parseResult = result;
  });

  if (!parseResult) {
    // prettier-ignore
    core.warning(`JUnitXml file is not XML or not well-formed${errorMessage ? `: ${errorMessage}` : ''}`);
    return null;
  }

  if (!parseResult.testsuites?.testsuite) {
    // prettier-ignore
    core.warning('JUnitXml file does not contain expected testsuites structure');
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
  let errorMessage = '';
  parser.parseString(data, (err: Error | null, result: ParsedXml) => {
    if (err) {
      errorMessage = err.message;
    }
    parseResult = result;
  });

  if (!parseResult) {
    // prettier-ignore
    core.warning(`JUnitXml file is not XML or not well-formed${errorMessage ? `: ${errorMessage}` : ''}`);
    return null;
  }

  if (!parseResult.testsuites?.testsuite) {
    // prettier-ignore
    core.warning('JUnitXml file does not contain expected testsuites structure');
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

// escape characters that are unsafe inside generated html
const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// truncate text with ellipsis when it exceeds the given length
const truncateText = (text: string, maxLength: number): string =>
  text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;

// encode url-reserved characters in each path segment, keep `/` separators
const encodePath = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/');

// extract texts from <failure> or <error> node.
// xml2js parses a node without attributes to a plain string,
// otherwise to `{ $: { message }, _: 'body text' }` (both parts optional)
const getNodeTexts = (node: ParsedXml): string[] => {
  // strip leading blank lines only, keeping first-line indentation,
  // so a body holding only an indented traceback keeps its frame shape
  const trimBody = (text?: string): string | undefined => {
    const body = text?.replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd();
    return body?.trim() ? body : undefined;
  };

  if (typeof node === 'string') {
    return [trimBody(node)].filter(Boolean) as string[];
  }

  return [node?.$?.message, trimBody(node?._)].filter(Boolean) as string[];
};

// remove traceback noise from failure text: location lines, native
// traceback frames and pytest frame separators. keeps the source context
// and the `E`/`>` assertion lines, they are the valuable part
const stripTracebackNoise = (text: string): string =>
  text
    .split(/\r?\n/)
    .filter(
      (line) =>
        !LOCATION_LINE_REGEX.test(line) &&
        !NATIVE_FRAME_REGEX.test(line) &&
        !FRAME_SEPARATOR_REGEX.test(line) &&
        line.trim() !== 'Traceback (most recent call last):',
    )
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// extract message from <failure> or <error> node texts, the most
// detailed text after removing traceback noise wins, so a short message
// attribute is preferred over a body holding only the traceback
const getFailureMessage = (texts: string[]): string => {
  const meaningful = texts.map(stripTracebackNoise).filter(Boolean);
  const candidates = meaningful.length ? meaningful : texts;

  return candidates.reduce(
    (longest: string, text: string) =>
      text.length > longest.length ? text : longest,
    '',
  );
};

// note about failed tests that were omitted from the report
export const moreFailedTestsNote = (count: number): string =>
  `_...and ${count} more failed tests_`;

// strip traceback noise from failure message, cap length and number of lines
const formatFailureMessage = (message: string): string => {
  let text = truncateText(
    stripTracebackNoise(message),
    MAX_FAILURE_MESSAGE_LENGTH,
  );

  // a node holding only a traceback strips to nothing, show the trace then
  if (!text) {
    text = truncateText(message.trim(), MAX_FAILURE_MESSAGE_LENGTH);
  }

  const lines = text.split('\n');
  if (lines.length > MAX_FAILURE_MESSAGE_LINES) {
    text = `${lines.slice(0, MAX_FAILURE_MESSAGE_LINES).join('\n')}\n…`;
  }

  return text;
};

// extract short one-line reason from failure message: the first `E` line
// with the prefix stripped (e.g. `assert 200 == 201`), the trailing
// `SomeError: message` line, or the first meaningful line
const extractShortReason = (message: string): string => {
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const eLine = lines.find((line) => /^E\s+\S/.test(line));
  const errorLine = [...lines]
    .reverse()
    .find((line) => /^[A-Za-z_][\w.]*(Error|Exception)\b/.test(line));
  const reason = eLine?.replace(/^E\s+/, '') ?? errorLine ?? lines[0] ?? '';

  return truncateText(reason.replace(/\s+/g, ' '), MAX_REASON_LENGTH);
};

// wrap failure message in a fenced `diff` code block, the fence is
// extended when the message itself contains backtick runs
const messageToDiffBlock = (message: string): string => {
  const backtickRuns = message.match(/`+/g) ?? [];
  const longestRun = Math.max(0, ...backtickRuns.map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));

  return `${fence}diff\n${message}\n${fence}`;
};

// extract test file location from the failure text. pytest junitxml (xunit2)
// has no file/line attributes on <testcase>, so the location comes from the
// traceback: prefer the frame in a test file over app/helper frames
const getTestLocation = (
  rawTexts: string[],
): { file?: string; line?: number } => {
  const frames: { file: string; line: number }[] = [];

  for (const rawText of rawTexts) {
    for (const textLine of rawText.split(/\r?\n/)) {
      const match =
        textLine.match(LOCATION_LINE_REGEX) ??
        textLine.match(NATIVE_FRAME_REGEX);

      if (match && !INSTALLED_PACKAGES_REGEX.test(match[1])) {
        frames.push({ file: match[1], line: Number(match[2]) });
      }
    }
  }

  const testFrame = frames.find((frame) => TEST_FILE_REGEX.test(frame.file));

  // pytest prints frames outermost first, the last one raised the error
  return testFrame ?? frames[frames.length - 1] ?? {};
};

// collect failed and errored testcases with their failure messages
export const getFailedTests = (options: Options): FailedTest[] => {
  try {
    const content = getContent(options.xmlFile);

    if (!content) {
      return [];
    }

    const testcases = getTestCases(content);

    if (!testcases) {
      return [];
    }

    return testcases
      .filter((tc: ParsedXml) => tc && (tc.failure || tc.error))
      .map((tc: ParsedXml) => {
        const nodes = [...(tc.failure ?? []), ...(tc.error ?? [])];
        const nodeTexts = nodes.map(getNodeTexts);

        return {
          classname: tc.$?.classname ?? '',
          name: tc.$?.name ?? '',
          message: nodeTexts
            .map(getFailureMessage)
            .filter(Boolean)
            .join('\n')
            .slice(0, MAX_STORED_MESSAGE_LENGTH),
          ...getTestLocation(nodeTexts.flat()),
        };
      });
  } catch (error) {
    core.warning(`Could not get failed tests. ${(error as Error).message}`);
  }

  return [];
};

// make test name html for the summary line. the classname carries the link
// to the test file (when known), the test name stays plain text
const toTestName = (test: FailedTest, options: Options): string => {
  const { classname, name } = test;
  const hasClassnamePrefix = classname && name.startsWith(classname);
  const mainText = truncateText(classname || name, MAX_TEST_NAME_LENGTH);
  const restText =
    classname && name !== classname
      ? ` › ${escapeHtml(
          truncateText(
            hasClassnamePrefix ? name.slice(classname.length).trim() : name,
            Math.max(0, MAX_TEST_NAME_LENGTH - mainText.length),
          ),
        )}`
      : '';

  const testFile = test.file
    ?.replace(/^file:\/\/\/([A-Za-z]:\/)/, '$1')
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/');
  const isAbsolutePath = testFile ? ABSOLUTE_PATH_REGEX.test(testFile) : false;
  // absolute traceback paths are repo-relative after removing the
  // workspace prefix, `coverage-path-prefix` applies only to relative ones
  const relative =
    testFile && isAbsolutePath && options.prefix
      ? testFile.replace(options.prefix.replace(/\\/g, '/'), '')
      : testFile;
  const cannotResolvePath =
    !relative ||
    (isAbsolutePath && ABSOLUTE_PATH_REGEX.test(relative)) ||
    relative.split('/').includes('..');

  if (
    !options.repoUrl ||
    !options.commit ||
    options.removeLinksToFiles ||
    cannotResolvePath
  ) {
    return `<b>${escapeHtml(mainText)}</b>${restText}`;
  }

  const linkPath = isAbsolutePath
    ? encodePath(relative)
    : `${options.pathPrefix}${encodePath(relative)}`;
  const anchor =
    test.line && !options.removeLinksToLines ? `#L${test.line}` : '';
  const href = escapeHtml(
    `${options.repoUrl}/blob/${options.commit}/${linkPath}${anchor}`,
  ).replace(/"/g, '&quot;');

  return `<a href="${href}">${escapeHtml(mainText)}</a>${restText}`;
};

// convert failed tests to collapsed html block
export const failedTestsToMarkdown = (
  failedTests: FailedTest[],
  options: Options,
  title?: string,
  maxFailedTests: number = options.maxFailedTests ?? MAX_FAILED_TESTS,
): string => {
  if (!options.showFailedTests || !failedTests.length) {
    return '';
  }

  const summaryTitle = title ? `Failed Tests — ${title}` : 'Failed Tests';
  const emoji = options.hideEmoji ? '' : ':x: ';
  const entries = failedTests.slice(0, maxFailedTests).map((test) => {
    const message = formatFailureMessage(test.message);
    // pytest puts the `E` lines at the end of each frame block, so the
    // reason comes from the full message, before the display truncation
    const reason = extractShortReason(
      stripTracebackNoise(test.message) || test.message.trim(),
    );

    return `<details><summary>${toTestName(test, options)} — <code>${escapeHtml(
      reason,
    )}</code></summary>\n\n${messageToDiffBlock(message)}\n\n</details>`;
  });

  if (failedTests.length > maxFailedTests) {
    entries.push(moreFailedTestsNote(failedTests.length - maxFailedTests));
  }

  return `<details><summary>${emoji}${escapeHtml(summaryTitle)} (<b>${
    failedTests.length
  }</b>)</summary>\n\n${entries.join('\n')}\n\n</details>`;
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
  stripTracebackNoise,
  extractShortReason,
  formatFailureMessage,
  getTestLocation,
  toTestName,
};
