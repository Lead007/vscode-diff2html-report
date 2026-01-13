# Diff2html Report Generator For VS Code

Generate and export a `git diff` report as an HTML page.

## Features

This extension adds a "Genetate Diff Report" menu in the "Change" menu of Git panel, which allows you to select two branches or tags to generate HTML formatted Git Diff reports. You can also export the HTML page as a file.

## Requirements

* VS Code 1.68.0 or higher.
* VS Code's built-in Git plugin.

## Extension Settings

This extension contributes the following settings:

* `diff2html-report.filter`: Set the filter string to include only specific files in the diff report.
* `diff2html-report.defaultViewType`: Set the diff2html default view type. The default setting is side-by-side.
* `diff2html-report.useOnlineResources`: Set whether to use online resources for `diff2html` and `Bulma`. The default setting is `false`, which means using stylesheets and scripts inside this extension.


## Release Notes

### 1.0.0

Initial release.

---

**Enjoy!**
