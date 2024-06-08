const xml2js = require('xml2js');
const core = require('@actions/core');
const { getContent, getCoverageColor } = require('./utils');
const { toHtml } = require('./parse');

// return parsed xml
const getParsedXml = (options) => {
  const content = getContent(options.covXmlFile);

  if (content) {
    return getXmlContent(content);
  }

  return '';
};

const coveragePct = (num, denom) => {
  // follow the same logic as coverage.py: only return 0 when there are no hits,
  // only return 100% when all lines are covered, otherwise round.
  // https://github.com/nedbat/coveragepy/blob/0957c07064f8cd89a2a81a0ff1e51ca4bab77c69/coverage/results.py#L276
  if (num === denom) return '100%';
  if (num === 0) return '0%';
  const cover = Math.max(1, Math.min(99, Math.round((100 * num) / denom)));
  return `${cover}%`;
};

const getTotalCoverage = (parsedXml) => {
  if (!parsedXml) {
    return null;
  }

  const coverage = parsedXml['$'];
  const linesValid = parseInt(coverage['lines-valid']);
  const linesCovered = parseInt(coverage['lines-covered']);
  const branchesValid = parseInt(coverage['branches-valid']);
  const branchesCovered = parseInt(coverage['branches-covered']);

  return {
    name: 'TOTAL',
    stmts: linesValid,
    miss: linesValid - linesCovered,
    branches: branchesValid,
    partBranches: branchesValid - branchesCovered,
    cover: coveragePct(
      linesCovered + branchesCovered,
      linesValid + branchesValid,
    ),
  };
};

// return true if "coverage file" include right structure
const isValidCoverageContent = (parsedXml) => {
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
const getCoverageXmlReport = (options) => {
  try {
    const parsedXml = getParsedXml(options);

    const isValid = isValidCoverageContent(parsedXml);

    if (parsedXml && !isValid) {
      // prettier-ignore
      core.error(`Error: coverage file "${options.covXmlFile}" has bad format or wrong data`);
    }

    if (parsedXml && isValid) {
      const coverageObj = coverageXmlToFiles(parsedXml);
      const coverage = getTotalCoverage(parsedXml);
      const dataFromXml = { coverage: coverageObj, total: coverage };
      const html = toHtml(null, options, dataFromXml);
      const color = getCoverageColor(coverage ? coverage.cover : '0');

      return { html, coverage, color };
    }
    return null;
  } catch (error) {
    // prettier-ignore
    core.error(`Error generating coverage report from "${options.covXmlFile}". ${error.message}`);
  }

  return '';
};

// get content from coverage xml
const getXmlContent = (data) => {
  try {
    if (!data || !data.length) {
      return null;
    }

    const parser = new xml2js.Parser();

    const parsed = parser.parseString(data);
    if (!parsed || !parser.resultObject) {
      core.warning(`Coverage xml file is not XML or not well-formed`);
      return '';
    }

    return parser.resultObject.coverage;
  } catch (error) {
    core.error(`Error parsing coverage xml. ${error.message}`);
  }

  return '';
};

// parse coverage xml to Files structure
const coverageXmlToFiles = (coverageXml) => {
  let files = [];

  coverageXml.packages[0].package
    .filter((package) => package.classes && package.classes.length)
    .forEach((package) => {
      package.classes[0].class
        .filter((c) => c.lines)
        .forEach((c) => {
          const fileObj = parseClass(c);

          if (fileObj) {
            files.push(fileObj);
          }
        });
    });

  return files;
};

const parseClass = (classObj) => {
  if (!classObj || !classObj.lines) {
    return null;
  }

  const { stmts, missingStmts, branches, partBranches, missing } = parseLines(
    classObj.lines,
  );
  const { filename: name } = classObj['$'];
  const cover = coveragePct(
    stmts + branches - missingStmts - partBranches,
    stmts + branches,
  );

  return {
    name,
    stmts,
    miss: missingStmts,
    branches,
    partBranches,
    cover,
    missing,
  };
};

const parseLines = (lines) => {
  if (!lines || !lines.length || !lines[0].line) {
    return {
      stmts: 0,
      missingStmts: 0,
      branches: 0,
      partBranches: 0,
      missing: [],
    };
  }

  let stmts = 0,
    branches = 0;
  const missingLines = [],
    partBranchesText = [];

  lines[0].line.forEach((line) => {
    stmts++;
    const { hits, number, branch } = line['$'];

    if (hits === '0') {
      missingLines.push(parseInt(number));
    }
    if (branch === 'true') {
      const { 'condition-coverage': cc, 'missing-branches': mb } = line['$'];
      // 'condition-coverage' is usually formatted like "50% (1/2)". Parse the total number
      // of targets (the second number in parentheses). Default to 2 if not available.
      const numTargets = cc && cc.match(/\(\d+\/(\d+)\)/);
      branches += numTargets ? +numTargets[1] : 2;
      if (mb) {
        for (const target of mb.split(',')) {
          partBranchesText.push(`${number}->${target}`);
        }
      }
    }
  });

  const missing = missingLines.reduce((arr, val, i, a) => {
    if (!i || val !== a[i - 1] + 1) arr.push([]);
    arr[arr.length - 1].push(val);
    return arr;
  }, []);

  const missingText = [];
  missing.forEach((m) => {
    if (m.length === 1) {
      missingText.push(`${m[0]}`);
    } else {
      missingText.push(`${m[0]}-${m[m.length - 1]}`);
    }
  });
  missingText.push(...partBranchesText);

  return {
    stmts,
    missingStmts: missingLines.length,
    branches,
    partBranches: partBranchesText.length,
    missing: missingText,
  };
};

module.exports = { getCoverageXmlReport };
