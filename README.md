# Pytest Coverage Comment

![License](https://img.shields.io/github/license/MishaKav/pytest-coverage-comment)
![Version](https://img.shields.io/github/package-json/v/MishaKav/pytest-coverage-comment)
[![Wakatime](https://wakatime.com/badge/user/f838c8aa-c197-42f0-b335-cd1d26159dfd/project/b1e64a51-e518-4b91-bb00-189ffdd444c6.svg)](https://wakatime.com/badge/user/f838c8aa-c197-42f0-b335-cd1d26159dfd/project/b1e64a51-e518-4b91-bb00-189ffdd444c6)

A GitHub Action that adds pytest coverage reports as comments to your pull requests, helping you track and improve test coverage with visual feedback.

## 🎯 Features

- 📊 **Visual Coverage Reports** - Automatically comments on PRs with detailed coverage tables
- 🏷️ **Coverage Badges** - Dynamic badges showing coverage percentage with color coding
- 📈 **Test Statistics** - Shows passed, failed, skipped tests with execution time
- 🔗 **Direct File Links** - Click to view uncovered lines directly in your repository
- 📁 **Multiple Reports** - Support for monorepo with multiple coverage reports
- 🎨 **Customizable** - Flexible titles, badges, and display options
- 📝 **XML Support** - Works with both text and XML coverage formats
- 🚀 **Smart Updates** - Updates existing comments instead of creating duplicates

## 📋 Table of Contents

<details>
<summary>Click to expand</summary>

- [Pytest Coverage Comment](#pytest-coverage-comment)
  - [🎯 Features](#-features)
  - [📋 Table of Contents](#-table-of-contents)
  - [📦 Prerequisites](#-prerequisites)
  - [🚀 Quick Start](#-quick-start)
  - [⚙️ Configuration](#️-configuration)
    - [Inputs](#inputs)
    - [Outputs](#outputs)
  - [📚 Usage Examples](#-usage-examples)
    - [Basic Usage](#basic-usage)
    - [Coverage from XML](#coverage-from-xml)
    - [Monorepo Support](#monorepo-support)
    - [Docker Workflows](#docker-workflows)
    - [Matrix Builds](#matrix-builds)
    - [Auto-update README Badge](#auto-update-readme-badge)
  - [🔬 Advanced Features](#-advanced-features)
  - [🎨 Badge Colors](#-badge-colors)
  - [📸 Result Examples](#-result-examples)
    - [Standard Comment (Collapsed)](#standard-comment-collapsed)
    - [Expanded Coverage Report](#expanded-coverage-report)
    - [Multiple Files (Monorepo)](#multiple-files-monorepo)
  - [🔧 Troubleshooting](#-troubleshooting)
    - [Comment Not Appearing](#comment-not-appearing)
    - [Unrecognized Arguments Error](#unrecognized-arguments-error)
    - [Coverage Report Too Large](#coverage-report-too-large)
    - [GitHub Step Summary Too Large](#github-step-summary-too-large)
    - [Files Not Found](#files-not-found)
    - [Wrong File Links](#wrong-file-links)
  - [🤝 Contributing](#-contributing)
    - [Development Setup](#development-setup)
  - [👥 Contributors](#-contributors)
  - [📄 License](#-license)
  - [🔗 Similar Actions](#-similar-actions)

</details>

## 📦 Prerequisites

Before using this action, ensure you have the following installed in your Python environment:

- **Python** - Version 3.6+ (Python 3.9+ recommended for latest pytest/pytest-cov versions)
- **pytest** - Python testing framework
- **pytest-cov** - Coverage plugin for pytest (provides `--cov` and `--cov-report` flags)

```bash
pip install pytest pytest-cov
```

> **Note**: The `--cov` and `--cov-report` flags used in the examples below are provided by `pytest-cov`, not pytest itself. If you see an error like `pytest: error: unrecognized arguments: --cov`, you need to install `pytest-cov`.

<details>
<summary>Python version compatibility</summary>

- **Python 3.9+**: Supported by latest pytest (8.4+) and pytest-cov (6.0+) versions
- **Python 3.8**: Use pytest-cov < 6.0.0 (e.g., pytest-cov 5.x)
- **Python 3.7**: Use pytest-cov < 5.0.0 (e.g., pytest-cov 4.x)
- **Python 3.6 and older**: Use older versions of pytest and pytest-cov

For most users, we recommend using **Python 3.9+** with the latest versions of pytest and pytest-cov to get the latest features and security updates.

</details>

## 🚀 Quick Start

Add this action to your workflow:

```yaml
- name: Pytest coverage comment
  uses: MishaKav/pytest-coverage-comment@main
  with:
    pytest-coverage-path: ./pytest-coverage.txt
    junitxml-path: ./pytest.xml
```

<details>
<summary>📖 Complete workflow example</summary>

```yaml
name: pytest-coverage-comment
on:
  pull_request:
    branches:
      - '*'

permissions:
  contents: write
  checks: write
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: 3.11

      - name: Install dependencies
        run: |
          pip install pytest pytest-cov

      - name: Run tests with coverage
        run: |
          pytest --junitxml=pytest.xml --cov-report=term-missing:skip-covered --cov=src tests/ | tee pytest-coverage.txt

      - name: Pytest coverage comment
        uses: MishaKav/pytest-coverage-comment@main
        with:
          pytest-coverage-path: ./pytest-coverage.txt
          junitxml-path: ./pytest.xml
```

</details>

## ⚙️ Configuration

### Inputs

<details>
<summary>📝 Core Inputs</summary>

| Name                       | Required | Default                 | Description                                                                            |
| -------------------------- | -------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `github-token`             | ✓        | `${{github.token}}`     | GitHub token for API access to create/update comments                                  |
| `pytest-coverage-path`     |          | `./pytest-coverage.txt` | Path to pytest text coverage output (from `--cov-report=term-missing`)                 |
| `pytest-xml-coverage-path` |          |                         | Path to XML coverage report (from `--cov-report=xml:coverage.xml`)                     |
| `junitxml-path`            |          |                         | Path to JUnit XML file for test statistics (passed/failed/skipped)                     |
| `issue-number`             |          |                         | Pull request number to comment on (required for workflow_dispatch/workflow_run events) |

</details>

<details>
<summary>🎨 Display Options</summary>

| Name                        | Default           | Description                                                         |
| --------------------------- | ----------------- | ------------------------------------------------------------------- |
| `title`                     | `Coverage Report` | Main title for the coverage comment (useful for monorepo projects)  |
| `badge-title`               | `Coverage`        | Text shown on the coverage percentage badge                         |
| `junitxml-title`            |                   | Title for the test summary section from JUnit XML                   |
| `hide-badge`                | `false`           | Hide the coverage percentage badge from the comment                 |
| `hide-report`               | `false`           | Hide the detailed coverage table (show only summary and badge)      |
| `hide-comment`              | `false`           | Skip creating PR comment entirely (useful for using outputs only)   |
| `report-only-changed-files` | `false`           | Show only files changed in the current pull request                 |
| `xml-skip-covered`          | `false`           | Hide files with 100% coverage from XML coverage reports             |
| `remove-link-from-badge`    | `false`           | Remove hyperlink from coverage badge (badge becomes plain image)    |
| `remove-links-to-files`     | `false`           | Remove file links from coverage table to reduce comment size        |
| `remove-links-to-lines`     | `false`           | Remove line number links from coverage table to reduce comment size |

</details>

<details>
<summary>🔧 Advanced Options</summary>

| Name                    | Default | Description                                                                                            |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `create-new-comment`    | `false` | Create new comment on each run instead of updating existing comment                                    |
| `unique-id-for-comment` |         | Unique identifier for matrix builds to update separate comments (e.g., `${{ matrix.python-version }}`) |
| `default-branch`        | `main`  | Base branch name for file links in coverage report (e.g., main, master)                                |
| `coverage-path-prefix`  |         | Prefix to add to file paths in coverage report links                                                   |
| `multiple-files`        |         | Generate single comment with multiple coverage reports (useful for monorepos)                          |

</details>

### Outputs

<details>
<summary>📤 Available Outputs</summary>

| Name                 | Example         | Description                                                                          |
| -------------------- | --------------- | ------------------------------------------------------------------------------------ |
| `coverage`           | `85%`           | Coverage percentage from pytest report                                               |
| `color`              | `green`         | Badge color based on coverage percentage (red/orange/yellow/green/brightgreen)       |
| `coverageHtml`       | HTML string     | Full HTML coverage report with clickable links to uncovered lines                    |
| `summaryReport`      | Markdown string | Test summary in markdown format with statistics (tests/skipped/failures/errors/time) |
| `warnings`           | `42`            | Number of coverage warnings from pytest-cov                                          |
| `tests`              | `109`           | Total number of tests run (from JUnit XML)                                           |
| `skipped`            | `2`             | Number of skipped tests (from JUnit XML)                                             |
| `failures`           | `0`             | Number of failed tests (from JUnit XML)                                              |
| `errors`             | `0`             | Number of test errors (from JUnit XML)                                               |
| `time`               | `12.5`          | Test execution time in seconds (from JUnit XML)                                      |
| `notSuccessTestInfo` | JSON string     | JSON details of failed, errored, and skipped tests (from JUnit XML)                  |

</details>

## 📚 Usage Examples

### Basic Usage

<details>
<summary>Standard PR Comment</summary>

```yaml
- name: Run tests
  run: |
    pytest --junitxml=pytest.xml --cov-report=term-missing:skip-covered --cov=src tests/ | tee pytest-coverage.txt

- name: Coverage comment
  uses: MishaKav/pytest-coverage-comment@main
  with:
    pytest-coverage-path: ./pytest-coverage.txt
    junitxml-path: ./pytest.xml
```

</details>

### Coverage from XML

<details>
<summary>Using coverage.xml instead of text output</summary>

```yaml
- name: Generate XML coverage
  run: |
    pytest --cov-report=xml:coverage.xml --cov=src tests/

- name: Coverage comment
  uses: MishaKav/pytest-coverage-comment@main
  with:
    pytest-xml-coverage-path: ./coverage.xml
    junitxml-path: ./pytest.xml
```

</details>

### Monorepo Support

<details>
<summary>Multiple coverage reports in a single comment</summary>

```yaml
- name: Coverage comment
  uses: MishaKav/pytest-coverage-comment@main
  with:
    multiple-files: |
      Backend API, ./backend/pytest-coverage.txt, ./backend/pytest.xml
      Frontend SDK, ./frontend/pytest-coverage.txt, ./frontend/pytest.xml
      Data Pipeline, ./pipeline/pytest-coverage.txt, ./pipeline/pytest.xml
```

This creates a consolidated table showing all coverage reports:

| Title         | Coverage | Tests | Time  |
| ------------- | -------- | ----- | ----- |
| Backend API   | 85%      | 156   | 23.4s |
| Frontend SDK  | 92%      | 89    | 12.1s |
| Data Pipeline | 78%      | 234   | 45.6s |

**Output**: Combined table showing coverage and test results for all packages.

<img alt="Multiple Files Mode Example" src="https://user-images.githubusercontent.com/289035/122121939-ddd0c500-ce34-11eb-8546-89a8a769e065.png">

</details>

### Docker Workflows

<details>
<summary>Running tests inside Docker containers</summary>

```yaml
- name: Run tests in Docker
  run: |
    docker run -v /tmp:/tmp $IMAGE_TAG \
      python -m pytest \
        --cov-report=term-missing:skip-covered \
        --junitxml=/tmp/pytest.xml \
        --cov=src tests/ | tee /tmp/pytest-coverage.txt

- name: Coverage comment
  uses: MishaKav/pytest-coverage-comment@main
  with:
    pytest-coverage-path: /tmp/pytest-coverage.txt
    junitxml-path: /tmp/pytest.xml
```

</details>

### Matrix Builds

<details>
<summary>Separate comments for each matrix combination</summary>

```yaml
strategy:
  matrix:
    python-version: ['3.9', '3.10', '3.11']
    os: [ubuntu-latest, windows-latest]

steps:
  - name: Coverage comment
    uses: MishaKav/pytest-coverage-comment@main
    with:
      pytest-coverage-path: ./pytest-coverage.txt
      junitxml-path: ./pytest.xml
      unique-id-for-comment: ${{ matrix.python-version }}-${{ matrix.os }}
      title: Coverage for Python ${{ matrix.python-version }} on ${{ matrix.os }}
```

</details>

### Auto-update README Badge

<details>
<summary>Keep coverage badge in README always up-to-date</summary>

First, add placeholders to your README.md:

```markdown
<!-- Pytest Coverage Comment:Begin -->
<!-- Pytest Coverage Comment:End -->
```

Then use this workflow:

```yaml
name: Update Coverage Badge
on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  update-badge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
          fetch-depth: 0

      - name: Run tests
        run: |
          pytest --junitxml=pytest.xml --cov-report=term-missing --cov=src tests/ | tee pytest-coverage.txt

      - name: Coverage comment
        id: coverage
        uses: MishaKav/pytest-coverage-comment@main
        with:
          pytest-coverage-path: ./pytest-coverage.txt
          junitxml-path: ./pytest.xml
          hide-comment: true

      - name: Update README
        run: |
          sed -i '/<!-- Pytest Coverage Comment:Begin -->/,/<!-- Pytest Coverage Comment:End -->/c\<!-- Pytest Coverage Comment:Begin -->\n${{ steps.coverage.outputs.coverageHtml }}\n<!-- Pytest Coverage Comment:End -->' ./README.md

      - name: Commit changes
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'docs: update coverage badge'
          file_pattern: README.md
```

</details>

## 📋 Output Example

Here's what the generated coverage comment looks like:

<img alt="Coverage" src="https://img.shields.io/badge/Coverage-30%25-red.svg" /><br/><details><summary>Coverage Report</summary><table><tr><th>File</th><th>Stmts</th><th>Miss</th><th>Cover</th><th>Missing</th></tr><tbody><tr><td colspan="5"><b>functions/example_completed</b></td></tr><tr><td>&nbsp; &nbsp;<a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_completed/example_completed.py">example_completed.py</a></td><td>64</td><td>19</td><td>70%</td><td><a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_completed/example_completed.py#L33">33</a>, <a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_completed/example_completed.py#L39-L45">39&ndash;45</a>, <a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_completed/example_completed.py#L48-L51">48&ndash;51</a>, <a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_completed/example_completed.py#L55-L58">55&ndash;58</a>, <a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_completed/example_completed.py#L65-L70">65&ndash;70</a>, <a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_completed/example_completed.py#L91-L92">91&ndash;92</a></td></tr><tr><td colspan="5"><b>functions/example_manager</b></td></tr><tr><td>&nbsp; &nbsp;<a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_manager/example_manager.py">example_manager.py</a></td><td>44</td><td>11</td><td>75%</td><td><a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_manager/example_manager.py#L31-L33">31&ndash;33</a>, <a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_manager/example_manager.py#L49-L55">49&ndash;55</a>, <a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_manager/example_manager.py#L67-L69">67&ndash;69</a></td></tr><tr><td>&nbsp; &nbsp;<a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_manager/example_static.py">example_static.py</a></td><td>40</td><td>2</td><td>95%</td><td><a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/example_manager/example_static.py#L60-L61">60&ndash;61</a></td></tr><tr><td colspan="5"><b>functions/my_exampels</b></td></tr><tr><td>&nbsp; &nbsp;<a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/my_exampels/example.py">example.py</a></td><td>20</td><td>20</td><td>0%</td><td><a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/my_exampels/example.py#L1-L31">1&ndash;31</a></td></tr><tr><td colspan="5"><b>functions/resources</b></td></tr><tr><td>&nbsp; &nbsp;<a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/resources/resources.py">resources.py</a></td><td>26</td><td>26</td><td>0%</td><td><a href="https://github.com/MishaKav/pytest-coverage-comment/blob/680f562642190a6a28f6c54785c767e2586b44b8/functions/resources/resources.py#L1-L37">1&ndash;37</a></td></tr><tr><td><b>TOTAL</b></td><td><b>1055</b></td><td><b>739</b></td><td><b>30%</b></td><td>&nbsp;</td></tr></tbody></table></details>

| Tests | Skipped | Failures | Errors   | Time               |
| ----- | ------- | -------- | -------- | ------------------ |
| 109   | 2 :zzz: | 1 :x:    | 0 :fire: | 0.583s :stopwatch: |

## 🔬 Advanced Features

<details>
<summary>📊 Using Output Variables</summary>

```yaml
- name: Coverage comment
  id: coverage
  uses: MishaKav/pytest-coverage-comment@main
  with:
    pytest-coverage-path: ./pytest-coverage.txt
    junitxml-path: ./pytest.xml

- name: Dynamic Badges
  uses: schneegans/dynamic-badges-action@v1.7.0
  with:
    auth: ${{ secrets.GIST_SECRET }}
    gistID: your-gist-id
    filename: coverage.json
    label: Coverage
    message: ${{ steps.coverage.outputs.coverage }}
    color: ${{ steps.coverage.outputs.color }}

- name: Fail if coverage too low
  if: ${{ steps.coverage.outputs.coverage < 80 }}
  run: |
    echo "Coverage is below 80%!"
    exit 1
```

</details>

<details>
<summary>🎯 Show Only Changed Files</summary>

```yaml
- name: Coverage comment (changed files only)
  uses: MishaKav/pytest-coverage-comment@main
  with:
    pytest-coverage-path: ./pytest-coverage.txt
    junitxml-path: ./pytest.xml
    report-only-changed-files: true
```

This is particularly useful for large codebases where you want to focus on coverage for files modified in the PR.

</details>

<details>
<summary>🔀 Workflow Dispatch Support</summary>

```yaml
name: Manual Coverage Report
on:
  workflow_dispatch:
    inputs:
      pr_number:
        description: 'Pull Request number'
        required: true

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - name: Coverage comment
        uses: MishaKav/pytest-coverage-comment@main
        with:
          pytest-coverage-path: ./pytest-coverage.txt
          junitxml-path: ./pytest.xml
          issue-number: ${{ github.event.inputs.pr_number }}
```

</details>

<details>
<summary>⚡ Performance Optimization</summary>

For large coverage reports that might exceed GitHub's comment size limits:

```yaml
- name: Coverage comment
  uses: MishaKav/pytest-coverage-comment@main
  with:
    pytest-coverage-path: ./pytest-coverage.txt
    junitxml-path: ./pytest.xml
    hide-report: true # Show only summary and badge
    xml-skip-covered: true # Skip files with 100% coverage
    report-only-changed-files: true # Only show changed files
    remove-links-to-files: true # Remove clickable file links
    remove-links-to-lines: true # Remove clickable line number links
```

**Link Removal Options:**

- `remove-links-to-files: true` - Removes clickable links to files. Instead of `[example.py](link)`, shows plain `example.py`
- `remove-links-to-lines: true` - Removes clickable links to line numbers. Instead of `[14-18](link)`, shows plain `14-18`

These options significantly reduce comment size while preserving all coverage information.

</details>

## 🎨 Badge Colors

Coverage badges automatically change color based on the percentage:

| Coverage | Badge                                                                           | Color        |
| -------- | ------------------------------------------------------------------------------- | ------------ |
| 0-40%    | ![Coverage 0-40](https://img.shields.io/badge/Coverage-20%25-red.svg)           | Red          |
| 40-60%   | ![Coverage 40-60](https://img.shields.io/badge/Coverage-50%25-orange.svg)       | Orange       |
| 60-80%   | ![Coverage 60-80](https://img.shields.io/badge/Coverage-70%25-yellow.svg)       | Yellow       |
| 80-90%   | ![Coverage 80-90](https://img.shields.io/badge/Coverage-85%25-green.svg)        | Green        |
| 90-100%  | ![Coverage 90-100](https://img.shields.io/badge/Coverage-95%25-brightgreen.svg) | Bright Green |

## 🔄 Auto-Updating Badge on README

If you want auto-update the coverage badge on your README, you can see the [workflow example](#auto-update-readme-badge) above.

![Auto Updating Badge](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/MishaKav/5e90d640f8c212ab7bbac38f72323f80/raw/pytest-coverage-comment__main.json)

<img alt="Auto-updating badge example" src="https://user-images.githubusercontent.com/289035/126039976-3f1bf8dd-5a6b-4103-8548-fc3eecc377d7.png">

## 📸 Result Examples

<details>
<summary>View example outputs</summary>

### Standard Comment (Collapsed)

![Collapsed Comment](https://user-images.githubusercontent.com/289035/120536428-c7664a80-c3ec-11eb-9cce-3ac53343fac4.png)

### Expanded Coverage Report

![Expanded Report](https://user-images.githubusercontent.com/289035/120536607-f8df1600-c3ec-11eb-9f49-c6d7571e43ac.png)

### Multiple Files (Monorepo)

![Multiple Files](https://user-images.githubusercontent.com/289035/122121939-ddd0c500-ce34-11eb-8546-89a8a769e065.png)

</details>

## 🔧 Troubleshooting

<details>
<summary>Common Issues and Solutions</summary>

### Comment Not Appearing

**Issue**: The action runs successfully but no comment appears on the PR.

**Solutions**:

- Ensure proper permissions are set:
  ```yaml
  permissions:
    contents: write
    pull-requests: write
  ```
- For `workflow_dispatch`, provide the `issue-number` input
- Check if `hide-comment` is set to `false`

### Unrecognized Arguments Error

**Issue**: `pytest: error: unrecognized arguments: --cov --cov-report`

**Root Cause**: The `pytest-cov` plugin is not installed. The `--cov` and `--cov-report` flags are provided by `pytest-cov`, not pytest itself.

**Solution**:

Install the `pytest-cov` package in your Python environment:

```bash
pip install pytest-cov
```

Or add it to your `requirements.txt` or `pyproject.toml`:

```txt
# requirements.txt
pytest>=8.0.0
pytest-cov>=5.0.0
```

```toml
# pyproject.toml
[project]
dependencies = [
    "pytest>=8.0.0",
    "pytest-cov>=5.0.0",
]
```

Make sure the installation step runs before executing pytest commands in your workflow:

```yaml
- name: Install dependencies
  run: |
    pip install pytest pytest-cov

- name: Run tests with coverage
  run: |
    pytest --cov=src --cov-report=term-missing tests/
```

### Coverage Report Too Large

**Issue**: "Comment is too long (maximum is 65536 characters)"

**Solutions**:

- Use `xml-skip-covered: true` to hide fully covered files
- Enable `report-only-changed-files: true`
- Set `hide-report: true` to show only summary
- Use `remove-links-to-files: true` to remove clickable file links
- Use `remove-links-to-lines: true` to remove clickable line number links
- Use `--cov-report=term-missing:skip-covered` in pytest

### GitHub Step Summary Too Large

**Issue**: "GitHub Action Summary too big" (exceeds 1MB limit)

**Solution**: As of v1.1.55, the action automatically truncates summaries that exceed GitHub's 1MB limit.

### Files Not Found

**Issue**: "No such file or directory" errors

**Solutions**:

- Use absolute paths or paths relative to `$GITHUB_WORKSPACE`
- For Docker workflows, ensure volumes are mounted correctly
- Check that coverage files are generated before the action runs

### Wrong File Links

**Issue**: Links in the coverage report point to wrong files or 404

**Solutions**:

- Set `default-branch` to your repository's main branch
- Use `coverage-path-prefix` if your test paths differ from repository structure
- Ensure the action runs on the correct commit SHA

</details>

## 🤝 Contributing

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

We welcome all contributions! Please feel free to submit [pull requests](https://github.com/MishaKav/pytest-coverage-comment/pulls) or open [issues](https://github.com/MishaKav/pytest-coverage-comment/issues) for bugs, feature requests, or improvements.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/MishaKav/pytest-coverage-comment.git
cd pytest-coverage-comment

# Install dependencies
npm install

# Run tests (if available)
npm test

# Build the action
npm run build
```

## 👥 Contributors

<a href="https://github.com/MishaKav/pytest-coverage-comment/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=MishaKav/pytest-coverage-comment" alt="Contributors" />
</a>

## 📄 License

MIT © [Misha Kav](https://github.com/MishaKav)

---

## 🔗 Similar Actions

**For JavaScript/TypeScript projects using Jest:**
Check out [jest-coverage-comment](https://github.com/marketplace/actions/jest-coverage-comment) - a similar action with even more features for Jest test coverage.

---

<div align="center">

**If you find this action helpful, please consider giving it a ⭐ on [GitHub](https://github.com/MishaKav/pytest-coverage-comment)!**

</div>
