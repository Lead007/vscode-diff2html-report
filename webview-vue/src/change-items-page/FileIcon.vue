<script setup lang="ts">
import { computed } from 'vue';
import { getFileIcon } from 'diff2html/lib/render-utils';
import type { DiffFile } from 'diff2html/lib/types';
import type { DiffReviewLabels } from './types';

const props = defineProps<{ file: DiffFile; labels: DiffReviewLabels }>();

const iconName = computed(() => getFileIcon(props.file));
</script>

<template>
    <svg v-if="iconName === 'file-added'" aria-hidden="true" class="d2h-icon d2h-added" height="16" :title="props.labels.added"
        version="1.1" viewBox="0 0 14 16" width="14">
        <path
            d="M13 1H1C0.45 1 0 1.45 0 2v12c0 0.55 0.45 1 1 1h12c0.55 0 1-0.45 1-1V2c0-0.55-0.45-1-1-1z m0 13H1V2h12v12zM6 9H3V7h3V4h2v3h3v2H8v3H6V9z">
        </path>
    </svg>

    <svg v-else-if="iconName === 'file-changed'" aria-hidden="true" class="d2h-icon d2h-changed" height="16"
        :title="props.labels.changed" version="1.1" viewBox="0 0 14 16" width="14">
        <path
            d="M13 1H1C0.45 1 0 1.45 0 2v12c0 0.55 0.45 1 1 1h12c0.55 0 1-0.45 1-1V2c0-0.55-0.45-1-1-1z m0 13H1V2h12v12zM4 8c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3-3-1.34-3-3z">
        </path>
    </svg>

    <svg v-else-if="iconName === 'file-deleted'" aria-hidden="true" class="d2h-icon d2h-deleted" height="16"
        :title="props.labels.deleted" version="1.1" viewBox="0 0 14 16" width="14">
        <path
            d="M13 1H1C0.45 1 0 1.45 0 2v12c0 0.55 0.45 1 1 1h12c0.55 0 1-0.45 1-1V2c0-0.55-0.45-1-1-1z m0 13H1V2h12v12zM11 9H3V7h8v2z">
        </path>
    </svg>

    <svg v-else aria-hidden="true" class="d2h-icon d2h-renamed" height="16" :title="props.labels.renamed" version="1.1"
        viewBox="0 0 14 16" width="14">
        <path
            d="M6 9H3V7h3V4l5 4-5 4V9z m8-7v12c0 0.55-0.45 1-1 1H1c-0.55 0-1-0.45-1-1V2c0-0.55 0.45-1 1-1h12c0.55 0 1 0.45 1 1z m-1 0H1v12h12V2z">
        </path>
    </svg>
</template>
