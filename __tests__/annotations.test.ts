import { expect, test, describe, beforeEach, vi } from 'vitest';
import * as core from '@actions/core';
import * as path from 'path';
import {
  MAX_ANNOTATIONS,
  annotateMissingLines,
  getAddedLines,
  getAnnotations,
} from '../src/annotations';
import { getCoverageReport } from '../src/parse';
import { getCoverageXmlReport } from '../src/parseXml';
import { getCoverageJsonReport } from '../src/parseJson';
import { spyCore } from './setup';
import type { Options, CoverageLine } from '../src/types';

const spyNotice = vi.spyOn(core, 'notice').mockImplementation(() => {});

const dataPath = path.resolve(__dirname, '..', 'data');

const line = (name: string, missing: string[] | null): CoverageLine => ({
  name,
  stmts: '10',
  miss: '1',
  cover: '90%',
  missing,
});

const pathOptions = { prefix: '', pathPrefix: '' };

describe('getAddedLines', () => {
  test('returns added line numbers of the head version', () => {
    const patch = [
      '@@ -1,4 +1,5 @@',
      ' import os',
      '-import sys',
      '+import re',
      '+import json',
      ' ',
      ' def foo():',
      '@@ -20,2 +21,3 @@ def bar():',
      '     return 1',
      '+    # new',
      '\\ No newline at end of file',
    ].join('\n');

    expect(getAddedLines(patch)).toEqual([2, 3, 22]);
  });

  test('handles a new file and a hunk header without counts', () => {
    expect(getAddedLines('@@ -0,0 +1,2 @@\n+a\n+b')).toEqual([1, 2]);
    expect(getAddedLines('@@ -3 +3 @@\n-a\n+b')).toEqual([3]);
  });

  test('ignores text before the first hunk and missing patches', () => {
    expect(getAddedLines('+not a hunk\n@@ -1 +5 @@\n+x')).toEqual([5]);
    expect(getAddedLines(undefined)).toEqual([]);
    expect(getAddedLines('')).toEqual([]);
  });
});

