import * as core from '@actions/core';
import { toRelativePath } from './parse';
import { toRuns } from './utils';
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

  // report values are untrusted, keep only well-formed entries so a message
  // never carries anything but numbers (and `exit`)
  for (const entry of new Set(missing.map((m) => String(m).trim()))) {
    const arc = /^(\d+)->(\d+|exit)$/.exec(entry);
    if (arc) {
      const from = Number(arc[1]);
      const branches = arcs.get(from) || [];
      branches.push(entry);
      arcs.set(from, branches);
      continue;
    }

    const range = /^(\d+)(?:-(\d+))?$/.exec(entry);
    if (range) {
      ranges.push([Number(range[1]), Number(range[2] ?? range[1])]);
    }
  }

  return { ranges, arcs };
};

// annotations for uncovered lines that the diff added, `addedLines` is keyed
// by the full repo path (with `coverage-path-prefix`)
export const getAnnotations = (
  coverage: CoverageLine[],
  addedLines: Record<string, number[]>,
  options: Pick<Options, 'prefix' | 'pathPrefix'>,
): Annotation[] => {
  const annotations: Annotation[] = [];
  // xml reports can list one file in several classes, merge them per file.
  // json reports keep arcs to missing lines out of `missing`, add them back
  const missingByFile = new Map<string, string[]>();
  for (const item of coverage) {
    // the diff uses `/`, a windows-style prefix would never match
    const prefix = options.pathPrefix.replace(/\\/g, '/');
    const file = `${prefix}${toRelativePath(item.name, options)}`;
    missingByFile.set(file, [
      ...(missingByFile.get(file) ?? []),
      ...(item.missing ?? []),
      ...(item.missingBranches ?? []),
    ]);
  }

  for (const [file, missing] of missingByFile) {
    // sorted and unique, see getAddedLines. Own keys only, a report file
    // named e.g. `constructor` must not hit Object members
    const added = Object.hasOwn(addedLines, file)
      ? addedLines[file]
      : undefined;

    if (!missing.length || !added?.length) {
      continue;
    }

    const addedSet = new Set(added);
    const { ranges, arcs } = parseMissing(missing);
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

  // the type picks a `core` function, never call anything but an annotation
  const type: AnnotationType = ANNOTATION_TYPES.includes(
    options.annotationType as AnnotationType,
  )
    ? (options.annotationType as AnnotationType)
    : 'warning';

  core.startGroup('Annotations');
  try {
    const annotations = getAnnotations(coverage, addedLines, options);

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
      core.info(`${rest.length} more annotations were not created, GitHub shows at most ${MAX_ANNOTATIONS} ${type} annotations per step:`);
      // a file name can hold a newline, keep each entry on its own log line
      // so it can't start a workflow command
      rest.forEach((a) =>
        core.info(
          `${JSON.stringify(a.file)}:${a.startLine} ${JSON.stringify(a.message)}`,
        ),
      );
    }
  } catch (error) {
    // prettier-ignore
    core.error(`Error creating annotations for missing lines. ${(error as Error).message}`);
  } finally {
    core.endGroup();
  }
};
