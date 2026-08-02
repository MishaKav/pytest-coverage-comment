import { expect, test, describe, beforeEach } from 'vitest';
import * as path from 'path';
import {
  getSummaryReport,
  getParsedXml,
  getNotSuccessTest,
  getFailedTests,
  failedTestsToMarkdown,
  moreFailedTestsNote,
  exportedForTesting,
} from '../src/junitXml';
import { spyCore } from './setup';
import type { Options, JUnitSummary, FailedTest } from '../src/types';

const { toMarkdown } = exportedForTesting;

const dataPath = path.resolve(__dirname, '..', 'data');

const baseOptions: Options = {
  token: 'token_123',
  repository: 'MishaKav/pytest-coverage-comment',
  commit: 'abc123',
  prefix: '',
  pathPrefix: '',
  covFile: '',
  covXmlFile: '',
  covJsonFile: '',
  xmlFile: '',
  title: 'Coverage Report',
  badgeTitle: 'Coverage',
  hideBadge: false,
  hideReport: false,
  createNewComment: false,
  hideComment: false,
  hideEmoji: false,
  xmlSkipCovered: false,
  reportOnlyChangedFiles: false,
  removeLinkFromBadge: false,
  removeLinksToFiles: false,
  removeLinksToLines: false,
  textInsteadBadge: false,
  defaultBranch: 'main',
  xmlTitle: '',
  showFailedTests: false,
  maxFailedTests: 30,
  multipleFiles: [],
  repoUrl: 'https://github.com/MishaKav/pytest-coverage-comment',
};

describe('getParsedXml', () => {
  beforeEach(() => {
    spyCore.error.mockClear();
    spyCore.warning.mockClear();
  });

  test('should return null for empty xmlFile', () => {
    const result = getParsedXml(baseOptions);
    expect(result).toBeNull();
  });

  test('should return null for non-existent file', () => {
    const options = { ...baseOptions, xmlFile: '/nonexistent/pytest.xml' };
    const result = getParsedXml(options);
    expect(result).toBeNull();
  });

  test('should parse pytest_1.xml successfully', () => {
    const xmlFile = path.join(dataPath, 'pytest_1.xml');
    const options = { ...baseOptions, xmlFile };
    const result = getParsedXml(options);

    expect(result).not.toBeNull();
    expect(result!.tests).toBe(109);
    expect(result!.failures).toBe(1);
    expect(result!.errors).toBe(0);
    expect(result!.skipped).toBe(2);
    expect(result!.time).toBeCloseTo(0.583, 2);
  });

  test('should parse pytest_2.xml successfully', () => {
    const xmlFile = path.join(dataPath, 'pytest_2.xml');
    const options = { ...baseOptions, xmlFile };
    const result = getParsedXml(options);

    expect(result).not.toBeNull();
    expect(result!.tests).toBeGreaterThan(0);
  });
});

describe('getSummaryReport', () => {
  beforeEach(() => {
    spyCore.error.mockClear();
  });

  test('should return empty string for empty xmlFile', () => {
    const result = getSummaryReport(baseOptions);
    expect(result).toBe('');
  });

  test('should generate markdown table from pytest_1.xml', () => {
    const xmlFile = path.join(dataPath, 'pytest_1.xml');
    const options = { ...baseOptions, xmlFile };
    const result = getSummaryReport(options);

    expect(result).toContain('| Tests | Skipped | Failures | Errors | Time |');
    expect(result).toContain('109');
    expect(result).toContain(':zzz:');
    expect(result).toContain(':x:');
    expect(result).toContain(':fire:');
    expect(result).toContain(':stopwatch:');
  });

  test('should include title when xmlTitle is set', () => {
    const xmlFile = path.join(dataPath, 'pytest_1.xml');
    const options = { ...baseOptions, xmlFile, xmlTitle: 'Test Results' };
    const result = getSummaryReport(options);

    expect(result).toContain('## Test Results');
  });

  test('should hide emojis when hideEmoji is true', () => {
    const xmlFile = path.join(dataPath, 'pytest_1.xml');
    const options = { ...baseOptions, xmlFile, hideEmoji: true };
    const result = getSummaryReport(options);

    expect(result).not.toContain(':zzz:');
    expect(result).not.toContain(':x:');
    expect(result).not.toContain(':fire:');
    expect(result).not.toContain(':stopwatch:');
  });
});

