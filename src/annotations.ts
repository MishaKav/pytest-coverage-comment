import * as core from '@actions/core';
import { toRelativePath } from './parse';
import type { Options, CoverageLine, AnnotationType } from './types';

// github shows at most 10 annotations of each type per step (50 per job)
export const MAX_ANNOTATIONS = 10;
export const ANNOTATION_TYPES: readonly AnnotationType[] = [
  'notice',
  'warning',
  'error',
];
// annotations need a base..head diff of the commit the run belongs to
export const ANNOTATION_EVENTS = [
  'pull_request',
  'pull_request_target',
  'push',
];

export interface Annotation {
  file: string;
  startLine: number;
  endLine: number;
  title: string;
  message: string;
}

// line numbers added in the head version of a file, from its unified diff
export const getAddedLines = (patch: string | undefined): number[] => {
  const added: number[] = [];
  let inHunk = false;
  let line = 0;

  for (const text of (patch || '').split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);

    if (hunk) {
      inHunk = true;
      line = parseInt(hunk[1], 10);
    } else if (inHunk && text.startsWith('+')) {
      added.push(line++);
    } else if (inHunk && text.startsWith(' ')) {
      line++;
    }
    // `-` lines only exist in the base, `\ No newline at end of file` is a marker
  }

  return added;
};

// split the "Missing" entries into line ranges and partial branch arcs
// keyed by their source line, e.g. ["4", "10-12", "7->exit"]
const parseMissing = (
  missing: string[],
): { ranges: [number, number][]; arcs: Map<number, string[]> } => {
  const ranges: [number, number][] = [];
  const arcs = new Map<number, string[]>();

  for (const entry of missing) {
    const value = entry.trim();

    if (value.includes('->')) {
      const from = Number(value.split('->')[0]);
      if (Number.isInteger(from)) {
        const branches = arcs.get(from) || [];
        branches.push(value);
        arcs.set(from, branches);
      }
      continue;
    }

    const [start, end = start] = value.split('-').map(Number);
    if (Number.isInteger(start) && Number.isInteger(end)) {
      ranges.push([start, end]);
    }
  }

  return { ranges, arcs };
};

// group sorted line numbers into consecutive runs, e.g. [4, 5, 9] -> [[4, 5], [9, 9]]
const toRuns = (lines: number[]): [number, number][] =>
  lines.reduce((runs: [number, number][], line) => {
    const last = runs[runs.length - 1];
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      runs.push([line, line]);
    }
    return runs;
  }, []);

// annotations for uncovered lines that the diff added, `addedLines` is keyed
// like `changedFiles.all` (repo path without `coverage-path-prefix`)
export const getAnnotations = (
  coverage: CoverageLine[],
  addedLines: Record<string, number[]>,
  options: Pick<Options, 'prefix' | 'pathPrefix'>,
): Annotation[] => {
  const annotations: Annotation[] = [];

  for (const item of coverage) {
    const relative = toRelativePath(item.name, options);
    // sorted and unique, see getAddedLines
    const added = addedLines[relative];

    if (!item.missing?.length || !added?.length) {
      continue;
    }

    const file = `${options.pathPrefix}${relative}`;
    const addedSet = new Set(added);
    const { ranges, arcs } = parseMissing(item.missing);
    const uncovered = added.filter((line) =>
      ranges.some(([s, e]) => line >= s && line <= e),
    );
    const uncoveredSet = new Set(uncovered);
    const fileAnnotations: Annotation[] = [];

    toRuns(uncovered).forEach(([startLine, endLine]) => {
      const lines =
        startLine === endLine
          ? `Line ${startLine} is`
          : `Lines ${startLine}-${endLine} are`;
      fileAnnotations.push({
        file,
        startLine,
        endLine,
        title: 'Missing coverage',
        message: `${lines} not covered by tests`,
      });
    });

    // a branch from an uncovered line is already part of that annotation
    arcs.forEach((branches, line) => {
      if (!addedSet.has(line) || uncoveredSet.has(line)) {
        return;
      }

      const noun = branches.length === 1 ? 'a branch' : 'branches';
      fileAnnotations.push({
        file,
        startLine: line,
        endLine: line,
        title: 'Partial branch coverage',
        message: `Line ${line} has ${noun} not covered by tests: ${branches.join(', ')}`,
      });
    });

    fileAnnotations.sort((a, b) => a.startLine - b.startLine);
    annotations.push(...fileAnnotations);
  }

  return annotations;
};

// annotate the lines added in this diff that the coverage report marks as missing
export const annotateMissingLines = (
  coverage: CoverageLine[],
  options: Options,
): void => {
  const addedLines = options.changedFiles?.addedLines;

  if (!addedLines) {
    return;
  }

  try {
    const annotations = getAnnotations(coverage, addedLines, options);
    const type = options.annotationType || 'warning';

    core.startGroup('Annotations');
    if (!annotations.length) {
      core.info('No uncovered lines found in the changed code');
    }

    annotations.slice(0, MAX_ANNOTATIONS).forEach((a) => {
      const { file, startLine, endLine, title, message } = a;
      core[type](message, { title, file, startLine, endLine });
    });

    const rest = annotations.slice(MAX_ANNOTATIONS);
    if (rest.length) {
      // prettier-ignore
      core.info(`${rest.length} more uncovered ranges were not annotated, GitHub shows at most ${MAX_ANNOTATIONS} ${type} annotations per step:`);
      rest.forEach((a) => core.info(`${a.file}:${a.startLine} ${a.message}`));
    }
    core.endGroup();
  } catch (error) {
    // prettier-ignore
    core.error(`Error creating annotations for missing lines. ${(error as Error).message}`);
  }
};
