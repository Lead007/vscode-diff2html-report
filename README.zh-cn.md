[English](README.md) | 简体中文

# Git Diff 差异报告 — 分享为HTML

**把 `git diff` 变成一份能发出去的 HTML 报告 —— 不用截图，不用把差异贴进聊天框。**

在任意两个 Git 版本之间生成差异报告或结构化的更改项报告，在 VS Code 内预览，并导出为单个独立 HTML 文件。

全程在你本机运行：差异由你自己的 Git 生成，扩展负责渲染，报告用任何浏览器都能打开。

不需要账号，不上传代码，不需要联网。

[![Marketplace](https://vsmarketplacebadges.dev/version-short/Lead007.diff2html-report.svg)](https://marketplace.visualstudio.com/items?itemName=Lead007.diff2html-report)
[![Installs](https://vsmarketplacebadges.dev/installs-short/Lead007.diff2html-report.svg)](https://marketplace.visualstudio.com/items?itemName=Lead007.diff2html-report)
[![Rating](https://vsmarketplacebadges.dev/rating-star/Lead007.diff2html-report.svg)](https://marketplace.visualstudio.com/items?itemName=Lead007.diff2html-report)
[![License](https://img.shields.io/github/license/Lead007/vscode-diff2html-report)](https://github.com/Lead007/vscode-diff2html-report/blob/main/LICENSE)

## 这个插件解决什么问题

`git diff` 适合自己看，不适合给别人看。这个扩展把它变成一份可以直接交付的产物：

- **30 秒上手**：打开仓库 → 源代码管理标题栏点图标 → 选基准/当前版本 → 预览 → 导出 HTML
- **代码评审** —— PR 太大，浏览器里读不下去？导出成一份页面，离线慢慢看，或附在评审里。把 **merge base** 选为基准版本，报告就只包含分支自身的改动。
- **交付与交接** —— 给甲方或下一个团队一份可读的改动清单，带说明，而不是一堆 `+`/`-`。
- **发布记录与审计** —— 每个版本留一份 HTML 变更记录，按符号分组，附上文字说明。
- **内网 / 受限环境** —— 不依赖 CDN、不收集遥测、不发起任何外部请求。拔掉网线也能预览和导出，适合隔离网络、金融和政企环境。

## 快速开始（30 秒）

1. 安装扩展，在 VS Code 中打开一个 Git 仓库。
2. 打开 **源代码管理** 视图，点击该仓库标题栏的 `...` 菜单。
3. 运行 **生成差异报告** → 选择基准版本和当前版本 → 预览 → **导出 HTML**。

导出的文件用任何浏览器都能打开，对方不需要装插件，可以直接发邮件、贴到工单里，或提交到仓库的 `docs/` 目录。

## 两个命令，两种报告

| | **生成差异报告** | **生成更改项报告** |
|---|---|---|
| 输出 | 所选版本之间的完整差异 | 按更改项分组的差异 |
| 适合 | 原样评审或归档一份 diff | 说明「改了什么、为什么改」 |
| 符号分析 | — | 通过 VS Code 文档符号按类 / 函数 / 方法分组 |
| 说明文字 | — | 每个更改项可填标题和描述 |
| 导出 | 独立 HTML | 独立 HTML |

这两个命令也可以通过源代码管理标题栏的 **生成报告 (HTML)** 图标/菜单弹出的选择菜单调用。

## 报告里有什么

- 文件列表，以及新增 / 删除总行数统计
- 并排（side-by-side）或逐行（line-by-line）视图
- 浅色 / 深色主题，导出前可切换
- 单个自包含 HTML 文件，不需要插件、服务器或构建步骤
- 符号级分组，把 40 个文件的差异收敛成几条有名字的改动（更改项报告）

## 环境要求

* VS Code 1.68.0 或更高版本。
* VS Code 内置的 Git 扩展。
* 使用 **生成更改项报告** 进行符号级分析时，需要为相应语言安装能够提供文档符号的 VS Code 语言扩展。符号识别也受语言扩展和当前 VS Code 配置影响；缺少头文件或其他未解决的依赖可能影响返回的符号。

## 安装

- **应用市场**：搜索 `Git Diff Report — Share as HTML` 或扩展 ID `Lead007.diff2html-report`（中文界面下扩展显示为「Git Diff 差异报告 — 分享为HTML」），或从[扩展页面](https://marketplace.visualstudio.com/items?itemName=Lead007.diff2html-report)安装。
- **VSIX**：从 [Releases](https://github.com/Lead007/vscode-diff2html-report/releases) 下载`.vsix`，然后 `扩展 → ... → 从 VSIX 安装...`。

## 使用方法

在 VS Code 中打开 Git 仓库。两个报告命令都可以从 **源代码管理** 视图中该仓库的标题菜单启动。

运行任一命令时，先选择基准版本和当前版本（可选分支或标签），也可以手动输入分支名、标签名或提交哈希。当前版本还可以选择 **暂存区** ，以比较基准版本与已暂存的更改。之后可选择要应用的 `git diff` 选项。报告使用 `git diff <base> <current>` 直接比较两个版本（two-dot），而不是它们的 merge base；评审分支时请把 merge base 选为基准版本。

### 生成差异报告

1. 在源代码管理视图的仓库标题菜单中选择 **生成差异报告** 。
2. 选择基准版本和当前版本，然后选择 `git diff` 选项。
3. 在预览中查看差异。报告包含文件列表，还会显示新增和删除的总行数。
4. 如需保存独立 HTML 报告，选择 **导出 HTML** ，可以切换浅色/深色主题，选择保存位置。导出后可以打开文件或其所在文件夹。

### 生成更改项报告

1. 在源代码管理视图的仓库标题菜单中选择 **生成更改项报告** 。
2. 选择基准版本和当前版本，然后选择 `git diff` 选项。扩展会分析变更文件，并使用 VS Code 文档符号识别变更符号。
3. 在评审界面中，选择要关联到更改项的变更符号或文件级变更，填写标题和说明并创建更改项。你还可以编辑或删除更改项、调整关联项，或清空所有更改项。
4. 选择 **预览 HTML** 检查报告；可以切换浅色/深色主题，然后选择 **导出 HTML** 将报告保存为独立文件。

*符号级分析需要已安装并启用、且能为相应文件类型提供文档符号的语言扩展。如果符号不可用或未识别到符号，相关变更可能以文件级变更显示。二进制文件和超大文件的差异不会被解析和显示。*

## 扩展设置

| 设置 | 默认值 | 说明 |
|---|---|---|
| `diff2html-report.defaultDiffOptions` | — | 生成报告时默认选中的 `git diff` 选项，支持 `-b`、`-w`、`-M`、`-C`。 |
| `diff2html-report.filter` | — | 按顺序原样追加到 `git diff <base> <current>` 的额外参数（在选择器中选中的选项之后）。路径前请加 `--`，例如 `["--", "src/"]` 或 `["--", "*.cpp"]`；也可以传其他 `git diff` 选项，例如 `["--diff-filter=M"]`。 |
| `diff2html-report.encoding` | `utf8` | 读取仓库文件特定版本时使用的字符编码，支持列表见 [iconv-lite](https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings)。 |
| `diff2html-report.recentCommitCount` | 5 | 在提交选择下拉列表中显示的最近提交数。|
| `diff2html-report.maxGitDiffFileSize` | `67108864`（64 MiB） | 单次 Git 命令（`diff`、`log`、`for-each-ref`、`show`）输出的最大字节数。超出时该命令会失败，报告生成随之中断；可按需调大。 |
| `diff2html-report.symbolDiffLineThreshold` | `30` | 符号行数小于或等于该值时，在符号级差异中显示完整内容。 |
| `diff2html-report.symbolDiffChangePercentage` | `30` | 较长内容的符号的变更行数达到此比例时，显示完整符号内容。 |
| `diff2html-report.symbolDiffContextLines` | `3` | 内容长的符号仅有少量变更时，在变更周围显示的未修改上下文行数。 |
| `diff2html-report.symbolDiffSymbolKinds` | `Class`、`Function`、`Method`、`Constructor`、`Operator`、`Struct` | 符号级分析包含的 VS Code 文档符号类型。 |
| `diff2html-report.defaultViewType` | `side-by-side` | Diff 预览和导出报告使用的视图类型；更改项评审页始终使用 `line-by-line`。 |

## 常见问题

### 报告中的代码出现乱码怎么办？

在 VS Code 设置中将 `diff2html-report.encoding` 改为与仓库文件相符的编码。默认值为 `utf8`；例如，GBK 编码的文件可以设置为 `gbk`。

### 如何限制报告范围或传递其他 `git diff` 参数？

将 `diff2html-report.filter` 设置为参数数组。数组中的每一项都会按顺序原样追加到 `git diff <base> <current>`（在选择器中选中的选项之后）。路径前请加 `--`，例如 `["--", "src/"]` 可筛选 `src` 文件夹，`["--", "*.cpp"]` 可筛选匹配该模式的文件；其他 `git diff` 选项（如 `["--diff-filter=M"]`）也会原样传给 Git。

### 如果在列表中找不到基准版本或当前版本怎么办？

可以在 Git 历史记录或 Git Graph 等扩展中找到相应的提交，复制其提交哈希，然后在选择基准版本或当前版本时手动输入该哈希。

### 为什么有些文件没有正确显示符号级分析结果？

尤其是在刚打开工作区时，提供文档符号的语言扩展可能尚未完成加载。等待语言扩展加载完成后，再次运行**生成更改项报告**。

### 为什么编写更改项的页面中，代码行差异始终是`line-by-line`视图类型，即使我的设置是`side-by-side`？

因为编写更改项的页面中代码差异和填写更改项的表单是水平方向并排的，考虑到给代码差异能留的宽度有限，所以视图类型始终是`line-by-line`。

### 哪些语言支持符号级分析？

只要对应的 VS Code 语言扩展提供文档符号即可。JavaScript/TypeScript、C/C++、Java、C#、Go、
Python、Rust 等通常可用，具体覆盖范围取决于语言扩展的符号支持。

## 已知限制

- **two-dot 比较** —— 报告执行 `git diff <base> <current>`（two-dot），直接比较两个版本的树，而不是它们的 merge base。需要 PR 式评审时，请把 merge base 作为基准版本；否则目标分支在分叉后的改动会以反向差异出现在报告里。
- **二进制文件** —— 二进制文件只保留文件条目，不展示文件内容。
- **差异大小** —— 任一 Git 命令（`diff`、`log`、`for-each-ref`、`show`）的输出超过 `diff2html-report.maxGitDiffFileSize`（字节）时，该命令会失败，整次报告生成随之中断；可适当调大该设置。
- **符号配对** —— 符号级变更是启发式配对，重命名或大幅修改的符号可能被归错。
- **更改项仅限当前会话** —— 更改项只存在于当前 webview 会话中，关闭面板后未导出的内容会丢失。
- **评审布局** —— 即使 `diff2html-report.defaultViewType` 设为 `side-by-side`，评审编辑页仍固定使用 line-by-line 视图。
- **导出格式** —— 仅支持导出为独立 HTML 文件。

## 隐私

- `git diff` 通过你本机的 Git 执行， **代码不会被上传** ，扩展也不发起外部请求、收集遥测或使用数据。
- 渲染用的前端库已打包进扩展，预览可离线使用，不存在会被代理拦截的 CDN 依赖。
- 导出的 HTML 文件只会写入你在本机选择的位置。

## 反馈与支持

- Bug 与功能请求：[Issues](https://github.com/Lead007/vscode-diff2html-report/issues)
- 问题与想法：[Discussions](https://github.com/Lead007/vscode-diff2html-report/discussions)
- 提 Issue 前请先阅读 [SUPPORT.zh-cn.md](https://github.com/Lead007/vscode-diff2html-report/blob/main/SUPPORT.zh-cn.md)
- 遇到问题时，打开 **视图 → 输出**（View → Output），在输出面板选择 `diff2html-report` 频道，复制日志后再反馈。

## 参与贡献

欢迎提交 PR，请先看 [CONTRIBUTING.zh-cn.md](https://github.com/Lead007/vscode-diff2html-report/blob/main/CONTRIBUTING.zh-cn.md)。

如果这个扩展帮你省了时间，在应用市场留一条评价，能让更多开发者找到它。

## 许可证

本项目由 [@Lead007](https://github.com/Lead007) 基于 [MIT 许可证](https://github.com/Lead007/vscode-diff2html-report/blob/main/LICENSE)发布。

符号图标使用 Microsoft 的 [Codicons](https://github.com/microsoft/vscode-codicons)，基于 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可。

## 发布说明

请参阅[更新日志](https://github.com/Lead007/vscode-diff2html-report/blob/main/CHANGELOG.md)。
