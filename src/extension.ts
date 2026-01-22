// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RefInfo } from './scmTypes';
import { getSelection, selectCommit, selectDiffOptions } from './selection';
import { execFile, ExecFileOptionsWithBufferEncoding, ExecFileOptionsWithStringEncoding } from 'child_process';
import * as diff2html from 'diff2html';
import { OutputFormatType } from 'diff2html/lib/types';
import { getExportContent, getWebviewContent } from './htmlTemplate';
import { promisify } from 'util';
import { init, localize } from 'vscode-nls-i18n';
// This method is called when your extension is activateds
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	init(context.extensionPath);

	// 获取 Git 扩展
	const gitExtension = vscode.extensions.getExtension('vscode.git');
	if (!gitExtension) {
		return;
	}

	const git = gitExtension.exports.getAPI(1);

	// npm包中的样式和脚本
	const uri_diff2html_ui_css = vscode.Uri.joinPath(context.extensionUri, 'node_modules', 'diff2html', 'bundles', 'css', 'diff2html.min.css');
	const uri_diff2html_ui_js = vscode.Uri.joinPath(context.extensionUri, 'node_modules', 'diff2html', 'bundles', 'js', 'diff2html-ui.min.js');
	const uri_bulma_css = vscode.Uri.joinPath(context.extensionUri, 'node_modules', 'bulma', 'css', 'bulma.css');

	// 在 SCM 提供者上注册命令
	context.subscriptions.push(
		vscode.commands.registerCommand('diff2html-report.generateDiffReport', async (uri?) => {
			// 获取当前仓库
			const repo = git.repositories[0];
			if (!repo) { return; }

			// 显示进度窗口并获取引用
			const commits = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				cancellable: false
			}, async (progress) => {
				progress.report({ message: localize('diff2html-report.progress.loadingRefs') });
				const refs: RefInfo[] = await repo.getRefs();

				progress.report({ message: localize('diff2html-report.progress.loadingRefsMessage') });
				const head = {
					label: "HEAD",
					description: localize('diff2html-report.commitOption.description.head'),
					detail: localize('diff2html-report.commitOption.detail.head')
				};

				const input = {
					label: localize('diff2html-report.commitOption.label.inputPrompt'),
					description: localize('diff2html-report.commitOption.description.inputPrompt'),
					detail: localize('diff2html-report.commitOption.detail.inputPrompt'),
					isCustom: true
				};

				// 获取分支、标签和提交
				const localBranches = await Promise.all(refs
					.filter(ref => ref.type === 0) // type 1 是本地分支
					.map(ref => getSelection(ref, localize('diff2html-report.commitOption.description.local'), repo)));

				const remoteBranches = await Promise.all(refs
					.filter(ref => ref.type === 1) // type 2 是远程分支
					.map(ref => getSelection(ref, localize('diff2html-report.commitOption.description.remote'), repo)));

				const tags = await Promise.all(refs
					.filter(ref => ref.type === 2) // type 3 是Tag
					.map(ref => getSelection(ref, localize('diff2html-report.commitOption.description.tag'), repo)));
				return [head, input, ...localBranches, ...remoteBranches, ...tags];
			});

			// 选择基线版本
			let selectedBase = await selectCommit(commits, localize('diff2html-report.commitOption.placeHolder.base'));

			if (!selectedBase) {
				return;
			}

			// 选择当前版本时，插入暂存区选项
			commits.splice(1, 0, {
				label: '--staged',
				description: localize('diff2html-report.commitOption.description.staged'),
				detail: localize('diff2html-report.commitOption.detail.staged')
			});

			let selectedCur = await selectCommit(commits, localize('diff2html-report.commitOption.placeHolder.current'));

			if (!selectedCur) {
				return;
			}

			const extensionConfig = vscode.workspace.getConfiguration('diff2html-report');
			// 选择git diff参数
			const enableOptionsStr = await selectDiffOptions(extensionConfig);

			// 获取编码和文件大小限制配置
			const encoding = extensionConfig.get<string>('encoding') || 'utf8';
			const maxGitDiffFileSize = extensionConfig.get<number>('maxGitDiffFileSize') || 67108864;

			const htmlContent = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				cancellable: false
			}, async (progress) => {
				progress.report({ message: localize('diff2html-report.progress.executingDiff') });

				const diffContent = await runGitDiffCommand(repo.rootUri.fsPath, encoding, maxGitDiffFileSize, [selectedBase.label, selectedCur.label, ...enableOptionsStr]);
				if (!diffContent) {
					return;
				}

				// 使用Diff2Html渲染
				progress.report({ message: localize('diff2html-report.progress.generatingReport') });
				const configuration = {
					drawFileList: true,
					matching: 'lines',
					outputFormat: extensionConfig.get<string>('defaultViewType') as OutputFormatType,
				} as diff2html.Diff2HtmlConfig;
				return diff2html.html(diffContent, configuration);
			});

			// 创建Webview
			const panel = vscode.window.createWebviewPanel(
				'diff2htmlPreview',
				localize('diff2html-report.webview.title'),
				vscode.ViewColumn.Active,
				{
					enableScripts: true,
					localResourceRoots: [
						vscode.Uri.joinPath(context.extensionUri, 'webview'),
						vscode.Uri.joinPath(context.extensionUri, 'node_modules'),
					]
				}
			);

			// 准备webview css和js资源
			let cssUris: vscode.Uri[] = [];
			let scriptUris: vscode.Uri[] = [];
			if (extensionConfig.get<boolean>('useOnlineResources')) {
				// 使用在线资源
				cssUris = [
					vscode.Uri.parse(localize('diff2html-report.webview.css.diff2html.online')),
					vscode.Uri.parse(localize('diff2html-report.webview.css.bulma.online')),
				];
				scriptUris = [
					vscode.Uri.joinPath(context.extensionUri, 'webview', 'preview-page.js'),
					vscode.Uri.parse(localize('diff2html-report.webview.js.diff2html.online')),
				];
			} else {
				// 使用本地资源
				cssUris = [
					uri_diff2html_ui_css,
					uri_bulma_css,
				];
				scriptUris = [
					vscode.Uri.joinPath(context.extensionUri, 'webview', 'preview-page.js'),
					uri_diff2html_ui_js
				];
			}

			// 计算行数
			let lineCountResult = '';
			if (extensionConfig.get<boolean>('drawLineCount')) {
				lineCountResult = await runGitDiffCommand(repo.rootUri.fsPath, encoding, maxGitDiffFileSize, [selectedBase.label, selectedCur.label, '--numstat', ...enableOptionsStr]);
				if (!lineCountResult) {
					return;
				}
			}

			const lineCountForFile = lineCountResult.trim().split('\n').map(line => {
				const parts = line.split('\t');
				if (parts.length >= 3) {
					return {
						added: parts[0] === '-' ? 0 : parseInt(parts[0], 10),
						deleted: parts[1] === '-' ? 0 : parseInt(parts[1], 10),
						file: parts[2],
					};
				}
				return null;
			}).filter(item => item !== null) as { added: number, deleted: number, file: string }[];

			const totalAdded = lineCountForFile.reduce((sum, item) => sum + item.added, 0);
			const totalDeleted = lineCountForFile.reduce((sum, item) => sum + item.deleted, 0);

			const lineCountContent = localize('diff2html-report.webview.lineCountContent', String(totalAdded), String(totalDeleted));

			// 生成最终的webview html内容
			const resultHtml = await getWebviewContent(panel.webview, {
				htmlPath: vscode.Uri.joinPath(context.extensionUri, 'webview', 'preview-page.html'),
				cssUris,
				scriptUris,
				title: localize('diff2html-report.webview.title'),
				header: localize('diff2html-report.webview.header'),
			}, {
				exportOptionsLabel: localize('diff2html-report.webview.exportOptionsLabel'),
				generateFileListLabel: localize('diff2html-report.webview.generateFileListLabel'),
				exportButtonLabel: localize('diff2html-report.webview.exportButtonLabel'),
				htmlContent,
				lineCountContent
			});

			panel.webview.html = resultHtml;

			panel.webview.onDidReceiveMessage(async (message) => {
				if (message.type === 'saveHtml') {
					const options = message.options;
					const html = message.html;
					// 保存文件对话框
					const uri = await vscode.window.showSaveDialog({
						defaultUri: vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0].uri || vscode.Uri.file('/'), `diff-report-${new Date().toLocaleDateString().replace(/\//g, '-')}.html`),
						filters: {
							'HTML file': ['html', 'htm']
						}
					});
					if (uri) {
						vscode.window.withProgress({
							location: vscode.ProgressLocation.Notification,
							cancellable: false
						}, async (progress) => {
							progress.report({ message: localize('diff2html-report.progress.exportingReport') });

							let diff2htmlCss = '';
							const extensionConfig = vscode.workspace.getConfiguration('diff2html-report');
							if (!extensionConfig.get<boolean>('useOnlineResources')) {
								// 进行资源内联
								const diff2htmlCssBytes = await vscode.workspace.fs.readFile(uri_diff2html_ui_css);
								diff2htmlCss = new TextDecoder().decode(diff2htmlCssBytes);

								if (!options.generateFileList) {
									diff2htmlCss += `
									.d2h-file-list-wrapper {
										display: none !important;
									}`;
								}

								diff2htmlCss = `
								<style>
								${diff2htmlCss}
								</style>
							`;
							} else {
								// 使用在线资源链接
								diff2htmlCss = `
								<link rel="stylesheet" href="${localize('diff2html-report.webview.css.diff2html.online')}">
							`;
								if (!options.generateFileList) {
									diff2htmlCss += `
								<style>
									.d2h-file-list-wrapper {
										display: none !important;
									}
								</style>`;
								}
							}


							let finalHtml = await getExportContent(vscode.Uri.joinPath(context.extensionUri, 'webview', 'export-page.html'),
								{ title: localize('diff2html-report.webview.header'), htmlContent: html, cssContent: diff2htmlCss, lineCountContent });
							await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(finalHtml));

						});
						const action = await vscode.window.showInformationMessage(
							localize('diff2html-report.export.information', uri.fsPath),
							localize('diff2html-report.export.openFile'),
							localize('diff2html-report.export.openFolder')
						);
						if (action === localize('diff2html-report.export.openFile')) {
							vscode.env.openExternal(vscode.Uri.file(uri.fsPath));
						} else if (action === localize('diff2html-report.export.openFolder')) {
							vscode.commands.executeCommand('revealFileInOS', uri);
						}
					}
				}
			});

		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }

