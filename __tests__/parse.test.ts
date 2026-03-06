import { expect, test, describe, beforeEach } from 'vitest';
import * as path from 'path';
import { getCoverageReport, toHtml, exportedForTesting } from '../src/parse';
import { getContentFile } from '../src/utils';
import { spyCore } from './setup';
import type { Options } from '../src/types';

const {
  parseOneLine,
  parseTotalLine,
  getActualLines,
  getTotal,
  getWarnings,
  isValidCoverageContent,
  hasBranchCoverage,
  parse,
  toTable,
} = exportedForTesting;

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

describe('isValidCoverageContent', () => {
  test('should return false for empty input', () => {
    expect(isValidCoverageContent('')).toBe(false);
  });

  test('should return true for valid coverage content', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    expect(isValidCoverageContent(content!)).toBe(true);
  });

  test('should return false for content missing keywords', () => {
    expect(isValidCoverageContent('just some text')).toBe(false);
  });
});

describe('hasBranchCoverage', () => {
  test('should return false for empty input', () => {
    expect(hasBranchCoverage('')).toBe(false);
  });

  test('should return false for regular coverage data', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    expect(hasBranchCoverage(content!)).toBe(false);
  });

  test('should return true for branch coverage data', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_11.txt'),
    );
    expect(content).not.toBeNull();
    expect(hasBranchCoverage(content!)).toBe(true);
  });
});

describe('parseOneLine', () => {
  test('should return null for empty input', () => {
    expect(parseOneLine(null)).toBeNull();
  });

  test('should parse a regular line', () => {
    const line =
      'functions/example_completed/example_completed.py                64    19    70%   33, 39-45, 48-51, 55-58, 65-70, 91-92';
    const result = parseOneLine(line);
    expect(result).not.toBeNull();
    expect(result!.name).toBe(
      'functions/example_completed/example_completed.py',
    );
    expect(result!.stmts).toBe('64');
    expect(result!.miss).toBe('19');
    expect(result!.cover).toBe('70%');
    expect(result!.missing).toContain('33');
  });

  test('should parse a line with 100% coverage', () => {
    const line =
      'functions/example.py                                            10     0   100%';
    const result = parseOneLine(line);
    expect(result).not.toBeNull();
    expect(result!.cover).toBe('100%');
    expect(result!.missing).toBeNull();
  });

  test('should return null for lines with too few columns', () => {
    expect(parseOneLine('short line')).toBeNull();
  });
});

describe('parseTotalLine', () => {
  test('should return null for empty input', () => {
    expect(parseTotalLine(null)).toBeNull();
  });

  test('should parse a total line', () => {
    const line =
      'TOTAL                                                        1055    739    30%';
    const result = parseTotalLine(line);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('TOTAL');
    expect(result!.stmts).toBe('1055');
    expect(result!.miss).toBe('739');
    expect(result!.cover).toBe('30%');
  });

  test('should return null for short lines', () => {
    expect(parseTotalLine('TOTAL  10')).toBeNull();
  });
});

describe('getActualLines', () => {
  test('should return null for empty input', () => {
    expect(getActualLines('')).toBeNull();
  });

  test('should extract actual lines from coverage data', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const lines = getActualLines(content!);
    expect(lines).not.toBeNull();
    expect(lines!.length).toBeGreaterThan(0);
  });
});

describe('getTotal', () => {
  test('should return null for empty input', () => {
    expect(getTotal(null)).toBeNull();
  });

  test('should return total from coverage file', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const total = getTotal(content);
    expect(total).not.toBeNull();
    expect(total!.name).toBe('TOTAL');
    expect(total!.cover).toBe('30%');
  });
});

describe('getWarnings', () => {
  test('should return 0 for empty input', () => {
    expect(getWarnings(null)).toBe(0);
  });

  test('should return 0 when no warnings present', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    expect(getWarnings(content)).toBe(0);
  });
});

