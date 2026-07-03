import * as core from '@actions/core';
import { getContent } from './utils';
import { getCoverageColor } from './utils';
import { toHtml } from './parse';
import type { CoverageLine, DataFromXml, Options, TotalLine } from './types';

interface JsonSummary {
  covered_lines?: number;
  num_statements?: number;
  percent_covered_display?: string | number;
  missing_lines?: number;
  num_branches?: number;
  missing_branches?: number;
}

interface JsonCoverageFile {
  summary?: JsonSummary;
  missing_lines?: number[];
  missing_branches?: [number, number][];
}

interface JsonCoverageData {
  files?: Record<string, JsonCoverageFile>;
  totals?: JsonSummary;
}

const isValidCoverageContent = (data: JsonCoverageData): boolean => {
  if (!data || !data.files || !Object.keys(data.files).length || !data.totals) {
    return false;
  }

  return true;
};

const toPercent = (value: string | number | undefined): string => {
  if (value === undefined || value === null || value === '') {
    return '0';
  }

  const str = String(value);
  return str.endsWith('%') ? str : `${str}%`;
};

const toBranchTarget = (target: number): string =>
  target < 0 ? 'exit' : `${target}`;

const toMissingLinesText = (
  missingLines: number[] = [],
  missingBranches: [number, number][] = [],
): string[] => {
  const missing = [...missingLines].sort((a, b) => a - b);
  const ranges = missing.reduce((arr: number[][], val: number, i: number) => {
    if (!i || val !== missing[i - 1] + 1) {
      arr.push([]);
    }
    arr[arr.length - 1].push(val);
    return arr;
  }, []);

  const missingEntries: { sort: number; text: string }[] = [];
  ranges.forEach((range) => {
    missingEntries.push({
      sort: range[0],
      text:
        range.length === 1
          ? `${range[0]}`
          : `${range[0]}-${range[range.length - 1]}`,
    });
  });

  missingBranches.forEach(([start, target]) => {
    missingEntries.push({
      sort: start,
      text: `${start}->${toBranchTarget(target)}`,
    });
  });

  missingEntries.sort((a, b) => a.sort - b.sort);

  return missingEntries.map((entry) => entry.text);
};

const toCoverageLine = (name: string, data: JsonCoverageFile): CoverageLine => {
  const summary = data.summary || {};
  const missing = toMissingLinesText(data.missing_lines, data.missing_branches);
  const result: CoverageLine = {
    name,
    stmts: `${summary.num_statements || 0}`,
    miss: `${summary.missing_lines || 0}`,
    cover: toPercent(summary.percent_covered_display),
    missing,
  };

  if ((summary.num_branches || 0) > 0) {
    result.branch = `${summary.num_branches || 0}`;
    result.brpart = `${summary.missing_branches || 0}`;
  }

  return result;
};

const getTotalCoverage = (totals?: JsonSummary): TotalLine => ({
  name: 'TOTAL',
  stmts: totals?.num_statements || 0,
  miss: totals?.missing_lines || 0,
  cover: toPercent(totals?.percent_covered_display),
  ...((totals?.num_branches || 0) > 0
    ? {
        branch: `${totals?.num_branches || 0}`,
        brpart: `${totals?.missing_branches || 0}`,
      }
    : {}),
});

const getParsedJson = (options: Options): JsonCoverageData | null => {
  const content = getContent(options.covJsonFile || '');

  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as JsonCoverageData;
  } catch (error) {
    core.warning(
      `Coverage json file is not JSON or not well-formed: ${(error as Error).message}`,
    );
    return null;
  }
};

export const getCoverageJsonReport = (options: Options) => {
  const parsedJson = getParsedJson(options);
  if (!parsedJson) {
    return null;
  }

  const isValid = isValidCoverageContent(parsedJson);
  if (!isValid) {
    core.error(
      `Error: coverage file "${options.covJsonFile}" has bad format or wrong data`,
    );
    return null;
  }

  const coverage = getTotalCoverage(parsedJson.totals);
  const coverageObj = Object.entries(parsedJson.files || {})
    .map(([name, file]) => toCoverageLine(name, file))
    .filter((line) =>
      options.xmlSkipCovered ? line.cover !== '100%' && line.cover !== '100.0%' : true,
    );
  const dataFromJson: DataFromXml = {
    coverage: coverageObj,
    total: coverage,
  };
  const html = toHtml(null, options, dataFromJson);
  const color = getCoverageColor(coverage.cover);

  return { html, coverage, color };
};
