import { expect, test, describe, beforeEach } from 'vitest';
import * as path from 'path';
import { getMultipleReport, exportedForTesting } from '../src/multiFiles';
import { spyCore } from './setup';
import type { Options } from '../src/types';

const { parseLine } = exportedForTesting;

const dataPath = path.resolve(__dirname, '..', 'data');
const abs = (p: string): string => path.resolve(dataPath, p);

const baseOptions: Options = {
  token: 'token_123',
  repository: 'MishaKav/pytest-coverage-comment',
  commit: 'main',
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
  removeLinkFromBadge: true,
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

describe('parseLine', () => {
  test('should return null for empty input', () => {
    expect(parseLine('')).toBeNull();
  });

  test('should return null for line without comma', () => {
    expect(parseLine('just a title')).toBeNull();
  });

  test('should parse a line with title and covFile', () => {
    const result = parseLine('My Title, coverage.txt');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('My Title');
    expect(result!.covFile).toBe('coverage.txt');
    expect(result!.xmlFile).toBe('');
  });

  test('should parse a line with title, covFile, and xmlFile', () => {
    const result = parseLine('My Title, coverage.txt, pytest.xml');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('My Title');
    expect(result!.covFile).toBe('coverage.txt');
    expect(result!.xmlFile).toBe('pytest.xml');
  });
});

describe('getMultipleReport', () => {
  beforeEach(() => {
    spyCore.error.mockClear();
    spyCore.info.mockClear();
    spyCore.startGroup.mockClear();
    spyCore.endGroup.mockClear();
    spyCore.setOutput.mockClear();
  });

  test('should return table header for empty multipleFiles', () => {
    const options = { ...baseOptions, multipleFiles: [] };
    const result = getMultipleReport(options);
    // Even with no files, the function returns the mini table header
    expect(result).toContain('| Title | Coverage |');
  });

  test('should generate report with TXT coverage files', () => {
    const options = {
      ...baseOptions,
      multipleFiles: [
        `TXT Title, ${abs('pytest-coverage_4.txt')}`,
      ],
    };
    const result = getMultipleReport(options);
    expect(result).toContain('| Title | Coverage |');
    expect(result).toContain('TXT Title');
    expect(result).toContain('img.shields.io/badge');
  });

  test('should generate report with mixed TXT and XML coverage', () => {
    const options = {
      ...baseOptions,
      multipleFiles: [
        `TXT Title, ${abs('pytest-coverage_4.txt')}, ${abs('pytest_1.xml')}`,
        `XML Title, ${abs('coverage_1.xml')}, ${abs('pytest_1.xml')}`,
      ],
    };
    const result = getMultipleReport(options);

    expect(result).toContain('| Title | Coverage | Tests | Skipped | Failures | Errors | Time |');
    expect(result).toContain('TXT Title');
    expect(result).toContain('XML Title');
    expect(result).toContain('img.shields.io/badge');
  });

  test('should include JUnit data when xmlFile is provided', () => {
    const options = {
      ...baseOptions,
      multipleFiles: [
        `My Title, ${abs('pytest-coverage_4.txt')}, ${abs('pytest_1.xml')}`,
      ],
    };
    const result = getMultipleReport(options);
    expect(result).toContain(':zzz:');
    expect(result).toContain(':x:');
    expect(result).toContain(':fire:');
    expect(result).toContain(':stopwatch:');
  });

  test('should hide emojis when hideEmoji is true', () => {
    const options = {
      ...baseOptions,
      hideEmoji: true,
      multipleFiles: [
        `My Title, ${abs('pytest-coverage_4.txt')}, ${abs('pytest_1.xml')}`,
      ],
    };
    const result = getMultipleReport(options);
    expect(result).not.toContain(':zzz:');
    expect(result).not.toContain(':x:');
    expect(result).not.toContain(':fire:');
    expect(result).not.toContain(':stopwatch:');
  });

  test('should set outputs for first file', () => {
    const options = {
      ...baseOptions,
      multipleFiles: [
        `First, ${abs('pytest-coverage_4.txt')}, ${abs('pytest_1.xml')}`,
        `Second, ${abs('pytest-coverage_4.txt')}, ${abs('pytest_1.xml')}`,
      ],
    };
    getMultipleReport(options);
    expect(spyCore.setOutput).toHaveBeenCalledWith('coverage', expect.anything());
    expect(spyCore.setOutput).toHaveBeenCalledWith('color', expect.anything());
  });
});

describe('getMultipleReport with show-failed-tests', () => {
  const line = (title: string): string =>
    `${title}, ${abs('pytest-coverage_4.txt')}, ${abs('pytest_failures.xml')}`;
  const options: Options = {
    ...baseOptions,
    showFailedTests: true,
    multipleFiles: [line('Backend'), line('Frontend')],
  };

  test('should not add failed tests blocks when disabled', () => {
    const result = getMultipleReport({ ...options, showFailedTests: false });
    expect(result).not.toContain('Failed Tests');
  });

  test('should add a titled block for every file with failures', () => {
    const result = getMultipleReport(options);

    expect(result).toContain(
      '<summary>:x: Failed Tests — Backend (<b>8</b>)</summary>',
    );
    expect(result).toContain(
      '<summary>:x: Failed Tests — Frontend (<b>8</b>)</summary>',
    );
    expect(result).toContain('test_wrong_title');
  });

  test('should share the budget across files and truncate inside a block', () => {
    // first file consumes 8 of 10, second renders 2 and notes the rest
    const result = getMultipleReport(options, 10);

    const backendBlock = result.indexOf('Failed Tests — Backend');
    const frontendBlock = result.indexOf('Failed Tests — Frontend');
    expect(backendBlock).toBeGreaterThan(-1);
    expect(frontendBlock).toBeGreaterThan(backendBlock);
    expect(result).toContain('_...and 6 more failed tests_');
  });

  test('should note fully omitted files after the budget is exhausted', () => {
    const result = getMultipleReport(
      { ...options, multipleFiles: [line('A'), line('B'), line('C')] },
      10,
    );

    expect(result).toContain('Failed Tests — A');
    expect(result).toContain('Failed Tests — B');
    expect(result).not.toContain('Failed Tests — C');
    // 6 truncated inside block B and all 8 of file C are omitted
    expect(result).toContain('_...and 6 more failed tests_');
    expect(result).toContain('_...and 8 more failed tests_');
  });
});
