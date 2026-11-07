/// <reference types="node" />

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { getGitRefs, getSelection, selectCommit, selectDiffOptions } from './selection';
import * as diff2html from 'diff2html';
import type { OutputFormatType } from 'diff2html/lib/types';
import { getExportContent, getWebviewContent } from './htmlTemplate';
import { findChangedFunctions } from './functionSymbols';
import type { ChangedFileFunctions } from './functionSymbols';
import { init, localize } from 'vscode-nls-i18n';
import { runGitDiffCommand } from './scmHelper';
import { randomBytes } from 'crypto';
import { appendLog, logger } from './logger';

const WEBVIEW_PREFIX = 'diff2html-report.webview.';
const DIFFVIEW_PREFIX = 'diff2html-report.webview.diffview.';
const CHANGE_ITEM_PREFIX = 'diff2html-report.webview.changeitems.';

async function getl18nWithPrefix(extensionUri: vscode.Uri, prefixes: string[]): Promise<Record<string, string>> {
	const localizationUri = vscode.Uri.joinPath(extensionUri, 'package.nls.json');
	const localizationBytes = await vscode.workspace.fs.readFile(localizationUri);
	const localizationEntries = JSON.parse(new TextDecoder().decode(localizationBytes)) as Record<string, string>;

	const result: Record<string, string> = {};

	for (const key of Object.keys(localizationEntries)) {
		for (const prefix of prefixes) {
			if (key.slice(0, key.lastIndexOf('.') + 1) !== prefix) {
				continue;
			}

			// 去掉命中的 prefix 和点，作为新 key
			result[key.slice(prefix.length)] = localize(key);
		}
	}
	return result;
}

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

	context.subscriptions.push(logger);
	// 在 SCM 提供者上注册命令
	context.subscriptions.push(
		vscode.commands.registerCommand('diff2html-report.generateDiffReport', async (uri?) => {
			appendLog(`Command 'diff2html-report.generateDiffReport' executing...`);
			const extensionConfig = vscode.workspace.getConfiguration('diff2html-report');
			// 获取当前仓库
			const repo = git.repositories[0];
			if (!repo) { return; }

			const selected = await selectTwoCommits(repo.rootUri.fsPath);

			if (!selected) {
				return;
			}

			const selectedBase = selected.base;
			const selectedCur = selected.current;
			const enableOptionsStr = selected.options;

			const htmlContent = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				cancellable: false
			}, async (progress) => {
				progress.report({ message: localize('diff2html-report.progress.executingDiff') });

				const diffContent = await runGitDiffCommand(repo.rootUri.fsPath, [selectedBase.label, selectedCur.label, ...enableOptionsStr]);
				if (!diffContent) {
					return;
				}

				const configuration = {
					drawFileList: true,
					matching: 'lines',
					outputFormat: extensionConfig.get<string>('defaultViewType') as OutputFormatType,
				} as diff2html.Diff2HtmlConfig;


				// 使用Diff2Html渲染
				progress.report({ message: localize('diff2html-report.progress.generatingReport') });
				return {
					html: diff2html.html(diffContent, configuration),
				};
			});
			if (!htmlContent) {
				return;
			}


			// 计算行数
			let lineCountResult = '';
			if (extensionConfig.get<boolean>('drawLineCount')) {
				lineCountResult = await runGitDiffCommand(repo.rootUri.fsPath, [selectedBase.label, selectedCur.label, '--numstat', ...enableOptionsStr]);
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
			const webViewContext = {
				title: localize('diff2html-report.webview.title'),
				header: localize('diff2html-report.webview.header'),
				htmlContent: htmlContent.html,
				lineCountContent,
				labels: await getl18nWithPrefix(context.extensionUri, [WEBVIEW_PREFIX, DIFFVIEW_PREFIX]),
			};
			showVuePage(context, 'legacy-diff-preview.html', localize('diff2html-report.webview.title'),
				webViewContext, '__LEGACY_DIFF_PREVIEW_DATA__',
				async (message) => {
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
							await vscode.window.withProgress({
								location: vscode.ProgressLocation.Notification,
								cancellable: false
							}, async (progress) => {
								progress.report({ message: localize('diff2html-report.progress.exportingReport') });

								let diff2htmlCss = '';
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

								diff2htmlCss += `
								<style>
									.changed-file { margin: 10px 0; border: 1px solid #d8d8d8; border-radius: 6px; overflow: hidden; }
									.changed-file-header, .changed-function-header { padding: 8px 12px; background: #f7f7f7; overflow-wrap: anywhere; }
									.changed-function { margin: 10px; border: 1px solid #d8d8d8; border-radius: 4px; overflow: hidden; }
									.changed-function pre { margin: 0; padding: 8px 12px; overflow-x: auto; white-space: pre; font-family: Consolas, monospace; font-size: 13px; }
									.changed-function pre.deleted { background: #fee8e9; }
									.changed-function pre.added { background: #dfd; }
									.function-status, .symbol-warning { color: #4b5563; }
								</style>`;

								let finalHtml = await getExportContent(vscode.Uri.joinPath(context.extensionUri, 'webview', 'export-page.html'),
									{ title: localize('diff2html-report.webview.header'), htmlContent: html, cssContent: diff2htmlCss, lineCountContent });
								await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(finalHtml));
							});

							//先让 VS Code 有机会刷新并关闭进度通知
							await new Promise<void>(resolve => setTimeout(resolve, 1000));
							//提示保存成功，可以打开文件或文件夹
							const action = await vscode.window.showInformationMessage(
								localize('diff2html-report.export.information', uri.fsPath),
								localize('diff2html-report.export.openFile'),
								localize('diff2html-report.export.openFolder')
							);
							if (action === localize('diff2html-report.export.openFile')) {
								const open = (await import('open')).default;
								await open(uri.fsPath);
							} else if (action === localize('diff2html-report.export.openFolder')) {
								vscode.commands.executeCommand('revealFileInOS', uri);
							}

						}
					}
				});

			appendLog(`Command 'diff2html-report.generateDiffReport' executed.`);

		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('diff2html-report.generateChangeItemReport', async (uri?) => {
			appendLog(`Command 'diff2html-report.generateChangeItemReport' executing...`);
			const extensionConfig = vscode.workspace.getConfiguration('diff2html-report');
			// 获取当前仓库
			const repo = git.repositories[0];
			if (!repo) { return; }

			const selected = await selectTwoCommits(repo.rootUri.fsPath);

			if (!selected) {
				return;
			}

			const selectedBase = selected.base;
			const selectedCur = selected.current;
			const enableOptionsStr = selected.options;

			const webViewContext = await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				cancellable: false
			}, async (progress) => {
				progress.report({ message: localize('diff2html-report.progress.executingDiff') });

				const diffContent = await runGitDiffCommand(repo.rootUri.fsPath, [selectedBase.label, selectedCur.label, ...enableOptionsStr]);
				if (!diffContent) {
					return;
				}

				progress.report({ message: localize('diff2html-report.progress.analyzingFunctions') });

				const diffInfo = diff2html.parse(diffContent, { drawFileList: true, matching: 'lines', outputFormat: extensionConfig.get<string>('defaultViewType') as OutputFormatType });
				let changedFunctions: ChangedFileFunctions[];
				try {
					changedFunctions = await findChangedFunctions(
						repo.rootUri.fsPath,
						diffInfo,
						selectedBase.label,
						selectedCur.label,
						(current, total, filePath) => {
							progress.report({
								message: localize('diff2html-report.progress.analyzingFunctionsProgress', filePath, String(current), String(total)),
								increment: current === 0 ? 0 : ((1 / total) * 100)
							});
						}
					);
				} catch (error) {
					vscode.window.showErrorMessage(localize('diff2html-report.commandErrorText', String(error)));
					return;
				}

				const labels = await getl18nWithPrefix(context.extensionUri, [WEBVIEW_PREFIX, CHANGE_ITEM_PREFIX]);

				const configs = {
					viewType: extensionConfig.get<string>('defaultViewType'),
				};
				return { diffInfo, changedFunctions, labels, configs };
			});

			if (!webViewContext) {
				return;
			}

			showVuePage(context, 'change-items-page.html', localize('diff2html-report.webview.changeitems.panelTitle'),
				webViewContext, '__DIFF_REVIEW_DATA__',
				async (message) => {
					if (message.type !== 'exportReport') {
						return;
					}
					if (typeof message.html !== 'string') {
						vscode.window.showErrorMessage(localize('diff2html-report.commandErrorText', 'Invalid report content.'));
						return;
					}

					try {
						const uri = await vscode.window.showSaveDialog({
							defaultUri: vscode.Uri.joinPath(
								vscode.workspace.workspaceFolders?.[0].uri || vscode.Uri.file('/'),
								`diff-report-${new Date().toLocaleDateString().replace(/\//g, '-')}.html`
							),
							filters: { 'HTML file': ['html', 'htm'] }
						});
						if (!uri) {
							return;
						}

						await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(message.html));
						appendLog(`Function change report exported to '${uri.fsPath}'.`);
						const action = await vscode.window.showInformationMessage(
							localize('diff2html-report.export.information', uri.fsPath),
							localize('diff2html-report.export.openFile'),
							localize('diff2html-report.export.openFolder')
						);
						if (action === localize('diff2html-report.export.openFile')) {
							const open = (await import('open')).default;
							await open(uri.fsPath);
						} else if (action === localize('diff2html-report.export.openFolder')) {
							await vscode.commands.executeCommand('revealFileInOS', uri);
						}
					} catch (error) {
						appendLog(`Failed to export function change report: ${String(error)}`);
						vscode.window.showErrorMessage(localize('diff2html-report.commandErrorText', String(error)));
					}
				});

			appendLog(`Command 'diff2html-report.generateChangeItemReport' executed`);
		})
	);
}

