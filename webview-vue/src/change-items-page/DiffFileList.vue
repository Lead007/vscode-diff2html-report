<script setup lang="ts">
import FileIcon from './FileIcon.vue';
import { DiffFile } from 'diff2html/lib/types';
import { DiffReviewLabels, getDiffFileId } from './types';
import { formatLabel } from '../shared';


const props = defineProps<{
    diffFiles: DiffFile[],
    labels: DiffReviewLabels
}>();

function scrollToDiffFile(filePath: string): void {
    document.getElementById(getDiffFileId(filePath))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

</script>


<template>
    <el-card class="mb-6">
        <template #header>
            <div class="d2h-file-list-header">
                <span class="d2h-file-list-title review-text-primary">
                    {{ formatLabel(props.labels.filesChanged, String(props.diffFiles.length)) }}
                </span>
            </div>
        </template>
        <div class="d2h-file-list-wrapper d2h-light-color-scheme">
            <ol class="d2h-file-list">
                <li v-for="file in props.diffFiles" :key="file.newName || file.oldName" class="d2h-file-list-line">
                    <span class="d2h-file-name-wrapper">
                        <FileIcon :file :labels="props.labels" />
                        <a :href="`#${getDiffFileId(file.newName || file.oldName)}`"
                            class="d2h-file-name cursor-pointer hover:underline"
                            @click.prevent="scrollToDiffFile(file.newName || file.oldName)">
                            {{ file.newName || file.oldName }}
                        </a>
                        <span class="d2h-file-stats">
                            <span class="d2h-lines-added">+{{ file.addedLines }}</span>
                            <span class="d2h-lines-deleted">-{{ file.deletedLines }}</span>
                        </span>
                    </span>
                </li>
            </ol>
        </div>
    </el-card>
</template>