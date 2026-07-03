import { expect, test, describe, beforeEach } from 'vitest';
import * as path from 'path';
import { getCoverageJsonReport } from '../src/parseJson';
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

describe('getCoverageJsonReport', () => {
  beforeEach(() => {
    spyCore.error.mockClear();
    spyCore.warning.mockClear();
    spyCore.info.mockClear();
  });

  test('should return null for empty covJsonFile', () => {
    const result = getCoverageJsonReport(baseOptions);
    expect(result).toBeNull();
  });

  test('should return null for non-existent file', () => {
    const options = { ...baseOptions, covJsonFile: '/nonexistent/coverage.json' };
    const result = getCoverageJsonReport(options);
    expect(result).toBeNull();
  });

  test('should parse coverage_4.json successfully', () => {
    const covJsonFile = path.join(dataPath, 'coverage_4.json');
    const options = { ...baseOptions, covJsonFile };
    const result = getCoverageJsonReport(options);

    expect(result).not.toBeNull();
    expect(result!.html).toContain('img.shields.io/badge');
    expect(result!.coverage).not.toBeNull();
    expect(result!.coverage!.name).toBe('TOTAL');
    expect(result!.coverage!.cover).toBe('71%');
    expect(result!.color).toBe('yellow');
  });

  test('should show partial branches as arrows in the missing column', () => {
    const covJsonFile = path.join(dataPath, 'coverage_4.json');
    const options = { ...baseOptions, covJsonFile };
    const result = getCoverageJsonReport(options);

    expect(result).not.toBeNull();
    expect(result!.html).toContain('>2->exit</a>');
  });

  test('should skip covered files when xmlSkipCovered is true', () => {
    const covJsonFile = path.join(dataPath, 'coverage_4.json');
    const options = { ...baseOptions, covJsonFile, xmlSkipCovered: true };
    const result = getCoverageJsonReport(options);

    expect(result).not.toBeNull();
    expect(result!.html).not.toContain('src/b.py');
  });
});
