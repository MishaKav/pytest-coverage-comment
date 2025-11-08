# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pytest-coverage-comment is a GitHub Action that comments on pull requests with pytest code coverage reports. It parses pytest coverage output (txt and xml formats) and JUnit XML test results to create detailed coverage comments with badges and HTML reports.

## Development Commands

### Build and Bundle
```bash
npm run build      # Bundle the action with ncc into dist/index.js
npm run all        # Run lint, format, and build in sequence
```

### Code Quality
```bash
npm run lint       # Run ESLint on src/**/*.js
npm run format     # Format code with Prettier
npm run format-check # Check formatting without changing files
```

### Version Management
```bash
npm run bump-version # Increment patch version
```

### Local Testing
The `src/cli.js` file contains a CLI tool for local testing of coverage parsing functionality. It can be run directly to test coverage report generation without GitHub Actions.

## Architecture Overview

The codebase is a Node.js GitHub Action with the following key components:

### Entry Points
- **src/index.js**: Main GitHub Action entry point that orchestrates the entire workflow
- **src/cli.js**: CLI utility for local testing and development

### Core Parsing Modules
- **src/parse.js**: Parses pytest text coverage output (e.g., from `pytest --cov`)
- **src/parseXml.js**: Parses XML coverage reports (e.g., from `pytest --cov-report=xml`)
- **src/junitXml.js**: Parses JUnit XML test results for test statistics

### Supporting Modules
- **src/multiFiles.js**: Handles multiple coverage files (useful for monorepos)
- **src/utils.js**: Shared utilities for file operations, color determination, and GitHub API interactions

### Data Flow
1. Action receives coverage files (txt/xml) and JUnit XML as inputs
2. Parsers extract coverage percentages, file details, and test statistics
3. HTML report is generated with file links pointing to the repository
4. Comment is created/updated on PR using GitHub API with coverage badge and collapsible report

### GitHub Integration
- Uses `@actions/core` for input/output handling
- Uses `@actions/github` for API interactions (creating/updating PR comments)
- Supports comment watermarking to update existing comments instead of creating duplicates

## Key Implementation Details

- Coverage thresholds for badge colors: 0-40% (red), 40-60% (orange), 60-80% (yellow), 80-90% (green), 90-100% (brightgreen)
- Maximum comment length: 65,536 characters (GitHub limit)
- Supports filtering to show only changed files in the current commit
- Can skip files with 100% coverage from XML reports
- Handles both absolute and relative file paths for coverage inputs

## Testing Notes

<!-- Test branch for v1.1.58 release verification -->