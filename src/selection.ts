import { execFile, ExecFileOptionsWithStringEncoding, ExecFileOptionsWithBufferEncoding } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { localize } from 'vscode-nls-i18n';


export interface RefInfo{
    commit: string;
    name: string;
    type: number;
    subject?: string;
}

/**
 * 获取 Git 引用信息
 * @param path 工作目录
 * @returns 引用信息数组
 */
export async function getGitRefs(path: string): Promise<RefInfo[]> {
	try {
		const execFileAsync = promisify(execFile);
		const execOption: ExecFileOptionsWithStringEncoding = { cwd: path, encoding: 'utf8' };
		const { stdout } = await execFileAsync('git', [
			'for-each-ref',
			'--format=%(refname)%00%(objectname)%00%(*objectname)%00%(subject)%00%(*subject)%00%(symref)',
			'refs/heads',
			'refs/remotes',
			'refs/tags'
		], execOption);

		return stdout.split(/\r?\n/).filter(Boolean).flatMap(line => {
			const [fullName, objectName, peeledObjectName, subject, peeledSubject, symbolicRef] = line.split('\0');
			if (symbolicRef) {
				return [];
			}

			let name: string;
			let type: number;
			if (fullName.startsWith('refs/heads/')) {
				name = fullName.slice('refs/heads/'.length);
				type = 0;
			} else if (fullName.startsWith('refs/remotes/')) {
				name = fullName.slice('refs/remotes/'.length);
				type = 1;
			} else if (fullName.startsWith('refs/tags/')) {
				name = fullName.slice('refs/tags/'.length);
				type = 2;
			} else {
				return [];
			}

			return [{
				name,
				type,
				commit: peeledObjectName || objectName,
				subject: peeledSubject || subject
			}];
		});
	} catch (error) {
		const message = String(error);
		vscode.window.showErrorMessage(localize('diff2html-report.commandErrorText', message));
		throw error;
	}
}

/**
 * 生成某个ref对应的选择项
 * @param ref git ref信息
 * @param description 描述
 * @returns 生成的vscode下拉选择项
 */
export function getSelection(ref: RefInfo, description: string): vscode.QuickPickItem {
    const detail = ref.commit
        ? `${ref.subject || ''}${ref.subject ? ' ' : ''}(${ref.commit.slice(0, 8)})`
        : '';
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
    // 读取git diff默认配置
    const defaultDiffOptions = extensionConfig.get<Record<string, boolean>>('defaultDiffOptions') || {};
    // 选择git diff参数
    const options = [
        { label: '-b', description: localize('diff2html-report.commandOption.b'), picked: defaultDiffOptions['-b'] },
        { label: '-w', description: localize('diff2html-report.commandOption.w'), picked: defaultDiffOptions['-w'] },
        { label: '-M', description: localize('diff2html-report.commandOption.M'), picked: defaultDiffOptions['-M'] },
        { label: '-C', description: localize('diff2html-report.commandOption.C'), picked: defaultDiffOptions['-C'] },
        { label: '--submodule', description: localize('diff2html-report.commandOption.--submodule'), picked: defaultDiffOptions['--submodule'] },
    ];

    const enabledOptions = await vscode.window.showQuickPick(options, {
        canPickMany: true,
        placeHolder: localize('diff2html-report.commandOption.placeHolder'),
        ignoreFocusOut: true,
    });

    const enableOptionsStr = enabledOptions?.map(p => p.label) || [];
    const filter = extensionConfig.get<string[]>('filter');
    if (filter && filter.length > 0) {
        enableOptionsStr.push(...filter);
    }

    return enableOptionsStr;
}


/**
 * 指定编码运行 git diff 命令并返回输出
 * @param path 运行目录
 * @param encoding 编码
 * @param paras git diff后的参数列表
 * @returns stdout，若有错误返回空字符串
 */
export async function runGitDiffCommand(path: string, encoding: string, maxBuffer: number, paras: string[]): Promise<string> {
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