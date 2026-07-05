import { getCoverageReport } from './parse';
import { getCoverageXmlReport } from './parseXml';
import { getCoverageJsonReport } from './parseJson';
import { getParsedXml } from './junitXml';
import * as core from '@actions/core';
import type { Options, MultipleFileLine } from './types';

// parse oneline from multiple files to object
const parseLine = (line: string): MultipleFileLine | null => {
  if (!line || !line.includes(',')) {
    return null;
  }

  const lineArr = line.split(',');

  return {
    title: lineArr[0].trim(),
    covFile: lineArr[1].trim(),
    xmlFile: lineArr.length > 2 ? lineArr[2].trim() : '',
  };
};

// make internal options
// covFile, covXmlFile and covJsonFile are mutually exclusive — detected by extension
const getOptions = (options: Options, line: MultipleFileLine): Options => {
  const isXmlCoverage =
    line.covFile && line.covFile.toLowerCase().endsWith('.xml');
  const isJsonCoverage =
    line.covFile && line.covFile.toLowerCase().endsWith('.json');
  return {
    ...options,
    title: line.title,
    covFile: isXmlCoverage || isJsonCoverage ? '' : line.covFile,
    covXmlFile: isXmlCoverage ? line.covFile : '',
    covJsonFile: isJsonCoverage ? line.covFile : '',
    hideReport: true,
    xmlFile: line.xmlFile,
    xmlTitle: '',
  };
};

// return multiple report in markdown format
export const getMultipleReport = (options: Options): string => {
  const { multipleFiles, defaultBranch } = options;

  try {
    const lineReports = multipleFiles
      .map(parseLine)
      .filter((l): l is MultipleFileLine => l !== null);
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
      let report;
      if (internalOptions.covJsonFile) {
        report = getCoverageJsonReport(internalOptions);
      } else if (internalOptions.covXmlFile) {
        report = getCoverageXmlReport(internalOptions);
      } else {
        report = getCoverageReport(internalOptions);
      }
      const summary = getParsedXml(internalOptions);

      if (report && report.html) {
        table += `| ${l.title} | ${report.html}`;

        if (i === 0) {
          core.startGroup(
            internalOptions.covXmlFile ||
              internalOptions.covJsonFile ||
              internalOptions.covFile,
          );
          const coverageValue =
            internalOptions.covXmlFile || internalOptions.covJsonFile
              ? (report.coverage as { cover?: string } | null)?.cover || ''
              : (report as { coverage: string }).coverage;
          core.info(`coverage: ${coverageValue}`);
          core.info(`color: ${report.color}`);
          if (!internalOptions.covXmlFile && !internalOptions.covJsonFile) {
            core.info(
              `warnings: ${(report as { warnings?: number }).warnings}`,
            );
          }
          core.endGroup();

          core.setOutput('coverage', coverageValue);
          core.setOutput('color', report.color);
          if (!internalOptions.covXmlFile && !internalOptions.covJsonFile) {
            core.setOutput(
              'warnings',
              (report as { warnings?: number }).warnings,
            );
          }

          const newOptions = { ...internalOptions, commit: defaultBranch };
          let output;
          if (newOptions.covJsonFile) {
            output = getCoverageJsonReport(newOptions);
          } else if (newOptions.covXmlFile) {
            output = getCoverageXmlReport(newOptions);
          } else {
            output = getCoverageReport(newOptions);
          }
          if (output) {
            core.setOutput('coverageHtml', output.html);
          }

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
          time > 60
            ? `${(time / 60) | 0}m ${(time % 60) | 0}s`
            : `${time.toFixed(3)}s`;
        const e = (emoji: string): string =>
          options.hideEmoji ? '' : ` ${emoji}`;
        table += `| ${tests} | ${skipped}${e(':zzz:')} | ${failures}${e(':x:')} | ${errors}${e(':fire:')} | ${displayTime}${e(':stopwatch:')} |\n`;
      } else {
        table += '\n';
      }
    });

    return table;
  } catch (error) {
    core.error(`Error generating summary report. ${(error as Error).message}`);
  }

  return '';
};

export const exportedForTesting = {
  parseLine,
  getOptions,
};
