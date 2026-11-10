import type { DiffFile } from 'diff2html/lib/types';
import type { ChangedFileFunctions, ChangedFunction } from '../../../src/functionSymbols';
import type { SharedLabels } from '../shared';
import { ExportContent, ExportData } from '../../../src/htmlTemplate';

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

export function getDiffFileId(filePath: string): string {
	return `diff-file-${encodeURIComponent(filePath)}`;
}

export function getChangedFunctionId(filePath: string, fn: ChangedFunction, fallbackIndex: number): string {
	return JSON.stringify([
		filePath,
		fn.kind,
		fn.name,
		fn.detail,
		fn.symbolKind,
		getRangeStartLine(fn.newRange) ?? getRangeStartLine(fn.oldRange) ?? fallbackIndex,
	]);
}

export interface DiffReviewData {
	diffInfo: DiffFile[];
	changedFunctions: ChangedFileFunctions[];
	labels: DiffReviewLabels;
	configs: DiffReviewConfigs;
	totalAdded: number,
	totalDeleted: number,
}

export interface DiffReviewLabels extends SharedLabels {
	title: string;
	appTitle: string;
	panelTitle: string;
	subtitle: string;
	clearChanges: string;
	previewHtml: string;
	reportPreviewTitle: string;
	reportPreviewDescription: string;
	backToReview: string;
	reportTitle: string;
	reportDiffUnavailable: string;
	pageTitle: string;
	pageDescription: string;
	filesChanged: string;
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
	added: string;
	deleted: string;
	changed: string;
	renamed: string;
	selectAllFunctionsInFile: string;
	selectFile: string;
	selectFunction: string;
	fileTooBig: string;
	fileIsBinary: string;
	fileWithoutChanges: string;
	fileSymbolError: string;
	fileLevelChanges: string;
}

export interface DiffReviewConfigs {
	viewType: 'line-by-line' | 'side-by-side';
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
