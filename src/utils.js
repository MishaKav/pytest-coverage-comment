const fs = require('fs');
const core = require('@actions/core');

const getPathToFile = (pathToFile) => {
  if (!pathToFile) {
    return null;
  }

  // suports absolute path like '/tmp/pytest-coverage.txt'
  return pathToFile.startsWith('/')
    ? pathToFile
    : `${process.env.GITHUB_WORKSPACE}/${pathToFile}`;
};

const getContentFile = (pathToFile, skipWarning = false) => {
  if (!pathToFile || skipWarning) {
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

const getContent = (filePath) => {
  try {
    const fullFilePath = getPathToFile(filePath);

    if (fullFilePath) {
      const content = getContentFile(fullFilePath);

      return content;
    }
  } catch (error) {
    core.error(`Could not get content of "${filePath}". ${error.message}`);
  }

  return null;
};

// get coverage color from coverage percentage
const getCoverageColor = (percentage) => {
  // https://shields.io/category/coverage
  const rangeColors = [
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

  const num = parseFloat(percentage);

  const { color } =
    rangeColors.find(({ range: [min, max] }) => num >= min && num < max) ||
    rangeColors[0];

  return color;
};

module.exports = {
  getPathToFile,
  getContentFile,
  getContent,
  getCoverageColor,
};