describe('getAnnotations', () => {
  test('annotates only missing lines that were added, merging runs', () => {
    const coverage = [line('pkg/mod.py', ['3-6', '10', '20-25'])];
    const added = { 'pkg/mod.py': [1, 4, 5, 6, 7, 10, 30] };

    expect(getAnnotations(coverage, added, pathOptions)).toEqual([
      {
        file: 'pkg/mod.py',
        startLine: 4,
        endLine: 6,
        title: 'Missing coverage',
        message: 'Lines 4-6 are not covered by tests',
      },
      {
        file: 'pkg/mod.py',
        startLine: 10,
        endLine: 10,
        title: 'Missing coverage',
        message: 'Line 10 is not covered by tests',
      },
    ]);
  });

  test('annotates partial branches on added lines', () => {
    const coverage = [line('a.py', ['4', '7->9', '7->exit', '12->14'])];
    const added = { 'a.py': [4, 7, 8] };

    expect(getAnnotations(coverage, added, pathOptions)).toEqual([
      expect.objectContaining({ startLine: 4, endLine: 4 }),
      {
        file: 'a.py',
        startLine: 7,
        endLine: 7,
        title: 'Partial branch coverage',
        message: 'Line 7 has branches not covered by tests: 7->9, 7->exit',
      },
    ]);
  });

  test('skips a branch whose source line is already annotated', () => {
    const coverage = [line('a.py', ['5-6', '5->8'])];
    const result = getAnnotations(coverage, { 'a.py': [5] }, pathOptions);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Missing coverage');
  });

  test('skips unchanged files and fully covered files', () => {
    const coverage = [line('a.py', ['1-3']), line('b.py', null)];
    const added = { 'b.py': [1], 'c.py': [1] };

    expect(getAnnotations(coverage, added, pathOptions)).toEqual([]);
  });

  test('maps coverage paths to repo paths with prefix and path prefix', () => {
    const coverage = [line('/home/runner/work/pkg/mod.py', ['1-2'])];
    // a root `pkg/mod.py` must not be taken for `src/pkg/mod.py`
    const added = { 'src/pkg/mod.py': [1], 'pkg/mod.py': [2] };
    const result = getAnnotations(coverage, added, {
      prefix: '/home/runner/work/',
      pathPrefix: 'src/',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      file: 'src/pkg/mod.py',
      startLine: 1,
      endLine: 1,
    });
  });

  test('normalizes a windows-style path prefix', () => {
    const coverage = [line('pkg/mod.py', ['1'])];
    const result = getAnnotations(
      coverage,
      // with and without the prefix, the key convention is set by the caller
      { 'pkg/mod.py': [1], 'src/pkg/mod.py': [1] },
      { prefix: '', pathPrefix: 'src\\' },
    );

    expect(result[0].file).toBe('src/pkg/mod.py');
  });

  test('normalizes windows paths', () => {
    const coverage = [line('pkg\\mod.py', ['1'])];
    const result = getAnnotations(coverage, { 'pkg/mod.py': [1] }, pathOptions);

    expect(result[0].file).toBe('pkg/mod.py');
  });

  test('does not expand huge ranges from the report', () => {
    const coverage = [line('a.py', ['1-999999999'])];
    const result = getAnnotations(coverage, { 'a.py': [5] }, pathOptions);

    expect(result).toEqual([expect.objectContaining({ startLine: 5 })]);
  });

  test('ignores report files named like Object members', () => {
    const coverage = [line('constructor', ['1']), line('a.py', ['1'])];
    const result = getAnnotations(coverage, { 'a.py': [1] }, pathOptions);

    expect(result).toEqual([expect.objectContaining({ file: 'a.py' })]);
  });

  test('annotates a line once when a file is listed twice', () => {
    const coverage = [line('a.py', ['2-3']), line('a.py', ['3-4'])];
    const result = getAnnotations(coverage, { 'a.py': [2, 3, 4] }, pathOptions);

    expect(result).toEqual([
      expect.objectContaining({ startLine: 2, endLine: 4 }),
    ]);
  });

  test('keeps only numeric branch arcs, so messages stay inert', () => {
    const coverage = [line('a.py', ['3->5\n::error::forged', '3->7'])];
    const result = getAnnotations(coverage, { 'a.py': [3] }, pathOptions);

    expect(result).toEqual([
      expect.objectContaining({
        message: 'Line 3 has a branch not covered by tests: 3->7',
      }),
    ]);
  });

  test('ignores malformed missing entries', () => {
    const coverage = [line('a.py', ['x', 'a-b', 'y->z', '2'])];
    const result = getAnnotations(coverage, { 'a.py': [2] }, pathOptions);

    expect(result).toEqual([expect.objectContaining({ startLine: 2 })]);
  });
});

