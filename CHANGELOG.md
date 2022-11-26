# Changelog of the Pytest Coverage Comment

## [Pytest Coverage Comment 1.1.38](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.38)

**Release Date:** 2022-11-26

#### Changes

- Fix when using `multiple-files` table is not formatted correctly, because of the column count mismatch thanks to [@jbcumming](https://github.com/jbcumming) for contribution

## [Pytest Coverage Comment 1.1.37](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.37)

**Release Date:** 2022-10-20

#### Changes

- Fix failing the action when the event type is not `pull_request`/`push`. Now it will just post `warning` message if you try to comment (and not fail the whole action). If you just using an `output` of the action you will be able to run this action on events like `schedule`/`workflow_dispatch` etc
- Add full `CHANGELOG.md` (current file with all history). Those whos use `dependabot` now will be able to see the changes directly in the PR

## [Pytest Coverage Comment 1.1.36](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.36)

**Release Date:** 2022-10-12

#### Changes

- Upgrade `node12` to `node16`(otherwise GitHub print `warning` on that)

## [Pytest Coverage Comment 1.1.35](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.35)

**Release Date:** 2022-09-06

#### Changes

- fix empty folders on changed files (the report show empty folders even they don't contain files)

## [Pytest Coverage Comment 1.1.34](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.34)

**Release Date:** 2022-09-06

#### Changes

- fix warning when use `coverage-xml`

## [Pytest Coverage Comment 1.1.33](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.33)

**Release Date:** 2022-08-29

#### Changes

- add support for `coverage.xml`, thanks to [@xportation](https://github.com/xportation) for contribution

## [Pytest Coverage Comment 1.1.32](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.32)

**Release Date:** 2022-08-10

#### Changes

- add multi files to coverage report

## [Pytest Coverage Comment 1.1.31](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.31)

**Release Date:** 2022-08-09

#### Changes

- Add option to remove link on badge `remove-link-from-badge`

## [Pytest Coverage Comment 1.1.30](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.30)

**Release Date:** 2022-08-05

#### Changes

- fix typo, thanks to [@SimonOsipov](https://github.com/SimonOsipov) for contribution

## [Pytest Coverage Comment 1.1.29](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.29)

**Release Date:** 2022-06-29

#### Changes

- fix changed files (when the first commit comes in `push` evnet, it fails to compare it with `head` commit)

## [Pytest Coverage Comment 1.1.28](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.28)

**Release Date:** 2022-04-27

#### Changes

- Add comment to report when no files changed: <br/> _report-only-changed-files is enabled. No files were changed during this commit :)_

## [Pytest Coverage Comment 1.1.27](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.27)

**Release Date:** 2022-04-26

#### Changes

- fix parse on big files

## [Pytest Coverage Comment 1.1.26](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.26)

**Release Date:** 2022-04-22

#### Changes

- show elapsed time in minutes when it's more than 60 seconds
- If the elapsed time is more than 1 minute, it will show it in a different format (`555.0532s` > `9m 15s`), the output format will be the same as junit.xml (`555.0532s`).

## [Pytest Coverage Comment 1.1.26](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.26)

**Release Date:** 2022-04-22

#### Changes

- Elapsed time in minutes

## [Pytest Coverage Comment 1.1.25](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.25)

**Release Date:** 2022-04-06

#### Changes

- Fix ahead of base commit

## [Pytest Coverage Comment 1.1.24](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.24)

**Release Date:** 2022-03-15

#### Changes

- Correct coverage header words to include

## [Pytest Coverage Comment 1.1.23](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.23)

**Release Date:** 2022-03-14

#### Changes

- prefix to changed files

## [Pytest Coverage Comment 1.1.22](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.22)

**Release Date:** 2022-03-12

#### Changes

- fix missing lines

## [Pytest Coverage Comment 1.1.21](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.21)

**Release Date:** 2022-03-10

#### Changes

- add links in comment with prefix

## [Pytest Coverage Comment 1.1.20](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.20)

**Release Date:** 2022-03-08

#### Changes

- fix cover td

## [Pytest Coverage Comment 1.1.19](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.19)

**Release Date:** 2022-02-24

#### Changes

- fix cover export with old syntax

## [Pytest Coverage Comment 1.1.18](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.18)

**Release Date:** 2022-02-24

#### Changes

- fix cover percentage when using `cov-branch`

## [Pytest Coverage Comment 1.1.17](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.17)

**Release Date:** 2022-01-21

#### Changes

- add option to `reportOnlyChangedFiles`

## [Pytest Coverage Comment 1.1.16](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.16)

**Release Date:** 2021-12-09

#### Changes

- fix table when missing column are not there

## [Pytest Coverage Comment 1.1.15](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.15)

**Release Date:** 2021-12-09

#### Changes

- fix repository name when `undefined` \
  Thanks to [@OTooleMichael](https://github.com/OTooleMichael) for contribution

## [Pytest Coverage Comment 1.1.14](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.14)

**Release Date:** 2021-12-04

#### Changes

- fix repository name when run on `schedule`

## [Pytest Coverage Comment 1.1.13](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.13)

**Release Date:** 2021-12-01

#### Changes

- fix parsing issues in some cases

## [Pytest Coverage Comment 1.1.12](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.12)

**Release Date:** 2021-11-11

#### Changes

- Add summary report to output to multiFiles

## [Pytest Coverage Comment 1.1.11](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.11)

**Release Date:** 2021-10-31

#### Changes

- add warnings to output

## [Pytest Coverage Comment 1.1.10](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.10)

**Release Date:** 2021-10-16

#### Changes

- fork for notSuccessTestInfo

## [Pytest Coverage Comment 1.1.9](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.9)

**Release Date:** 2021-09-08

#### Changes

- add values from to output variables

## [Pytest Coverage Comment 1.1.8](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.8)

**Release Date:** 2021-09-08

#### Changes

- add `coverageHtml` to multiFiles mode

## [Pytest Coverage Comment 1.1.7](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.7)

**Release Date:** 2021-09-08

#### Changes

- Export coverage example

## [Pytest Coverage Comment 1.1.6](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.6)

**Release Date:** 2021-07-26

#### Changes

- Add option to hide the comment (will generate only the `output`)

## [Pytest Coverage Comment 1.1.5](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.5)

**Release Date:** 2021-07-17

#### Changes

- fix error body to long

## [Pytest Coverage Comment 1.1.4](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.4)

**Release Date:** 2021-07-13

#### Changes

- add output for first file when multiple files mode enabled

## [Pytest Coverage Comment 1.1.3](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.3)

**Release Date:** 2021-06-24

#### Changes

- fix validation of a coverage file

## [Pytest Coverage Comment 1.1.2](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.2)

**Release Date:** 2021-06-23

#### Changes

- add check if coverage file is valid

## [Pytest Coverage Comment 1.1.1](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.1)

**Release Date:** 2021-06-19

#### Changes

- ignore files that didn't exists in multi-mode

## [Pytest Coverage Comment 1.1.0](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.1.0)

**Release Date:** 2021-06-15

#### Changes

- Multiple Files Mode (can be useful on mono-repo projects)
  ![Result Multiple Files Mode Example](https://user-images.githubusercontent.com/289035/122121939-ddd0c500-ce34-11eb-8546-89a8a769e065.png)

## [Pytest Coverage Comment 1.0.1](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.0.1)

**Release Date:** 2021-06-15

#### Changes

- improove watermark

## [Pytest Coverage Comment 1.0](https://github.com/MishaKav/pytest-coverage-comment/tree/v1.0)

**Release Date:** 2021-06-02

#### Changes

- Initial publication on GitHub. The first release of the action.
