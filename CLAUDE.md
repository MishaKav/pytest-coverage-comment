# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pytest-coverage-comment is a GitHub Action that comments on pull requests with pytest code coverage reports. It parses pytest coverage output (txt and xml formats) and JUnit XML test results to create detailed coverage comments with badges and HTML reports.

## Development Commands

### Build and Bundle

```bash
npm run build      # Bundle the action with ncc (compiles TS + bundles) into dist/index.js
npm run all        # Run typecheck, lint, format, test, and build in sequence
```

### Type Checking and Code Quality

```bash
npm run typecheck  # Run tsc --noEmit (type-check only, no output)
npm run lint       # Run ESLint on src/**/*.ts
npm run format     # Format code with Prettier
npm run format-check # Check formatting without changing files
```

### Testing

```bash
npm test           # Run Vitest tests (vitest run)
npm run test:watch # Run Vitest in watch mode
npm run test:coverage # Run tests with V8 coverage
```

### Version Management

```bash
npm run bump-version # Increment patch version
```

### Local Testing

The `src/cli.ts` file contains a CLI tool for local testing of coverage parsing functionality. It can be run directly to test coverage report generation without GitHub Actions.

## Architecture Overview

The codebase is a TypeScript GitHub Action with the following key components:

### Entry Points

- **src/index.ts**: Main GitHub Action entry point that orchestrates the entire workflow
- **src/cli.ts**: CLI utility for local testing and development

### Type Definitions

- **src/types.d.ts**: All shared TypeScript interfaces (Options, CoverageLine, TotalLine, etc.)

### Core Parsing Modules

- **src/parse.ts**: Parses pytest text coverage output (e.g., from `pytest --cov`)
- **src/parseXml.ts**: Parses XML coverage reports (e.g., from `pytest --cov-report=xml`)
- **src/junitXml.ts**: Parses JUnit XML test results for test statistics

### Supporting Modules

- **src/multiFiles.ts**: Handles multiple coverage files (useful for monorepos)
- **src/utils.ts**: Shared utilities for file operations, color determination, and GitHub API interactions

### Test Infrastructure

- **\_\_tests\_\_/setup.ts**: Global test setup with `spyCore` mocks for `@actions/core`
- **\_\_tests\_\_/\*.test.ts**: Vitest unit tests for each module (91 tests total)
- Uses `exportedForTesting` pattern to expose internal functions for testing
- Test fixtures in `data/` directory (pytest coverage txt, coverage xml, junit xml)

### Build System

- TypeScript is used for type-checking only (`noEmit: true` in tsconfig)
- `@vercel/ncc` compiles TS and bundles directly to `dist/index.js` in a single step
- No intermediate `lib/` or `outDir` needed

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
- xml2js `parseString` is used synchronously via callback pattern (not async)
- `@actions/github` has ESM/CJS compatibility issues in test context — mock it with `vi.mock()` in tests
- `@actions/core` v3+ and `@actions/github` v9+ are pure ESM — incompatible with ncc's webpack CJS bundling. Must stay on `@actions/core` v2.x and `@actions/github` v8.x until ncc supports ESM or the project switches bundlers
