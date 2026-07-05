import { expect, test, describe, beforeEach } from 'vitest';
import * as path from 'path';
import { getCoverageJsonReport, exportedForTesting } from '../src/parseJson';
import { spyCore } from './setup';
import type { Options } from '../src/types';

const { isValidCoverageContent, collapseRanges, getMissing, getTotalCoverage } =
  exportedForTesting;

type MissingArg = Parameters<typeof getMissing>[0];
type TotalsArg = Parameters<typeof getTotalCoverage>[0];

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

  test('should warn and return null for malformed json', () => {
    const covJsonFile = path.join(dataPath, 'coverage_1.xml'); // not json
    const options = { ...baseOptions, covJsonFile };
    const result = getCoverageJsonReport(options);

    expect(result).toBeNull();
    expect(spyCore.warning).toHaveBeenCalled();
  });

  test('should parse coverage_1.json (no branches) successfully', () => {
    const covJsonFile = path.join(dataPath, 'coverage_1.json');
    const options = { ...baseOptions, covJsonFile };
    const result = getCoverageJsonReport(options);

    expect(result).not.toBeNull();
    expect(result!.html).toContain('img.shields.io/badge');
    expect(result!.coverage).not.toBeNull();
    expect(result!.coverage!.name).toBe('TOTAL');
    expect(result!.coverage!.cover).toBe('88%');
    // foo.py is 80% with missing lines 5 and 12
    expect(result!.html).toContain('<td>80%</td>');
    expect(result!.html).toContain('>5</a>');
    expect(result!.html).toContain('>12</a>');
    // no branch columns for a statement-only report
    expect(result!.html).not.toContain('<th>Branch</th>');
  });

  test('should parse coverage_2.json with branch coverage', () => {
    const covJsonFile = path.join(dataPath, 'coverage_2.json');
    const options = { ...baseOptions, covJsonFile };
    const result = getCoverageJsonReport(options);

    expect(result).not.toBeNull();
    expect(result!.coverage!.cover).toBe('82%');
    expect(result!.coverage!.branch).toBe('10');
    expect(result!.coverage!.brpart).toBe('3');
    expect(result!.html).toContain('<th>Branch</th><th>BrPart</th>');
    // branch arcs from getMissing are wired into the missing column
    expect(result!.html).toContain('>2->exit</a>');
  });

  test('should skip covered files when xmlSkipCovered is true', () => {
    const covJsonFile = path.join(dataPath, 'coverage_1.json');
    const options = { ...baseOptions, covJsonFile, xmlSkipCovered: true };
    const result = getCoverageJsonReport(options);

    expect(result).not.toBeNull();
    // bar.py is 100% covered and should be excluded from the table
    expect(result!.html).not.toContain('bar.py');
    expect(result!.html).toContain('foo.py');
  });
});

describe('parseJson internals', () => {
  test('isValidCoverageContent', () => {
    expect(isValidCoverageContent(null)).toBe(false);
    expect(isValidCoverageContent({ files: {} } as never)).toBe(false);
    expect(isValidCoverageContent({ files: {}, totals: {} } as never)).toBe(
      true,
    );
  });

  test('collapseRanges groups consecutive lines', () => {
    expect(collapseRanges([4, 10, 11, 12])).toEqual([
      { sort: 4, text: '4' },
      { sort: 10, text: '10-12' },
    ]);
    expect(collapseRanges([])).toEqual([]);
  });

  test('getMissing renders lines, exit arcs, and normal arcs sorted by line', () => {
    const asArg = (file: {
      missing_lines: number[];
      missing_branches: number[][];
    }): MissingArg => file as unknown as MissingArg;

    expect(
      getMissing(asArg({ missing_lines: [5, 14], missing_branches: [[2, 5]] })),
    ).toEqual(['5', '14']);
    expect(
      getMissing(asArg({ missing_lines: [], missing_branches: [[2, -1]] })),
    ).toEqual(['2->exit']);
    expect(
      getMissing(asArg({ missing_lines: [], missing_branches: [[2, 4]] })),
    ).toEqual(['2->4']);
    expect(
      getMissing(asArg({ missing_lines: [6], missing_branches: [[2, 4]] })),
    ).toEqual(['2->4', '6']);
  });

  test('getTotalCoverage maps totals to a TotalLine', () => {
    expect(
      getTotalCoverage({
        num_statements: 16,
        missing_lines: 2,
        percent_covered: 87.5,
      } as TotalsArg),
    ).toEqual({ name: 'TOTAL', stmts: 16, miss: 2, cover: '88%' });

    expect(
      getTotalCoverage({
        num_statements: 18,
        missing_lines: 2,
        percent_covered: 82.14,
        num_branches: 10,
        missing_branches: 3,
      } as TotalsArg),
    ).toEqual({
      name: 'TOTAL',
      stmts: 18,
      miss: 2,
      cover: '82%',
      branch: '10',
      brpart: '3',
    });
  });

  test('getTotalCoverage returns null for a non-finite percentage', () => {
    spyCore.warning.mockClear();
    expect(
      getTotalCoverage({
        num_statements: 0,
        missing_lines: 0,
        percent_covered: NaN,
      } as TotalsArg),
    ).toBeNull();
    expect(spyCore.warning).toHaveBeenCalled();
  });
});