async function selectTwoCommits(repoPath: string): Promise<{ base: vscode.QuickPickItem, current: vscode.QuickPickItem, options: string[] } | undefined> {
	// 显示进度窗口并获取引用
	const commits = await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		cancellable: false
	}, async (progress) => {
		progress.report({ message: localize('diff2html-report.progress.loadingRefs') });
		const refs = await getGitRefs(repoPath);

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

		// 获取分支和标签
		const localBranches = await Promise.all(refs
			.filter(ref => ref.type === 0) // 本地分支
			.map(ref => getSelection(ref, localize('diff2html-report.commitOption.description.local'))));

		const remoteBranches = await Promise.all(refs
			.filter(ref => ref.type === 1) // 远程分支
			.map(ref => getSelection(ref, localize('diff2html-report.commitOption.description.remote'))));

		const tags = await Promise.all(refs
			.filter(ref => ref.type === 2) // Tag
			.map(ref => getSelection(ref, localize('diff2html-report.commitOption.description.tag'))));
		return [head, input, ...localBranches, ...remoteBranches, ...tags];
	});

	// 选择基线版本
	let base = await selectCommit(commits, localize('diff2html-report.commitOption.placeHolder.base'));

	if (!base) {
		return;
	}

	// 选择当前版本时，插入暂存区选项
	commits.splice(1, 0, {
		label: '--staged',
		description: localize('diff2html-report.commitOption.description.staged'),
		detail: localize('diff2html-report.commitOption.detail.staged')
	});

	let current = await selectCommit(commits, localize('diff2html-report.commitOption.placeHolder.current'));

	if (!current) {
		return;
	}

	// 选择git diff参数
	const extensionConfig = vscode.workspace.getConfiguration('diff2html-report');
	const options = await selectDiffOptions(extensionConfig);

	return { base, current, options };
}

