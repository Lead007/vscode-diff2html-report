# 为 Git Diff Report 贡献代码

感谢你抽出时间参与贡献。本文介绍如何搭建开发环境、我们遵循的约定，以及新增用户可见功能时的检查清单。

## 参与贡献的方式

- **报告 Bug** —— 使用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.yml)。
- **功能想法** —— 先开一个 Issue，描述你想支持的工作流程。「我需要把一份变更摘要附到工单里」比「加一个 PDF 按钮」更有用。
- **文档** —— 错别字、表述不清的步骤、缺失的截图，都欢迎以 PR 形式提交。
- **翻译** —— 界面文案位于 `package.nls.json` 和 `package.nls.zh-cn.json`。
- **代码** —— 提 PR 之前请先看下面的检查清单。

## 开始之前

对于比错别字或一行修改更大的改动，请**先开 Issue**。这样可以避免你花一个周末做出一个不符合路线图的功能。

涉及符号级分析的改动，请说明你测试所用的语言扩展（例如 `ms-vscode.cpptools`、`vscjava.vscode-java-pack`），因为符号识别完全取决于该扩展上报的内容。

## 开发环境搭建

环境要求：

- Node.js 20 或更高版本
- npm
- Git
- VS Code 1.68.0 或更高版本

```
git clone https://github.com/Lead007/vscode-diff2html-report.git

cd vscode-diff2html-report

npm install

npm run build:debug
```

然后在 VS Code 中按 `F5` 启动扩展开发宿主（Extension Development Host）。在打开的窗口中打开一个 Git 仓库，并从源代码管理视图的仓库标题菜单运行任一报告命令。

## 项目结构

| 路径 | 内容 |
|---|---|
| `src/` | 扩展宿主代码（TypeScript）。先用 `tsc` 编译，再由 esbuild 打包到 `dist/`。 |
| `src/webview/`（或 Vite 根目录） | 预览与报告界面。Vue 3 + Element Plus + UnoCSS，由 Vite 打包。 |
| `dist/` | 构建输出。**不要手动修改**，也不要提交。 |
| `package.nls.json`、`package.nls.zh-cn.json` | 命令、设置和菜单标签的所有用户可见文案。 |
| `assets/icon.png` | 应用市场图标，128×128。 |

如果上表中的路径与你看到的实际结构不一致，以仓库为准，并欢迎提交文档 PR —— 这张表是手工维护的。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run build` | 对 webview 做类型检查、构建 webview，并编译打包扩展。打包前使用。 |
| `npm run build:debug` | 同上，但不做压缩。速度更快，调用栈更清晰。 |
| `npm run watch` | 以 watch 模式运行 `tsc`，只处理扩展宿主代码。 |
| `npm run dev:webview` | 为 webview 界面启动 Vite 开发服务器。 |
| `npm run watch:webview` | 以 watch 模式运行 Vite 构建。 |
| `npm run check:webview` | 只对 webview 运行 `vue-tsc` 类型检查。 |
| `npm run lint` | 对 `src/` 运行 ESLint。 |
| `npm test` | 通过 `vscode-test` 运行扩展测试套件。 |
| `npm run release` | 用 `vsce` 打包 `.vsix`。 |

## 编码约定

- **不发起任何外部网络请求。** 可完全离线运行是这个扩展的核心承诺。添加 CDN 引用、遥测调用或「检查更新」请求的 PR 会被拒绝。
- **保持依赖精简。** 每个运行时依赖都会被打进 VSIX，并影响激活时间。能用 VS Code API 解决，就不要新增依赖包。
- **对最终进入报告的所有内容做转义。** 差异内容、文件名和更改项标题都会被渲染进用户用浏览器打开的 HTML 文档。请把它们全部当作不可信输入处理。
- **Git 参数以数组形式传递**，绝不拼接成 shell 字符串。分支名和提交哈希都来自用户输入。
- `npm run lint` 必须通过。请沿用现有代码风格，不要顺手重新格式化相邻文件。
- 用户可见文案必须同时添加到 `package.nls.json` 和 `package.nls.zh-cn.json`，且键保持一致。

## 检查清单：新增命令或设置

1. 在 `package.json` 的 `contributes.commands` / `contributes.configuration` 中注册。
2. 在 `package.nls.json` **和** `package.nls.zh-cn.json` 中加入 `%key%` 占位符。
3. 如果该命令需要能从源代码管理标题栏启动，请添加 `menus.scm/title` 条目 **并** 配置 `icon`（例如 `$(git-compare)` 这样的 [codicon](https://code.visualstudio.com/api/references/icons-in-labels) id），否则它会以内联分组中的纯文本形式显示。
4. 更新 `README.md` 和 `README.zh-cn.md` 中的设置表和用法章节。
5. 在 `CHANGELOG.md` 中新增条目。

## 提交与 PR

- 使用 [Conventional Commits](https://www.conventionalcommits.org/)：`feat:`、`fix:`、`docs:`、`perf:`、`refactor:`、`chore:`。
- 一个 PR 只做一件事，不要把一个修复和一次重构混在一起。
- 界面改动需要在 PR 描述中提供改动前后的截图。
- 推送之前请运行：

```
npm run lint

npm test

npm run build
```

- 在 PR 正文中引用 Issue 编号（`Closes #12`）。

## 许可证

参与贡献即表示你同意你的贡献按 [MIT 许可证](LICENSE) 授权，与本项目所采用的条款相同。
