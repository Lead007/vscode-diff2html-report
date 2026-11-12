<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Download, View } from '@element-plus/icons-vue';
import type { LegacyDiffPreviewData } from './types';
import { formatLabel, getExportStyles } from '../shared';
import { ElMessage } from 'element-plus';
import { ExportContent } from '../../../src/htmlTemplate';

const props = defineProps<LegacyDiffPreviewData>();
const statusMessage = ref('');
const vscodeApi = window.acquireVsCodeApi?.();

let initialDarkMode = document.body.classList.contains('vscode-dark');
const darkMode = ref(initialDarkMode);

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

function exportHtml(): void {
	const reportContent = document.getElementById('diff-content');
	if (!vscodeApi || !reportContent) {
		ElMessage.error(props.labels.reportExportUnavailable);
		return;
	}

	let styles: string;
	try {
		styles = getExportStyles();
	} catch (error) {
		console.error('Failed to collect styles for the exported report.', error);
		ElMessage.error(`${props.labels.reportExportUnavailable} ${String(error)}`);
		return;
	}

	const exportContent: ExportContent = {
		title: props.labels.reportTitle,
		styles: styles,
		htmlContent: reportContent.outerHTML,
		darkMode: darkMode.value
	}

	vscodeApi.postMessage({
		type: 'exportReport',
		content: exportContent,
	});
}
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
					<strong class="text-base font-semibold">{{ props.labels.header }}</strong>
					<div class="truncate text-sm review-text-muted">{{ props.labels.title }}</div>
				</div>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<div class="flex items-center gap-2 text-xs">
					<span class="review-text-muted">{{ darkMode ? props.labels.darkMode : props.labels.lightMode
						}}</span>
					<el-switch v-model="darkMode" :aria-label="props.labels.themeMode" />
				</div>
				<el-button class="!rounded-md" type="primary" :icon="Download" @click="exportHtml">{{ props.labels.exportReport }}</el-button>
			</div>
		</header>
		<main id="diff-content" class="report-theme mx-auto min-h-screen max-w-8xl p-4 review-surface review-text-primary md:p-8">
			<div class="mb-5">
				<h1 class="mb-2 text-2xl font-bold">{{ props.labels.header }}</h1>
				<p class="text-sm review-text-muted">
					{{ formatLabel(props.labels.lineCountContent, String(props.totalAdded), String(props.totalDeleted)) }}
				</p>
			</div>

			<div v-html="props.htmlContent"></div>
		</main>
	</div>
</template>
