const { getCoverageReport } = require('./parse');
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
const getOptions = (options = {}, line = {}) => ({
  ...options,
  title: line.title,
  covFile: line.covFile,
  hideReport: true,
  xmlFile: line.xmlFile,
  xmlTitle: '',
});

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
      const coverage = getCoverageReport(internalOptions);
      const summary = getParsedXml(internalOptions);

      if (coverage.html) {
        table += `| ${l.title} | ${coverage.html}`;

        if (i === 0) {
          core.startGroup(internalOptions.covFile);
          core.info(`coverage: ${coverage.coverage}`);
          core.info(`color: ${coverage.color}`);
          core.info(`warnings: ${coverage.warnings}`);
          core.endGroup();

          core.setOutput('coverage', coverage.coverage);
          core.setOutput('color', coverage.color);
          core.setOutput('warnings', coverage.warnings);

          const newOptions = { ...internalOptions, commit: defaultBranch };
          const output = getCoverageReport(newOptions);
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
