// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {RefInfo} from './scmTypes';
import { execFile } from 'child_process';
import * as diff2html from 'diff2html';
import { OutputFormatType } from 'diff2html/lib/types';
import { getExportContent, getWebviewContent } from './htmlTemplate';
import { promisify } from 'util';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "diff2html-report" is now active!');

	// 获取 Git 扩展
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) {
        return;
    }

	const git = gitExtension.exports.getAPI(1);

	// 在 SCM 提供者上注册命令
	context.subscriptions.push(
        vscode.commands.registerCommand('diff2html-report.generateDiffReport', async (uri?) => {
            // 获取当前仓库
			const repo = git.repositories[0];
			if (!repo) { return; }
			const refs: RefInfo[] = await repo.getRefs();

			async function getSelection(ref: RefInfo): Promise<vscode.QuickPickItem> {
				var detail: string = '';
				if (ref.commit) {
					const commit = await repo.getCommit(ref.commit);
					detail = `${commit.message} (${ref.commit.slice(0, 8)})`;
				}
				return {
					label: ref.name,
					description: '本地分支',
					detail
				};
			};

			const head = {
				label: "HEAD",
				description: '当前提交',
				detail: '当前工作区'
			};

			const input = {
				label: "手动输入分支名/标签名/提交哈希",
				description: '手动输入',
				detail: '👉手动输入分支名/标签名/提交哈希',
				isCustom: true
			};

			// 获取分支、标签和提交
			const localBranches = await Promise.all(refs
				.filter((ref) => ref.type === 0) // type 1 是本地分支
				.map(getSelection));

			// 获取远程分支
			const remoteBranches = await Promise.all(refs
				.filter((ref) => ref.type === 1) // type 2 是远程分支
				.map(getSelection));

			const tags = await Promise.all(refs
				.filter((ref) => ref.type === 2) // type 3 是Tag
				.map(getSelection));

			const commits = [head, input, ...localBranches, ...remoteBranches, ...tags];
			// 选择基线版本
			let selectedBase = await selectCommit(commits, '选择一个分支或标签作为基线');

			if (!selectedBase) {
				return;
			}

			// 选择当前版本时，插入暂存区选项
			commits.splice(1, 0, {
				label: '--staged',
				description: '暂存区',
				detail: `已暂存的更改`
			});

			let selectedCur = await selectCommit(commits, '选择一个分支或标签作为当前版本');

			if (!selectedCur) {
				return;
			}

			const extensionConfig = vscode.workspace.getConfiguration('diff2html-report');
			// 选择git diff参数
			const options = [
				{ label: '-b', description: '忽略行尾空格', picked: false },
				{ label: '-w', description: '忽略所有空白', picked: false },
				{ label: '-M', description: '重命名检测', picked: false },
				{ label: '-C', description: '移动检测', picked: false },
				{ label: '--submodule', description: '递归子模块', picked: false },
			];

			const enabledOptions = await vscode.window.showQuickPick(options, {
				canPickMany: true,
				placeHolder: '选择git diff的参数 (可多选)',
				ignoreFocusOut: true,
			});

			const enableOptionsStr = enabledOptions?.map(p => p.label) || [];
			const filter = extensionConfig.get<string>('filter');
			if(filter && filter.trim().length > 0) {
				enableOptionsStr.push(filter);
			}

			const execFileAsync = promisify(execFile);

			let diffContent = '';
			try {
				const { stdout, stderr } = await execFileAsync('git', ['diff', selectedBase.label, selectedCur.label, ...enableOptionsStr], { cwd: repo.rootUri.fsPath, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
				if (stderr && !stderr.includes('warning:')) {
					vscode.window.showErrorMessage(`执行 git diff 失败: ${stderr}`);
					return;
				}
				diffContent = stdout;
			} catch (error) {
				vscode.window.showErrorMessage(`执行 git diff 失败: ${error}`);
				return;
			}



			// 使用Diff2Html渲染
			const configuration = {
				drawFileList: true,
				matching: 'lines',
				outputFormat: extensionConfig.get<string>('outputFormat') as OutputFormatType,
			} as diff2html.Diff2HtmlConfig;
			const htmlContent = diff2html.html(diffContent, configuration);

			const targetColumn = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Beside;
			const panel = vscode.window.createWebviewPanel(
				'diff2htmlPreview',
				'Git Diff Preview',
				targetColumn,
				{
					enableScripts: true,
					localResourceRoots: [
						vscode.Uri.joinPath(context.extensionUri, 'webview'),
					]
				}
			);

			// 准备webview css和js资源
			let cssUris: vscode.Uri[] = [];
			let scriptUris: vscode.Uri[] = [];
			if (extensionConfig.get<boolean>('useOnlineResources')) {
				// 使用在线资源
				cssUris = [
					vscode.Uri.parse('https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css'),
					vscode.Uri.parse('https://cdnjs.cloudflare.com/ajax/libs/bulma/1.0.4/css/bulma.min.css'),
				];
				scriptUris = [
					vscode.Uri.joinPath(context.extensionUri, 'webview', 'preview-page.js'),
					vscode.Uri.parse('https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html-ui.min.js'),
				];
			} else {
				// 使用本地资源
				cssUris = [
					vscode.Uri.joinPath(context.extensionUri, 'webview', 'diff2html-3.4.55.min.css'),
					vscode.Uri.joinPath(context.extensionUri, 'webview', 'bulma-1.0.4.min.css'),
				];
				scriptUris = [
					vscode.Uri.joinPath(context.extensionUri, 'webview', 'preview-page.js'),
					vscode.Uri.joinPath(context.extensionUri, 'webview', 'diff2html-ui-3.4.55.min.js')
				];
			}

			// 生成最终的webview html内容
			const resultHtml = await getWebviewContent(panel.webview, {
				htmlPath: vscode.Uri.joinPath(context.extensionUri, 'webview', 'preview-page.html'),
				cssUris,
				scriptUris,
				title: 'Git Diff Preview',
				header: `Git Diff 报告`
			}, {
				htmlContent,
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
							'HTML 文件': ['html', 'htm']
						}
					});
					if (uri) {
						let diff2htmlCss = '';
						const extensionConfig = vscode.workspace.getConfiguration('diff2html-report');
						if (!extensionConfig.get<boolean>('useOnlineResources')) {
							// 进行资源内联
							const diff2htmlCssBytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(context.extensionUri, 'webview', 'diff2html.min.css'));
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
								<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css">
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


						let finalHtml = await getExportContent(vscode.Uri.joinPath(context.extensionUri, 'webview', 'export-page.html'), html, diff2htmlCss);
						await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(finalHtml));
						vscode.window.showInformationMessage(`Diff 报告已保存到 ${uri.fsPath}`);
					}
				}
			});

        })
    );

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	// const disposable = vscode.commands.registerCommand('diff2html-report.helloWorld', () => {
	// 	// The code you place here will be executed every time your command is executed
	// 	// Display a message box to the user
	// 	vscode.window.showInformationMessage('Hello World from diff2html-report!');
	// });

	// context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

/**
 * 弹出列表让用户选择一个提交
 * @param commits 选项列表
 * @param placeHolder 提示信息
 * @returns 用户选择的提交
 */
async function selectCommit(commits: vscode.QuickPickItem[], placeHolder: string): Promise<vscode.QuickPickItem | undefined> {
	let selected = await vscode.window.showQuickPick(commits, {
		placeHolder: placeHolder,
		ignoreFocusOut: true,
	});

	if (!selected) {
		return;
	}

	if ((selected as any).isCustom) {
		const userInput = await vscode.window.showInputBox({
			placeHolder: '请输入分支名/标签名/提交哈希',
			prompt: '请输入分支名/标签名/提交哈希'
		});
		if (!userInput) {
			return;
		}
		selected = {
			label: userInput,
		};
	}
	return selected;
}