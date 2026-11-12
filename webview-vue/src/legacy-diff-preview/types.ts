import { SharedLabels } from "../shared";

interface LegacyDiffPreviewLabels extends SharedLabels {
}

export interface LegacyDiffPreviewData {
	htmlContent: string;
	totalAdded: number,
	totalDeleted: number,
	labels: LegacyDiffPreviewLabels;
}
