export interface LegacyDiffPreviewData {
	title: string;
	header: string;
	lineCountContent: string;
	htmlContent: string;
	labels: {
		exportOptionsLabel: string;
		generateFileListLabel: string;
		exportButtonLabel: string;
	};
}

declare global {
	interface Window {
		__LEGACY_DIFF_PREVIEW_DATA__?: LegacyDiffPreviewData;
	}
}
