# Threat model: pytest-coverage-comment

Written for the OSS Scanner agent. Audit `src/`.

## What this project does and where untrusted input enters

`MishaKav/pytest-coverage-comment` is a JavaScript GitHub Action (`runs.using: node24`, entry `dist/index.js` bundled from `src/index.ts`). It runs **inside other people's CI jobs**. It reads coverage and test-result files from the job's workspace, turns them into markdown/HTML, and publishes the result with a GitHub token that has write access.

How it runs:

- Token: the `github-token` input, defaulting to `${{ github.token }}`. Users grant `pull-requests: write` (often `contents: write` too). The token goes to `@actions/github`'s `getOctokit()` and is used for:
  - `issues.listComments`, `issues.createComment`, `issues.updateComment`: PR comments. An existing comment is found by a hidden watermark prefix `<!-- Pytest Coverage Comment: <job> [| <unique-id-for-comment> ]-->`.
  - `repos.createCommitComment`: on `push`.
  - `repos.compareCommits`, `repos.getCommit`, `pulls.get`: for `report-only-changed-files`.
  - `git.getTag`: resolves annotated tags on tag pushes.
- Supported events (`src/index.ts`): `pull_request`, `pull_request_target`, `push`, `workflow_dispatch`, `workflow_run`. On `workflow_dispatch` and `workflow_run` the body is also written to the job step summary (`core.summary`, capped at 1 MB), and a PR comment is posted only when the `issue-number` input is set.
- Outputs (`core.setOutput`, written to `GITHUB_OUTPUT`; full list in `action.yml` `outputs:`). The ones that carry report-derived text are `coverageHtml`, `summaryReport`, `notSuccessTestInfo` and `failedTestsHtml`. Downstream workflow steps commonly interpolate these into `run:` scripts or README updates (see this repo's `.github/workflows/update-coverage-*.yml`), so their contents matter.
- Size limits: the comment is capped at GitHub's 65,536 characters (`enforceCommentLength` in `index.ts`), and failed-test output has its own caps in `junitXml.ts`.

### Attacker model

The primary attacker is **an outside contributor opening a pull request from a fork**. They control the full contents of the PR's tree: source, tests, fixtures, any file this action later reads, **the names and paths of files** (which become paths inside coverage reports and JUnit tracebacks), and symlinks. In the typical workflow, the victim's CI runs the attacker's tests, which produce the coverage/JUnit files this action consumes. So the attacker can also write those report files directly with arbitrary content.

Setups where this matters most:

- **`pull_request_target`**: the job runs with the base repo's write-capable token. This repo's README recommends it for fork PRs, and workflows often check out the PR head. Everything the action reads is then attacker-controlled while the token can write.
- **`workflow_run`**: a privileged follow-up workflow downloads artifacts (coverage/JUnit files) produced by an unprivileged fork-PR run and posts a comment to `issue-number`. The artifacts are attacker-controlled; the token is privileged.
- **`workflow_dispatch`** with `issue-number`: same as above when the files come from PR content.
- `pull_request` from a fork normally gets a read-only token, but the job log, outputs and step summary are still attacker-influenced.

The attacker does **not** control the workflow YAML of the base repository (that would be a user misconfiguration, see Out of scope), and does not see the token directly.

### Adversarial inputs

Treat all of these as attacker-controlled bytes:

| Input | Read by | Attacker-controlled parts |
|---|---|---|
| `pytest-coverage-path` (pytest-cov `term-missing` text, default `./pytest-coverage.txt`) | `src/parse.ts` | Every line: file names, Stmts/Miss/Branch/BrPart/Cover columns, Missing ranges, TOTAL line, `N warnings in` line |
| `pytest-xml-coverage-path` (Cobertura XML) | `src/parseXml.ts` (xml2js) | Whole document: `<coverage>` totals attributes, `class@filename`, `line@number/hits/branch/condition-coverage/missing-branches`, DOCTYPE/entities, element/attribute names |
| `pytest-json-coverage-path` (coverage.py JSON) | `src/parseJson.ts` (`JSON.parse`) | `totals`, `files` object **keys** (file paths), `summary.*` values and types, `missing_lines`, `missing_branches` arcs |
| `junitxml-path` (JUnit XML) | `src/junitXml.ts` (xml2js) | `testsuite` count attributes, `testcase@classname/name`, `<failure>/<error>` `message` attribute and body text (tracebacks with file paths and line numbers, backtick runs, markdown), `<skipped>` |
| `multiple-files` lines (`Title, coverage-path, junit-path`) | `src/multiFiles.ts` | Each referenced file as above; the type is picked by extension (`.json`/`.xml`, else txt) |
| File paths themselves | `src/utils.ts` (`getPathToFile`, `getContentFile`) | Relative paths are joined to `GITHUB_WORKSPACE`, absolute paths are used as-is, and files are read with `fs.readFileSync`; in a PR checkout, any path may be a symlink |
| Changed-file names | `src/index.ts` `getChangedFiles` (GitHub compare API) | File names in the PR diff, logged and matched against report paths |
| Event payload fields | `src/index.ts` | PR head ref/branch name (`payload.pull_request.head.ref`, `workflow_run.head_branch`), which reaches logs |

Action inputs set by the workflow author (`title`, `badge-title`, `junitxml-title`, `default-branch`, `coverage-path-prefix`, `unique-id-for-comment`, path inputs, booleans) are trusted **unless** a realistic workflow fills them from PR-controlled data (e.g. `unique-id-for-comment: ${{ github.head_ref }}`, or a `multiple-files` list generated by a PR script). Findings that rely on that should say so.

## Components that matter most / least

Most important (all in `src/`):

- `parse.ts`: the text-report parser **and the shared HTML table builder** (`toHtml`, `toTable`, `toRow`, `toFileNameTd`, `toFolderTd`, `toMissingTd`, `toTotalRow`) used by the txt, XML and JSON paths. Pay attention to how values from the report files are placed into HTML elements, attributes and URLs.
- `junitXml.ts`: JUnit parsing, failed-test rendering (`failedTestsToMarkdown`, `toTestName`, `messageToDiffBlock`, `escapeHtml`, `encodePath`), the traceback/location regexes (`LOCATION_LINE_REGEX`, `NATIVE_FRAME_REGEX`, `FRAME_SEPARATOR_REGEX`, `TEST_FILE_REGEX`), and the `notSuccessTestInfo` output.
- `parseXml.ts`, `parseJson.ts`: parsing of untrusted structured data into `CoverageLine` objects.
- `index.ts`: event handling, comment lookup/update by watermark, length enforcement, outputs, step summary, error messages.
- `utils.ts`: path resolution and file reads.
- `multiFiles.ts`: per-line option building and the markdown table.

Out-of-scope paths are listed under "Anything to leave alone".

## In-scope vulnerability classes

Only report issues reachable through this action's code:

1. **Markdown/HTML injection and link spoofing** in the PR comment, commit comment or step summary. Examples: breaking out of table cells, `<details>` or code fences; injecting links or images that point off-site; fake status text or badges; hidden content; @mentions or issue cross-references that notify people; anything that makes content written by the bot account mislead a reviewer. GitHub sanitizes `<script>` and event handlers, so focus on what survives GitHub's markdown sanitizer.
2. **Comment identity confusion**: making the action update or attach its report to a comment it did not create, or anything else that lets an attacker control or later alter content that looks like the bot's report.
3. **XML parsing issues** (xml2js / sax): entity expansion, external entities/XXE, DTD handling, prototype pollution or `__proto__`/`constructor` keys in parsed objects, type confusion (string vs object vs array nodes) that leads to crashes or wrong rendering.
4. **JSON parsing issues**: prototype-polluting keys in `files`, unexpected types for `summary.*` and arcs.
5. **ReDoS / super-linear regex** in `junitXml.ts` and `parse.ts` on long or crafted lines, and quadratic string handling (`split`/`reduce`/`includes` loops) on large inputs.
6. **Path traversal / reading outside the workspace**: absolute paths, `..`, and symlinks committed in a PR that make the action read runner files (event payload, `/proc`, credentials files) and reflect any part of them into logs, outputs or the comment.
7. **Token or secret leakage** into logs, error messages, outputs, the step summary or comments, including through API error objects.
8. **Command / workflow-command injection**: content that reaches stdout as `::command::` lines (e.g. through `core.info`/`core.warning` of attacker data), and injection into `GITHUB_OUTPUT` (multi-line delimiter breaking) or into outputs that downstream `run:` steps commonly interpolate.
9. **Resource-exhaustion DoS** of the job: memory/CPU blowups from huge or deeply nested inputs, failures in the comment-size fallback logic, unbounded loops.
10. Anything else you find where a fork PR can make this action do something its user did not intend with the write token.

## How to exercise it

- The project is built at `/src` by `.oss-scanner/Dockerfile`. Re-run the tests with `cd /src && npm test` (vitest, fully offline).
- Unit tests live in `__tests__/*.test.ts`, sample reports in `data/` (`pytest-coverage_*.txt`, `coverage_*.xml`, `coverage_*.json`, `pytest_*.xml`).
- Easiest PoC harness: add a vitest file under `__tests__/` that writes a malicious report to a temp file and calls the exported functions directly. For example `getCoverageReport`, `getCoverageXmlReport`, `getCoverageJsonReport`, `getSummaryReport`, `getFailedTests`, `failedTestsToMarkdown`, `getNotSuccessTest` and `getMultipleReport`, with an `Options` object (`repoUrl`, `commit`, `prefix`, `pathPrefix`, `title`, `badgeTitle`, `showFailedTests`, `maxFailedTests`, ...). Set `process.env.GITHUB_WORKSPACE` for relative paths. `__tests__/setup.ts` mocks `@actions/core` logging; `@actions/github` must be mocked with `vi.mock()` (see `__tests__/index.test.ts`).
- `src/index.ts` runs `main()` on import and needs a GitHub context. Test its exported helpers (`truncateSummary`, `enforceCommentLength`, `tooLongNotice`, `resolveCommitSha`) or mock `@actions/github`.

## How you rate severity

- **Critical**: exfiltration of the `GITHUB_TOKEN` or other secrets, or code/command execution in the victim's CI job, triggered by fork-PR content.
- **High**: attacker-controlled content published by the bot account that can realistically mislead reviewers (spoofed links, fake coverage/test status, injected markup outside its cell or block); making the action edit or hijack comments it doesn't own; injecting into `GITHUB_OUTPUT` or into outputs in a way that alters downstream steps; reading files outside the workspace and reflecting them into comments, outputs or logs.
- **Medium**: denial of service of the job (crash, hang, memory exhaustion, ReDoS) or reliably suppressing the coverage comment with crafted input; workflow-command injection into logs without further impact.
- **Low**: cosmetic comment issues (broken table layout, wrong numbers from malformed input, harmless markdown quirks inside the attacker's own row) with no misleading effect on reviewers.

Lower the rating by one level when the issue only works with an unusual workflow configuration. Examples: PR-controlled values put into trusted inputs, or a non-default `github-token` with broader scopes.

## Report preferences

For each finding include:

1. A **minimal PoC**: the malicious input file (txt/XML/JSON/JUnit content, or the file layout/symlink) plus the workflow snippet that triggers it. Prefer a realistic `pull_request_target` or `workflow_run` workflow using `MishaKav/pytest-coverage-comment@main`.
2. The **root cause** in `src/` (file and function), not in `dist/`.
3. A **minimal patch** to `src/` with a **regression test** in `__tests__/` that fails before and passes after. Keep the existing output format and behavior for benign inputs.

**Deduplicate by root cause, not by input file.** If one helper renders unsafe data for the txt, XML and JSON paths alike, that is one finding listing all affected inputs.

## Anything to leave alone (out of scope)

- Misconfiguration in the user's workflow (e.g. running untrusted PR code with secrets in `pull_request_target`, granting extra permissions, interpolating outputs unsafely in their own scripts) unless this action's code makes the unsafe pattern the only way to use a feature.
- Bugs in GitHub itself (markdown sanitizer, Actions runner, API).
- Vulnerabilities in dependencies (`@actions/core`, `@actions/github`, `xml2js`, transitive packages) unless they are reachable through this action's code with attacker input and you show that path. The `@actions/core` v2 / `@actions/github` v8 pins are intentional (ncc can't bundle the ESM-only newer majors).
- `dist/` (generated), `src/cli.ts`, `__tests__/`, `data/`, `.github/workflows/` of this repository, and documentation/examples.
