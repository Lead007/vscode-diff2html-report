import * as vscode from 'vscode';
import { RefInfo } from './scmTypes';
import { localize } from 'vscode-nls-i18n';

/**
 * 生成某个ref对应的选择项
 * @param ref git ref信息
 * @param description 描述
 * @param repo 仓库对象
 * @returns 生成的vscode下拉选择项
 */
export async function getSelection(ref: RefInfo, description: string, repo: any): Promise<vscode.QuickPickItem> {
    var detail: string = '';
    if (ref.commit) {
        const commit = await repo.getCommit(ref.commit);
        detail = `${commit.message} (${ref.commit.slice(0, 8)})`;
    }
    return {
        label: ref.name,
        description,
        detail
    };
};

/**
 * 弹出列表让用户选择一个提交
 * @param commits 选项列表
 * @param placeHolder 提示信息
 * @returns 用户选择的提交
 */
export async function selectCommit(commits: vscode.QuickPickItem[], placeHolder: string): Promise<vscode.QuickPickItem | undefined> {
    let selected = await vscode.window.showQuickPick(commits, {
        placeHolder: placeHolder,
        ignoreFocusOut: true,
    });

    if (!selected) {
        return;
    }

    if ((selected as any).isCustom) {
        const userInput = await vscode.window.showInputBox({
            placeHolder: localize('diff2html-report.commitOption.label.inputPrompt'),
            prompt: localize('diff2html-report.commitOption.label.inputPrompt')
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

/**
 * 弹出列表让用户选择git diff参数
 * @param extensionConfig 插件设置
 * @returns 用户选择的git diff参数数组
 */
export async function selectDiffOptions(extensionConfig: vscode.WorkspaceConfiguration): Promise<string[]> {
    // 选择git diff参数
    const options = [
        { label: '-b', description: localize('diff2html-report.commandOption.b'), picked: false },
        { label: '-w', description: localize('diff2html-report.commandOption.w'), picked: false },
        { label: '-M', description: localize('diff2html-report.commandOption.M'), picked: false },
        { label: '-C', description: localize('diff2html-report.commandOption.C'), picked: false },
        { label: '--submodule', description: localize('diff2html-report.commandOption.--submodule'), picked: false },
    ];

    const enabledOptions = await vscode.window.showQuickPick(options, {
        canPickMany: true,
        placeHolder: localize('diff2html-report.commandOption.placeHolder'),
        ignoreFocusOut: true,
    });

    const enableOptionsStr = enabledOptions?.map(p => p.label) || [];
    const filter = extensionConfig.get<string>('filter');
    if (filter && filter.trim().length > 0) {
        enableOptionsStr.push(filter);
    }

    return enableOptionsStr;
}