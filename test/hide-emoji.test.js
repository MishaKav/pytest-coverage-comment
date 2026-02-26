/* eslint-disable no-console */
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.GITHUB_WORKSPACE = path.resolve(__dirname, '..');
const ghaOutput = path.join(os.tmpdir(), 'gha_output.txt');
try { fs.writeFileSync(ghaOutput, ''); } catch (_) {}
process.env.GITHUB_OUTPUT = ghaOutput;

const { getSummaryReport, getParsedXml } = require('../src/junitXml');
const { getMultipleReport } = require('../src/multiFiles');

const abs = (p) => path.resolve(__dirname, '..', p);

(async () => {
  // Test 1: Default behavior - emojis should be present
  console.log('Test 1: Default behavior (emojis present)...');
  const optionsWithEmoji = {
    xmlFile: abs('data/pytest_1.xml'),
    hideEmoji: false,
  };
  const summaryWithEmoji = getSummaryReport(optionsWithEmoji);
  assert.ok(summaryWithEmoji.includes(':zzz:'), 'Skipped emoji should be present');
  assert.ok(summaryWithEmoji.includes(':x:'), 'Failures emoji should be present');
  assert.ok(summaryWithEmoji.includes(':fire:'), 'Errors emoji should be present');
  assert.ok(summaryWithEmoji.includes(':stopwatch:'), 'Time emoji should be present');
  console.log('✓ Test 1 passed: Emojis are present by default');

  // Test 2: With hideEmoji=true - emojis should NOT be present
  console.log('Test 2: With hideEmoji=true (emojis hidden)...');
  const optionsWithoutEmoji = {
    xmlFile: abs('data/pytest_1.xml'),
    hideEmoji: true,
  };
  const summaryWithoutEmoji = getSummaryReport(optionsWithoutEmoji);
  assert.ok(!summaryWithoutEmoji.includes(':zzz:'), 'Skipped emoji should NOT be present');
  assert.ok(!summaryWithoutEmoji.includes(':x:'), 'Failures emoji should NOT be present');
  assert.ok(!summaryWithoutEmoji.includes(':fire:'), 'Errors emoji should NOT be present');
  assert.ok(!summaryWithoutEmoji.includes(':stopwatch:'), 'Time emoji should NOT be present');
  console.log('✓ Test 2 passed: Emojis are hidden when hideEmoji=true');

  // Test 3: Verify numbers are still present when emojis are hidden
  console.log('Test 3: Numbers still present when emojis hidden...');
  const parsedXml = getParsedXml(optionsWithoutEmoji);
  assert.ok(summaryWithoutEmoji.includes(`${parsedXml.tests}`), 'Tests count should be present');
  assert.ok(summaryWithoutEmoji.includes(`${parsedXml.skipped}`), 'Skipped count should be present');
  assert.ok(summaryWithoutEmoji.includes(`${parsedXml.failures}`), 'Failures count should be present');
  assert.ok(summaryWithoutEmoji.includes(`${parsedXml.errors}`), 'Errors count should be present');
  console.log('✓ Test 3 passed: All numbers are present without emojis');

  // Test 4: Multiple files with hideEmoji=true
  console.log('Test 4: Multiple files with hideEmoji=true...');
  const multiFileOptionsWithoutEmoji = {
    repository: 'owner/repo',
    repoUrl: 'https://github.com/owner/repo',
    commit: 'main',
    defaultBranch: 'main',
    badgeTitle: 'Coverage',
    title: 'Coverage Report',
    hideBadge: false,
    hideReport: false,
    removeLinkFromBadge: true,
    hideEmoji: true,
    multipleFiles: [
      `TXT Title, ${abs('data/pytest-coverage_4.txt')}, ${abs('data/pytest_1.xml')}`,
      `XML Title, ${abs('data/coverage_1.xml')}, ${abs('data/pytest_1.xml')}`,
    ],
  };
  const multiFileTableWithoutEmoji = getMultipleReport(multiFileOptionsWithoutEmoji);
  assert.ok(!multiFileTableWithoutEmoji.includes(':zzz:'), 'Skipped emoji should NOT be in multi-file table');
  assert.ok(!multiFileTableWithoutEmoji.includes(':x:'), 'Failures emoji should NOT be in multi-file table');
  assert.ok(!multiFileTableWithoutEmoji.includes(':fire:'), 'Errors emoji should NOT be in multi-file table');
  assert.ok(!multiFileTableWithoutEmoji.includes(':stopwatch:'), 'Time emoji should NOT be in multi-file table');
  console.log('✓ Test 4 passed: Emojis hidden in multiple files table');

  // Test 5: Multiple files with hideEmoji=false (default)
  console.log('Test 5: Multiple files with hideEmoji=false...');
  const multiFileOptionsWithEmoji = {
    repository: 'owner/repo',
    repoUrl: 'https://github.com/owner/repo',
    commit: 'main',
    defaultBranch: 'main',
    badgeTitle: 'Coverage',
    title: 'Coverage Report',
    hideBadge: false,
    hideReport: false,
    removeLinkFromBadge: true,
    hideEmoji: false,
    multipleFiles: [
      `TXT Title, ${abs('data/pytest-coverage_4.txt')}, ${abs('data/pytest_1.xml')}`,
    ],
  };
  const multiFileTableWithEmoji = getMultipleReport(multiFileOptionsWithEmoji);
  assert.ok(multiFileTableWithEmoji.includes(':zzz:'), 'Skipped emoji should be in multi-file table');
  assert.ok(multiFileTableWithEmoji.includes(':x:'), 'Failures emoji should be in multi-file table');
  assert.ok(multiFileTableWithEmoji.includes(':fire:'), 'Errors emoji should be in multi-file table');
  assert.ok(multiFileTableWithEmoji.includes(':stopwatch:'), 'Time emoji should be in multi-file table');
  console.log('✓ Test 5 passed: Emojis present in multiple files table by default');

  console.log('\n✅ All hide-emoji tests passed!');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
