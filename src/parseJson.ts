import * as core from '@actions/core';
import { getContent, getCoverageColor } from './utils';
import { toHtml } from './parse';
import { formatCoverPercent } from './parseXml';
import type {
  Options,
  CoverageLine,
  TotalLine,
  XmlCoverageReport,
  DataFromXml,
} from './types';

// coverage.py `coverage json` schema (only the fields we use):
//   files["path"].summary.{num_statements, missing_lines(count), percent_covered,
//                          num_branches, missing_branches(count)}
//   files["path"].missing_lines    -> array of line numbers
//   files["path"].missing_branches -> array of [from, to] arcs (to < 0 means exit)
//   totals.{num_statements, missing_lines, percent_covered, num_branches, missing_branches}
interface JsonSummary {
  num_statements: number;
  missing_lines: number;
  percent_covered: number;
  num_branches?: number;
  missing_branches?: number;
}

interface JsonFile {
  summary: JsonSummary;
  missing_lines: number[];
  missing_branches?: number[][];
}

interface JsonCoverage {
  files: Record<string, JsonFile>;
  totals: JsonSummary;
}

// read and parse the json coverage file
const getParsedJson = (options: Options): JsonCoverage | null => {
  const content = getContent(options.covJsonFile);

  if (!content || !content.length) {
    return null;
  }

  try {
    return JSON.parse(content) as JsonCoverage;
  } catch (error) {
    // prettier-ignore
    core.warning(`Coverage json file is not valid JSON: ${(error as Error).message}`);
    return null;
  }
};

// return true if the parsed json includes the expected structure
const isValidCoverageContent = (parsedJson: JsonCoverage | null): boolean =>
  !!parsedJson && !!parsedJson.files && !!parsedJson.totals;

// collapse a sorted list of line numbers into range strings, e.g.
// [4, 10, 11, 12] -> ["4", "10-12"]
const collapseRanges = (
  lineNumbers: number[],
): { sort: number; text: string }[] =>
  lineNumbers
    .slice()
    .sort((a, b) => a - b)
    .reduce((arr: number[][], val: number, i: number, a: number[]) => {
      if (!i || val !== a[i - 1] + 1) arr.push([]);
      arr[arr.length - 1].push(val);
      return arr;
    }, [])
    .map((range) => ({
      sort: range[0],
      text:
        range.length === 1
          ? `${range[0]}`
          : `${range[0]}-${range[range.length - 1]}`,
    }));

// build the "Missing" column entries the same way `coverage report -m` does:
// missing statement lines as ranges, plus partial branch arcs as `from->to`
// (or `from->exit`). An arc whose destination is itself a missing line is
// omitted, since the line already appears as missing.
const getMissing = (file: JsonFile): string[] => {
  const missingLines = file.missing_lines || [];
  const missingLinesSet = new Set(missingLines);

  const entries = collapseRanges(missingLines);

  (file.missing_branches || []).forEach(([from, to]) => {
    if (to < 0) {
      entries.push({ sort: from, text: `${from}->exit` });
    } else if (!missingLinesSet.has(to)) {
      entries.push({ sort: from, text: `${from}->${to}` });
    }
  });

  return entries.sort((a, b) => a.sort - b.sort).map((e) => e.text);
};

// convert a single file entry to CoverageLine
const parseFile = (
  name: string,
  file: JsonFile,
  xmlSkipCovered: boolean,
): CoverageLine | null => {
  const { summary } = file;
  const numBranches = summary.num_branches || 0;
  const missingBranches = summary.missing_branches || 0;
  const isFullCoverage = summary.missing_lines === 0 && missingBranches === 0;

  if (xmlSkipCovered && isFullCoverage) {
    return null;
  }

  const cover = isFullCoverage
    ? '100%'
    : `${formatCoverPercent(summary.percent_covered)}%`;

  const result: CoverageLine = {
    name,
    stmts: summary.num_statements.toString(),
    miss: summary.missing_lines.toString(),
    cover,
    missing: getMissing(file),
  };

  if (numBranches > 0) {
    result.branch = numBranches.toString();
    result.brpart = missingBranches.toString();
  }

  return result;
};

// convert the top-level totals to a TotalLine
const getTotalCoverage = (totals: JsonSummary): TotalLine | null => {
  const cover = formatCoverPercent(totals.percent_covered);
  const numBranches = totals.num_branches || 0;

  if (!Number.isFinite(cover)) {
    // prettier-ignore
    core.warning(`Coverage json file is missing a valid total coverage percentage`);
    return null;
  }

  const result: TotalLine = {
    name: 'TOTAL',
    stmts: totals.num_statements,
    miss: totals.missing_lines,
    cover: cover !== 0 ? `${cover}%` : '0',
  };

  if (numBranches > 0) {
    result.branch = numBranches.toString();
    result.brpart = (totals.missing_branches || 0).toString();
  }

  return result;
};

// return summary report in markdown format
export const getCoverageJsonReport = (
  options: Options,
): XmlCoverageReport | null => {
  try {
    const parsedJson = getParsedJson(options);

    if (parsedJson && !isValidCoverageContent(parsedJson)) {
      // prettier-ignore
      core.error(`Error: coverage file "${options.covJsonFile}" has bad format or wrong data`);
      return null;
    }

    const coverage = parsedJson ? getTotalCoverage(parsedJson.totals) : null;

    if (parsedJson && coverage) {
      const coverageObj: CoverageLine[] = Object.entries(parsedJson.files)
        .map(([name, file]) => parseFile(name, file, options.xmlSkipCovered))
        .filter((line): line is CoverageLine => line !== null);
      const dataFromXml: DataFromXml = {
        coverage: coverageObj,
        total: coverage,
      };
      const html = toHtml(null, options, dataFromXml);
      const color = getCoverageColor(coverage.cover);

      return { html, coverage, color };
    }

    return null;
  } catch (error) {
    // prettier-ignore
    core.error(`Error generating coverage report from "${options.covJsonFile}". ${(error as Error).message}`);
  }

  return null;
};

export const exportedForTesting = {
  isValidCoverageContent,
  collapseRanges,
  getMissing,
  getTotalCoverage,
};
