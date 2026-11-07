<script setup lang="ts">
import { ref } from 'vue';
import type { LegacyDiffPreviewData } from './types';

const props = defineProps<LegacyDiffPreviewData>();
const generateFileList = ref(true);
const statusMessage = ref('');
const vscode = window.acquireVsCodeApi?.();

function exportHtml(): void {
	if (!vscode) {
		statusMessage.value = 'HTML export is only available in a VS Code Webview.';
		return;
	}

	vscode.postMessage({
		type: 'saveHtml',
		html: props.htmlContent,
		options: { generateFileList: generateFileList.value },
	});
}
</script>

<template>
	<main class="legacy-diff-preview">
		<form class="export-options" @submit.prevent="exportHtml">
			<strong>{{ props.labels.exportOptionsLabel }}</strong>
			<label>
				<input v-model="generateFileList" type="checkbox" />
				{{ props.labels.generateFileListLabel }}
			</label>
			<button type="submit">{{ props.labels.exportButtonLabel }}</button>
			<p v-if="statusMessage" role="status">{{ statusMessage }}</p>
		</form>

		<hr />
		<h1>{{ props.header }}</h1>
		<p>{{ props.lineCountContent ?? '' }}</p>
		<div v-html="props.htmlContent"></div>
	</main>
</template>
