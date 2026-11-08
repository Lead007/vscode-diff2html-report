<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Check, Delete, Document, Download, Edit } from '@element-plus/icons-vue';
import DiffFile from './DiffFile.vue';
import EntryTree from './EntryTree.vue';
import ReportPreview from './ReportPreview.vue';
import { getRangeStartLine, getDiffFileId, ChangeEntry, ChangeItem, DiffReviewData } from './types.js';
import { formatLabel, getExportStyles } from '../shared.js';
import { ExportContent } from '../../../src/htmlTemplate';
import DiffFileList from './DiffFileList.vue';

// 扩展宿主传入的本次 Diff 文件和函数数据。
const props = defineProps<DiffReviewData>();
const vscodeApi = window.acquireVsCodeApi?.();
let initialDarkMode = document.body.classList.contains('vscode-dark');

// Diff 概览区展示的文件列表。
const diffFiles = computed(() => props.diffInfo ?? []);

// 从扩展传入的数据中取得函数级差异列表。
const diffFunctions = computed(() => props.changedFunctions ?? []);

// 为每个变更函数补充稳定 ID，供勾选、关联和树节点使用。
const diffFunctionsFiles = computed(() => diffFunctions.value.map((file) => ({
	...file,
	functions: (file.functions ?? []).map((fn, index) => ({
		...fn,
		id: JSON.stringify([
			file.path,
			fn.kind,
			fn.name,
			getRangeStartLine(fn.newRange) ?? getRangeStartLine(fn.oldRange) ?? index,
		])
	}))
})),
);

// 当前所有文件中的变更函数总数。
const diffFunctionsCount = computed(() => diffFunctionsFiles.value.reduce((sum, file) => sum + (file.functions?.length || 1), 0));

