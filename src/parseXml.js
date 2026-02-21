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

const getTotalCoverage = (parsedXml) => {
  if (!parsedXml) {
    return null;
  }

  const coverage = parsedXml['$'];
  const cover = parseInt(parseFloat(coverage['line-rate']) * 100);
  const linesValid = parseInt(coverage['lines-valid']);
  const linesCovered = parseInt(coverage['lines-covered']);

  const result = {
    name: 'TOTAL',
    stmts: linesValid,
    miss: linesValid - linesCovered,
    cover: cover !== '0' ? `${cover}%` : '0',
  };

  // Add branch coverage if present
  const branchesValid = parseInt(coverage['branches-valid']);
  if (branchesValid > 0) {
    const branchesCovered = parseInt(coverage['branches-covered']);
    result.branch = branchesValid.toString();
    result.brpart = (branchesValid - branchesCovered).toString();
  }

  return result;
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

    const coverage = getTotalCoverage(parsedXml);
    // const coverage = getCoverageReportXml(getContent(options.covXmlFile));
    const isValid = isValidCoverageContent(parsedXml);

    if (parsedXml && !isValid) {
      // prettier-ignore
      core.error(`Error: coverage file "${options.covXmlFile}" has bad format or wrong data`);
    }

    if (parsedXml && isValid) {
      const coverageObj = coverageXmlToFiles(parsedXml, options.xmlSkipCovered);

      // Check if branch coverage is present
      const rootCoverage = parsedXml['$'];
      const branchesValid = parseInt(rootCoverage['branches-valid'] || '0');
      const hasBranch = branchesValid > 0;

      const dataFromXml = { coverage: coverageObj, total: coverage, hasBranch };
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
const coverageXmlToFiles = (coverageXml, xmlSkipCovered) => {
  let files = [];

  coverageXml.packages[0].package
    .filter((package) => package.classes && package.classes.length)
    .forEach((package) => {
      package.classes[0].class
        .filter((c) => c.lines)
        .forEach((c) => {
          const fileObj = parseClass(c, xmlSkipCovered);

          if (fileObj) {
            files.push(fileObj);
          }
        });
    });

  return files;
};

const parseClass = (classObj, xmlSkipCovered) => {
  if (!classObj || !classObj.lines) {
    return null;
  }

  const {
    stmts,
    missing,
    totalMissing: miss,
    branch,
    brpart,
  } = parseLines(classObj.lines);
  const { filename: name, 'line-rate': lineRate } = classObj['$'];
  const isFullCoverage = lineRate === '1';

  if (xmlSkipCovered && isFullCoverage) {
    return null;
  }

  const cover = isFullCoverage
    ? '100%'
    : `${parseInt(parseFloat(lineRate) * 100)}%`;

  const result = { name, stmts, miss, cover, missing };

  // Only include branch info if there are branches
  if (parseInt(branch) > 0) {
    result.branch = branch;
    result.brpart = brpart;
  }

  return result;
};

const parseLines = (lines) => {
  if (!lines || !lines.length || !lines[0].line) {
    return {
      stmts: '0',
      missing: '',
      totalMissing: '0',
      branch: '0',
      brpart: '0',
    };
  }

  let stmts = 0;
  let totalBranches = 0;
  let partialBranches = 0;
  const missingLines = [];

  lines[0].line.forEach((line) => {
    stmts++;
    const { hits, number, branch } = line['$'];

    if (hits === '0') {
      missingLines.push(parseInt(number));
    }

    // Count branches
    if (branch === 'true') {
      const condCoverage = line['$']['condition-coverage'];
      if (condCoverage) {
        // Parse "100% (2/2)" or "50% (1/2)" format
        const match = condCoverage.match(/\((\d+)\/(\d+)\)/);
        if (match) {
          const covered = parseInt(match[1]);
          const total = parseInt(match[2]);
          totalBranches += total;
          partialBranches += total - covered;
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

  return {
    stmts: stmts.toString(),
    missing: missingText,
    totalMissing: missingLines.length.toString(),
    branch: totalBranches.toString(),
    brpart: partialBranches.toString(),
  };
};

module.exports = { getCoverageXmlReport };
