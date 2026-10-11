import * as vscode from 'vscode';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { localize } from 'vscode-nls-i18n';

/**
 * 按照指定编码输出运行命令
 * @param rootPath 运行目录
 * @param cmd 命令
 * @param args 命令参数
 * @param encoding 编码（可选，默认使用插件配置中的编码）
 * @returns
 */
export async function execCmdAsync(
    rootPath: string,
    cmd: string,
    args: string[],
    encoding: string = ""): Promise<{
        stdout: string;
        stderr: string;
    }> {
    // 获取编码和文件大小限制配置
    const extensionConfig = vscode.workspace.getConfiguration('diff2html-report');
    if (encoding === "") {
        encoding = extensionConfig.get<string>('encoding') || 'utf8';
    }
    const maxBuffer = extensionConfig.get<number>('maxGitDiffFileSize') || 67108864;

    const execFileAsync = promisify(execFile);
    const { stdout, stderr } = await execFileAsync(cmd, args, {
        cwd: rootPath,
        encoding: 'buffer',
        maxBuffer
    });
    // 按照编码解码
    const decoder = new TextDecoder(encoding);
    return { stdout: decoder.decode(stdout), stderr: decoder.decode(stderr) };

}


/**
 * 指定编码运行 git diff 命令并返回输出
 * @param path 运行目录
 * @param encoding 编码
 * @param paras git diff后的参数列表
 * @returns stdout，若有错误返回空字符串
 */
export async function runGitDiffCommand(path: string, paras: string[]): Promise<string> {
	try {
		const { stdout, stderr } = await execCmdAsync(path,
			'git',
			['diff', ...paras],
		);

		if (stderr.length && stderr.includes('warning:')) {
			const errString = stderr;
			if (!errString.includes('warning:')) {
				vscode.window.showErrorMessage(localize('diff2html-report.commandErrorText', errString));
				return '';
			}
		}
		if (stdout.length === 0) {
			vscode.window.showInformationMessage(localize('diff2html-report.commandNoDiffText'));
			return '';
		}
		return stdout;
	} catch (error) {
		vscode.window.showErrorMessage(localize('diff2html-report.commandErrorText', String(error)));
		return '';
	}
}