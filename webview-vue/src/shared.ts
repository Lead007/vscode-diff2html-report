import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'diff2html/bundles/css/diff2html.min.css';
import 'virtual:uno.css';
import './review-theme.css';
import { LegacyDiffPreviewData } from './legacy-diff-preview/types';
import { ExportData } from '../../src/htmlTemplate';
import { DiffReviewData } from './change-items-page/types';

export interface SharedLabels {
    [key: string]: string;

    themeMode: string;
    lightMode: string;
    darkMode: string;
    exportReport: string;
	reportExportUnavailable: string;
	lineCountContent: string;
}

export function formatLabel(template: string, ...values: string[]): string {
    return template.replace(/\{(\d+)\}/g, (_match, index: string) => values[Number(index)] ?? '');
}

export function getExportStyles(): string {
    return Array.from(document.styleSheets)
        .flatMap(stylesheet => Array.from(stylesheet.cssRules))
        .filter(rule => !rule.cssText.startsWith('@layer vscode-default'))
        .map(rule => rule.cssText)
        .join('\n');
}

declare global {
    interface Window {
        __DIFF_REVIEW_DATA__?: DiffReviewData;
        __LEGACY_DIFF_PREVIEW_DATA__?: LegacyDiffPreviewData;
        acquireVsCodeApi?: () => {
            postMessage(
                message: ExportData
            ): void;
        };
    }
}