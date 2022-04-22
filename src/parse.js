

const getCoverageReportTxt = (content) => {
  const total = getTotal(content);
  const isValid = isValidCoverageContent(content);

  if (content && isValid) {
    const coverage = parse(content);
    return { coverage, total };
  }
};

// get total line from coverage-file
const getTotal = (data) => {
  if (!data || !data.length) {
    return null;
  }

  const lines = data.split('\n');
  const line = lines.find((l) => l.includes('TOTAL     '));

  return parseTotalLine(line);
};

// parse total line from coverage-file
const parseTotalLine = (line) => {
  if (!line) {
    return null;
  }

  const parsedLine = line.split('   ').filter((l) => l);

  if (parsedLine.length < 4) {
    return null;
  }

  return {
    name: parsedLine[0],
    stmts: parsedLine[1].trimStart(),
    miss: parsedLine[2].trimStart(),
    cover: parsedLine[parsedLine.length - 1].trimStart(),
  };
};

// return true if "coverage file" include all special words
const isValidCoverageContent = (data) => {
  if (!data || !data.length) {
    return false;
  }

  const wordsToInclude = [
    'coverage: platform',
    'Stmts',
    'Miss',
    'Cover',
    'TOTAL',
  ];

  return wordsToInclude.every((w) => data.includes(w));
};

// parse coverage-file
const parse = (data) => {
  const actualLines = getActualLines(data);

  if (!actualLines) {
    return null;
  }

  return actualLines.map(parseOneLine);
};

// get actual lines from coverage-file
const getActualLines = (data) => {
  if (!data || !data.length) {
    return null;
  }

  const lines = data.split('\n');
  const startIndex = lines.findIndex((l) => l.includes('coverage: platform'));
  const endIndex = lines.findIndex((l) => l.includes('TOTAL '));
  if (startIndex === -1) {
    return null;
  }

  return lines.slice(startIndex + 3, endIndex - 1);
};

// parse one line from coverage-file
const parseOneLine = (line) => {
  if (!line) {
    return null;
  }

  const parsedLine = line.split('   ').filter((l) => l);

  if (parsedLine.length < 4) {
    return null;
  }

  const lastItem = parsedLine[parsedLine.length - 1];
  const isFullCoverage = lastItem === '100%';
  const cover = isFullCoverage
    ? '100%'
    : parsedLine[parsedLine.length - 2].trimStart();
  const missing = isFullCoverage
    ? null
    : parsedLine[parsedLine.length - 1] &&
      parsedLine[parsedLine.length - 1].split(', ');

  return {
    name: parsedLine[0],
    stmts: parsedLine[1].trimStart(),
    miss: parsedLine[2].trimStart(),
    cover,
    missing,
  };
};

module.exports = { getCoverageReportTxt };
