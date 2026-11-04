<script setup lang="ts">
import { computed } from 'vue';
import { formatLabel } from './types';
import type { ChangeEntry, DiffReviewLabels } from './types';
import { Close } from '@element-plus/icons-vue';

const props = defineProps<{
    entries: ChangeEntry[];
    canEdit: boolean;
    labels: DiffReviewLabels;
}>();
const emit = defineEmits<{
    'removeEntry': [filePath: string];
    'removeFunction': [filePath: string, functionId: string];
}>();

interface EntryTreeNode {
    id: string;
    label: string;
    isFunction?: boolean;
    children?: EntryTreeNode[];
}
const treeNodesForEntries = computed(() => {
    return props.entries.map(entry => {
        // Set → 数组，生成子节点
        const functionNodes: EntryTreeNode[] = entry.functions
            ? Array.from(entry.functions).map(([fnId, fn]) => ({
                id: fnId, // 保证唯一
                label: fn.name,
                isFunction: true,
                parent: entry.filePath,
            }))
            : []

        return {
            id: entry.filePath,
            label: entry.filePath,
            children: functionNodes.length > 0 ? functionNodes : undefined,
        }
    });
});

const treeProps = {
    children: 'children',
    label: 'label',
};
</script>

<template>
    <el-tree :data="treeNodesForEntries" :props="treeProps" node-key="id" default-expand-all>
        <template #default="{ data }">
            <!-- 第二级：函数 -->
            <el-tag v-if="data.isFunction" type="primary" effect="plain" :closable="props.canEdit" class="mx-1"
                :aria-label="data.label"
                :title="data.label"
                @close="emit('removeFunction', data.parent, data.id)">
                {{ data.label }}
            </el-tag>

            <!-- 第一级：文件路径 -->
            <div v-else class="flex flex-1 items-center justify-between min-w-0 pr-2">
                <!-- 左边：文本 -->
                <span class="truncate" :title="data.label">
                    {{ data.label }}
                </span>

                <!-- 右边：关闭按钮（text 类型） -->
                <el-button v-if="props.canEdit" type="text" size="small" :icon="Close" class="ml-auto flex-shrink-0"
                    :aria-label="props.labels.removeFile"
                    :title="props.labels.removeFile"
                    @click="emit('removeEntry', data.id)" />
            </div>
        </template>
    </el-tree>
</template>