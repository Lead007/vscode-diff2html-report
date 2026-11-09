# Change Log

All notable changes to the "diff2html-report" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.6.3] - 2026-11-08

### Fixed

- Fix the bug that on the Project Review page, the file list display deleted files as '/dev/null', while renamed files only show the new file path.

- Delete configuration instructions which no longer exist in the Chinese readme.

## [0.6.2] - 2026-11-08

### Added

- In the change item report, it is supported to display diff lines in a side-by-side view type. The view type is still set through the configuration `diff2html-report.defaultViewType`.

## Changed

* The `diff2html` preview page is implemented using Vue instead of native HTML. It also supports switching between light and dark themes.

* Some common functions and localization strings shared by the two webview pages have been abstracted.

* Unified the tag labels for added, changed, and deleted states across file and function changes, and now color-code each type.

* The change preview page now also displays the list of changed files.

### Removed

The configuration `useOnlineResources` is removed, since the exported page's CSS styles  can be obtained from the webview page's stylesheet. Exporting CSS styles from the webview allows the exported page to support light and dark themes. It also ensures the style of the exported page stays consistent with the webview preview page.

### Fixed

Fix the bug that on the Diff Review page, the old and new line numbers may be arranged vertically instead of horizontally correctly.

## [0.6.0] - 2026-11-05

### Added

- Add the **Generate Change Item Report** command to review changes between Git revisions at the function and file level. Function-level diff analysis matches changed functions across revisions and showing focused context for large functions.
- Add a review Webview for selecting changed functions or file-level diffs, organizing them into change items, and adding titles and descriptions.
- Add HTML preview and standalone export for function change reports, with light and dark themes.

## [0.5.0] - 2026-09-01

### Added

- The configuration `diff2html-report.defaultDiffOptions` has been added as default `git diff` options when generating the diff report.

## [0.4.0] - 2026-08-31

### Changed

- Use CSS native styles instead of Bulma to render the `Save as HTML file` options and buttons in the `diff2html` preview interface.

### Fixed

- Fix the bug that after an HTML file has been exported, if the path contains "#" characters or non-ASCII characters, the file cannot be opened through the button in the vscode prompt box.

## [0.3.1] - 2026-03-26

### Fixed

- Fix the bug that the configuration `diff2html-report.filter` does not work when there are more than one filter. The type of configuration has been changed to `array`.

## [0.3.0] - 2026-01-24

### Added

- Popping up progress bar prompts during potentially time-consuming operations, including getting git refs, generating HTML page, and exporting the page, to avoid page freezes.
- Add `release` command in `package.json`.

### Changed

- When rendering the page, use CSS and JS files from the npm package instead of from the extension source directory. Therefore, remove the CSS and JS library files from the extension source code directory.

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

[0.6.3]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.6.3
[0.6.2]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.6.2
[0.6.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.6.0
[0.5.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.5.0
[0.4.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.4.0
[0.3.1]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.3.1
[0.3.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.3.0
[0.2.1]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.2.1
[0.2.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.2.0
[0.1.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.1.0