/**
 * 指定编码运行 git diff 命令并返回输出
 * @param path 运行目录
 * @param encoding 编码
 * @param paras git diff后的参数列表
 * @returns stdout，若有错误返回空字符串
 */
async function runGitDiffCommand(path: string, encoding: string, maxBuffer: number, paras: string[]): Promise<string> {
	try {
		const execFileAsync = promisify(execFile);
		const execOption: ExecFileOptionsWithBufferEncoding = { cwd: path, maxBuffer: maxBuffer, encoding: 'buffer' };
		const { stdout, stderr } = await execFileAsync(
			'git',
			['diff', ...paras],
			execOption
		);

		const decoder = new TextDecoder(encoding);
		if (stderr.buffer.byteLength && !decoder.decode(stderr.buffer).includes('warning:')) {
			const errString = decoder.decode(stderr.buffer);
			if (!errString.includes('warning:')) {
				vscode.window.showErrorMessage(localize('diff2html-report.commandErrorText', errString));
				return '';
			}
		}
		if (stdout.buffer.byteLength === 0) {
			vscode.window.showInformationMessage(localize('diff2html-report.commandNoDiffText'));
			return '';
		}
		return decoder.decode(stdout);
	} catch (error) {
		vscode.window.showErrorMessage(localize('diff2html-report.commandErrorText', String(error)));
		return '';
	}
}