describe('annotateMissingLines', () => {
  const baseOptions = {
    prefix: '',
    pathPrefix: '',
    covFile: '',
    covXmlFile: '',
    covJsonFile: '',
    xmlSkipCovered: false,
    title: 'Coverage Report',
    badgeTitle: 'Coverage',
  } as unknown as Options;
  const jsonLines = (covJsonFile: string): CoverageLine[] =>
    getCoverageJsonReport({ ...baseOptions, covJsonFile })!.lines!;

  beforeEach(() => {
    spyCore.warning.mockClear();
    spyCore.info.mockClear();
    spyCore.error.mockClear();
    spyNotice.mockClear();
  });

  test('emits annotations from a json report', () => {
    annotateMissingLines(jsonLines(`${dataPath}/coverage_1.json`), {
      ...baseOptions,
      changedFiles: { all: ['src/foo.py'], addedLines: { 'src/foo.py': [5] } },
    });

    expect(spyCore.warning).toHaveBeenCalledWith(
      'Line 5 is not covered by tests',
      {
        title: 'Missing coverage',
        file: 'src/foo.py',
        startLine: 5,
        endLine: 5,
      },
    );
  });

  test('annotates a json arc whose target line is missing', () => {
    // src/app.py: line 5 missing, arc 2->5 left out of the Missing column
    annotateMissingLines(jsonLines(`${dataPath}/coverage_2.json`), {
      ...baseOptions,
      changedFiles: { all: ['src/app.py'], addedLines: { 'src/app.py': [2] } },
    });

    expect(spyCore.warning).toHaveBeenCalledWith(
      'Line 2 has a branch not covered by tests: 2->5',
      expect.objectContaining({ file: 'src/app.py', startLine: 2 }),
    );
  });

  test('uses the configured annotation type', () => {
    annotateMissingLines(jsonLines(`${dataPath}/coverage_1.json`), {
      ...baseOptions,
      annotationType: 'notice',
      changedFiles: { all: ['src/foo.py'], addedLines: { 'src/foo.py': [12] } },
    });

    expect(spyNotice).toHaveBeenCalledTimes(1);
    expect(spyCore.warning).not.toHaveBeenCalled();
  });

  test('caps annotations and logs the rest', () => {
    const missing = Array.from({ length: 15 }, (_, i) => `${i * 2 + 1}`);
    const added = Array.from({ length: 30 }, (_, i) => i + 1);

    annotateMissingLines([line('a.py', missing)], {
      ...baseOptions,
      changedFiles: { all: ['a.py'], addedLines: { 'a.py': added } },
    });

    expect(spyCore.warning).toHaveBeenCalledTimes(MAX_ANNOTATIONS);
    expect(spyCore.info).toHaveBeenCalledWith(
      expect.stringContaining('5 more annotations were not created'),
    );
  });

  test('falls back to warning for an unknown annotation type', () => {
    annotateMissingLines([line('a.py', ['1'])], {
      ...baseOptions,
      annotationType: 'setFailed' as Options['annotationType'],
      changedFiles: { all: ['a.py'], addedLines: { 'a.py': [1] } },
    });

    expect(spyCore.setFailed).not.toHaveBeenCalled();
    expect(spyCore.warning).toHaveBeenCalledTimes(1);
  });

  test('closes the log group when creating annotations fails', () => {
    spyCore.endGroup.mockClear();
    annotateMissingLines([{ name: 'a.py' } as unknown as CoverageLine], {
      ...baseOptions,
      prefix: undefined as unknown as string,
      changedFiles: { all: ['a.py'], addedLines: { 'a.py': [1] } },
    });

    expect(spyCore.error).toHaveBeenCalled();
    expect(spyCore.endGroup).toHaveBeenCalledTimes(1);
  });

  test('keeps a file name with a newline on one log line', () => {
    const name = 'a.py\n::warning::forged';
    const missing = Array.from({ length: 11 }, (_, i) => `${i * 2 + 1}`);
    const added = Array.from({ length: 22 }, (_, i) => i + 1);

    annotateMissingLines([line(name, missing)], {
      ...baseOptions,
      changedFiles: { all: [name], addedLines: { [name]: added } },
    });

    const logged = spyCore.info.mock.calls.map(([m]) => m).join('\n');
    expect(logged).toContain('"a.py\\n::warning::forged":21');
    expect(logged.split('\n').some((l) => l.startsWith('::'))).toBe(false);
  });

  test('works with the lines of an xml report', () => {
    const options = {
      ...baseOptions,
      covXmlFile: `${dataPath}/coverage_1.xml`,
      changedFiles: {
        all: ['logger/config.py'],
        addedLines: {
          'logger/config.py': Array.from({ length: 200 }, (_, i) => i + 1),
        },
      },
    };
    annotateMissingLines(getCoverageXmlReport(options)!.lines!, options);

    expect(spyCore.error).not.toHaveBeenCalled();
    expect(spyCore.warning).toHaveBeenCalled();
    for (const [, props] of spyCore.warning.mock.calls) {
      expect(props).toMatchObject({ file: 'logger/config.py' });
    }
  });

  test('works with the lines of a txt report', () => {
    const options = {
      ...baseOptions,
      covFile: `${dataPath}/pytest-coverage_4.txt`,
    };
    const { lines } = getCoverageReport(options);
    const withMissing = lines!.find((l) => l.missing?.length)!;
    const [start] = withMissing.missing![0].split(/-|->/);

    annotateMissingLines(lines!, {
      ...options,
      changedFiles: {
        all: [withMissing.name],
        addedLines: { [withMissing.name]: [Number(start)] },
      },
    });

    expect(spyCore.warning).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ file: withMissing.name }),
    );
  });

  test('does nothing without added lines', () => {
    const lines = jsonLines(`${dataPath}/coverage_1.json`);
    spyCore.info.mockClear();
    annotateMissingLines(lines, {
      ...baseOptions,
      changedFiles: { all: [] },
    });

    expect(spyCore.warning).not.toHaveBeenCalled();
    expect(spyCore.info).not.toHaveBeenCalled();
  });
});
