import * as mustache from 'mustache';
import * as vscode from 'vscode';

export interface WebviewContentData {
    htmlPath: vscode.Uri;
    cssUris: vscode.Uri[];
    scriptUris: vscode.Uri[];

    title: string;
    header: string;
}

export async function getWebviewContent(webView: vscode.Webview, contentData: WebviewContentData, contentStrings: any): Promise<string> {
    const tplBytes = await vscode.workspace.fs.readFile(contentData.htmlPath);
    const tpl = new TextDecoder().decode(tplBytes);

    contentStrings.styleSheetUris = contentData.cssUris.map(uri => webView.asWebviewUri(uri)).map(uri => `\t<link rel="stylesheet" href="${uri}">`).join('\n');
    contentStrings.scriptUris = contentData.scriptUris.map(uri => webView.asWebviewUri(uri)).map(uri => `\t<script src="${uri}"></script>`).join('\n');
    contentStrings.title = contentData.title;
    contentStrings.header = contentData.header;

    const result = mustache.render(tpl, contentStrings);

    return result;
}

export async function getExportContent(htmlPath: vscode.Uri, htmlContent: string, cssContent: string): Promise<string> {
    const tplBytes = await vscode.workspace.fs.readFile(htmlPath);
    const tpl = new TextDecoder().decode(tplBytes);

    const contentStrings = {
        cssContent,
        htmlContent
    };

    const result = mustache.render(tpl, contentStrings);

    return result;
}
