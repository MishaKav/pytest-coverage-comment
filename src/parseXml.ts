import * as xml2js from 'xml2js';
import * as core from '@actions/core';
import { getContent, getCoverageColor } from './utils';
import { toHtml } from './parse';
import type {
  Options,
  CoverageLine,
  TotalLine,
  XmlCoverageReport,
  DataFromXml,
  ParsedXml,
} from './types';

// return parsed xml
const getParsedXml = (options: Options): ParsedXml => {
  const content = getContent(options.covXmlFile);

  if (content) {
    return getXmlContent(content);
  }

  return null;
};

const getTotalCoverage = (parsedXml: ParsedXml): TotalLine | null => {
  if (!parsedXml) {
    return null;
  }

  const coverage = parsedXml['$'];
  const cover = parseInt(String(parseFloat(coverage['line-rate']) * 100));
  const linesValid = parseInt(coverage['lines-valid']);
  const linesCovered = parseInt(coverage['lines-covered']);
  const branchesValid = parseInt(coverage['branches-valid']) || 0;
  const branchesCovered = parseInt(coverage['branches-covered']) || 0;

  const result: TotalLine = {
    name: 'TOTAL',
    stmts: linesValid,
    miss: linesValid - linesCovered,
    cover: cover !== 0 ? `${cover}%` : '0',
  };

  if (branchesValid > 0) {
    result.branch = branchesValid.toString();
    result.brpart = (branchesValid - branchesCovered).toString();
  }

  return result;
};

// return true if "coverage file" include right structure
const isValidCoverageContent = (parsedXml: ParsedXml): boolean => {
  if (!parsedXml || !parsedXml.packages || !parsedXml.packages.length) {
    return false;
  }

  const { packages } = parsedXml;
  if (!packages[0] || !packages[0].package || !packages[0].package.length) {
    return false;
  }

  return true;
};

// return summary report in markdown format
export const getCoverageXmlReport = (
  options: Options,
): XmlCoverageReport | null => {
  try {
    const parsedXml = getParsedXml(options);

    const coverage = getTotalCoverage(parsedXml);
    const isValid = isValidCoverageContent(parsedXml);

    if (parsedXml && !isValid) {
      // prettier-ignore
      core.error(`Error: coverage file "${options.covXmlFile}" has bad format or wrong data`);
    }

    if (parsedXml && isValid) {
      const coverageObj = coverageXmlToFiles(parsedXml, options.xmlSkipCovered);
      const dataFromXml: DataFromXml = {
        coverage: coverageObj,
        total: coverage!,
      };
      const html = toHtml(null, options, dataFromXml);
      const color = getCoverageColor(coverage ? coverage.cover : '0');

      return { html, coverage, color };
    }
    return null;
  } catch (error) {
    // prettier-ignore
    core.error(`Error generating coverage report from "${options.covXmlFile}". ${(error as Error).message}`);
  }

  return null;
};

// get content from coverage xml
const getXmlContent = (data: string): ParsedXml => {
  try {
    if (!data || !data.length) {
      return null;
    }

    const parser = new xml2js.Parser();

    let parseResult: ParsedXml = null;
    let errorMessage = '';
    parser.parseString(data, (err: Error | null, result: ParsedXml) => {
      if (err) {
        errorMessage = err.message;
      }
      parseResult = result;
    });

    if (!parseResult) {
      // prettier-ignore
      core.warning(`Coverage xml file is not XML or not well-formed${errorMessage ? `: ${errorMessage}` : ''}`);
      return '';
    }

    return parseResult.coverage;
  } catch (error) {
    core.error(`Error parsing coverage xml. ${(error as Error).message}`);
  }

  return '';
};

// parse coverage xml to Files structure
const coverageXmlToFiles = (
  coverageXml: ParsedXml,
  xmlSkipCovered: boolean,
): CoverageLine[] => {
  const files: CoverageLine[] = [];

  coverageXml.packages[0].package
    .filter((pkg: ParsedXml) => pkg.classes && pkg.classes.length)
    .forEach((pkg: ParsedXml) => {
      pkg.classes[0].class
        .filter((c: ParsedXml) => c.lines)
        .forEach((c: ParsedXml) => {
          const fileObj = parseClass(c, xmlSkipCovered);

          if (fileObj) {
            files.push(fileObj);
          }
        });
    });

  return files;
};

const parseClass = (
  classObj: ParsedXml,
  xmlSkipCovered: boolean,
): CoverageLine | null => {
  if (!classObj || !classObj.lines) {
    return null;
  }

  const {
    stmts,
    missing,
    totalMissing: miss,
    branchTotal,
    branchMissing,
  } = parseLines(classObj.lines);
  const { filename: name, 'line-rate': lineRate } = classObj['$'];
  const isFullCoverage = lineRate === '1';

  if (xmlSkipCovered && isFullCoverage) {
    return null;
  }

  const cover = isFullCoverage
    ? '100%'
    : `${parseInt(String(parseFloat(lineRate) * 100))}%`;

  const result: CoverageLine = { name, stmts, miss, cover, missing };

  if (branchTotal > 0) {
    result.branch = branchTotal.toString();
    result.brpart = branchMissing.toString();
  }

  return result;
};

interface ParsedLines {
  stmts: string;
  missing: string[];
  totalMissing: string;
  branchTotal: number;
  branchMissing: number;
}

const parseLines = (lines: ParsedXml): ParsedLines => {
  const emptyResult: ParsedLines = {
    stmts: '0',
    missing: [],
    totalMissing: '0',
    branchTotal: 0,
    branchMissing: 0,
  };

  if (!lines || !lines.length || !lines[0].line) {
    return emptyResult;
  }

  let stmts = 0;
  const missingLines: number[] = [];
  let branchTotal = 0;
  let branchMissing = 0;

  lines[0].line.forEach((line: ParsedXml) => {
    stmts++;
    const {
      hits,
      number: lineNumber,
      branch,
      'condition-coverage': condCoverage,
    } = line['$'];

    if (hits === '0') {
      missingLines.push(parseInt(lineNumber));
    }

    if (branch === 'true' && condCoverage) {
      const match = condCoverage.match(/\((\d+)\/(\d+)\)/);

      if (match) {
        const covered = parseInt(match[1]);
        const total = parseInt(match[2]);
        branchTotal += total;
        branchMissing += total - covered;
      }
    }
  });

  const missing = missingLines.reduce(
    (arr: number[][], val: number, i: number, a: number[]) => {
      if (!i || val !== a[i - 1] + 1) arr.push([]);
      arr[arr.length - 1].push(val);
      return arr;
    },
    [],
  );

  const missingText: string[] = [];
  missing.forEach((m) => {
    if (m.length === 1) {
      missingText.push(`${m[0]}`);
    } else {
      missingText.push(`${m[0]}-${m[m.length - 1]}`);
    }
  });

  return {
    stmts: stmts.toString(),
    missing: missingText,
    totalMissing: missingLines.length.toString(),
    branchTotal,
    branchMissing,
  };
};
