# Diff2html Report Generator For VS Code

Generate and export a `git diff` report as an HTML page.

## Features

This extension adds two menus in the "Change" menu of Git panel.

The menu "Genetate Diff Report" allows you to select two local/remote branches or tags to generate HTML formatted Git Diff reports. The HTML page can also be exported as a file.

The menu "Analyze Changed Functions", built as a separate Vue 3 + Element Plus Webview using Vite, can automatically analyze the differences between the two Git refs you have selected。a list of differences can be generated for the specified symbol type (default as function). You can use this to generate an HTML formatted list of change entries.

## Requirements

* VS Code 1.68.0 or higher.
* VS Code's built-in Git plugin.

## Extension Settings

This extension contributes the following settings:

* `diff2html-report.defaultDiffOptions`: Set a group of default `git diff` options when generating the diff report.
* `diff2html-report.filter`: Set a group of filter strings to include only specific files in the diff report.
* `diff2html-report.encoding`: The character set encoding used when retrieving a specific version of repository files (e.g. in the Diff View). A list of all supported encodings can be found [here](https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings).
* `diff2html-report.maxGitDiffFileSize`: Maximum file size (in bytes) for the git diff output. The default value is 64MB.
* `diff2html-report.functionDiffLineThreshold`: Show the full function when its length is at or below this line count. The default is 30.
* `diff2html-report.functionDiffChangePercentage`: Show the full function for a larger change when changed lines reach this percentage of the function length. The default is 30.
* `diff2html-report.functionDiffContextLines`: Number of unchanged lines shown around changes in long functions with a small change percentage. The default is 3.
* `diff2html-report.functionDiffSymbolKinds`: Select which VS Code document symbol kinds are included in function-level change analysis. The default is `Function`, `Method`, `Constructor`, and `Operator`.
* `diff2html-report.drawLineCount`: Display line count statistics in the diff report.
* `diff2html-report.defaultViewType`: Set the diff2html default view type. The default setting is side-by-side.
* `diff2html-report.useOnlineResources`: Set whether to use online resources for `diff2html`. The default setting is `false`, which means using stylesheets and scripts inside this extension.

## License

Released under [MIT](https://github.com/Lead007/vscode-diff2html-report/blob/main/LICENSE) by [@Lead007](https://github.com/Lead007).

## Release Notes

See [CHANGELOG](https://github.com/Lead007/vscode-diff2html-report/blob/main/CHANGELOG.md).

---

**Enjoy!**
