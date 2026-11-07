<script setup lang="ts">
import { ref } from 'vue';
import type { LegacyDiffPreviewData } from './types';

const props = defineProps<{ data?: LegacyDiffPreviewData }>();
const generateFileList = ref(true);
const statusMessage = ref('');
const vscode = window.acquireVsCodeApi?.();

function exportHtml(): void {
	if (!props.data) {
		statusMessage.value = 'Diff preview data has not been provided by the extension.';
		return;
	}
	if (!vscode) {
		statusMessage.value = 'HTML export is only available in a VS Code Webview.';
		return;
	}

	vscode.postMessage({
		type: 'saveHtml',
		html: props.data.htmlContent,
		options: { generateFileList: generateFileList.value },
	});
}
</script>

<template>
	<main class="legacy-diff-preview">
		<form class="export-options" @submit.prevent="exportHtml">
			<strong>{{ props.data?.labels.exportOptionsLabel ?? 'HTML Export Options' }}</strong>
			<label>
				<input v-model="generateFileList" type="checkbox" />
				{{ props.data?.labels.generateFileListLabel ?? 'Generate File List' }}
			</label>
			<button type="submit">{{ props.data?.labels.exportButtonLabel ?? 'Save as HTML File' }}</button>
			<p v-if="statusMessage" role="status">{{ statusMessage }}</p>
		</form>

		<hr />
		<h1>{{ props.data?.header ?? 'Git Diff Report' }}</h1>
		<p>{{ props.data?.lineCountContent ?? '' }}</p>
		<div v-if="props.data" class="diff-output" v-html="props.data.htmlContent"></div>
		<p v-else class="empty-state">Diff content will appear here when provided by the extension.</p>
	</main>
</template>