function scrollToDiffFile(filePath: string): void {
    document.getElementById(getDiffFileId(filePath))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 已创建的更改说明列表。
const changeItems = ref<ChangeItem[]>([]);
const isPreviewingReport = ref(false);
// 新增更改项表单的标题和描述草稿。
const form = ref({ title: '', description: '' });
// 当前进入编辑态的更改项 ID；为空时处于新增/浏览状态。
const editingChangeItemId = ref<number | null>(null);
// 进入编辑时保存原值，用于用户选择放弃修改时恢复。
const editingSnapshot = ref<ChangeItem | null>(null);
// 两组折叠面板当前展开的名称：新增面板使用 add，条目使用 change-<id>。
const collapseNames = ref<Array<string | number>>(['add']);
// 新增面板的折叠状态适配器：未编辑时强制保持展开，编辑时禁止展开。
const addCollapseNames = computed({
	get: () => collapseNames.value.includes('add') ? ['add'] : [],
	// 有更改项正在编辑时不允许展开新增面板；其余情况下始终保持展开。
	set: (value: string | number | Array<string | number>) => {
		const itemNames = collapseNames.value.filter(name => name !== 'add');
		collapseNames.value = editingChangeItemId.value === null
			? [...new Set(['add', ...itemNames])]
			: itemNames;
	},
});
// 已添加条目的折叠状态适配器；非编辑状态下始终保留新增面板为展开状态。
const changeCollapseNames = computed({
	get: () => collapseNames.value.filter(name => name !== 'add'),
	set: (value: string | number | Array<string | number>) => {
		const names = Array.isArray(value) ? value : [value];
		collapseNames.value = editingChangeItemId.value === null
			? [...new Set(['add', ...names])]
			: names.filter(name => name !== 'add');
	},
});

// 新增表单当前选择的文件/函数；编辑已有条目时改由 activeEntries 指向条目自身。
const selectedEntries = ref<ChangeEntry[]>([]);
// 当前正在编辑的条目对象；未编辑时为 undefined。
const activeChangeItem = computed(() => changeItems.value.find(item => item.id === editingChangeItemId.value));
// 左侧勾选实际修改的数据：编辑态写入条目，新增态写入表单草稿。
const activeEntries = computed(() => activeChangeItem.value?.entries ?? selectedEntries.value);
// 当前待选/正在编辑的关联项数量。
const selectedCount = computed(() => activeEntries.value.reduce((sum, entry) => sum + (entry.functions ? entry.functions.size : 1), 0));

// 深拷贝关联项数组及其中的函数 Map，避免草稿和已保存数据共享容器。
function cloneEntries(entries: ChangeEntry[]): ChangeEntry[] {
	return entries.map(entry => ({
		...entry,
		functions: entry.functions ? new Map(entry.functions) : undefined,
	}));
}

// 复制一条更改项，用作编辑快照或撤销编辑时的数据恢复值。
function cloneChangeItem(item: ChangeItem): ChangeItem {
	return { ...item, entries: cloneEntries(item.entries) };
}

// 按文件增删函数关联；同一文件没有剩余函数时移除该文件项。
function changeSelectedFunctionIds(filePath: string, ids: string[], selected: boolean) {
	const file = diffFunctionsFiles.value.find(item => item.path === filePath);
	if (!file) return;
	const entry = activeEntries.value.find(item => item.filePath == filePath);
	if (entry) {
		if (!entry.functions) {
			entry.functions = new Map();
		}
		if (selected) {
			// 并集：把 ids 中不存在的添加进去
			for (const id of ids) {
				const fn = file.functions.find(fn => fn.id === id);
				if (fn) {
					entry.functions.set(id, fn);
				}
			}
		} else {
			// 差集：从已有集合中移除 ids 里存在的
			for (const id of ids) {
				entry.functions.delete(id)
			}
			if (entry.functions.size === 0) {
				const index = activeEntries.value.indexOf(entry);
				if (index !== -1) {
					activeEntries.value.splice(index, 1);
				}
			}
		}
	} else if (selected && ids.length > 0) {
		// 不存在且是选中操作 → 新建一条
		activeEntries.value.push({
			filePath,
			functions: new Map(
				ids.map(id => [id, file.functions.find(fn => fn.id === id)!] as const).
					filter(([, fn]) => fn !== undefined)),
		})
	}
}

// 处理没有函数节点的文件级选择，或新增/移除文件关联。
function changeSelectedPath(filePath: string, selected: boolean) {
	const entry = activeEntries.value.find(item => item.filePath == filePath);
	if (selected && !entry) {
		activeEntries.value.push({ filePath });
	} else if (!selected && entry) {
		const index = activeEntries.value.indexOf(entry);
		if (index !== -1) {
			activeEntries.value.splice(index, 1);
		}
	}
}

// 校验并创建一条更改说明，保存当前关联项后清空待选状态。
function addChangeItem() {
	if (!form.value.title.trim()) {
		ElMessage.warning(props.labels.fillTitleAndDescription);
		return;
	}
	if (selectedEntries.value.length === 0) {
		ElMessage.warning(props.labels.selectRelatedEntry);
		return;
	}
	const item: ChangeItem = {
		id: Date.now(),
		title: form.value.title.trim(),
		description: form.value.description.trim(),
		entries: cloneEntries(selectedEntries.value),
	};
	changeItems.value.push(item);
	selectedEntries.value = [];
	collapseNames.value = [...new Set([...collapseNames.value, 'add', `change-${item.id}`])];
	form.value = { title: '', description: '' };
	ElMessage.success(props.labels.changeItemAdded);
}

// 删除指定更改项；若它正处于编辑状态，同时退出编辑并清理折叠状态。
async function removeChangeItem(itemId: number) {
	const result = await ElMessageBox.confirm(
		props.labels.deleteChangeItemConfirmation,
		props.labels.deleteChangeItem,
		{
			confirmButtonText: props.labels.confirm,
			cancelButtonText: props.labels.cancel,
			type: 'warning',
		},
	);
	if(result.action !== 'confirm') return;
	changeItems.value = changeItems.value.filter(item => item.id !== itemId);
	collapseNames.value = collapseNames.value.filter(name => name !== `change-${itemId}`);
	if (editingChangeItemId.value === itemId) {
		editingChangeItemId.value = null;
		editingSnapshot.value = null;
		collapseNames.value = [...new Set(['add', ...collapseNames.value])];
	}
}

// 校验并完成当前编辑；成功后清空待选状态并保持已保存条目展开。
function finishEditing(item: ChangeItem) {
	if (!item.title.trim()) {
		ElMessage.warning(props.labels.fillTitleAndDescription);
		return false;
	}
	if (item.entries.length === 0) {
		ElMessage.warning(props.labels.associateEntry);
		return false;
	}
	item.title = item.title.trim();
	item.description = item.description.trim();
	selectedEntries.value = [];
	editingChangeItemId.value = null;
	editingSnapshot.value = null;
	collapseNames.value = [...new Set([
		'add',
		...collapseNames.value.filter(name => name !== 'add'),
		`change-${item.id}`,
	])];
	return true;
}

// 放弃当前编辑并用进入编辑时的快照恢复条目内容。
function discardEditing() {
	const item = changeItems.value.find(candidate => candidate.id === editingChangeItemId.value);
	if (item && editingSnapshot.value) {
		Object.assign(item, cloneChangeItem(editingSnapshot.value));
	}
	editingChangeItemId.value = null;
	editingSnapshot.value = null;
	collapseNames.value = [...new Set([
		'add',
		...collapseNames.value.filter(name => name !== 'add'),
		...(item ? [`change-${item.id}`] : []),
	])];
}

// 进入指定条目的编辑状态；若已有其他条目在编辑，先询问保存或放弃。
async function startEditing(item: ChangeItem) {
	if (editingChangeItemId.value === item.id) return;
	if (editingChangeItemId.value !== null) {
		let shouldSave = true;
		try {
			await ElMessageBox.confirm(
				props.labels.switchEditingItemConfirmation,
				props.labels.changeItems,
				{
					confirmButtonText: props.labels.saveAndSwitch,
					cancelButtonText: props.labels.discardAndSwitch,
					distinguishCancelAndClose: true,
					type: 'warning',
				},
			);
		} catch (action) {
			if (action === 'cancel') {
				shouldSave = false;
			} else {
				return;
			}
		}
		if (shouldSave) {
			const currentItem = activeChangeItem.value;
			if (!currentItem || !finishEditing(currentItem)) return;
		} else {
			discardEditing();
		}
	}
	editingChangeItemId.value = item.id;
	editingSnapshot.value = cloneChangeItem(item);
	collapseNames.value = [...new Set([
		...collapseNames.value.filter(name => name !== 'add'),
		`change-${item.id}`,
	])];
}

// 二次确认后清空全部更改项，并重置编辑和折叠状态。
async function clearChangeItems() {
	if (changeItems.value.length === 0) {
		ElMessage.info(props.labels.noChangeItemsToClear);
		return;
	}
	try {
		await ElMessageBox.confirm(
			props.labels.clearChangeItemsConfirmation,
			props.labels.clearConfirmationTitle,
			{
				confirmButtonText: props.labels.confirm,
				cancelButtonText: props.labels.cancel,
				type: 'warning',
			}
		);
		changeItems.value = [];
		editingChangeItemId.value = null;
		editingSnapshot.value = null;
		collapseNames.value = ['add'];
	} catch (error) {
		if (error !== 'cancel' && error !== 'close') {
			throw error;
		}
	}
}

// 先让用户审阅 Vue 报告，再由预览界面触发文件导出。
function previewHtml() {
	if (changeItems.value.length === 0) {
		ElMessage.warning(props.labels.emptyChangeItems);
		return;
	}
	if (editingChangeItemId.value !== null) {
		const item = activeChangeItem.value;
		if (!item || !finishEditing(item)) return;
	}
	initialDarkMode = document.body.classList.contains('vscode-dark');
	isPreviewingReport.value = true;
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, character => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	})[character] ?? character);
}

