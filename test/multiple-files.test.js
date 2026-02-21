/* eslint-disable no-console */
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.GITHUB_WORKSPACE = path.resolve(__dirname, '..');
const ghaOutput = path.join(os.tmpdir(), 'gha_output.txt');
try { fs.writeFileSync(ghaOutput, ''); } catch (_) {}
process.env.GITHUB_OUTPUT = ghaOutput;

const { getMultipleReport } = require('../src/multiFiles');

const abs = (p) => path.resolve(__dirname, '..', p);

(async () => {
  const options = {
    // inherited by line internals
    repository: 'owner/repo',
    repoUrl: 'https://github.com/owner/repo',
    commit: 'main',
    defaultBranch: 'main',
    badgeTitle: 'Coverage',
    title: 'Coverage Report',
    hideBadge: false,
    hideReport: false,
    removeLinkFromBadge: true,

    // important: two lines — one TXT coverage, one XML coverage
    multipleFiles: [
      `TXT Title, ${abs('data/pytest-coverage_4.txt')}, ${abs('data/pytest_1.xml')}`,
      `XML Title, ${abs('data/coverage_1.xml')}, ${abs('data/pytest_1.xml')}`,
    ],
  };

  const table = getMultipleReport(options);

  // Basic presence checks
  assert.ok(table && typeof table === 'string', 'Table should be a non-empty string');

  // Header should include Tests columns (since junit xml provided)
  assert.ok(table.includes('| Title | Coverage | Tests | Skipped | Failures | Errors | Time |'),
    'Header with Tests/Skipped/Failures/Errors/Time should be present');

  // Titles present
  assert.ok(table.includes('TXT Title'), 'TXT title row present');
  assert.ok(table.includes('XML Title'), 'XML title row present');

  // Badge present (from toHtml)
  assert.ok(table.includes('img.shields.io/badge'), 'Badge should be present');

  // JUnit summary columns should be filled for both rows
  // Skipped/failures/errors/time icons present
  assert.ok(table.includes(':zzz:'), 'Skipped emoji should be present');
  assert.ok(table.includes(':x:'), 'Failures emoji should be present');
  assert.ok(table.includes(':fire:'), 'Errors emoji should be present');
  assert.ok(table.includes(':stopwatch:'), 'Time emoji should be present');

  console.log('OK: multiple-files TXT and XML coverage supported.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
