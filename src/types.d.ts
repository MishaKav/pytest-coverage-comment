export interface Options {
  token: string;
  repository: string;
  prefix: string;
  pathPrefix: string;
  covFile: string;
  covXmlFile: string;
  covJsonFile: string;
  xmlFile: string;
  title: string;
  badgeTitle: string;
  hideBadge: boolean;
  hideReport: boolean;
  createNewComment: boolean;
  hideComment: boolean;
  hideEmoji: boolean;
  xmlSkipCovered: boolean;
  reportOnlyChangedFiles: boolean;
  removeLinkFromBadge: boolean;
  removeLinksToFiles: boolean;
  removeLinksToLines: boolean;
  textInsteadBadge: boolean;
  defaultBranch: string;
  xmlTitle: string;
  showFailedTests: boolean;
  maxFailedTests: number;
  multipleFiles: string[];
  annotateMissingLines?: boolean;
  annotationType?: AnnotationType;
  repoUrl?: string;
  commit?: string;
  head?: string;
  base?: string;
  changedFiles?: ChangedFiles | null;
  // Set during processing in toTable()
  hasMissing?: boolean;
  hasBranch?: boolean;
}

export interface ChangedFiles {
  all: string[];
  added?: string[];
  modified?: string[];
  removed?: string[];
  renamed?: string[];
  AddedOrModified?: string[];
  // line numbers added in the head version of each file, keyed by full repo path
  addedLines?: Record<string, number[]>;
}

export type AnnotationType = 'notice' | 'warning' | 'error';

export type CoverageColor =
  'red' | 'orange' | 'yellow' | 'green' | 'brightgreen';

export interface CoverageLine {
  name: string;
  stmts: string;
  miss: string;
  cover: string;
  missing: string[] | null;
  // every missing branch arc (json), `missing` leaves out arcs to missing lines
  missingBranches?: string[];
  branch?: string;
  brpart?: string;
}

export interface TotalLine {
  name: string;
  stmts: string | number;
  miss: string | number;
  cover: string;
  branch?: string;
  brpart?: string;
}

export interface CoverageReport {
  html: string;
  coverage: string;
  color: CoverageColor;
  warnings: number;
  // per-file rows, e.g. for annotations
  lines?: CoverageLine[];
}

export interface XmlCoverageReport {
  html: string;
  coverage: TotalLine | null;
  color: CoverageColor;
  lines?: CoverageLine[];
}

export interface DataFromXml {
  coverage: CoverageLine[];
  total: TotalLine;
}

export interface JUnitSummary {
  errors: number;
  failures: number;
  skipped: number;
  tests: number;
  time: number;
}

export interface TestCaseInfo {
  classname: string;
  name: string;
}

export interface NotSuccessTestInfo {
  count: number;
  failures: TestCaseInfo[];
  errors: TestCaseInfo[];
  skipped: TestCaseInfo[];
}

export interface FailedTest {
  classname: string;
  name: string;
  message: string;
  file?: string;
  line?: number;
}

export interface MultipleFileLine {
  title: string;
  covFile: string;
  xmlFile: string;
}

export interface ColorRange {
  color: CoverageColor;
  range: [number, number];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParsedXml = any;