function exportReport(darkMode: boolean): void {
	const reportContent = document.getElementById('report-content');
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
		darkMode: darkMode
	}
	vscodeApi.postMessage({ type: 'exportReport', content: exportContent });
}
</script>

<template>
	<ReportPreview v-if="isPreviewingReport" :items="changeItems" :files="diffFunctionsFiles" :labels="props.labels"
		:initial-dark-mode="initialDarkMode" :view-type="props.configs.viewType"
		@back="isPreviewingReport = false" @export="exportReport" />
	<div v-else class="min-h-screen">
		<header class="flex items-center justify-between px-4 py-3">
			<div class="flex items-center gap-3">
				<div class="review-app-icon flex items-center justify-center w-10 h-10 rounded-lg">
					<el-icon class="text-xl">
						<Document />
					</el-icon>
				</div>
				<div class="flex flex-col">
					<strong class="text-base font-semibold review-text-primary">{{ props.labels.appTitle }}</strong>
						<div class="text-sm review-text-muted">{{ props.labels.subtitle }}</div>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<el-button class="!rounded-md theme-clear-button"
					@click="clearChangeItems">{{ props.labels.clearChanges }}</el-button>
				<el-button class="!rounded-md" type="primary" :icon="Download" @click="previewHtml">{{ props.labels.previewHtml }}</el-button>
			</div>
		</header>

		<main class="p-6 review-surface min-h-screen">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold review-text-primary mb-2">{{ props.labels.pageTitle }}</h1>
					<p class="review-text-muted">{{ props.labels.pageDescription }}</p>
				</div>
			</div>

			<DiffFileList :diff-files="diffFiles" :labels="props.labels" @scroll-to-diff-file="scrollToDiffFile" />

			<el-row gutter="20" class="diff-columns">
				<el-col :span="16" class="diff-column">
					<el-card class="diff-panel" shadow="never">
						<template #header>
							<div class="min-h-[34px] flex items-center justify-between">
								<div>
									<strong>{{ props.labels.fileFunctions }} <el-tag round>{{ diffFunctionsCount }}</el-tag></strong>
									<div class="text-xs">{{ editingChangeItemId === null ? props.labels.selectFunctionsHint :
										props.labels.updateSelectionHint }}</div>
								</div>
								<span class="text-xs">{{ formatLabel(props.labels.selectedCount, String(selectedCount)) }}</span>
							</div>
						</template>

						<template v-for="file in diffFunctionsFiles" :key="file.path">
							<div :id="getDiffFileId(file.path)">
								<DiffFile :item="file" :entry="activeEntries.find(entry => entry.filePath === file.path)"
									:labels="props.labels" view-type="line-by-line"
									@update:selected-function-ids="(ids, selected) => changeSelectedFunctionIds(file.path, ids, selected)"
									@update:selected-path="(selected) => changeSelectedPath(file.path, selected)" />
							</div>
						</template>
					</el-card>
				</el-col>
				<el-col :span="8" class="diff-column">
					<el-card
						class="[&>.el-card__header]:px-[17px] [&>.el-card__header]:py-[14px] [&>.el-card__body]:p-4"
						shadow="never">
						<template #header>
							<div class="min-h-[34px] flex items-center justify-between">
								<div>
									<strong>{{ props.labels.changeItems }}</strong>
									<div class="mt-1 text-xs review-text-muted">{{ props.labels.changeItemsDescription }}</div>
								</div>
							</div>
						</template>

						<el-collapse v-model="addCollapseNames">
							<!--新增更改项-->
							<el-collapse-item name="add">
								<template #title>
									<div class="min-h-[34px] flex w-full items-center justify-between">
										<strong>{{ props.labels.addChangeItem }}</strong>
										<el-tag round>{{ changeItems.length }}</el-tag>
									</div>
								</template>
								<el-form label-position="top"
									class="review-form [&_.el-form-item]:!mb-[13px] [&_.el-form-item__label]:!mb-[5px] [&_.el-form-item__label]:!h-auto [&_.el-form-item__label]:text-xs [&_.el-form-item__label]:font-bold [&_.el-form-item__label:before]:hidden [&_.el-textarea__inner]:leading-6"
									@submit.prevent="addChangeItem">
									<el-form-item :label="props.labels.changeTitle" required>
										<el-input v-model="form.title" maxlength="100" :placeholder="props.labels.titlePlaceholder" />
									</el-form-item>
									<el-form-item :label="props.labels.changeDescription">
										<el-input v-model="form.description" type="textarea" :rows="4" maxlength="1000"
											:placeholder="props.labels.descriptionPlaceholder" />
									</el-form-item>
									<div
										class="mb-[15px] rounded-lg border border-dashed review-border review-surface-subtle p-[11px]">
										<div class="mb-[7px] text-xs font-bold review-text-primary">{{
											props.labels.relatedFilesAndFunctions }} <span
												class="review-text-danger">*</span>
										</div>
										<EntryTree v-if="selectedEntries.length !== 0" :entries="selectedEntries"
											:labels="props.labels" :can-edit="true"
											@remove-entry="(filePath) => changeSelectedPath(filePath, false)"
											@remove-function="(filePath, functionId) => changeSelectedFunctionIds(filePath, [functionId], false)" />
										<div v-else class="mt-1 text-xs review-text-muted">{{
											props.labels.selectFunctionHint }}</div>
									</div>
									<el-button type="primary" class="!w-full" @click="addChangeItem">＋ {{ props.labels.addChangeItem }}</el-button>
								</el-form>
							</el-collapse-item>
						</el-collapse>
						<div class="mb-[9px] mt-4 flex items-center justify-between gap-3">
								<strong>{{ props.labels.addedChangeItems }}</strong>
								<span class="text-xs review-text-muted">{{ formatLabel(props.labels.changeItemCount, String(changeItems.length)) }}</span>
						</div>
						<el-empty v-if="changeItems.length === 0"
								class="!py-2 [&_.el-empty__description_p]:text-[11px]" :description="props.labels.emptyChangeItems"
								:image-size="48" />
						<el-collapse v-model="changeCollapseNames" class="change-items-collapse">
							<el-collapse-item v-for="item in changeItems" :key="item.id"
								:name="`change-${item.id}`" class="mt-2">
								<template #title>
									<div class="flex min-w-0 flex-1 items-center justify-between gap-2 pr-2">
										<strong class="min-w-0 truncate text-xs">{{ item.title }}</strong>
										<div class="flex shrink-0 items-center gap-0" @click.stop>
											<el-button v-if="editingChangeItemId !== item.id" text :icon="Edit" class="!ml-0"
												:aria-label="props.labels.editChangeItem" :title="props.labels.editChangeItem" @click.stop="startEditing(item)" />
											<el-button v-else text type="primary" :icon="Check" class="!ml-0"
												:aria-label="props.labels.finishEditing" :title="props.labels.finishEditing" @click.stop="finishEditing(item)" />
											<el-button text type="danger" :icon="Delete" class="!ml-0"
												:title="props.labels.deleteChangeItem" :aria-label="props.labels.deleteChangeItem" @click.stop="removeChangeItem(item.id)" />
										</div>
									</div>
								</template>
								<template v-if="editingChangeItemId === item.id">
									<el-input v-if="editingChangeItemId === item.id" v-model="item.title" class="mb-2"
										maxlength="100" :placeholder="props.labels.changeTitle" />
									<el-input v-if="editingChangeItemId === item.id" v-model="item.description"
										type="textarea" :rows="4" maxlength="1000"
										:placeholder="props.labels.changeDescription" />
									<div v-if="editingChangeItemId === item.id" class="mt-3">
										<div class="mb-1 text-xs font-bold review-text-primary">{{
											props.labels.relatedFilesAndFunctions }}</div>
										<div v-if="item.entries.length === 0" class="text-xs review-text-muted">{{
											props.labels.selectFunctionHint }}
										</div>
										<EntryTree v-else :entries="item.entries" :can-edit="true"
											:labels="props.labels"
											@remove-entry="(filePath) => changeSelectedPath(filePath, false)"
											@remove-function="(filePath, functionId) => changeSelectedFunctionIds(filePath, [functionId], false)" />
									</div>
								</template>
								<template v-else>
									<p v-if="item.description.trim().length !== 0"
										class="my-2 mt-[5px] text-[11px] review-text-muted [overflow-wrap:anywhere] whitespace-pre-wrap">
										{{ item.description }}</p>
									<EntryTree v-if="item.entries.length !== 0" :entries="item.entries" :labels="props.labels"
										:can-edit="false" />
								</template>
							</el-collapse-item>
						</el-collapse>
					</el-card>
				</el-col>
			</el-row>

			<div class="workspace">


			</div>
		</main>
	</div>
</template>
