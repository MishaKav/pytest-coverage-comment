import * as fs from 'fs';
import * as core from '@actions/core';
import type { CoverageColor, ColorRange } from './types';

export const getPathToFile = (pathToFile: string): string | null => {
  if (!pathToFile) {
    return null;
  }

  // supports absolute path like '/tmp/pytest-coverage.txt'
  return pathToFile.startsWith('/')
    ? pathToFile
    : `${process.env.GITHUB_WORKSPACE}/${pathToFile}`;
};

export const getContentFile = (pathToFile: string | null): string | null => {
  if (!pathToFile) {
    return null;
  }

  const fileExists = fs.existsSync(pathToFile);

  if (!fileExists) {
    core.warning(`File "${pathToFile}" doesn't exist`);
    return null;
  }

  const content = fs.readFileSync(pathToFile, 'utf8');

  if (!content) {
    core.warning(`No content found in file "${pathToFile}"`);
    return null;
  }

  core.info(`File read successfully "${pathToFile}"`);
  return content;
};

// escape characters that are unsafe inside generated html
export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// escape a value placed inside a double-quoted html attribute
export const escapeHtmlAttr = (text: string): string =>
  escapeHtml(text).replace(/"/g, '&quot;');

// url-encode each segment of a repo path for use in a link
// (toWellFormed: a lone utf-16 surrogate makes encodeURIComponent throw)
export const encodePath = (path: string): string =>
  path
    .split('/')
    .map((segment) => encodeURIComponent(segment.toWellFormed()))
    .join('/');

// a `..` segment would let a link leave the repo once the browser resolves it
export const hasParentSegment = (path: string): boolean =>
  path.split('/').includes('..');

export const getContent = (filePath: string): string | null => {
  try {
    const fullFilePath = getPathToFile(filePath);

    if (fullFilePath) {
      const content = getContentFile(fullFilePath);

      return content;
    }
  } catch (error) {
    core.error(
      `Could not get content of "${filePath}". ${(error as Error).message}`,
    );
  }

  return null;
};

// get coverage color from coverage percentage
export const getCoverageColor = (
  percentage: string | number,
): CoverageColor => {
  // https://shields.io/category/coverage
  const rangeColors: ColorRange[] = [
    {
      color: 'red',
      range: [0, 40],
    },
    {
      color: 'orange',
      range: [40, 60],
    },
    {
      color: 'yellow',
      range: [60, 80],
    },
    {
      color: 'green',
      range: [80, 90],
    },
    {
      color: 'brightgreen',
      range: [90, 101],
    },
  ];

  const num = parseFloat(String(percentage));

  const found = rangeColors.find(
    ({ range: [min, max] }) => num >= min && num < max,
  );

  return (found || rangeColors[0]).color;
};
