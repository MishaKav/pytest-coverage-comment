import { getCoverageReport } from './parse';
import { getCoverageXmlReport } from './parseXml';
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
// covFile and covXmlFile are mutually exclusive — detected by .xml extension
const getOptions = (options: Options, line: MultipleFileLine): Options => {
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
      const report = internalOptions.covXmlFile
        ? getCoverageXmlReport(internalOptions)
        : getCoverageReport(internalOptions);
      const summary = getParsedXml(internalOptions);

      if (report && report.html) {
        table += `| ${l.title} | ${report.html}`;

        if (i === 0) {
          core.startGroup(
            internalOptions.covXmlFile || internalOptions.covFile,
          );
          const coverageValue = internalOptions.covXmlFile
            ? (report.coverage as { cover?: string } | null)?.cover || ''
            : (report as { coverage: string }).coverage;
          core.info(`coverage: ${coverageValue}`);
          core.info(`color: ${report.color}`);
          if (!internalOptions.covXmlFile) {
            core.info(
              `warnings: ${(report as { warnings?: number }).warnings}`,
            );
          }
          core.endGroup();

          core.setOutput('coverage', coverageValue);
          core.setOutput('color', report.color);
          if (!internalOptions.covXmlFile) {
            core.setOutput(
              'warnings',
              (report as { warnings?: number }).warnings,
            );
          }

          const newOptions = { ...internalOptions, commit: defaultBranch };
          const output = newOptions.covXmlFile
            ? getCoverageXmlReport(newOptions)
            : getCoverageReport(newOptions);
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
