const { getCoverageReport } = require('./parse');
const { getCoverageXmlReport } = require('./parseXml');
const { getParsedXml } = require('./junitXml');
const core = require('@actions/core');

// parse oneline from multiple files to object
const parseLine = (line) => {
  if (!line || !line.includes(',')) {
    return '';
  }

  const lineArr = line.split(',');

  return {
    title: lineArr[0].trim(),
    covFile: lineArr[1].trim(),
    xmlFile: lineArr.length > 2 ? lineArr[2].trim() : '',
  };
};

// make internal options
const getOptions = (options = {}, line = {}) => {
  const isXmlCoverage =
    line.covFile && line.covFile.toLowerCase().endsWith('.xml');
  return {
    ...options,
    title: line.title,
    covFile: isXmlCoverage ? '' : line.covFile,
    covXmlFile: isXmlCoverage ? line.covFile : '',
    hideReport: true,
    xmlFile: line.xmlFile,
    xmlTitle: '',
  };
};

// return multiple report in markdown format
const getMultipleReport = (options) => {
  const { multipleFiles, defaultBranch } = options;

  try {
    const lineReports = multipleFiles.map(parseLine).filter((l) => l);
    const hasXmlReports = lineReports.some((l) => l.xmlFile);
    const miniTable = `| Title | Coverage |
| ----- | ----- |
`;
    const fullTable = `| Title | Coverage | Tests | Skipped | Failures | Errors | Time |
| ----- | ----- | ----- | ------- | -------- | -------- | ------------------ |
`;
    let table = hasXmlReports ? fullTable : miniTable;

    lineReports.forEach((l, i) => {
      const internalOptions = getOptions(options, l);
      const report = internalOptions.covXmlFile
        ? getCoverageXmlReport(internalOptions)
        : getCoverageReport(internalOptions);
      const summary = getParsedXml(internalOptions);

      if (report.html) {
        table += `| ${l.title} | ${report.html}`;

        if (i === 0) {
          core.startGroup(
            internalOptions.covXmlFile || internalOptions.covFile,
          );
          const coverageValue = internalOptions.covXmlFile
            ? report.coverage.cover
            : report.coverage;
          core.info(`coverage: ${coverageValue}`);
          core.info(`color: ${report.color}`);
          if (!internalOptions.covXmlFile) {
            core.info(`warnings: ${report.warnings}`);
          }
          core.endGroup();

          core.setOutput('coverage', coverageValue);
          core.setOutput('color', report.color);
          if (!internalOptions.covXmlFile) {
            core.setOutput('warnings', report.warnings);
          }

          const newOptions = { ...internalOptions, commit: defaultBranch };
          const output = newOptions.covXmlFile
            ? getCoverageXmlReport(newOptions)
            : getCoverageReport(newOptions);
          core.setOutput('coverageHtml', output.html);

          if (summary) {
            const { errors, failures, skipped, tests, time } = summary;
            const valuesToExport = { errors, failures, skipped, tests, time };

            core.startGroup(internalOptions.xmlFile);
            Object.entries(valuesToExport).forEach(([key, value]) => {
              core.setOutput(key, value);
              core.info(`${key}: ${value}`);
            });
            core.endGroup();
          }
        }
      } else if (summary) {
        table += `| ${l.title} |  `;
      }

      if (hasXmlReports && summary) {
        const { errors, failures, skipped, tests, time } = summary;
        const displayTime =
          time > 60 ? `${(time / 60) | 0}m ${time % 60 | 0}s` : `${time}s`;
        table += `| ${tests} | ${skipped} :zzz: | ${failures} :x: | ${errors} :fire: | ${displayTime} :stopwatch: |
`;
      } else {
        table += `
`;
      }
    });

    return table;
  } catch (error) {
    core.error(`Error generating summary report. ${error.message}`);
  }

  return '';
};

module.exports = { getMultipleReport };
