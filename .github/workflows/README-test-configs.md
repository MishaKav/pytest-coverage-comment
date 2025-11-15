# Test Latest Release Configurations

This document describes the comprehensive test workflow for pytest-coverage-comment v1.2.0.

## Workflow: `test-latest-release-configs.yml`

This workflow tests all major features and configuration options of the action to ensure the latest release works correctly.

### Test Jobs

#### 1. **test-text-badge** - Text Badge Feature
Tests the new `text-instead-badge` option that uses simple text instead of badge images.
- **Features tested**: `text-instead-badge`, basic coverage + JUnit integration
- **Validates**: Coverage percentage, color, test counts

#### 2. **test-xml-skip-covered** - XML Coverage Optimization
Tests XML coverage parsing with the ability to hide files with 100% coverage.
- **Features tested**: `pytest-xml-coverage-path`, `xml-skip-covered`
- **Use case**: Reduce comment size by hiding fully covered files

#### 3. **test-changed-files-only** - Changed Files Filter
Tests showing coverage only for files changed in the PR.
- **Features tested**: `report-only-changed-files`
- **Use case**: Focus reviews on relevant files in large codebases

#### 4. **test-badge-customization** - Badge Options
Tests various badge customization options.
- **Features tested**:
  - `badge-title` - Custom badge text
  - `remove-link-from-badge` - Badge without hyperlink
  - `hide-badge` - No badge at all
- **Use case**: Customize appearance and behavior

#### 5. **test-link-removal** - Link Optimization
Tests link removal options to reduce comment size for large reports.
- **Features tested**:
  - `remove-links-to-files` - Remove file hyperlinks
  - `remove-links-to-lines` - Remove line number links
  - Combined removal of all links
- **Use case**: Work around GitHub's 65,536 character comment limit

#### 6. **test-hide-options** - Hide Report Features
Tests options to hide parts of or the entire comment.
- **Features tested**:
  - `hide-report` - Show only summary, hide detailed table
  - `hide-comment` - Skip PR comment entirely (use outputs only)
- **Use case**: Integration with other tools via outputs

#### 7. **test-multiple-files-advanced** - Monorepo Support
Tests the `multiple-files` option with various configurations.
- **Features tested**: `multiple-files` with different combinations
- **Use case**: Monorepos with multiple Python projects

#### 8. **test-path-prefix** - Path Prefixing
Tests the `coverage-path-prefix` option for monorepo file links.
- **Features tested**: `coverage-path-prefix`
- **Use case**: Correct file links in monorepo structures

#### 9. **test-unique-id-matrix** - Matrix Build Support
Tests unique comment IDs for matrix builds to prevent comment conflicts.
- **Features tested**: `unique-id-for-comment` with matrix strategy
- **Use case**: Multiple Python versions or test suites in parallel

#### 10. **test-junit-features** - JUnit XML Integration
Tests JUnit XML parsing and custom title.
- **Features tested**: `junitxml-path`, `junitxml-title`
- **Validates**: All JUnit outputs (tests, failures, errors, skipped, time, notSuccessTestInfo)

#### 11. **test-default-branch** - Custom Base Branch
Tests custom default branch for file links.
- **Features tested**: `default-branch`
- **Use case**: Projects using `develop`, `master`, or other base branches

#### 12. **test-kitchen-sink** - Combined Configuration
Tests multiple options working together.
- **Features tested**: Nearly all options combined
- **Validates**: All outputs work correctly together

## Running the Tests

### On Pull Requests
The workflow runs automatically on all pull requests.

### Manual Trigger
You can manually trigger the workflow using GitHub Actions UI:
1. Go to Actions tab
2. Select "Test Latest Release Configs"
3. Click "Run workflow"

## Expected Outcomes

All jobs should:
1. ✅ Complete successfully
2. ✅ Generate appropriate PR comments (except when `hide-comment: true`)
3. ✅ Produce correct outputs for verification steps

## Coverage Data Files Used

The workflow uses test data files from the `/data` directory:
- Coverage text files: `pytest-coverage_*.txt`
- Coverage XML files: `coverage_*.xml`
- JUnit XML files: `pytest_*.xml`

## Key Features Tested

| Feature | Description | Test Job |
|---------|-------------|----------|
| `text-instead-badge` | Use text instead of badge images | test-text-badge |
| `xml-skip-covered` | Hide 100% covered files from XML | test-xml-skip-covered |
| `report-only-changed-files` | Show only changed files | test-changed-files-only |
| `badge-title` | Custom badge text | test-badge-customization |
| `remove-link-from-badge` | Badge without link | test-badge-customization |
| `hide-badge` | Hide badge completely | test-badge-customization |
| `remove-links-to-files` | Remove file links | test-link-removal |
| `remove-links-to-lines` | Remove line links | test-link-removal |
| `hide-report` | Hide detailed table | test-hide-options |
| `hide-comment` | No PR comment (outputs only) | test-hide-options |
| `multiple-files` | Monorepo support | test-multiple-files-advanced |
| `coverage-path-prefix` | Path prefix for links | test-path-prefix |
| `unique-id-for-comment` | Matrix build support | test-unique-id-matrix |
| `junitxml-path` | JUnit XML integration | test-junit-features |
| `junitxml-title` | Custom JUnit title | test-junit-features |
| `default-branch` | Custom base branch | test-default-branch |

## Version Tested

These tests are designed for **pytest-coverage-comment v1.2.0** and validate all features available in the latest release.
