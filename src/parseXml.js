const { XMLParser } = require('fast-xml-parser');
const core = require('@actions/core');

const getCoverageReportXml = (content) => {
  const coverageData = getCoverageData(content);
  if (coverageData) {
    const total = getTotal(coverageData);
    const coverage = parseXml(coverageData);
    return { coverage, total };
  }
};

const getCoverageData = (content) => {
  if (!content || !content.length) {
    return null;
  }

  const options = {
    ignoreDeclaration: true,
    ignoreAttributes: false,
  };
  const parser = new XMLParser(options);
  const output = parser.parse(content);

  if (!output) {
    core.warning(`Coverage file is not XML or not well formed`);
    return '';
  }
  return output.coverage;
};

const getTotal = (content) => {
  if (!content) {
    return null;
  }

  const cover = floatToInt(content['@_line-rate']);
  const linesValid = parseInt(content['@_lines-valid']);
  const linesCovered = parseInt(content['@_lines-covered']);
  return {
    name: 'TOTAL',
    stmts: linesValid,
    miss: linesValid - linesCovered,
    cover: cover !== '0' ? `${cover}%` : '0',
  };
};

const floatToInt = (strValue) => {
  const floatValue = parseFloat(strValue.replace(',', '.'));
  const intValue = parseInt(floatValue * 100.0, 10);
  return intValue;
};

// parse coverage xml
const parseXml = (coverageData) => {
  let files = [];
  for (let i = 0; i < coverageData.packages.package.length; i++) {
    const package = coverageData.packages.package[i];
    for (let j = 0; j < package.classes.class.length; j++) {
      const c = package.classes.class[j];
      files.push(parseClass(c));
    }
  }
  return files;
};

const parseClass = (c) => {
  const { stmts, missing, totalMissing } = parseLines(c.lines);

  const lineRate = c['@_line-rate'];
  const isFullCoverage = lineRate === '1';
  const cover = isFullCoverage ? '100%' : `${floatToInt(lineRate)}%`;

  return {
    name: c['@_filename'],
    stmts: `${stmts}`,
    miss: `${totalMissing}`,
    cover: cover,
    missing: missing,
  };
};

const parseLines = (lines) => {
  let stmts = 0;
  const missingLines = [];
  for (let i = 0; i < lines.line.length; i++) {
    const line = lines.line[i];
    if (line['@_hits'] === '0') {
      missingLines.push(parseInt(line['@_number']));
    }
  }
  const missing = missingLines.reduce((arr, val, i, a) => {
    if (!i || val !== a[i - 1] + 1) arr.push([]);
    arr[arr.length - 1].push(val);
    return arr;
  }, []);

  const missingTxt = [];
  for (let i = 0; i < missing.length; i++) {
    const m = missing[i];
    if (m.length === 1) {
      missingTxt.push(`${m[0]}`);
    } else {
      missingTxt.push(`${m[0]}-${m[m.length - 1]}`);
    }
  }
  return {
    stmts,
    missing: missingTxt,
    totalMissing: missingLines.length,
  };
};

module.exports = { getCoverageReportXml };
