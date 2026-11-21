# Change Log

All notable changes to the "diff2html-report" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.7.3] - 2026-11-21

### Added

- When more than one workspace folder is open, the extension now asks you to choose the workspace the report is generated for instead of always using the first one. If only one workspace folder is open, the report is generated for it directly.

- Display some recent commits in the commit selection dropdown. The max count is set by configuration `diff2html-report.recentCommitCount`.

- Add a "Generate report (HTML)" button to the navigation bar of the SCM title. It opens a menu to choose between the Diff Report and the Change Item Report, and both commands are also available in the overflow menu of the SCM title.

- Show a footer in the Diff preview, the change item report preview and their exported HTML reports, linking to the Marketplace page and the GitHub repository. It can be turned off with the configuration `diff2html-report.showFooter` (enabled by default).

- Add a back-to-top button to the change items page, the report preview page and the Diff preview page.

- Progress notifications shown while loading refs and generating reports can now be cancelled.

### Changed

- Refined several fields in `package.json` so the extension's metadata is clearer and more accurate.

- Reduced the packaged extension size from about 10.3 MB to about 1.7 MB. `vue` is now a development dependency, since the webview ships prebuilt and self-contained assets, and the optional `highlight.js` files pulled in by `diff2html` are no longer packaged.

- Removed `--submodule` from the supported diff options, since it is rarely used and may produce incorrect results. Specify submodule content through the configuration `diff2html-report.filter` if needed.

- Rewrote the README, added the Chinese README, CONTRIBUTING, SECURITY, SUPPORT documents and GitHub issue templates, and aligned the configuration descriptions with the actual behavior.

### Fixed

- Fixed the document title of HTML reports exported from the Diff preview page, which did not match the report header.

## [0.7.1] - 2026-11-12

### Added

- In the change page, add an el-splitter between the diff files and change items cards to allow resizing both panels.

### Changed

- Line count is also displayed on the Change Item page and the change item report. The configuration `diff2html-report.drawLineCount` has been removed.

- Improved analysis of the file's symbol tree: child symbol differences are no longer shown when the parent symbol has changes.

- In the change page, different symbol changes now display distinct icons and tooltip text. Icons are provided by `@vscode/codicons`, matching the symbol icons in the VS Code outline view.

- Added classes and structs to the symbol kinds analyzed by default.

- Renamed all occurrences of "function" to "symbol" in displayed text, since the plugin's diff analysis is not limited to function-type symbols.

- Fine-tuned the font sizes of some UI text.

- The change preview page now also displays the content of change items.

### Fixed

- Fix the bug that on the Change Item page, the file list display deleted files as '/dev/null', while renamed files only show the new file path.

- Delete configuration instructions which no longer exist in the Chinese readme.

- Fixed an incorrect Mustache template path when exporting to HTML.

- Fixed the bug that the `el-card` for editing a change item was stretched unexpectedly when the change item title was too long.

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

[0.7.3]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.7.3
[0.7.1]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.7.1
[0.6.2]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.6.2
[0.6.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.6.0
[0.5.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.5.0
[0.4.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.4.0
[0.3.1]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.3.1
[0.3.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.3.0
[0.2.1]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.2.1
[0.2.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.2.0
[0.1.0]: https://github.com/Lead007/vscode-diff2html-report/releases/tag/0.1.0