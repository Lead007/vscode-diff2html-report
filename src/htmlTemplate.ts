import mustache from 'mustache';
import * as vscode from 'vscode';
import { localize } from 'vscode-nls-i18n';

export interface ExportContent {
    title: string,
    styles: string,
    htmlContent: string,
    darkMode: boolean
}

export interface ExportData {
    type: 'exportReport'
    content: ExportContent
}

/**
 *
 * @param extensionUri 插件Uri（来自activate）
 * @param defaultFileName 默认文件名
 * @param data 导出内容（不包含模板）
 * @returns 导出路径（未导出成功返回undefined）
 */
export async function exportHtml(extensionUri: vscode.Uri, defaultFileName: string, data: ExportContent) {
    // 保存文件对话框
    const fileName = `${defaultFileName}-${new Date().toLocaleDateString().replace(/\//g, '-')}.html`;
    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0].uri || vscode.Uri.file('/'), fileName),
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

            const htmlPath = vscode.Uri.joinPath(extensionUri, 'webview', 'export-page.mustache');
            const tplBytes = await vscode.workspace.fs.readFile(htmlPath);
            const tpl = new TextDecoder().decode(tplBytes);

            const finalHtml = mustache.render(tpl, data);
            await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(finalHtml));
        });

        //提示保存成功，可以打开文件或文件夹
        const action = await vscode.window.showInformationMessage(
            localize('diff2html-report.export.information', uri.fsPath),
            localize('diff2html-report.export.openFile'),
            localize('diff2html-report.export.openFolder')
        );
        if (action === localize('diff2html-report.export.openFile')) {
            const open = (await import('open')).default;
            open(uri.fsPath);
        } else if (action === localize('diff2html-report.export.openFolder')) {
            vscode.commands.executeCommand('revealFileInOS', uri);
        }

        return uri.fsPath;
    }
}