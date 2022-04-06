const xml2js = require('xml2js');
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

  const parser = new xml2js.Parser();
  const parsed = parser.parseString(content);
  if (!parsed) {
    core.warning(`Coverage file is not XML or not well formed`);
    return '';
  }

  return parser.resultObject.coverage;
};

const getTotal = (content) => {
  if (!content) {
    return null;
  }

  const cover = floatToInt(getXmlAttrib(content, 'line-rate'));
  const linesValid = parseInt(getXmlAttrib(content, 'lines-valid'));
  const linesCovered = parseInt(getXmlAttrib(content, 'lines-covered'));
  return {
    name: 'TOTAL',
    stmts: linesValid,
    miss: linesValid - linesCovered,
    cover: cover !== '0' ? `${cover}%` : '0',
  };
};

const getXmlAttrib = (obj, attribName) => {
  const entries = Object.entries(obj.$);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e[0] === attribName) {
      return e[1];
    }
  }
  return null;
};

const floatToInt = (strValue) => {
  const floatValue = parseFloat(strValue.replace(',', '.'));
  const intValue = parseInt(floatValue * 100.0, 10);
  return intValue;
};

// parse coverage xml
const parseXml = (coverageData) => {
  let files = [];
  for (let i = 0; i < coverageData.packages.length; i++) {
    const package = coverageData.packages[i].package;
    for (let j = 0; j < package.length; j++) {
      const classes = package[j].classes;
      for (let k = 0; k < classes.length; k++) {
        const c = classes[k].class;
        for (let l = 0; l < c.length; l++) {
          files.push(parseClass(c[l]));
        }
      }
    }
  }
  return files;
};

const parseClass = (c) => {
  const { stmts, missing, totalMissing } = parseLines(c.lines);

  const lineRate = getXmlAttrib(c, 'line-rate');
  const isFullCoverage = lineRate === '1';
  const cover = isFullCoverage ? '100%' : `${floatToInt(lineRate)}%`;

  return {
    name: c.$.filename,
    stmts: `${stmts}`,
    miss: `${totalMissing}`,
    cover: cover,
    missing: missing,
  };
};

const parseLines = (lines) => {
  let stmts = 0;
  const missingLines = [];
  for (let i = 0; i < lines.length; i++) {
    const iter = lines[i].line;
    for (let j = 0; j < iter.length; j++) {
      stmts++;
      const line = iter[j];
      if (line.$.hits === '0') {
        missingLines.push(parseInt(line.$.number));
      }
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
