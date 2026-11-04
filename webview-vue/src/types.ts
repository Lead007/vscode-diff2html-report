import type { DiffFile } from 'diff2html/lib/types';
import type { ChangedFileFunctions, ChangedFunction } from '../../src/functionSymbols';

function getLineNumber(value: unknown): number | undefined {
	if (Array.isArray(value) && typeof value[0] === 'number') {
		return value[0];
	}
	if (typeof value === 'object' && value !== null && 'line' in value) {
		const line = value.line;
		return typeof line === 'number' ? line : undefined;
	}
	return undefined;
}

export function getRangeStartLine(range: unknown): number | undefined {
	if (Array.isArray(range)) {
		return getLineNumber(range[0]);
	}
	if (typeof range === 'object' && range !== null && 'start' in range) {
		return getLineNumber(range.start);
	}
	return undefined;
}

export interface DiffReviewData {
	diffInfo: DiffFile[];
	changedFunctions: ChangedFileFunctions[];
	labels: DiffReviewLabels;
}

export interface DiffReviewLabels {
	[key: string]: string;
	title: string;
	appTitle: string;
	panelTitle: string;
	subtitle: string;
	clearChanges: string;
	previewHtml: string;
	reportPreviewTitle: string;
	reportPreviewDescription: string;
	backToReview: string;
	exportReport: string;
	reportTitle: string;
	reportGeneratedAt: string;
	reportDiffUnavailable: string;
	reportExportUnavailable: string;
	themeMode: string;
	lightMode: string;
	darkMode: string;
	pageTitle: string;
	pageDescription: string;
	filesChanged: string;
	hide: string;
	show: string;
	fileFunctions: string;
	selectFunctionsHint: string;
	updateSelectionHint: string;
	selectedCount: string;
	changeItemCount: string;
	changeItems: string;
	changeItemsDescription: string;
	addChangeItem: string;
	changeTitle: string;
	changeDescription: string;
	titlePlaceholder: string;
	descriptionPlaceholder: string;
	relatedFilesAndFunctions: string;
	selectFunctionHint: string;
	addedChangeItems: string;
	emptyChangeItems: string;
	editChangeItem: string;
	finishEditing: string;
	deleteChangeItem: string;
	removeFile: string;
	deleteChangeItemConfirmation: string;
	confirm: string;
	cancel: string;
	saveAndSwitch: string;
	discardAndSwitch: string;
	switchEditingItemConfirmation: string;
	clearConfirmationTitle: string;
	clearChangeItemsConfirmation: string;
	fillTitleAndDescription: string;
	selectRelatedEntry: string;
	associateEntry: string;
	changeItemAdded: string;
	noChangeItemsToClear: string;
	fileAdded: string;
	fileChanged: string;
	fileDeleted: string;
	fileRenamed: string;
	selectAllFunctionsInFile: string;
	selectFile: string;
	selectFunction: string;
	fileTooBig: string;
	fileIsBinary: string;
	fileWithoutChanges: string;
	fileSymbolError: string;
	fileLevelChanges: string;
	added: string;
	deleted: string;
	modified: string;
}

export function formatLabel(template: string, ...values: string[]): string {
	return template.replace(/\{(\d+)\}/g, (_match, index: string) => values[Number(index)] ?? '');
}

export interface ChangeEntry {
	filePath: string;
	functions?: Map<string, ChangedFunction>;
}

export interface ChangeItem {
	id: number;
	title: string;
	description: string;
	entries: ChangeEntry[];
}

declare global {
	interface Window {
		__DIFF_REVIEW_DATA__?: DiffReviewData;
		acquireVsCodeApi?: () => {
			postMessage(message: { type: 'exportReport'; html: string }): void;
		};
	}
}
