import { expect, test, describe, beforeEach } from 'vitest';
import * as path from 'path';
import { getCoverageXmlReport } from '../src/parseXml';
import { spyCore } from './setup';
import type { Options } from '../src/types';

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

describe('getCoverageXmlReport', () => {
  beforeEach(() => {
    spyCore.error.mockClear();
    spyCore.warning.mockClear();
    spyCore.info.mockClear();
  });

  test('should return null for empty covXmlFile', () => {
    const result = getCoverageXmlReport(baseOptions);
    expect(result).toBeNull();
  });

  test('should return null for non-existent file', () => {
    const options = { ...baseOptions, covXmlFile: '/nonexistent/coverage.xml' };
    const result = getCoverageXmlReport(options);
    expect(result).toBeNull();
  });

  test('should parse coverage_1.xml successfully', () => {
    const covXmlFile = path.join(dataPath, 'coverage_1.xml');
    const options = { ...baseOptions, covXmlFile };
    const result = getCoverageXmlReport(options);

    expect(result).not.toBeNull();
    expect(result!.html).toContain('img.shields.io/badge');
    expect(result!.coverage).not.toBeNull();
    expect(result!.coverage!.name).toBe('TOTAL');
    expect(result!.coverage!.cover).toContain('%');
    expect(result!.color).toBeTruthy();
  });

  test('should parse coverage_2.xml with branch coverage', () => {
    const covXmlFile = path.join(dataPath, 'coverage_2.xml');
    const options = { ...baseOptions, covXmlFile };
    const result = getCoverageXmlReport(options);

    expect(result).not.toBeNull();
    expect(result!.html).toBeTruthy();
    expect(result!.coverage).not.toBeNull();
  });

  test('should skip covered files when xmlSkipCovered is true', () => {
    const covXmlFile = path.join(dataPath, 'coverage_1.xml');
    const options = { ...baseOptions, covXmlFile, xmlSkipCovered: true };
    const result = getCoverageXmlReport(options);

    expect(result).not.toBeNull();
    // Files with 100% coverage should be excluded from the HTML table
    expect(result!.html).not.toContain('scrubbing.py');
  });

  test('should hide badge when hideBadge is true', () => {
    const covXmlFile = path.join(dataPath, 'coverage_1.xml');
    const options = { ...baseOptions, covXmlFile, hideBadge: true };
    const result = getCoverageXmlReport(options);

    expect(result).not.toBeNull();
    expect(result!.html).not.toContain('img.shields.io/badge');
  });

  test('should hide report when hideReport is true', () => {
    const covXmlFile = path.join(dataPath, 'coverage_1.xml');
    const options = { ...baseOptions, covXmlFile, hideReport: true };
    const result = getCoverageXmlReport(options);

    expect(result).not.toBeNull();
    expect(result!.html).toContain('img.shields.io/badge');
    expect(result!.html).not.toContain('<details>');
  });
});
