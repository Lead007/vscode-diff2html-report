<script setup lang="ts">
import { computed } from 'vue';
import { getFileIcon } from 'diff2html/lib/render-utils';
import { LineType } from 'diff2html/lib/types';
import type { DiffBlock } from 'diff2html/lib/types';
import type { ChangedFileFunctions, ChangedFunction } from '../../../src/functionSymbols';
import { alignDiffLines } from '../../../src/diffUtils';
import DiffLineByLine from './DiffLineByLine.vue';
import { formatLabel, getRangeStartLine } from './types';
import type { ChangeEntry, DiffReviewLabels } from './types';
import DiffSideBySide from './DiffSideBySide.vue';

const props = defineProps<{
    item: ChangedFileFunctions;
    entry?: ChangeEntry;
    labels: DiffReviewLabels;
    displayOnly?: boolean;
    viewType: 'line-by-line' | 'side-by-side';
}>();
const emit = defineEmits<{
    'update:selectedFunctionIds': [ids: string[], selected: boolean];
    'update:selectedPath': [selected: boolean];
}>();
const tag = computed(() => getFileIcon(props.item.diffInfo));
const functions = computed(() => props.item.functions ?? []);
const nonFunctionDiffBlocks = computed(() => props.item.nonFunctionDiffBlocks ?? []);

type DisplayItem =
    | { type: 'function'; key: string; line: number; fn: ChangedFunction; functionIndex: number }
    | { type: 'file'; key: string; line: number; block: DiffBlock };

function getFunctionId(fn: ChangedFunction, functionIndex: number): string {
    return JSON.stringify([
        props.item.path,
        fn.kind,
        fn.name,
        getRangeStartLine(fn.newRange) ?? getRangeStartLine(fn.oldRange) ?? functionIndex,
    ]);
}

function getFileBlockLine(block: DiffBlock): number {
    const newLines = block.lines.flatMap(line =>
        line.type === LineType.INSERT && line.newNumber !== undefined ? [line.newNumber] : []
    );
    const oldLines = block.lines.flatMap(line =>
        line.type === LineType.DELETE && line.oldNumber !== undefined ? [line.oldNumber] : []
    );
    return newLines.length > 0
        ? Math.min(...newLines)
        : oldLines.length > 0
            ? Math.min(...oldLines)
            : Math.min(block.oldStartLine, block.newStartLine);
}

const displayItems = computed<DisplayItem[]>(() => [
    ...nonFunctionDiffBlocks.value.map((block, index) => ({
        type: 'file' as const,
        key: `file:${index}:${getFileBlockLine(block)}`,
        line: getFileBlockLine(block),
        block,
    })),
    ...functions.value.map((fn, index) => ({
        type: 'function' as const,
        key: `function:${getFunctionId(fn, index)}`,
        line: (getRangeStartLine(fn.newRange) ?? getRangeStartLine(fn.oldRange) ?? 0) + 1,
        fn,
        functionIndex: index,
    })),
].sort((left, right) => left.line - right.line));

const allFunctionsSelected = computed(() =>
    functions.value.length > 0 &&
    functions.value.every((fn, index) => props.entry?.functions?.has(getFunctionId(fn, index))),
);
const someFunctionsSelected = computed(() =>
    functions.value.some((fn, index) => props.entry?.functions?.has(getFunctionId(fn, index))),
);

function toggleFileSelection(selected: boolean): void {
    if (functions.value.length === 0) {
        emit('update:selectedPath', selected);
        return;
    }
    const fileFunctionIds = functions.value.map((fn, index) => getFunctionId(fn, index));
    emit('update:selectedFunctionIds', fileFunctionIds, selected);
}

function toggleFunctionSelection(fn: ChangedFunction, functionIndex: number, selected: boolean): void {
    const id = getFunctionId(fn, functionIndex);
    emit('update:selectedFunctionIds', [id], selected);
}