describe('getCoverageReport', () => {
  beforeEach(() => {
    spyCore.error.mockClear();
    spyCore.info.mockClear();
  });

  test('should return default when covXmlFile is set', () => {
    const options = { ...baseOptions, covXmlFile: 'some.xml' };
    const result = getCoverageReport(options);
    expect(result).toEqual({
      html: '',
      coverage: '0',
      color: 'red',
      warnings: 0,
    });
  });

  test('should return default for empty covFile', () => {
    const result = getCoverageReport(baseOptions);
    expect(result.html).toBe('');
    expect(result.coverage).toBe('0');
    expect(result.color).toBe('red');
  });

  test('should generate report from valid coverage file', () => {
    const covFilePath = path.join(dataPath, 'pytest-coverage_4.txt');
    const options = { ...baseOptions, covFile: covFilePath };
    const result = getCoverageReport(options);
    expect(result.html).toContain('img.shields.io/badge');
    expect(result.coverage).toBe('30%');
    expect(result.color).toBe('red');
    expect(result.warnings).toBe(0);
  });
});

describe('toHtml', () => {
  test('should generate HTML with badge', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const html = toHtml(content, baseOptions);
    expect(html).toContain('img.shields.io/badge');
    expect(html).toContain('Coverage Report');
    expect(html).toContain('<details>');
  });

  test('should hide badge when hideBadge is true', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const options = { ...baseOptions, hideBadge: true };
    const html = toHtml(content, options);
    expect(html).not.toContain('img.shields.io/badge');
    expect(html).toContain('<details>');
  });

  test('should hide report when hideReport is true', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const options = { ...baseOptions, hideReport: true };
    const html = toHtml(content, options);
    expect(html).toContain('img.shields.io/badge');
    expect(html).not.toContain('<details>');
  });

  test('should use text instead of badge when textInsteadBadge is true', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const options = { ...baseOptions, textInsteadBadge: true };
    const html = toHtml(content, options);
    expect(html).not.toContain('img.shields.io/badge');
    expect(html).toContain('30%');
    expect(html).toContain('(');
  });

  test('should remove link from badge when removeLinkFromBadge is true', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const options = {
      ...baseOptions,
      removeLinkFromBadge: true,
      hideReport: true,
    };
    const html = toHtml(content, options);
    expect(html).toContain('<img');
    // Badge itself should not be wrapped in <a> tag
    expect(html).not.toContain('<a href=');
  });

  test('should return empty string for null data', () => {
    const html = toHtml(null, baseOptions);
    expect(html).toBe('');
  });
});

describe('toTable', () => {
  beforeEach(() => {
    spyCore.warning.mockClear();
  });

  test('should generate table from coverage data', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const table = toTable(content, { ...baseOptions });
    expect(table).toContain('<table>');
    expect(table).toContain('TOTAL');
  });

  test('should filter by changed files when reportOnlyChangedFiles is true', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const options = {
      ...baseOptions,
      reportOnlyChangedFiles: true,
      changedFiles: {
        all: ['functions/example_completed/example_completed.py'],
      },
    };
    const table = toTable(content, options);
    expect(table).toContain('example_completed');
    expect(table).not.toContain('resources.py');
  });

  test('should show message when no changed files match', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const options = {
      ...baseOptions,
      reportOnlyChangedFiles: true,
      changedFiles: { all: ['nonexistent.py'] },
    };
    const table = toTable(content, options);
    expect(table).toContain('report-only-changed-files is enabled');
  });

  test('should remove links to files when removeLinksToFiles is true', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const options = {
      ...baseOptions,
      removeLinksToFiles: true,
      removeLinksToLines: true,
    };
    const table = toTable(content, options);
    // With both file and line links removed, no <a href> should exist
    expect(table).not.toContain('<a href=');
  });

  test('should remove links to lines when removeLinksToLines is true', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const options = { ...baseOptions, removeLinksToLines: true };
    const table = toTable(content, options);
    // The table should have missing columns but no links to lines
    if (table && table.includes('Missing')) {
      expect(table).not.toMatch(/<a href="[^"]*#L\d+/);
    }
  });
});

describe('parse', () => {
  test('should return null for invalid data', () => {
    expect(parse('not valid coverage data')).toBeNull();
  });

  test('should parse valid coverage data', () => {
    const content = getContentFile(
      path.join(dataPath, 'pytest-coverage_4.txt'),
    );
    const result = parse(content!);
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    expect(result![0]).toHaveProperty('name');
    expect(result![0]).toHaveProperty('stmts');
    expect(result![0]).toHaveProperty('miss');
    expect(result![0]).toHaveProperty('cover');
  });
});
