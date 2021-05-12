const fs = require('fs');

const getPathToFile = (pathToFile) => {
  if (pathToFile == null) {
    return null;
  }

  // suports absolute path like '/tmp/pytest-coverage.txt'
  return pathToFile.startsWith('/')
    ? pathToFile
    : `${process.env.GITHUB_WORKSPACE}/${pathToFile}`;
};

const getContentFile = (pathToFile) => {
  if (!pathToFile) {
    return null;
  }

  console.log(`Try reading file '${pathToFile}'`);
  const fileExists = fs.existsSync(pathToFile);

  if (!fileExists) {
    console.log(`File '${pathToFile}' doesn't exist`);
    return null;
  }

  const content = fs.readFileSync(pathToFile, 'utf8');

  if (!content) {
    console.log(`No content found in file '${pathToFile}'`);
    return null;
  }

  console.log(`File read successfully '${pathToFile}'`);
  return content;
};

module.exports = { getPathToFile, getContentFile };
