import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'diff2html/bundles/css/diff2html.min.css';
import 'virtual:uno.css';
import './review-theme.css';

export interface SharedLabels {
	[key: string]: string;

    themeMode: string;
    lightMode: string;
    darkMode: string;
    exportReport: string;
}

export function formatLabel(template: string, ...values: string[]): string {
    return template.replace(/\{(\d+)\}/g, (_match, index: string) => values[Number(index)] ?? '');
}