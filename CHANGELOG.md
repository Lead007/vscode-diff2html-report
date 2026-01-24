# Change Log

All notable changes to the "diff2html-report" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.3.0] - 2026-01-24

### Added

- Popping up progress bar prompts during potentially time-consuming operations, including getting git refs, generating HTML page, and exporting the page, to avoid page freezes.
- Add `release` command in `package.json`.

### Changed

When rendering the page, use CSS and JS files from the npm package instead of from the extension source directory. Therefore, remove the CSS and JS library files from the extension source code directory.

## [0.2.1] - 2026-01-19

### Fixed

- Fix the bug that the configuration `diff2html-report.defaultViewType` does not take effect.
- Fix the debug command in `package.json`.

## [0.2.0] - 2026-01-18

### Added

- The configuration `diff2html-report.maxGitDiffFileSize` has been added as the max byte length of git diff output.
- Two buttons have been added to the prompt window for exporting reports, which user can click to open the report or its folder.
- Improve the README file.
- Optimize the building and packaging process.

## [0.1.0] - 2026-01-16

### Added

Initial release.

[0.3.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.3.0
[0.2.1]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.2.1
[0.2.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.2.0
[0.1.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.1.0