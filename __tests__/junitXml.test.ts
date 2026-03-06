import { expect, test, describe, beforeEach } from 'vitest';
import * as path from 'path';
import {
  getSummaryReport,
  getParsedXml,
  getNotSuccessTest,
  exportedForTesting,
} from '../src/junitXml';
import { spyCore } from './setup';
import type { Options, JUnitSummary } from '../src/types';

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
