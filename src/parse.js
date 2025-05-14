const core = require('@actions/core');
const { getPathToFile, getContentFile, getCoverageColor } = require('./utils');

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

// return full html coverage report and coverage percentage
const getCoverageReport = (options) => {
  const { covFile, covXmlFile } = options;

  if (!covXmlFile) {
    try {
      const covFilePath = getPathToFile(covFile);
      const content = getContentFile(covFilePath);
      const coverage = getTotalCoverage(content);
      const isValid = isValidCoverageContent(content);

      if (content && !isValid) {
        // prettier-ignore
        core.error(`Coverage file "${covFilePath}" has bad format or wrong data`);
      }

      if (content && isValid) {
        const html = toHtml(content, options);
        const total = getTotal(content);
        const warnings = getWarnings(content);
        const color = getCoverageColor(total ? total.cover : '0');

        return { html, coverage, color, warnings };
      }
    } catch (error) {
      core.error(`Generating coverage report. ${error.message}`);
    }
  }

  return { html: '', coverage: '0', color: 'red', warnings: 0 };
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

  const oldFormatLines = lines.slice(startIndex + 3, endIndex - 1);
  const newFormatLines = oldFormatLines.filter(
    (l) => !l.split('').every((c) => c === '-'),
  );

  return newFormatLines;
};

// get total line from coverage-file
const getTotal = (data) => {
  if (!data || !data.length) {
    return null;
  }

  const lines = data.split('\n');
  const line = lines.find((l) => l.includes('TOTAL    '));

  return parseTotalLine(line);
};

// get number of warnings from coverage-file
const getWarnings = (data) => {
  if (!data || !data.length) {
    return null;
  }

  const WARNINGS_KEY = ' warnings in ';
  if (!data.includes(WARNINGS_KEY)) {
    return 0;
  }

  const line = data.split('\n').find((l) => l.includes(WARNINGS_KEY));
  const lineArr = line.split(' ');
  const indexOfWarnings = lineArr.findIndex((i) => i === 'warnings');

  return parseInt(lineArr[indexOfWarnings - 1]);
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
    : parsedLine[parsedLine.length - 2].trim();
  const missing = isFullCoverage
    ? null
    : parsedLine[parsedLine.length - 1] &&
      parsedLine[parsedLine.length - 1].split(', ');

  return {
    name: parsedLine[0],
    stmts: parsedLine[1].trim(),
    miss: parsedLine[2].trim(),
    cover,
    missing,
  };
};

// parse total line from coverage-file
const parseTotalLine = (line) => {
  if (!line) {
    return null;
  }

  const parsedLine = line.split('  ').filter((l) => l);

  if (parsedLine.length < 4) {
    return null;
  }

  return {
    name: parsedLine[0],
    stmts: parsedLine[1].trim(),
    miss: parsedLine[2].trim(),
    cover: parsedLine[parsedLine.length - 1].trim(),
  };
};

// parse coverage-file
const parse = (data) => {
  const actualLines = getActualLines(data);

  if (!actualLines) {
    return null;
  }

  return actualLines.map(parseOneLine);
};

// collapse all lines to folders structure
const makeFolders = (coverage, options) => {
  const folders = {};

  for (const line of coverage) {
    const parts = line.name.replace(options.prefix, '').split('/');
    const folder = parts.slice(0, -1).join('/');

    folders[folder] = folders[folder] || [];
    folders[folder].push(line);
  }

  return folders;
};

// gets total coverage in percentage
const getTotalCoverage = (data) => {
  const total = getTotal(data);

  return total ? total.cover : '0';
};

// convert all data to html output
const toHtml = (data, options, dataFromXml = null) => {
  const {
    badgeTitle,
    title,
    hideBadge,
    hideReport,
    reportOnlyChangedFiles,
    removeLinkFromBadge,
  } = options;
  const table = hideReport ? '' : toTable(data, options, dataFromXml);
  const total = dataFromXml ? dataFromXml.total : getTotal(data);
  const color = getCoverageColor(total.cover);
  const onlyChnaged = reportOnlyChangedFiles ? '• ' : '';
  const readmeHref = `${options.repoUrl}/blob/${options.commit}/README.md`;
  const badge = `<img alt="${badgeTitle}" src="https://img.shields.io/badge/${badgeTitle}-${total.cover}25-${color}.svg" />`;
  const badgeWithLink = removeLinkFromBadge
    ? badge
    : `<a href="${readmeHref}">${badge}</a>`;
  const badgeHtml = hideBadge ? '' : badgeWithLink;
  const reportHtml = hideReport
    ? ''
    : `<details><summary>${title} ${onlyChnaged}</summary>${table}</details>`;

  return `${badgeHtml}${reportHtml}`;
};

