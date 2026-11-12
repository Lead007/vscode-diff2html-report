<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Back, Download, View } from '@element-plus/icons-vue';
import type { ChangedFileFunctions } from '../../../src/functionSymbols';
import DiffFile from './DiffFile.vue';
import type { ChangeItem, DiffReviewLabels } from './types';
import { formatLabel } from '../shared';
import DiffFileList from './DiffFileList.vue';

const props = defineProps<{
	items: ChangeItem[];
	files: ChangedFileFunctions[];
	labels: DiffReviewLabels;
	totalAdded: number,
	totalDeleted: number,
	initialDarkMode: boolean;
    viewType: 'line-by-line' | 'side-by-side';
}>();

const emit = defineEmits<{
	back: [];
	export: [darkMode: boolean];
}>();

const darkMode = ref(props.initialDarkMode);

const reportItems = computed(() => props.items.map(item => ({
	...item,
	entries: item.entries.map(entry => {
		const file = props.files.find(candidate => candidate.path === entry.filePath);
		if (!file) {
			return { filePath: entry.filePath, file: undefined };
		}

		const selectedFunctions = entry.functions ? [...entry.functions.values()] : undefined;
		return {
			filePath: entry.filePath,
			file: {
				...file,
				functions: selectedFunctions ?? file.functions,
				nonFunctionDiffBlocks: selectedFunctions?.length
					? []
					: file.nonFunctionDiffBlocks,
			},
		};
	}),
})));

function getChangeItemAnchorId(changeItemId: number): string {
	return `change-item-${changeItemId}`;
}

function syncTheme(): void {
	document.documentElement.classList.toggle('dark', darkMode.value);
}

watch(darkMode, syncTheme);
onMounted(syncTheme);
onBeforeUnmount(() => {
	document.documentElement.classList.toggle(
		'dark',
		document.body.classList.contains('vscode-dark'),
	);
});
</script>

<template>
	<div class="min-h-screen review-surface review-text-primary" :class="{ 'report-theme': true, dark: darkMode }">
		<header class="flex flex-wrap items-center justify-between px-4 py-3">
			<div class="flex min-w-0 items-center gap-3">
				<div class="review-app-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
					<el-icon class="text-xl">
						<View />
					</el-icon>
				</div>
				<div class="flex min-w-0 flex-col">
					<strong class="text-base font-semibold">{{ props.labels.reportPreviewTitle }}</strong>
					<div class="truncate text-sm review-text-muted">{{ props.labels.reportPreviewDescription }}</div>
				</div>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<div class="flex items-center gap-2 text-xs">
					<span class="review-text-muted">{{ darkMode ? props.labels.darkMode : props.labels.lightMode }}</span>
					<el-switch v-model="darkMode" :aria-label="props.labels.themeMode" />
				</div>
				<el-button class="!rounded-md" type="primary" :icon="Download"
					@click="emit('export', darkMode)">{{ props.labels.exportReport }}</el-button>
				<el-button class="!rounded-md" type="info" :icon="Back"
					@click="emit('back')">{{ props.labels.backToReview }}</el-button>
			</div>
		</header>

		<main id="report-content"
			class="report-theme mx-auto min-h-screen max-w-8xl p-4 review-surface review-text-primary md:p-8"
			:class="{ dark: darkMode }">
			<div class="mb-5">
				<h1 class="mb-2 text-2xl font-bold">{{ props.labels.reportTitle }}</h1>
				<p class="text-sm review-text-muted">
					{{ formatLabel(props.labels.lineCountContent, String(props.totalAdded),
						String(props.totalDeleted)) }}
				</p>
			</div>

			<el-card class="mb-6">
				<template #header>
					<div class="d2h-file-list-header">
						<span class="d2h-file-list-title review-text-primary text-base">
							{{ props.labels.changeItems }}
						</span>
					</div>
				</template>
				<div class="d2h-file-list-wrapper d2h-light-color-scheme">
					<ol class="d2h-file-list">
						<li v-for="(item, index) in reportItems" :key="item.id" class="d2h-file-list-line flex-col items-stretch">
							<div class="flex min-w-0 items-start gap-3 py-1">
								<span
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current review-surface-accent font-mono text-sm font-bold review-text-accent"
									aria-hidden="true">{{ index + 1 }}</span>

								<a :href="`#${getChangeItemAnchorId(item.id)}`"
									class="d2h-file-name cursor-pointer text-lg font-semibold review-text-primary hover:underline">
									{{ item.title }}
								</a>
							</div>
							<p v-if="item.description.trim().length"
								class="ml-10 mt-1 text-sm leading-normal review-text-muted [overflow-wrap:anywhere] whitespace-pre-wrap">
								{{ item.description }}
							</p>
						</li>
					</ol>
				</div>
			</el-card>

			<DiffFileList :diff-files="props.files.map(f => f.diffInfo)" :labels="props.labels" />

			<div class="mb-5">
				<h1 class="mb-2 text-2xl font-bold">{{ props.labels.changeDescription }}</h1>
			</div>
			<el-card v-for="(item, itemIndex) in reportItems" :key="item.id"
				:id="getChangeItemAnchorId(item.id)" class="mb-4 scroll-mt-4" shadow="never">
				<template #header>
					<div class="flex min-h-[34px] items-center justify-between gap-3">
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current review-surface-accent font-mono text-sm font-bold review-text-accent"
							aria-hidden="true">{{ itemIndex + 1 }}</span>
						<strong class="min-w-0 flex-1 text-base [overflow-wrap:anywhere]">{{ item.title }}</strong>
						<el-tag round>{{ formatLabel(props.labels.changeItemCount, String(item.entries.length)) }}</el-tag>
					</div>
				</template>
				<p v-if="item.description.trim().length !== 0"
					class="mb-4 text-sm leading-normal whitespace-pre-wrap [overflow-wrap:anywhere]">{{ item.description }}</p>

				<template v-for="entry in item.entries" :key="entry.filePath">
					<DiffFile v-if="entry.file" :item="entry.file" :labels="props.labels" :view-type="props.viewType" display-only />
					<el-card v-else class="mb-4" shadow="never">
						<template #header>
							<strong class="text-sm [overflow-wrap:anywhere]">{{ entry.filePath }}</strong>
						</template>
						<div class="text-xs review-text-muted">{{ props.labels.reportDiffUnavailable }}</div>
					</el-card>
				</template>
			</el-card>
		</main>
	</div>
</template>
