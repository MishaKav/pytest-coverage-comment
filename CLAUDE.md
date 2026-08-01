# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pytest-coverage-comment is a GitHub Action that comments on pull requests with pytest code coverage reports. It parses pytest coverage output (txt and xml formats) and JUnit XML test results to create detailed coverage comments with badges and HTML reports.

## Key Implementation Details

- Coverage thresholds for badge colors: 0-40% (red), 40-60% (orange), 60-80% (yellow), 80-90% (green), 90-100% (brightgreen)
- Maximum comment length: 65,536 characters (GitHub limit)
- Supports filtering to show only changed files in the current commit
- Can skip files with 100% coverage from XML reports
- Handles both absolute and relative file paths for coverage inputs
- Coverage parser precedence (index.ts, cli.ts, multiFiles.ts): JSON > XML > TXT. multiFiles picks the parser by file extension (`.json`/`.xml`, else txt). JSON and XML expose `coverage` as a `TotalLine` object; TXT exposes it as a string
- coverage.py JSON schema (from `coverage json`): top-level key is `totals` (not `summary`); per-file `summary.missing_lines` is a **count** while `file.missing_lines` is an **array**; `missing_branches` arcs are `[from, to]` pairs where a negative `to` means an exit arc (`from->exit`)
- The JSON "Missing" column matches `coverage report -m`: a branch arc whose destination is an already-missing line is omitted (the line shows on its own). The XML parser predates this and shows a redundant `from->dest` arrow in that case — a known minor divergence, not fixed to keep the diff minimal
- `formatCoverPercent` (exported from parseXml.ts) is the shared rounding helper (caps 99.x→99, floors 0.x→1); JSON uses coverage.py's precomputed `percent_covered` so it never needs `computeCoverPercent`
- xml2js `parseString` is used synchronously via callback pattern (not async)
- `@actions/github` has ESM/CJS compatibility issues in test context — mock it with `vi.mock()` in tests
- `@actions/core` v3+ and `@actions/github` v9+ are pure ESM — incompatible with ncc's webpack CJS bundling. Must stay on `@actions/core` v2.x and `@actions/github` v8.x until ncc supports ESM or the project switches bundlers