// make html table from coverage-file
const toTable = (data, options, dataFromXml = null) => {
  const coverage = dataFromXml ? dataFromXml.coverage : parse(data);
  const { reportOnlyChangedFiles, changedFiles } = options;

  if (!coverage) {
    core.warning(`Coverage file not well-formed`);
    return null;
  }
  const totalLine = dataFromXml ? dataFromXml.total : getTotal(data);
  options.hasMissing = coverage.some((c) => c.missing);

  core.info(`Generating coverage report`);
  const headTr = toHeadRow(options);
  const totalTr = toTotalRow(totalLine, options);
  const folders = makeFolders(coverage, options);

  const rows = Object.keys(folders)
    .sort()
    .filter((folderPath) => {
      if (!reportOnlyChangedFiles) {
        return true;
      }

      const allFilesInFolder = Object.values(folders[folderPath]).map(
        (f) => f.name,
      );

      folders[folderPath] = folders[folderPath].filter((f) =>
        changedFiles.all.some((c) => c.includes(f.name)),
      );
      const fileExistsInFolder = allFilesInFolder.some((f) =>
        changedFiles.all.some((c) => c.includes(f)),
      );
      return fileExistsInFolder;
    })
    .reduce(
      (acc, key) => [
        ...acc,
        toFolderTd(key, options),
        ...folders[key].map((file) => toRow(file, key !== '', options)),
      ],
      [],
    );

  const hasLines = rows.length > 0;
  const isFilesChanged =
    reportOnlyChangedFiles && !hasLines
      ? `<i>report-only-changed-files is enabled. No files were changed during this commit :)</i>`
      : '';

  // prettier-ignore
  return `<table>${headTr}<tbody>${rows.join('')}${totalTr}</tbody></table>${isFilesChanged}`;
};

// make html head row - th
const toHeadRow = (options) => {
  const lastTd = options.hasMissing ? '<th>Missing</th>' : '';

  return `<tr><th>File</th><th>Stmts</th><th>Miss</th><th>Cover</th>${lastTd}</tr>`;
};

// make html row - tr
const toRow = (item, indent = false, options) => {
  const { stmts, miss, cover } = item;

  const name = toFileNameTd(item, indent, options);
  const missing = toMissingTd(item, options);
  const lastTd = options.hasMissing ? `<td>${missing}</td>` : '';

  return `<tr><td>${name}</td><td>${stmts}</td><td>${miss}</td><td>${cover}</td>${lastTd}</tr>`;
};

// make summary row - tr
const toTotalRow = (item, options) => {
  const { name, stmts, miss, cover } = item;
  const emptyCell = options.hasMissing ? '<td>&nbsp;</td>' : '';

  return `<tr><td><b>${name}</b></td><td><b>${stmts}</b></td><td><b>${miss}</b></td><td><b>${cover}</b></td>${emptyCell}</tr>`;
};

// make fileName cell - td
const toFileNameTd = (item, indent = false, options) => {
  const relative = item.name.replace(options.prefix, '');
  const href = `${options.repoUrl}/blob/${options.commit}/${options.pathPrefix}${relative}`;
  const parts = relative.split('/');
  const last = parts[parts.length - 1];
  const space = indent ? '&nbsp; &nbsp;' : '';

  return `${space}<a href="${href}">${last.replace(/__/g, '\\_\\_')}</a>`;
};

// make folder row - tr
const toFolderTd = (path, options) => {
  if (path === '') {
    return '';
  }

  const colspan = options.hasMissing ? 5 : 4;
  return `<tr><td colspan="${colspan}"><b>${path}</b></td></tr>`;
};

// make missing cell - td
const toMissingTd = (item, options) => {
  if (!item.missing || !item.missing.length) {
    return '&nbsp;';
  }

  return item.missing
    .map((range) => {
      const [start, end = start] = range.split('-');
      const fragment = start === end ? `L${start}` : `L${start}-L${end}`;
      const relative = item.name;
      const href = `${options.repoUrl}/blob/${options.commit}/${options.pathPrefix}${relative}#${fragment}`;
      const text = start === end ? start : `${start}&ndash;${end}`;

      return `<a href="${href}">${text}</a>`;
    })
    .join(', ');
};

module.exports = { getCoverageReport, getCoverageColor, toTable, toHtml };
