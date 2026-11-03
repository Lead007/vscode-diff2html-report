<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Check, Delete, Document, Download, Edit } from '@element-plus/icons-vue';
import DiffFile from './DiffFile.vue';
import EntryTree from './EntryTree.vue';
import FileIcon from './FileIcon.vue';
import { formatLabel, getRangeStartLine } from './types';
import type { ChangeEntry, DiffReviewData } from './types';

// 扩展宿主传入的本次 Diff 文件和函数数据。
const props = defineProps<DiffReviewData>();

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

function getDiffFileId(filePath: string): string {
	return `diff-file-${encodeURIComponent(filePath)}`;
}

function scrollToDiffFile(filePath: string): void {
	document.getElementById(getDiffFileId(filePath))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 右侧一条已添加说明的数据结构，包含标题、描述和关联文件/函数。
interface ChangeItem {
	id: number;
	title: string;
	description: string;
	entries: ChangeEntry[];
}

// 已创建的更改说明列表。
const changeItems = ref<ChangeItem[]>([]);
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
	if (!form.value.title.trim() || !form.value.description.trim()) {
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
	if (!item.title.trim() || !item.description.trim()) {
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

// 对插入 HTML 的文本进行转义，避免内容被浏览器当作标签解析。
function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	})[character] ?? character);
}

// 将函数差异块转换成带增删样式的 HTML 行。
function renderFunctionDiff(blocks: DiffReviewData['changedFunctions'][number]['functions'][number]['diffBlocks'] = []): string {
	return blocks.flatMap((block) => block.lines).map((line) => {
		const prefix = line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' ';
		return `<pre class="${line.type}">${prefix}${escapeHtml(line.content)}</pre>`;
	}).join('');
}

// 导出报告的入口；当前导出实现仍处于注释状态，调用时不会生成文件。
function previewHtml() {
	// 	if (changeItems.value.length === 0) {
	// 		ElMessage.warning('请先添加至少一个更改项，再导出报告');
	// 		return;
	// 	}
	// 	const sections = diffFunctionsFiles.value.map((file) => `
	// 		<section class="file">
	// 			<h2>${escapeHtml(file.path)} <span>+${file.diffInfo.addedLines} −${file.diffInfo.deletedLines}</span></h2>
	// 			${(file.functions ?? []).map((fn) => `
	// 				<article class="function">
	// 					<h3>${escapeHtml(fn.name)} (${fn.kind === 'modified' ? 'changed' : fn.kind})</h3>
	// 					${renderFunctionDiff(fn.diffBlocks ?? [])}
	// 				</article>
	// 			`).join('')}
	// 		</section>
	// 	`).join('');
	// 	const notes = changeItems.value.map((item) => {
	// 		const related = item.functionIds.map((id) => {
	// 			const fn = allFunctions.value.find((candidate) => candidate.id === id);
	// 			return fn ? `<code>${escapeHtml(fn.file)} · ${escapeHtml(fn.name)}</code>` : '';
	// 		}).join(' ');
	// 		return `<article class="note"><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><div>关联函数：${related}</div></article>`;
	// 	}).join('');
	// 	const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Diff 函数变更报告</title><style>
	// body{max-width:1100px;margin:32px auto;padding:0 18px;background:#f5f7fb;color:#172033;font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif}
	// .file,.note{margin:16px 0;padding:18px;border:1px solid #e2e8f0;border-radius:9px;background:white}.file h2{font:600 14px monospace}.file h2 span{color:#16803c}.function{margin-top:12px;border:1px solid #e2e8f0}.function h3{margin:0;padding:9px;background:#f8fafc;font:600 12px monospace}pre{margin:0;padding:3px 10px;font:12px/1.6 monospace;white-space:pre-wrap}.context{background:#fff;color:#334155}.insert{background:#e8f7ec;color:#166534}.delete{background:#fff0ee;color:#991b1b}.hunk{background:#eef2ff;color:#52618a}.note code{display:inline-block;margin:3px;padding:4px;background:#f1f5f9}
	// </style><h1>Diff 函数变更报告</h1><p>导出时间：${escapeHtml(new Date().toLocaleString('zh-CN'))}</p><h2>更改说明</h2>${notes}<h2>文件与函数差异</h2>${sections}</html>`;
	// 	const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
	// 	const link = document.createElement('a');
	// 	link.href = url;
	// 	link.download = 'diff-function-report.html';
	// 	link.click();
	// 	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>

<template>
	<div class="min-h-screen">
		<header class="flex items-center justify-between px-4 py-3 border-b border-solid review-border">
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
			<el-card class="mb-6">
				<div class="d2h-file-list-wrapper d2h-light-color-scheme">
					<div class="d2h-file-list-header">
						<span class="d2h-file-list-title review-text-primary">{{ formatLabel(props.labels.filesChanged, String(diffFiles.length)) }}</span>
						<a class="d2h-file-switch d2h-hide">{{ props.labels.hide }}</a>
						<a class="d2h-file-switch d2h-show">{{ props.labels.show }}</a>
					</div>
					<ol class="d2h-file-list">
						<li v-for="file in diffFiles" :key="file.newName || file.oldName" class="d2h-file-list-line">
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
									:labels="props.labels"
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
									<el-form-item :label="props.labels.changeDescription" required>
										<el-input v-model="form.description" type="textarea" :rows="4" maxlength="1000"
											:placeholder="props.labels.descriptionPlaceholder" />
									</el-form-item>
									<el-button type="primary" class="!w-full" @click="addChangeItem">＋ {{ props.labels.addChangeItem }}</el-button>
								</el-form>
								<div
									class="mb-[15px] rounded-lg border border-dashed review-border review-surface-subtle p-[11px]">
									<div class="mb-[7px] text-xs font-bold review-text-primary">{{ props.labels.relatedFilesAndFunctions }} <span
											class="review-text-danger">*</span>
									</div>
									<EntryTree v-if="selectedEntries.length !== 0" :entries="selectedEntries" :labels="props.labels"
										:can-edit="true"
										@remove-entry="(filePath) => changeSelectedPath(filePath, false)"
										@remove-function="(filePath, functionId) => changeSelectedFunctionIds(filePath, [functionId], false)" />
									<div v-else class="mt-1 text-xs review-text-muted">{{ props.labels.selectFunctionHint }}</div>
								</div>
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

								<el-input v-if="editingChangeItemId === item.id" v-model="item.title" class="mb-2"
									maxlength="100" :placeholder="props.labels.changeTitle" />
								<p v-else
									class="my-2 mt-[5px] text-[11px] review-text-muted [overflow-wrap:anywhere] whitespace-pre-wrap">
									{{ item.description }}</p>
								<el-input v-if="editingChangeItemId === item.id" v-model="item.description"
									type="textarea" :rows="4" maxlength="1000" :placeholder="props.labels.changeDescription" />
								<div v-if="editingChangeItemId === item.id" class="mt-3">
									<div class="mb-1 text-xs font-bold review-text-primary">{{ props.labels.relatedFilesAndFunctions }}</div>
									<div v-if="item.entries.length === 0" class="text-xs review-text-muted">{{ props.labels.selectFunctionHint }}
									</div>
									<EntryTree v-else :entries="item.entries" :can-edit="true" :labels="props.labels"
										@remove-entry="(filePath) => changeSelectedPath(filePath, false)"
										@remove-function="(filePath, functionId) => changeSelectedFunctionIds(filePath, [functionId], false)" />
								</div>
								<EntryTree v-else-if="item.entries.length !== 0" :entries="item.entries" :labels="props.labels"
									:can-edit="false" />
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
