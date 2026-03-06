import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import { getCoverageReport } from './parse';
import { getSummaryReport, getParsedXml, getNotSuccessTest } from './junitXml';
import { getMultipleReport } from './multiFiles';
import { getCoverageXmlReport } from './parseXml';
import type { Options } from './types';

/*
  Useful git commands
  git tag -a -m "Export coverage example" v1.1.7 && git push --follow-tags
  git tag -d v1.0
  git tag -d origin v1.0

  # remove all workflows from repo
  gh api repos/MishaKav/pytest-coverage-comment/actions/runs \
  | jq -r '.workflow_runs[] | select(.head_branch != "main") | "\(.id)"' \
  | gxargs -n1 -I '{}' gh api repos/MishaKav/pytest-coverage-comment/actions/runs/{} -X DELETE --silent

  # remove all local branches
  git branch | grep -v "main" | xargs git branch -D
*/

const getPathToFile = (pathToFile: string): string | null => {
  if (!pathToFile) {
    return null;
  }

  // supports absolute path like '/tmp/pytest-coverage.txt'
  return pathToFile.startsWith('/') ? pathToFile : `${__dirname}/${pathToFile}`;
};

const main = async (): Promise<void> => {
  const covFile = './../data/pytest-coverage_4.txt';
  const xmlFile = './../data/pytest_1.xml';
  const covXmlFile = './../data/coverage_1.xml'; // use coverage_2.xml for branch coverage
  const prefix = path.dirname(path.dirname(path.resolve(covFile))) + '/';
  const multipleFiles = [
    `My Title 1, ${getPathToFile(covFile)}, ${getPathToFile(xmlFile)}`,
    `My Title 2, ${getPathToFile(covFile)!.replace('_4', '_3')}, ${getPathToFile(
      xmlFile,
    )!.replace('_1', '_2')}`,
  ];

  let finalHtml = '';

  const options: Options = {
    token: '',
    repository: 'MishaKav/pytest-coverage-comment',
    commit: 'f9d42291812ed03bb197e48050ac38ac6befe4e5',
    prefix,
    pathPrefix: '',
    covFile: getPathToFile(covFile)!,
    xmlFile: getPathToFile(xmlFile)!,
    covXmlFile: getPathToFile(covXmlFile)!,
    defaultBranch: 'main',
    head: 'feat/test',
    base: 'main',
    title: 'Coverage Report',
    badgeTitle: 'Coverage',
    hideBadge: false,
    hideReport: false,
    createNewComment: false,
    reportOnlyChangedFiles: false,
    removeLinkFromBadge: false,
    hideComment: false,
    hideEmoji: false,
    xmlSkipCovered: false,
    xmlTitle: '',
    removeLinksToFiles: false,
    removeLinksToLines: false,
    textInsteadBadge: false,
    multipleFiles,
    changedFiles: {
      all: [
        'functions/example_completed/example_completed.py',
        'functions/example_manager/example_manager.py',
        'functions/example_manager/example_static.py',
      ],
    },
  };

  const report = options.covXmlFile
    ? getCoverageXmlReport(options)
    : getCoverageReport(options);

  const html = report ? report.html : '';

  const summaryReport = getSummaryReport(options);

  // set to output junitxml values
  if (summaryReport) {
    const parsedXml = getParsedXml(options);
    if (parsedXml) {
      const { errors, failures, skipped, tests, time } = parsedXml;
      const valuesToExport = { errors, failures, skipped, tests, time };
      const notSuccessTestInfo = getNotSuccessTest(options);

      console.log('notSuccessTestInfo', JSON.stringify(notSuccessTestInfo));

      Object.entries(valuesToExport).forEach(([key, value]) => {
        console.log(key, value);
      });
    }
  }

  finalHtml += html;
  finalHtml += finalHtml.length ? `\n\n${summaryReport}` : summaryReport;

  let multipleFilesHtml = '';
  if (options.multipleFiles && options.multipleFiles.length) {
    multipleFilesHtml = `\n\n${getMultipleReport(options)}`;
  }

  finalHtml += multipleFilesHtml
    ? `\n\n${multipleFilesHtml}`
    : multipleFilesHtml;

  if (!finalHtml || options.hideComment) {
    console.log('Nothing to report');
    return;
  }

  const resultFile = `${__dirname}/../tmp/result.md`;
  mkdirSync(`${__dirname}/../tmp`, { recursive: true });
  writeFileSync(resultFile, finalHtml);
  console.log(resultFile);
};

main().catch(function (err: Error) {
  console.log(err);
  process.exit(1);
});