</script>
<template>
    <el-card :class="props.displayOnly ? 'mb-4' : 'mb-12'" :body-style="{ padding: '0' }" shadow="never">
        <template #header>
            <div class="flex items-center text-sm font-semibold review-text-primary">
                <span class="flex min-w-0 flex-1 items-center">
                    <svg aria-hidden="true" class="mr-2 h-4 w-3 shrink-0 fill-current" height="16" version="1.1"
                        viewBox="0 0 12 16" width="12">
                        <path
                            d="M6 5H2v-1h4v1zM2 8h7v-1H2v1z m0 2h7v-1H2v1z m0 2h7v-1H2v1z m10-7.5v9.5c0 0.55-0.45 1-1 1H1c-0.55 0-1-0.45-1-1V2c0-0.55 0.45-1 1-1h7.5l3.5 3.5z m-1 0.5L8 2H1v12h10V5z">
                        </path>
                    </svg>
                    <span class="min-w-0 truncate" :title="props.item.path">{{ props.item.path }}</span>
                    <span v-if="tag === 'file-added'" class="d2h-tag d2h-added d2h-added-tag shrink-0 whitespace-nowrap">{{ props.labels.fileAdded }}</span>
                    <span v-else-if="tag === 'file-changed'" class="d2h-tag d2h-changed d2h-changed-tag shrink-0 whitespace-nowrap">{{ props.labels.fileChanged }}</span>
                    <span v-else-if="tag === 'file-deleted'" class="d2h-tag d2h-deleted d2h-deleted-tag shrink-0 whitespace-nowrap">{{ props.labels.fileDeleted }}</span>
                    <span v-else class="d2h-tag d2h-moved d2h-moved-tag shrink-0 whitespace-nowrap">{{ props.labels.fileRenamed }}</span>
                </span>
                <span class="ml-auto shrink-0 review-text-added font-medium">+{{ props.item.diffInfo.addedLines }}</span>
                <span class="ml-3 shrink-0 review-text-deleted font-medium">-{{ props.item.diffInfo.deletedLines }}</span>
                <el-checkbox v-if="!props.displayOnly && functions.length > 0" class="ml-3 shrink-0" :model-value="allFunctionsSelected"
                    :indeterminate="someFunctionsSelected && !allFunctionsSelected"
                    :aria-label="formatLabel(props.labels.selectAllFunctionsInFile, props.item.path)" @change="toggleFileSelection($event === true)" />
               <el-checkbox v-else-if="!props.displayOnly" class="ml-3 shrink-0" :model-value="props.entry?.filePath == props.item.path"
                    :aria-label="formatLabel(props.labels.selectFile, props.item.path)" @change="toggleFileSelection($event === true)" />
            </div>
        </template>
        <div class="d2h-file-diff">
            <div class="d2h-code-wrapper">
                <!--文件过大-->
               <div v-if="props.item.diffInfo.isTooBig"
                    class="flex items-center gap-2 border-b review-border review-surface-subtle px-4 py-2 text-xs font-semibold uppercase tracking-wide review-text-muted">
                    <span
                        class="flex h-5 w-5 shrink-0 items-center justify-center rounded review-surface-raised font-mono text-xs font-bold review-text-muted"
                        aria-hidden="true">#</span>
                    <span>{{ props.labels.fileTooBig }}</span>
                </div>
                <!--二进制文件-->
                <div v-if="props.item.diffInfo.isBinary" class="review-file-status review-file-status--info" role="status">
                    <span class="review-file-status__icon" aria-hidden="true">B</span>
                    <span>{{ props.labels.fileIsBinary }}</span>
                </div>
                <!--无差异-->
                <div v-if="props.item.diffInfo.blocks.length === 0" class="review-file-status review-file-status--neutral" role="status">
                    <span class="review-file-status__icon" aria-hidden="true">—</span>
                    <span>{{ props.labels.fileWithoutChanges }}</span>
                </div>
                <!--有差异但无法解析出函数，则直接渲染差异内容-->
                <div v-else-if="functions.length === 0 && nonFunctionDiffBlocks.length === 0">
                    <div v-if="props.item.error && !props.displayOnly" class="review-file-status review-file-status--error" role="status">
                        <span class="review-file-status__icon" aria-hidden="true">!</span>
                        <span>{{ props.item.error }}</span>
                    </div>
                    <DiffLineByLine v-if="props.viewType === 'line-by-line'" :item="alignDiffLines(props.item.diffInfo.blocks)" />
                    <DiffSideBySide v-else :item="alignDiffLines(props.item.diffInfo.blocks)" />
                </div>
                <!--有差异且解析出函数，则渲染函数列表-->
                <div v-else>
                    <div v-if="!props.item.symbolProviderAvailable && !props.displayOnly" class="review-file-status review-file-status--error" role="status">
                        <span class="review-file-status__icon" aria-hidden="true">!</span>
                        <span>{{ props.labels.fileSymbolError }}</span>
                    </div>
                    <template v-for="displayItem in displayItems" :key="displayItem.key">
                        <template v-if="displayItem.type === 'file'">
                            <div
                                class="flex items-center gap-2 border-b review-border review-surface-subtle px-4 py-2 text-xs font-semibold uppercase tracking-wide review-text-muted">
                                <span
                                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded review-surface-raised font-mono text-xs font-bold review-text-muted"
                                    aria-hidden="true">#</span>
                                <span>{{ props.labels.fileLevelChanges }}</span>
                            </div>
                            <DiffLineByLine v-if="props.viewType === 'line-by-line'" :item="alignDiffLines([displayItem.block])" />
                            <DiffSideBySide v-else :item="alignDiffLines([displayItem.block])" />
                        </template>
                        <template v-else>
                            <div
                                class="flex items-center gap-2 border-b review-border review-function-header px-4 py-2.5">
                                <span
                                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md review-surface-accent font-mono text-sm font-bold review-text-accent"
                                    aria-hidden="true">ƒ</span>
                                <span class="min-w-0 flex-1 truncate font-mono text-sm font-semibold review-text-primary"
                                    :title="displayItem.fn.name">{{ displayItem.fn.name }}</span>
                                <span
                                    class="review-tag shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                    {{ displayItem.fn.kind === 'added' ? props.labels.added : displayItem.fn.kind === 'deleted' ? props.labels.deleted : props.labels.modified }}
                                </span>
                                <el-checkbox v-if="!props.displayOnly" class="ml-2 shrink-0"
                                    :model-value="props.entry?.functions?.has(getFunctionId(displayItem.fn, displayItem.functionIndex))"
                                    :aria-label="formatLabel(props.labels.selectFunction, displayItem.fn.name)"
                                    @change="toggleFunctionSelection(displayItem.fn, displayItem.functionIndex, $event === true)" />
                            </div>
                            <DiffLineByLine v-if="props.viewType === 'line-by-line'" :item="alignDiffLines(displayItem.fn.diffBlocks ?? [])" />
                            <DiffSideBySide v-else :item="alignDiffLines(displayItem.fn.diffBlocks ?? [])" />
                        </template>
                    </template>
                </div>

            </div>
        </div>
    </el-card>
</template>