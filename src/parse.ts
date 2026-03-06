import * as core from '@actions/core';
import { getPathToFile, getContentFile, getCoverageColor } from './utils';
import type {
  Options,
  CoverageLine,
  TotalLine,
  CoverageReport,
  DataFromXml,
} from './types';

// return true if "coverage file" include all special words
const isValidCoverageContent = (data: string): boolean => {
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

// return true if coverage data includes branch coverage columns
const hasBranchCoverage = (data: string): boolean => {
  if (!data || !data.length) {
    return false;
  }

  return data.includes('Branch') && data.includes('BrPart');
};

// return full html coverage report and coverage percentage
export const getCoverageReport = (options: Options): CoverageReport => {
  const { covFile, covXmlFile } = options;

  if (!covXmlFile) {
    try {
      const covFilePath = getPathToFile(covFile);
      const content = getContentFile(covFilePath);
      const coverage = getTotalCoverage(content);
      const isValid = isValidCoverageContent(content!);

      if (content && !isValid) {
        // prettier-ignore
        core.error(`Coverage file "${covFilePath}" has bad format or wrong data`);
      }

      if (content && isValid) {
        const html = toHtml(content, options);
        const total = getTotal(content);
        const warnings = getWarnings(content);
        const color = getCoverageColor(total ? total.cover : '0');

        return { html, coverage, color, warnings: warnings ?? 0 };
      }
    } catch (error) {
      core.error(`Generating coverage report. ${(error as Error).message}`);
    }
  }

  return { html: '', coverage: '0', color: 'red', warnings: 0 };
};

// get actual lines from coverage-file
const getActualLines = (data: string): string[] | null => {
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
const getTotal = (data: string | null): TotalLine | null => {
  if (!data || !data.length) {
    return null;
  }

  const lines = data.split('\n');
  const line = lines.find((l) => l.includes('TOTAL    '));
  const hasBranch = hasBranchCoverage(data);

  return parseTotalLine(line ?? null, hasBranch);
};

// get number of warnings from coverage-file
const getWarnings = (data: string | null): number => {
  if (!data || !data.length) {
    return 0;
  }

  const WARNINGS_KEY = ' warnings in ';
  if (!data.includes(WARNINGS_KEY)) {
    return 0;
  }

  const line = data.split('\n').find((l) => l.includes(WARNINGS_KEY));
  if (!line) {
    return 0;
  }
  const lineArr = line.split(' ');
  const indexOfWarnings = lineArr.findIndex((i) => i === 'warnings');

  return parseInt(lineArr[indexOfWarnings - 1]);
};

// parse one line from coverage-file
const parseOneLine = (
  line: string | null,
  hasBranch = false,
): CoverageLine | null => {
  if (!line) {
    return null;
  }

  const parsedLine = line.split('   ').filter((l) => l);
  const minCols = hasBranch ? 6 : 4;

  if (parsedLine.length < minCols) {
    return null;
  }

  const lastItem = parsedLine[parsedLine.length - 1];
  const isFullCoverage = lastItem === '100%';
  const cover = isFullCoverage
    ? '100%'
    : parsedLine[parsedLine.length - 2].trim();
  const missing: string[] | null = isFullCoverage
    ? null
    : parsedLine[parsedLine.length - 1]
      ? parsedLine[parsedLine.length - 1].split(', ')
      : null;

  const result: CoverageLine = {
    name: parsedLine[0],
    stmts: parsedLine[1].trim(),
    miss: parsedLine[2].trim(),
    cover,
    missing,
  };

  if (hasBranch) {
    result.branch = parsedLine[3].trim();
    result.brpart = parsedLine[4].trim();
  }

  return result;
};

// parse total line from coverage-file
const parseTotalLine = (
  line: string | null,
  hasBranch = false,
): TotalLine | null => {
  if (!line) {
    return null;
  }

  const parsedLine = line.split('  ').filter((l) => l);
  const minCols = hasBranch ? 6 : 4;

  if (parsedLine.length < minCols) {
    return null;
  }

  const result: TotalLine = {
    name: parsedLine[0],
    stmts: parsedLine[1].trim(),
    miss: parsedLine[2].trim(),
    cover: parsedLine[parsedLine.length - 1].trim(),
  };

  if (hasBranch) {
    result.branch = parsedLine[3].trim();
    result.brpart = parsedLine[4].trim();
  }

  return result;
};

// parse coverage-file
const parse = (data: string): CoverageLine[] | null => {
  const actualLines = getActualLines(data);

  if (!actualLines) {
    return null;
  }

  const hasBranch = hasBranchCoverage(data);

  return actualLines
    .map((line) => parseOneLine(line, hasBranch))
    .filter((line): line is CoverageLine => line !== null);
};

// collapse all lines to folders structure
const makeFolders = (
  coverage: CoverageLine[],
  options: Options,
): Record<string, CoverageLine[]> => {
  const folders: Record<string, CoverageLine[]> = {};

  for (const line of coverage) {
    const parts = line.name.replace(options.prefix, '').split('/');
    const folder = parts.slice(0, -1).join('/');

    folders[folder] = folders[folder] || [];
    folders[folder].push(line);
  }

  return folders;
};

// gets total coverage in percentage
const getTotalCoverage = (data: string | null): string => {
  const total = getTotal(data);

  return total ? total.cover : '0';
};

// convert all data to html output
export const toHtml = (
  data: string | null,
  options: Options,
  dataFromXml: DataFromXml | null = null,
): string => {
  const {
    badgeTitle,
    title,
    hideBadge,
    hideReport,
    reportOnlyChangedFiles,
    removeLinkFromBadge,
    textInsteadBadge,
  } = options;
  const table = hideReport ? '' : toTable(data, options, dataFromXml);
  const total = dataFromXml ? dataFromXml.total : getTotal(data);

  if (!total) {
    return '';
  }

  const color = getCoverageColor(total.cover);
  const onlyChanged = reportOnlyChangedFiles ? '\u2022 ' : '';
  const readmeHref = `${options.repoUrl}/blob/${options.commit}/README.md`;
  const badge = `<img alt="${badgeTitle}" src="https://img.shields.io/badge/${badgeTitle}-${total.cover}25-${color}.svg" />`;
  const badgeWithLink = removeLinkFromBadge
    ? badge
    : `<a href="${readmeHref}">${badge}</a>`;
  const covered =
    (typeof total.stmts === 'number' ? total.stmts : parseInt(total.stmts)) -
    (typeof total.miss === 'number' ? total.miss : parseInt(total.miss));
  const textBadge = `${total.cover} (${covered}/${total.stmts})`;
  const badgeContent = textInsteadBadge ? textBadge : badgeWithLink;
  const badgeHtml = hideBadge ? '' : badgeContent;
  const reportHtml = hideReport
    ? ''
    : `<details><summary>${title} ${onlyChanged}</summary>${table}</details>`;

  return `${badgeHtml}${reportHtml}`;
};

// make html table from coverage-file
const toTable = (
  data: string | null,
  options: Options,
  dataFromXml: DataFromXml | null = null,
): string | null => {
  const coverage = dataFromXml ? dataFromXml.coverage : parse(data!);
  const { reportOnlyChangedFiles, changedFiles } = options;

  if (!coverage) {
    core.warning(`Coverage file not well-formed`);
    return null;
  }
  const totalLine = dataFromXml ? dataFromXml.total : getTotal(data!);
  options.hasMissing = coverage.some((c) => c.missing);
  options.hasBranch = coverage.some((c) => c.branch !== undefined);

  core.info(`Generating coverage report`);
  const headTr = toHeadRow(options);
  const totalTr = toTotalRow(totalLine!, options);
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
        changedFiles!.all.some((c) => c.includes(f.name)),
      );
      const fileExistsInFolder = allFilesInFolder.some((f) =>
        changedFiles!.all.some((c) => c.includes(f)),
      );
      return fileExistsInFolder;
    })
    .reduce(
      (acc: string[], key) => [
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
const toHeadRow = (options: Options): string => {
  const branchTh = options.hasBranch ? '<th>Branch</th><th>BrPart</th>' : '';
  const missingTh = options.hasMissing ? '<th>Missing</th>' : '';

  // prettier-ignore
  return `<tr><th>File</th><th>Stmts</th><th>Miss</th>${branchTh}<th>Cover</th>${missingTh}</tr>`;
};

// make html row - tr
const toRow = (
  item: CoverageLine,
  indent: boolean = false,
  options: Options,
): string => {
  const { stmts, miss, cover } = item;

  const name = toFileNameTd(item, indent, options);
  const missing = toMissingTd(item, options);
  const branchTd = options.hasBranch
    ? `<td>${item.branch || 0}</td><td>${item.brpart || 0}</td>`
    : '';
  const missingTd = options.hasMissing ? `<td>${missing}</td>` : '';

  // prettier-ignore
  return `<tr><td>${name}</td><td>${stmts}</td><td>${miss}</td>${branchTd}<td>${cover}</td>${missingTd}</tr>`;
};

// make summary row - tr
const toTotalRow = (item: TotalLine, options: Options): string => {
  const { name, stmts, miss, cover } = item;
  const branchTd = options.hasBranch
    ? `<td><b>${item.branch || 0}</b></td>` +
      `<td><b>${item.brpart || 0}</b></td>`
    : '';
  const missingTd = options.hasMissing ? '<td>&nbsp;</td>' : '';

  // prettier-ignore
  return `<tr><td><b>${name}</b></td><td><b>${stmts}</b></td><td><b>${miss}</b></td>${branchTd}<td><b>${cover}</b></td>${missingTd}</tr>`;
};

// make fileName cell - td
const toFileNameTd = (
  item: CoverageLine,
  indent: boolean = false,
  options: Options,
): string => {
  const relative = item.name.replace(options.prefix, '');
  const href = `${options.repoUrl}/blob/${options.commit}/${options.pathPrefix}${relative}`;
  const parts = relative.split('/');
  const last = parts[parts.length - 1];
  const space = indent ? '&nbsp; &nbsp;' : '';
  const fileName = last.replace(/__/g, '\\_\\_');

  return options.removeLinksToFiles
    ? `${space}${fileName}`
    : `${space}<a href="${href}">${fileName}</a>`;
};

// make folder row - tr
const toFolderTd = (path: string, options: Options): string => {
  if (path === '') {
    return '';
  }

  const colspan =
    4 + (options.hasBranch ? 2 : 0) + (options.hasMissing ? 1 : 0);
  return `<tr><td colspan="${colspan}"><b>${path}</b></td></tr>`;
};

// make missing cell - td
const toMissingTd = (item: CoverageLine, options: Options): string => {
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

      return options.removeLinksToLines
        ? text
        : `<a href="${href}">${text}</a>`;
    })
    .join(', ');
};

export const exportedForTesting = {
  parseOneLine,
  parseTotalLine,
  getActualLines,
  getTotal,
  getWarnings,
  isValidCoverageContent,
  hasBranchCoverage,
  parse,
  toTable,
};
