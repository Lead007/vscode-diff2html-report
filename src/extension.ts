// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {RefInfo} from './scmTypes';
import { execFile } from 'child_process';
import * as diff2html from 'diff2html';
import { OutputFormatType } from 'diff2html/lib/types';
import * as path from 'path';
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
			if (repo) {
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

                const options = [...localBranches, ...remoteBranches, ...tags];
                // 让用户选择
                const selectedBase = await vscode.window.showQuickPick(options, {
                    placeHolder: '选择一个分支或标签作为基线'
                });

				if (!selectedBase) {
					return;
				}

				const selectedCur = await vscode.window.showQuickPick(options, {
                    placeHolder: '选择一个分支或标签作为当前版本'
                });

				if (!selectedCur) {
					return;
				}

				execFile('git', ['diff', selectedBase.label, selectedCur.label], { cwd: repo.rootUri.fsPath, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
					if (error) {
						vscode.window.showErrorMessage(`执行 git diff 失败: ${error.message}`);
						return;
					}
					if (stderr && !stderr.includes('warning:')) {
						vscode.window.showErrorMessage(`执行 git diff 失败: ${stderr}`);
						return;
					}

					// 使用Diff2Html渲染
					const configuration = {
						drawFileList: true,
						matching: 'lines',
						outputFormat: OutputFormatType.SIDE_BY_SIDE,
					} as diff2html.Diff2HtmlConfig;
					const htmlContent = diff2html.html(stdout, configuration);

					const panel = vscode.window.createWebviewPanel(
						'diff2htmlPreview',
						'Git Diff Preview',
						vscode.ViewColumn.Beside,
						{
							enableScripts: true,
							localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview')]
						}
					);


					const cssPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'diff2html.min.css');
					const scriptPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'diff2html-ui.min.js');
					const cssUri = panel.webview.asWebviewUri(cssPath);
					const scriptUri = panel.webview.asWebviewUri(scriptPath);

					panel.webview.html = getWebviewContent(htmlContent, cssUri, scriptUri);

				});
            }
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

function getWebviewContent(htmlContent: string, cssUri: vscode.Uri, scriptUri: vscode.Uri): string {
	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<link rel="stylesheet" href="${cssUri}">
			<title>Git Diff Preview</title>
		</head>
		<body>
			<h2>Git Diff 报告 - ${new Date().toLocaleDateString()}</h2>
			<div id="diffOutput">
				${htmlContent}
			</div>

			<script src="${scriptUri}"></script>

		</body>
		</html>
		`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