async function showVuePage(
	context: vscode.ExtensionContext,
	pageFileName: string,
	title: string,
	webViewContext: any,
	webViewContextName: string,
	onDidReceiveMessage?: (message: any) => void) {
	const webviewRoot = vscode.Uri.joinPath(context.extensionUri, 'webview', 'vue-dist');

	const panel = vscode.window.createWebviewPanel(
		'diff2html-report-VuePreview',
		title,
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			localResourceRoots: [webviewRoot],
		},
	);

	const nonce = randomBytes(16).toString('base64');
	const templateUri = vscode.Uri.joinPath(webviewRoot, pageFileName);
	const templateBytes = await vscode.workspace.fs.readFile(templateUri);
	let html = new TextDecoder().decode(templateBytes);
	const initialData = JSON.stringify(webViewContext).replace(/</g, '\\u003c');
	html = html
		.replace(/(src|href)="\.\/([^"]+)"/g, (_match, attribute: string, assetPath: string) => {
			const assetUri = vscode.Uri.joinPath(webviewRoot, ...assetPath.split('/'));
			return `${attribute}="${panel.webview.asWebviewUri(assetUri)}"`;
		})
		.replace('<script type="module"', `<script nonce="${nonce}" type="module"`)
		.replace(
			'</head>',
			`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${panel.webview.cspSource}; font-src ${panel.webview.cspSource}; connect-src ${panel.webview.cspSource};"><script nonce="${nonce}">window.${webViewContextName} = ${initialData};</script></head>`,
		);
	panel.webview.html = html;
	if (onDidReceiveMessage) {
		panel.webview.onDidReceiveMessage(onDidReceiveMessage);
	}
}