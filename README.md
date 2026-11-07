English Introduction | [中文介绍](#Git-Diff差异报告)

# Diff2html Report Generator For VS Code

Generate and export a `git diff` report as an HTML page.

## Features

This extension adds two commands to the Git repository's title menu in VS Code's **Source Control** view.

**Generate Diff Report** lets you compare Git revisions and preview or export the result as an HTML report.

**Generate Change Item Report** analyzes differences between the selected Git revisions. You can select changed functions, add change notes, preview the report in a Webview, and export it as a standalone HTML file.

## Requirements

* VS Code 1.68.0 or higher.
* VS Code's built-in Git plugin.
* A VS Code language extension that provides document symbols for each language you want to analyze with the **Generate Change Item Report** command. Symbol detection depends on the language extension and current VS Code configuration; missing headers or other unresolved dependencies may affect the symbols it returns.

## Usage

Open a Git repository in VS Code. Both report commands are available from the Git repository's title menu in the **Source Control** view.

For either command, select a base revision and a current revision from the available branches or tags. You can also enter a branch name, tag, or commit hash manually. The current revision can be **Staged** to compare the base revision with staged changes. Then choose any `git diff` options to apply.

### Generate Diff Report

1. Run **Generate Diff Report** from the Source Control view's title menu.
2. Select the base and current revisions, then choose the `git diff` options.
3. Review the rendered diff in the preview. The report includes a file list and, when enabled, total added/deleted line counts.
4. To save a standalone HTML report, use **Save as HTML File**, choose whether to include the file list, and select a destination. After export, you can open the saved file or its containing folder.

### Generate Change Item Report

1. Run **Generate Change Item Report** from the Source Control view's title menu.
2. Select the base and current revisions, then choose the `git diff` options. The extension analyzes changed files and uses VS Code document symbols to identify changed functions.
3. In the review view, select the changed functions or file-level changes that belong to a change item. Add a title and description, then create the item. You can edit or delete items, adjust their selections, or clear all items.
4. Select **Preview HTML** to review the report, switch its light/dark theme if desired, and choose **Export HTML** to save it as a standalone file.

Function-level analysis requires an installed and enabled language extension that provides document symbols for the file type. If symbols are unavailable or no functions are identified, changes may appear at file level instead. Binary and oversized files are not analyzed for function-level changes.

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
* `diff2html-report.defaultViewType`: Set the default view type to show diff lines for exported page, including Git Diff Report and Change Items Report. The default setting is side-by-side.
* `diff2html-report.useOnlineResources`: Set whether to use online resources for `diff2html`. The default setting is `false`, which means using stylesheets and scripts inside this extension.

## Q&A

### Why is code in the report garbled?

Set `diff2html-report.encoding` in VS Code settings to match the encoding of your repository files. The default is `utf8`; for example, use `gbk` for GBK-encoded files.

### How can I limit the report to specific folders or file types?

Set `diff2html-report.filter` to an array of `git diff` pathspec arguments. For example, use `["--", "src/"]` to include a folder or `["--", "*.cpp"]` to include files matching a pattern.

### What if I can't find the base or current revision in the list?

Find the commit in Git history or a Git Graph extension, copy its commit hash, and enter the hash manually when selecting the base or current revision.

### Why are some files uncorrectly missing function-level analysis results?

The language extension that provides document symbols may not have finished loading, especially immediately after opening a workspace. Wait for the language extension to finish loading, then run **Generate Change Item Report** again.

### Why are code diffs always shown in `line-by-line` view on the Diff Review page, even when my setting is `side-by-side`?

On the Diff Review page, the code diff and the change item form are displayed side by side. Since there is limited horizontal space for the diff, it always uses the `line-by-line` view.

## License

Released under [MIT](https://github.com/Lead007/vscode-diff2html-report/blob/main/LICENSE) by [@Lead007](https://github.com/Lead007).

## Release Notes

See [CHANGELOG](https://github.com/Lead007/vscode-diff2html-report/blob/main/CHANGELOG.md).

---

**Enjoy!**

# Git Diff差异报告

在 VS Code 中生成并导出 HTML 格式的 Git 差异报告。

## 功能

本扩展在 VS Code **源代码管理**视图中 Git 仓库的标题菜单提供两个命令：

* **生成差异报告**：比较 Git 版本，在预览中查看差异，并可导出为 HTML 文件。
* **生成更改项报告**：分析所选 Git 版本之间的差异。你可以选择变更的函数、添加更改说明，在 Webview 中预览报告，并导出为独立 HTML 文件。

## 环境要求

* VS Code 1.68.0 或更高版本。
* VS Code 内置的 Git 扩展。
* 如果要使用**生成更改项报告**进行函数级分析，需要为相应语言安装能够提供文档符号的 VS Code 语言扩展。符号识别也受语言扩展和当前 VS Code 项目配置影响；缺少头文件或其他未解决的依赖可能影响返回的符号。

## 使用方法

在 VS Code 中打开 Git 仓库。两个报告命令都可以从**源代码管理**视图中该仓库的标题菜单启动。

运行任一命令时，先选择基准版本和当前版本（可选分支或标签），也可以手动输入分支名、标签名或提交哈希。当前版本还可以选择**暂存区**，以比较基准版本与已暂存的更改。之后可选择要应用的 `git diff` 选项。

### 生成差异报告

1. 在源代码管理视图的仓库标题菜单中选择**生成差异报告**。
2. 选择基准版本和当前版本，然后选择 `git diff` 选项。
3. 在预览中查看差异。报告包含文件列表；启用行数统计时，还会显示新增和删除的总行数。
4. 如需保存独立 HTML 报告，选择**另存为 HTML 文件**，设置是否包含文件列表并选择保存位置。导出后可以打开文件或其所在文件夹。

### 生成更改项报告

1. 在源代码管理视图的仓库标题菜单中选择**生成更改项报告**。
2. 选择基准版本和当前版本，然后选择 `git diff` 选项。扩展会分析变更文件，并使用 VS Code 文档符号识别变更函数。
3. 在评审界面中，选择要关联到更改项的变更函数或文件级变更，填写标题和说明并创建更改项。你还可以编辑或删除更改项、调整关联项，或清空所有更改项。
4. 选择**预览 HTML**检查报告；可以切换浅色/深色主题，然后选择**导出 HTML**将报告保存为独立文件。

函数级分析需要已安装并启用、且能为相应文件类型提供文档符号的语言扩展。如果符号不可用或未识别到函数，相关变更可能以文件级变更显示。二进制文件和超大文件不会进行函数级分析。

## 扩展设置

本扩展提供以下设置：

* `diff2html-report.defaultDiffOptions`：生成差异报告时默认选中的 `git diff` 选项。
* `diff2html-report.filter`：设置文件筛选参数，仅在差异报告中包含指定文件。可使用 Git pathspec，例如 `["--", "src/"]`。
* `diff2html-report.encoding`：读取仓库文件特定版本时使用的字符编码（例如获取差异内容时）。默认值为 `utf8`。支持的编码列表见 [iconv-lite 文档](https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings)。
* `diff2html-report.maxGitDiffFileSize`：`git diff` 输出的最大大小，单位为字节，默认值为 64 MB。
* `diff2html-report.functionDiffLineThreshold`：函数行数小于或等于该值时，在函数级差异中显示完整函数，默认值为 30。
* `diff2html-report.functionDiffChangePercentage`：较长函数的变更行数达到此比例时，显示完整函数，默认值为 30%。
* `diff2html-report.functionDiffContextLines`：长函数仅有少量变更时，在变更周围显示的未修改上下文行数，默认值为 3。
* `diff2html-report.functionDiffSymbolKinds`：函数级分析包含的 VS Code 文档符号类型，默认值为 `Function`、`Method`、`Constructor` 和 `Operator`。
* `diff2html-report.drawLineCount`：是否在差异报告中显示行数统计。
* `diff2html-report.defaultViewType`：导出报告中显示差异行的默认视图类型，包括 Git Diff 报告和更改项报告。默认值为并排视图（`side-by-side`）。
* `diff2html-report.useOnlineResources`：是否使用 CDN 在线资源生成差异报告。默认值为 `false`，即使用扩展内的本地资源。

## 常见问题

### 报告中的代码出现乱码怎么办？

在 VS Code 设置中将 `diff2html-report.encoding` 改为与仓库文件相符的编码。默认值为 `utf8`；例如，GBK 编码的文件可以设置为 `gbk`。

### 如何只报告指定文件夹或文件类型？

将 `diff2html-report.filter` 设置为 Git `diff` 的 pathspec 参数数组。例如，`["--", "src/"]` 可筛选 `src` 文件夹，`["--", "*.cpp"]` 可筛选匹配该模式的文件。

### 如果在列表中找不到基准版本或当前版本怎么办？

可以在 Git 历史记录或 Git Graph 等扩展中找到相应的提交，复制其提交哈希，然后在选择基准版本或当前版本时手动输入该哈希。

### 为什么有些文件没有正确显示函数级分析结果？

尤其是在刚打开工作区时，提供文档符号的语言扩展可能尚未完成加载。等待语言扩展加载完成后，再次运行**生成更改项报告**。

### 为什么编写更改项的页面中，代码行差异始终是`line-by-line`视图类型，即使我的设置是`side-by side`？

因为编写更改项的页面中代码差异和填写更改项的表单是水平方向并排的，考虑到给代码差异能留的宽度有限，所以视图类型始终是`line-by-line`。

## 许可证

本项目由 [@Lead007](https://github.com/Lead007) 基于 [MIT 许可证](https://github.com/Lead007/vscode-diff2html-report/blob/main/LICENSE)发布。

## 发布说明

请参阅[更新日志](https://github.com/Lead007/vscode-diff2html-report/blob/main/CHANGELOG.md)。
