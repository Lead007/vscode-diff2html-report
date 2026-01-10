// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {RefInfo} from './scmTypes';

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
					.filter((ref) => ref.type === 0 && ref.name !== 'HEAD') // type 1 是本地分支
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
                    placeHolder: '选择一个分支或标签作为基线'
                });

				if (!selectedCur) {
					return;
				}
				vscode.window.showInformationMessage(`你选择了: ${selectedBase.label} 和 ${selectedCur.label}`);
				// 在这里可以执行相应的 Git 操作，例如 checkout
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

// This method is called when your extension is deactivated
export function deactivate() {}
