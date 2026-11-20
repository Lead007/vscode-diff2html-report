English | [简体中文](README.zh-cn.md)

# Git Diff Report — Share as HTML

**Turn `git diff` into a shareable HTML report — no screenshots, no pasting diffs into chat.**

Generate a diff report or a structured change-item report from any two Git revisions, preview it inside VS Code, and export it as a single standalone HTML file.

Everything runs on your machine: your own Git installation produces the diff, the extension renders it, and the report opens in any browser. No account, no upload, no network required.

[![Marketplace](https://vsmarketplacebadges.dev/version-short/Lead007.diff2html-report.svg)](https://marketplace.visualstudio.com/items?itemName=Lead007.diff2html-report)
[![Installs](https://vsmarketplacebadges.dev/installs-short/Lead007.diff2html-report.svg)](https://marketplace.visualstudio.com/items?itemName=Lead007.diff2html-report)
[![Rating](https://vsmarketplacebadges.dev/rating-star/Lead007.diff2html-report.svg)](https://marketplace.visualstudio.com/items?itemName=Lead007.diff2html-report)
[![License](https://img.shields.io/github/license/Lead007/vscode-diff2html-report)](https://github.com/Lead007/vscode-diff2html-report/blob/main/LICENSE)

## Why this extension

`git diff` is great for reading on your own screen and bad at everything else. This extension
turns it into an artifact you can actually hand to someone:

- **30-second start** — open a repository → click the icon in the **Source Control** title bar → pick a base and a current revision → preview → **Export HTML**.
- **Code review** — a PR is too large to read in the browser tab? Export the diff as one page and review it offline, or attach it to the review. Select the **merge base** as the base revision so the report shows only the branch's changes.
- **Delivery & handover** — give the client or the next team a readable list of what changed, with notes, instead of a wall of `+`/`-` lines.
- **Release notes & audit** — keep a per-release HTML record of the changes, with symbol-level grouping and written explanations.
- **Offline and restricted networks** — no CDN, no telemetry, no outbound requests. Preview and export work with the network cable unplugged, which makes the extension usable on air-gapped machines, behind corporate proxies, and in finance, government and enterprise environments.

## Quick start (30 seconds)

1. Install the extension and open a Git repository in VS Code.
2. Open **Source Control**, then use the **title menu of the repository** (the `...` button).
3. Run **Generate Diff Report** → pick a base and a current revision → review the preview → **Export HTML**.

That's it. The exported file opens in any browser, needs no extension installed, and can be
sent by email, attached to a ticket, or committed to a `docs/` folder.

## Two commands, two kinds of report

| | **Generate Diff Report** | **Generate Change Item Report** |
|---|---|---|
| Output | Full rendered diff of the selected revisions | Diff grouped into change items you describe |
| Best for | Reviewing or archiving a diff as-is | Explaining *what* changed and *why* |
| Symbol analysis | — | Groups changes by class / function / method (via VS Code document symbols) |
| Notes | — | Title + description per change item |
| Export | Standalone HTML | Standalone HTML |

Both commands can also be launched from the picker menu opened by **Generate report (HTML)** in the Source Control title bar (the icon and its menu).

## What's in the report

- File list with total added / deleted line counts
- Side-by-side or line-by-line view
- Light and dark theme, switchable before export
- A single self-contained HTML file — no plugin, no server, no build step
- Symbol-level grouping so a 40-file diff becomes a handful of named changes (Change Item Report)

## Requirements

* VS Code 1.68.0 or higher.
* VS Code's built-in Git plugin.
* For **Generate Change Item Report**: a language extension that provides document symbols for
the languages you want analyzed. Symbol detection depends on that language extension and your
current VS Code configuration; missing headers or other unresolved dependencies may affect the
symbols it returns.

## Installation

- **Marketplace**: search for `Git Diff Report — Share as HTML` or the extension ID `Lead007.diff2html-report`, or install from [the extension page](https://marketplace.visualstudio.com/items?itemName=Lead007.diff2html-report).
- **VSIX**: download the `.vsix` from [Releases](https://github.com/Lead007/vscode-diff2html-report/releases), then `Extensions → ... → Install from VSIX...`.

## Usage

Open a Git repository in VS Code. Both report commands are available from the Git repository's title menu in the **Source Control** view.

For either command, select a base revision and a current revision from the available branches or tags. You can also enter a branch name, tag, or commit hash manually. The current revision can be **Staged** to compare the base revision with staged changes. Then choose any `git diff` options to apply. Reports compare the two revisions directly with `git diff <base> <current>` (two-dot), not their merge base; for a branch review, choose the merge base as the base revision.

### Generate Diff Report

1. Run **Generate Diff Report** from the Source Control view's title menu.
2. Select the base and current revisions, then choose the `git diff` options.
3. Review the rendered diff in the preview. The report includes a file list and total added/deleted line counts.
4. To save it as a standalone HTML report, use **Export HTML**, switch its light/dark theme if desired, and select a destination. After export, you can open the saved file or its containing folder.

### Generate Change Item Report

1. Run **Generate Change Item Report** from the Source Control view's title menu.
2. Select the base and current revisions, then choose the `git diff` options. The extension analyzes changed files and uses VS Code document symbols to identify changed symbols.
3. In the review view, select the changed symbols or file-level changes that belong to a change item. Add a title and description, then create the item. You can edit or delete items, adjust their selections, or clear all items.
4. Select **Preview HTML** to review the report, switch its light/dark theme if desired, and use **Export HTML** to save it as a standalone file.

*Note: Symbol-level analysis requires an installed and enabled language extension that provides document symbols for the file type. If symbols are unavailable or no symbols of selected type are identified, changes may appear at file level instead. Diffs of binary and oversized files are not parsed or displayed.*

## Settings

| Setting | Default | Description |
|---|---|---|
| `diff2html-report.defaultDiffOptions` | — | Default `git diff` options pre-selected when generating a report. Supported: `-b`, `-w`, `-M`, `-C`. |
| `diff2html-report.filter` | — | Extra arguments appended verbatim, in order, to `git diff <base> <current>` after the options selected in the picker. Put `--` before pathspecs, e.g. `["--", "src/"]` or `["--", "*.cpp"]`; other `git diff` options are passed through as well, e.g. `["--diff-filter=M"]`. |
| `diff2html-report.encoding` | `utf8` | Charset used when reading a specific version of repository files. Supported list: [iconv-lite](https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings). |
| `diff2html-report.recentCommitCount` | 5 | Number of recent commits to display in the commit selection dropdown. |
| `diff2html-report.maxGitDiffFileSize` | `67108864` (64 MiB) | Maximum output size (in bytes) of a single Git command (`diff`, `log`, `for-each-ref`, `show`). If a command exceeds it, that command fails and report generation stops; raise the value if needed. |
| `diff2html-report.symbolDiffLineThreshold` | `30` | Symbols at or below this line count are shown in full in symbol-level diffs. |
| `diff2html-report.symbolDiffChangePercentage` | `30` | Long symbols are shown in full when changed lines reach this percentage of their length. |
| `diff2html-report.symbolDiffContextLines` | `3` | Unchanged context lines around changes in long symbols with a small change percentage. |
| `diff2html-report.symbolDiffSymbolKinds` | `Class`, `Function`, `Method`, `Constructor`, `Operator`, `Struct` | VS Code document symbol kinds included in symbol-level analysis. |
| `diff2html-report.defaultViewType` | `side-by-side` | View type used by the Diff preview and exported reports. The change-item review page always uses `line-by-line`. |
| `diff2html-report.showFooter` | `true` | Whether to show the footer in the Diff preview, the change-item report preview, and their exported reports. The change-item review page has no footer. |

## Q&A

### Why is code in the report garbled?

Set `diff2html-report.encoding` in VS Code settings to match the encoding of your repository files. The default is `utf8`; for example, use `gbk` for GBK-encoded files.

### How can I limit the report or pass extra `git diff` arguments?

Set `diff2html-report.filter` to an array of arguments. Every item is appended verbatim, in order, to `git diff <base> <current>` after the options selected in the picker. Use `--` before pathspecs, for example `["--", "src/"]` to include a folder or `["--", "*.cpp"]` to include files matching a pattern; other `git diff` options such as `["--diff-filter=M"]` are passed through as well.

### What if I can't find the base or current revision in the list?

Find the commit in Git history, or in a Git Graph or similar extension, copy its commit hash, and enter the hash manually when selecting the base or current revision.

### Why do some files lack symbol-level analysis results?

The language extension that provides document symbols may not have finished loading, especially immediately after opening a workspace. Wait for the language extension to finish loading, then run **Generate Change Item Report** again.

### Why are code diffs always shown in `line-by-line` view on the Diff Review page, even when my setting is `side-by-side`?

On the Diff Review page, the code diff and the change item form are displayed side by side. Since there is limited horizontal space for the diff, it always uses the `line-by-line` view.

### Which languages support symbol-level analysis?

Any language whose VS Code extension provides document symbols. JavaScript/TypeScript, C/C++,
Java, C#, Go, Python, Rust and others generally work, but coverage depends on the language
extension's symbol support.

## Limitations

- **Two-dot comparison** — reports run `git diff <base> <current>` (two-dot), comparing the two trees directly rather than their merge base. For a PR-style review, choose the merge base as the base revision; otherwise changes made on the target branch after divergence appear as reverse differences.
- **Binary files** — binary files keep their file entries, but their contents are not shown.
- **Diff size** — if the output of any Git command (`diff`, `log`, `for-each-ref`, `show`) exceeds `diff2html-report.maxGitDiffFileSize` (bytes), that command fails and the entire report generation stops; raise the setting if needed.
- **Heuristic symbol pairing** — symbol-level changes are matched heuristically, so renamed or heavily modified symbols may be grouped incorrectly.
- **Session-only change items** — change items exist only in the current webview session; anything not exported is lost when the panel is closed.
- **Review layout** — the Diff Review page always uses the line-by-line view, even when `diff2html-report.defaultViewType` is set to `side-by-side`.
- **Export format** — reports are exported as standalone HTML only.

## Privacy

- `git diff` runs locally through your own Git installation. **Your code never leaves your machine** — the extension makes no outbound network requests and collects no telemetry or usage data.
- The rendering library is bundled into the extension, so the preview works offline. There is no CDN dependency for a proxy to block.
- The exported HTML file is written only to the location you choose on your local disk.

## Feedback & support

- Bugs and feature requests: [Issues](https://github.com/Lead007/vscode-diff2html-report/issues)
- Questions and ideas: [Discussions](https://github.com/Lead007/vscode-diff2html-report/discussions)
- Please read [SUPPORT.md](https://github.com/Lead007/vscode-diff2html-report/blob/main/SUPPORT.md) before opening an issue.
- Reporting a problem? Open **View → Output**, select the `diff2html-report` channel in the Output panel, and include the copied log with your report.

## Contributing

Pull requests are welcome. See [CONTRIBUTING.md](https://github.com/Lead007/vscode-diff2html-report/blob/main/CONTRIBUTING.md).

If this extension saves you time, a Marketplace review helps other developers find it.

## License

Released under [MIT](https://github.com/Lead007/vscode-diff2html-report/blob/main/LICENSE) by [@Lead007](https://github.com/Lead007).

The symbol icons use [Codicons](https://github.com/microsoft/vscode-codicons) by Microsoft, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Release Notes

See [CHANGELOG](https://github.com/Lead007/vscode-diff2html-report/blob/main/CHANGELOG.md).

---

**Enjoy!**
