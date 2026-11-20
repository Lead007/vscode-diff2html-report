<script setup lang="ts">
import { SharedLabels } from './shared';

const props = defineProps<{
	labels: SharedLabels;
}>();
</script>

<template>
    <footer class="text-center text-sm">
        {{ props.labels.footerText }}
        <a href="https://marketplace.visualstudio.com/items?itemName=Lead007.diff2html-report" target="_blank" rel="noopener noreferrer" class="review-text-accent">{{props.labels.footerPage}}</a>
        &nbsp;
        <a href="https://github.com/Lead007/vscode-diff2html-report" target="_blank" rel="noopener noreferrer" class="review-text-accent">{{props.labels.footerRepo}}</a>
    </footer>

</template>