describe('toMarkdown', () => {
  test('should format time < 60s with 3 decimal places', () => {
    const summary: JUnitSummary = {
      errors: 0,
      failures: 0,
      skipped: 0,
      tests: 10,
      time: 5.123,
    };
    const result = toMarkdown(summary, baseOptions);
    expect(result).toContain('5.123s');
  });

  test('should format time > 60s as minutes and seconds', () => {
    const summary: JUnitSummary = {
      errors: 0,
      failures: 0,
      skipped: 0,
      tests: 10,
      time: 125,
    };
    const result = toMarkdown(summary, baseOptions);
    expect(result).toContain('2m 5s');
  });
});

describe('getNotSuccessTest', () => {
  beforeEach(() => {
    spyCore.warning.mockClear();
  });

  test('should return empty result for empty xmlFile', () => {
    const result = getNotSuccessTest(baseOptions);
    expect(result.count).toBe(0);
    expect(result.failures).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  test('should detect failures and skipped from pytest_1.xml', () => {
    const xmlFile = path.join(dataPath, 'pytest_1.xml');
    const options = { ...baseOptions, xmlFile };
    const result = getNotSuccessTest(options);

    expect(result.failures.length).toBe(1);
    expect(result.skipped.length).toBe(2);
    expect(result.errors.length).toBe(0);
    expect(result.count).toBe(3);
    expect(result.failures[0]).toHaveProperty('classname');
    expect(result.failures[0]).toHaveProperty('name');
  });

  test('should return empty result for non-existent file', () => {
    const options = { ...baseOptions, xmlFile: '/nonexistent/pytest.xml' };
    const result = getNotSuccessTest(options);
    expect(result.count).toBe(0);
  });
});

describe('getFailedTests', () => {
  const xmlFile = path.join(dataPath, 'pytest_failures.xml');
  const options = { ...baseOptions, xmlFile, showFailedTests: true };

  test('should return empty array for empty or missing xmlFile', () => {
    expect(getFailedTests(baseOptions)).toEqual([]);
    expect(
      getFailedTests({ ...baseOptions, xmlFile: '/nonexistent/pytest.xml' }),
    ).toEqual([]);
  });

  test('should collect failed and errored testcases only', () => {
    const failedTests = getFailedTests(options);

    expect(failedTests).toHaveLength(8);
    expect(failedTests.map((t) => t.name)).toEqual([
      'test_uses_broken_fixture',
      'test_wrong_title',
      'test_dict_diff',
      'test_type_error',
      'test_helper_failure',
      'test_status_code',
      "test_escaping[<b>bold</b> & 'quoted']",
      'test_backticks',
    ]);
    // passed and skipped testcases are not collected
    expect(failedTests.map((t) => t.name)).not.toContain('test_get_post_ok');
    expect(failedTests.map((t) => t.name)).not.toContain(
      'test_not_implemented',
    );
    expect(failedTests[5].classname).toBe(
      'tests.test_service.TestPostService',
    );
  });

  test('should keep assertion lines and strip location lines from message', () => {
    const failedTests = getFailedTests(options);
    const wrongTitle = failedTests.find((t) => t.name === 'test_wrong_title');

    expect(wrongTitle!.message).toContain(
      "E       AssertionError: assert 'first post' == 'my first post'",
    );
    expect(wrongTitle!.message).toContain('>       assert post["title"]');
    expect(wrongTitle!.message).not.toContain('tests/test_service.py:12:');
  });

  test('should extract location from pytest short-form traceback', () => {
    const failedTests = getFailedTests(options);
    const wrongTitle = failedTests.find((t) => t.name === 'test_wrong_title');

    expect(wrongTitle!.file).toBe('tests/test_service.py');
    expect(wrongTitle!.line).toBe(12);

    const fixtureError = failedTests.find(
      (t) => t.name === 'test_uses_broken_fixture',
    );
    expect(fixtureError!.file).toBe('tests/test_fixture_error.py');
    expect(fixtureError!.line).toBe(6);
  });

  test('should prefer test-file frame over app/helper frames', () => {
    const failedTests = getFailedTests(options);
    // the raising frame is post_service.py:19, the test frame must win
    const helperFailure = failedTests.find(
      (t) => t.name === 'test_helper_failure',
    );

    expect(helperFailure!.file).toBe('tests/test_service.py');
    expect(helperFailure!.line).toBe(25);
  });

  test('should extract location from native traceback and skip site-packages', () => {
    const { getTestLocation } = exportedForTesting;

    const native = getTestLocation([
      'Traceback (most recent call last):\n' +
        '  File "/usr/lib/python3.11/site-packages/requests/api.py", line 59, in get\n' +
        '    return request("get", url)\n' +
        '  File "/home/runner/work/repo/repo/tests/test_api.py", line 14, in test_get\n' +
        '    response = fetch()\n' +
        'ConnectionError: connection refused',
    ]);
    expect(native).toEqual({
      file: '/home/runner/work/repo/repo/tests/test_api.py',
      line: 14,
    });

    // with several test-file frames the innermost (last) one wins
    const nestedTestFrames = getTestLocation([
      'tests/test_api.py:14: in test_get\ntests/helpers.py:30: AssertionError',
    ]);
    expect(nestedTestFrames).toEqual({ file: 'tests/helpers.py', line: 30 });

    // without a test-file frame the last (raising) frame wins
    const helperOnly = getTestLocation([
      'app/service.py:10: in create\napp/db.py:25: RuntimeError',
    ]);
    expect(helperOnly).toEqual({ file: 'app/db.py', line: 25 });

    expect(getTestLocation(['no location here'])).toEqual({});
  });

  test('should take message attribute when node has no body', () => {
    const { getSummary } = exportedForTesting;
    // keep the parser warm-up out of the assertion path
    expect(getSummary('')).toBeNull();

    const failedTests = getFailedTests({
      ...options,
      xmlFile: path.join(dataPath, 'pytest_1.xml'),
    });
    expect(failedTests).toHaveLength(1);
    expect(failedTests[0].message).toBeTruthy();
  });
});

describe('failedTestsToMarkdown', () => {
  const options = { ...baseOptions, showFailedTests: true };
  const failedTest: FailedTest = {
    classname: 'tests.test_service',
    name: 'test_one',
    message: 'E       assert 200 == 201',
  };

  test('should return empty string when disabled or no failures', () => {
    expect(failedTestsToMarkdown([], options)).toBe('');
    expect(failedTestsToMarkdown([failedTest], baseOptions)).toBe('');
  });

  test('should render collapsed section with failed tests', () => {
    const html = failedTestsToMarkdown(
      [failedTest],
      { ...options, repoUrl: '', commit: '' },
    );

    expect(html).toBe(
      '<details><summary>:x: Failed Tests (<b>1</b>)</summary>\n\n' +
        '<details><summary><b>tests.test_service</b> › test_one — <code>assert 200 == 201</code></summary>\n\n' +
        '```diff\nE       assert 200 == 201\n```\n\n</details>\n\n' +
        '</details>',
    );
  });

  test('should render title for multiple files mode and honor hide-emoji', () => {
    expect(
      failedTestsToMarkdown([failedTest], options, 'Backend'),
    ).toContain('<summary>:x: Failed Tests — Backend (<b>1</b>)</summary>');

    expect(
      failedTestsToMarkdown([failedTest], { ...options, hideEmoji: true }),
    ).toContain('<summary>Failed Tests (<b>1</b>)</summary>');
  });

  test('should link classname to the test file from traceback location', () => {
    const html = failedTestsToMarkdown(
      [{ ...failedTest, file: 'tests/test_service.py', line: 25 }],
      options,
    );

    expect(html).toContain(
      '<a href="https://github.com/MishaKav/pytest-coverage-comment/blob/abc123/tests/test_service.py#L25">tests.test_service</a> › test_one',
    );
  });

  test('should strip workspace prefix from absolute paths without applying pathPrefix', () => {
    const html = failedTestsToMarkdown(
      [
        {
          ...failedTest,
          file: '/home/runner/work/repo/repo/tests/test_service.py',
          line: 25,
        },
      ],
      {
        ...options,
        prefix: '/home/runner/work/repo/repo/',
        pathPrefix: 'src/',
      },
    );

    expect(html).toContain('/blob/abc123/tests/test_service.py#L25">');
  });

  test('should apply pathPrefix to relative paths', () => {
    const html = failedTestsToMarkdown(
      [{ ...failedTest, file: 'tests/test_service.py', line: 25 }],
      { ...options, pathPrefix: 'backend/' },
    );

    expect(html).toContain('/blob/abc123/backend/tests/test_service.py#L25">');
  });

  test('should url-encode path segments and normalize windows and file uri paths', () => {
    const encoded = failedTestsToMarkdown(
      [{ ...failedTest, file: 'tests/a#b/test_service.py', line: 5 }],
      options,
    );
    expect(encoded).toContain('/blob/abc123/tests/a%23b/test_service.py#L5">');

    const windows = failedTestsToMarkdown(
      [{ ...failedTest, file: 'tests\\test_service.py', line: 5 }],
      options,
    );
    expect(windows).toContain('/blob/abc123/tests/test_service.py#L5">');

    const fileUri = failedTestsToMarkdown(
      [
        {
          ...failedTest,
          file: 'file:///home/runner/work/repo/repo/tests/test_service.py',
          line: 5,
        },
      ],
      { ...options, prefix: '/home/runner/work/repo/repo/' },
    );
    expect(fileUri).toContain('/blob/abc123/tests/test_service.py#L5">');
  });

  test('should not link when path cannot be resolved', () => {
    const unresolvable = [
      '/other/place/test_service.py', // absolute path outside the workspace prefix
      '../outside/test_service.py', // escapes the repository root
      undefined, // no location extracted
    ];

    for (const file of unresolvable) {
      const html = failedTestsToMarkdown(
        [{ ...failedTest, file, line: 25 }],
        { ...options, prefix: '/home/runner/work/repo/repo/' },
      );
      expect(html).toContain('<b>tests.test_service</b> › test_one');
      expect(html).not.toContain('<a href');
    }

    const noRepo = failedTestsToMarkdown(
      [{ ...failedTest, file: 'tests/test_service.py', line: 25 }],
      { ...options, repoUrl: '' },
    );
    expect(noRepo).not.toContain('<a href');
  });

  test('should honor remove-links-to-files and remove-links-to-lines', () => {
    const noFiles = failedTestsToMarkdown(
      [{ ...failedTest, file: 'tests/test_service.py', line: 25 }],
      { ...options, removeLinksToFiles: true },
    );
    expect(noFiles).not.toContain('<a href');

    const noLines = failedTestsToMarkdown(
      [{ ...failedTest, file: 'tests/test_service.py', line: 25 }],
      { ...options, removeLinksToLines: true },
    );
    expect(noLines).toContain('/blob/abc123/tests/test_service.py">');
    expect(noLines).not.toContain('#L25');
  });

  test('should escape html in test names, reason and href', () => {
    const html = failedTestsToMarkdown(
      [
        {
          classname: '',
          name: 'test <b>one</b> & two',
          message: 'E       assert "<a>" == "&"',
        },
      ],
      { ...options, repoUrl: '', commit: '' },
    );

    expect(html).toContain(
      '<summary><b>test &lt;b&gt;one&lt;/b&gt; &amp; two</b> — <code>assert "&lt;a&gt;" == "&amp;"</code></summary>',
    );
    expect(html).toContain('```diff\nE       assert "<a>" == "&"\n```');

    const href = failedTestsToMarkdown(
      [{ ...failedTest, file: 'tests/a&b/test_service.py', line: 5 }],
      options,
    );
    expect(href).toContain('tests/a%26b/test_service.py#L5">');
  });

  test('should extract short reason from first E line, error line or first line', () => {
    const fromELine = failedTestsToMarkdown(
      [
        {
          ...failedTest,
          message:
            'def test_wrong_title():\n>       assert post["title"] == "my first post"\nE       AssertionError: assert \'first post\' == \'my first post\'\nE         - my first post\nE         + first post',
        },
      ],
      { ...options, repoUrl: '' },
    );
    expect(fromELine).toContain(
      "<code>AssertionError: assert 'first post' == 'my first post'</code>",
    );

    const fromErrorLine = failedTestsToMarkdown(
      [{ ...failedTest, message: 'some context\nRuntimeError: database is unreachable' }],
      { ...options, repoUrl: '' },
    );
    expect(fromErrorLine).toContain(
      '<code>RuntimeError: database is unreachable</code>',
    );

    const fromFirstLine = failedTestsToMarkdown(
      [{ ...failedTest, message: 'Failed: Timeout >3.0s' }],
      { ...options, repoUrl: '' },
    );
    expect(fromFirstLine).toContain('<code>Failed: Timeout &gt;3.0s</code>');
  });

  test('should extract reason from E line beyond the display truncation', () => {
    // pytest puts E lines at the end of a frame block, a long body must
    // not lose the reason to the message truncation
    const contextLines = Array.from(
      { length: 20 },
      (_, i) => `    context line ${i + 1}`,
    ).join('\n');
    const html = failedTestsToMarkdown(
      [
        {
          ...failedTest,
          message: `def test_fetch_latest_post_times_out():\n${contextLines}\nE       TimeoutError: posts API did not respond within 0.03s`,
        },
      ],
      { ...options, repoUrl: '' },
    );

    expect(html).toContain(
      '<code>TimeoutError: posts API did not respond within 0.03s</code>',
    );
    // the body itself is still truncated
    expect(html).toContain('context line 14\n…');
  });

  test('should extend fence when message contains backtick runs', () => {
    const html = failedTestsToMarkdown(
      [{ ...failedTest, message: 'some\n```\ncode\n```' }],
      { ...options, repoUrl: '' },
    );

    expect(html).toContain('````diff\nsome\n```\ncode\n```\n````');
  });

  test('should show the traceback when nothing else is left after stripping', () => {
    const html = failedTestsToMarkdown(
      [{ ...failedTest, message: 'tests/test_service.py:25: AssertionError' }],
      { ...options, repoUrl: '' },
    );

    expect(html).toContain('tests/test_service.py:25: AssertionError');
    expect(html).not.toContain('```diff\n\n```');
  });

  test('should truncate long messages, reasons and test names', () => {
    const longMessage = failedTestsToMarkdown(
      [{ ...failedTest, message: 'a'.repeat(600) }],
      { ...options, repoUrl: '' },
    );
    expect(longMessage).toContain(`\`\`\`diff\n${'a'.repeat(500)}…\n\`\`\``);
    expect(longMessage).not.toContain('a'.repeat(501));

    const message = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join(
      '\n',
    );
    const manyLines = failedTestsToMarkdown(
      [{ ...failedTest, message }],
      { ...options, repoUrl: '' },
    );
    expect(manyLines).toContain('line 15\n…');
    expect(manyLines).not.toContain('line 16');

    const longName = failedTestsToMarkdown(
      [{ ...failedTest, classname: '', name: 'a'.repeat(400) }],
      { ...options, repoUrl: '' },
    );
    expect(longName).toContain(`<b>${'a'.repeat(255)}…</b>`);
    expect(longName).not.toContain('a'.repeat(256));
  });

  test('should cap number of rendered failed tests', () => {
    const failedTests: FailedTest[] = Array.from({ length: 35 }, (_, i) => ({
      ...failedTest,
      name: `test_number_${i + 1}_of_many`,
    }));

    const html = failedTestsToMarkdown(failedTests, options);
    expect(html).toContain(':x: Failed Tests (<b>35</b>)');
    expect(html).toContain('test_number_30_of_many');
    expect(html).not.toContain('test_number_31_of_many');
    expect(html).toContain(moreFailedTestsNote(5));

    const htmlWithMax = failedTestsToMarkdown(failedTests, {
      ...options,
      maxFailedTests: 10,
    });
    expect(htmlWithMax).toContain('test_number_10_of_many');
    expect(htmlWithMax).not.toContain('test_number_11_of_many');
    expect(htmlWithMax).toContain(moreFailedTestsNote(25));
  });

  test('should render real pytest fixture end to end', () => {
    const xmlFile = path.join(dataPath, 'pytest_failures.xml');
    const failedTests = getFailedTests({ ...options, xmlFile });
    const html = failedTestsToMarkdown(failedTests, options);

    expect(html).toContain(':x: Failed Tests (<b>8</b>)');
    expect(html).toContain(
      '<a href="https://github.com/MishaKav/pytest-coverage-comment/blob/abc123/tests/test_service.py#L12">tests.test_service</a> › test_wrong_title',
    );
    expect(html).toContain(
      "<code>AssertionError: assert 'first post' == 'my first post'</code>",
    );
    // parametrized test name with html-unsafe characters is escaped
    expect(html).toContain(
      "test_escaping[&lt;b&gt;bold&lt;/b&gt; &amp; 'quoted']",
    );
    // backtick runs in the failure output extend the fence
    expect(html).toContain('````diff\ndef test_backticks():');
  });
});
