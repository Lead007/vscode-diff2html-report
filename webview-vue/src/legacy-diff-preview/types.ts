import { SharedLabels } from "../shared";

interface LegacyDiffPreviewLabels extends SharedLabels {
	lineCountContent: string;
}

export interface LegacyDiffPreviewData {
	htmlContent: string;
	totalAdded: number,
	totalDeleted: number,
	labels: LegacyDiffPreviewLabels;
}

declare global {
	interface Window {
		__LEGACY_DIFF_PREVIEW_DATA__?: LegacyDiffPreviewData;
	}
}
