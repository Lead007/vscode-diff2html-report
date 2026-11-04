import * as vscode from 'vscode';

export const logger = vscode.window.createOutputChannel('diff2html-report');

export function appendLog(message: string) {
    const timestamp = new Date().toLocaleString();
    logger.appendLine(`[${timestamp}] ${message}`);
}