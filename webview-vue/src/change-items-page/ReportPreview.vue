<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Back, Download, View } from '@element-plus/icons-vue';
import type { ChangedFileFunctions } from '../../../src/functionSymbols';
import DiffFile from './DiffFile.vue';
import { formatLabel } from './types';
import type { ChangeItem, DiffReviewLabels } from './types';

const props = defineProps<{
	items: ChangeItem[];
	files: ChangedFileFunctions[];
	labels: DiffReviewLabels;
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
		<header class="flex flex-wrap items-center justify-between gap-4 border-b review-border review-surface-raised px-4 py-3">
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
			class="report-theme report-page mx-auto min-h-screen max-w-8xl p-4 review-surface review-text-primary md:p-8"
			:class="{ dark: darkMode }">
			<div class="mb-5">
				<h1 class="mb-2 text-2xl font-bold">{{ props.labels.reportTitle }}</h1>
				<p class="text-xs review-text-muted">
					{{ formatLabel(props.labels.reportGeneratedAt, new Date().toLocaleDateString()) }}
				</p>
			</div>

			<el-card v-for="(item, itemIndex) in reportItems" :key="item.id" class="mb-4" shadow="never">
				<template #header>
					<div class="flex min-h-[34px] items-center justify-between gap-3">
						<strong class="min-w-0 text-base [overflow-wrap:anywhere]">{{itemIndex + 1}}. {{ item.title }}</strong>
						<el-tag round>{{ formatLabel(props.labels.changeItemCount, String(item.entries.length)) }}</el-tag>
					</div>
				</template>
				<p v-if="item.description.trim().length !== 0"
					class="mb-4 whitespace-pre-wrap [overflow-wrap:anywhere]">{{ item.description }}</p>

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
