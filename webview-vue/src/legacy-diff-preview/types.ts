export interface LegacyDiffPreviewData {
	title: string;
	header: string;
	htmlContent: string;
	lineCountContent: string;
	labels: {
		themeMode: string;
		lightMode: string;
		darkMode: string;
		exportReport: string;
	};
	initialDarkMode: boolean;
}

declare global {
	interface Window {
		__LEGACY_DIFF_PREVIEW_DATA__?: LegacyDiffPreviewData;
	}
}
