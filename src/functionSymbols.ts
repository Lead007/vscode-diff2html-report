import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { diffArrays } from 'diff';
import { LineType } from 'diff2html/lib/types';
import type { DiffBlock, DiffFile, DiffLine } from 'diff2html/lib/types';
import { execCmdAsync } from './scmHelper';
import { appendLog } from './logger';

/**
 * @brief 某个文件中发生变化的函数及其差异块。
 */
export interface ChangedFunction {
	name: string;
	detail?: string;
	kind: 'added' | 'deleted' | 'modified';
	oldRange?: vscode.Range;
	newRange?: vscode.Range;
	diffBlocks: DiffBlock[];
}

/**
 * @brief 单个差异文件的函数变更分析结果及分析状态。
 */
export interface ChangedFileFunctions {
	path: string;
	diffInfo: DiffFile;
	functions: ChangedFunction[];
	nonFunctionDiffBlocks: DiffBlock[];
	symbolProviderAvailable: boolean;
	skipReason?: 'binary' | 'tooBig';
	error?: string;
}

/**
 * @brief 从 VS Code 符号提供器中提取出的符号及其层级结构。
 */
interface SourceSymbol {
	name: string;
	detail?: string;
	kind: vscode.SymbolKind;
	range: vscode.Range;
	children: SourceSymbol[];
}

/**
 * @brief 符号查询结果及提供器可用状态。
 */
interface SymbolResult {
	symbols: SourceSymbol[];
	available: boolean;
}

/**
 * @brief Diff 中旧版和新版分别发生变化的行号集合，行号从 1 开始。
 */
interface FileChanges {
	oldLines: Set<number>;
	newLines: Set<number>;
}

/**
 * @brief 函数分析的默认符号类型；类、变量等其他符号默认不会作为函数处理。
 */
const defaultFunctionSymbolKindNames = [
	'Function',
	'Method',
	'Constructor',
	'Operator'
];

const symbolKindsByName = new Map<string, vscode.SymbolKind>([
	['File', vscode.SymbolKind.File],
	['Module', vscode.SymbolKind.Module],
	['Namespace', vscode.SymbolKind.Namespace],
	['Package', vscode.SymbolKind.Package],
	['Class', vscode.SymbolKind.Class],
	['Method', vscode.SymbolKind.Method],
	['Property', vscode.SymbolKind.Property],
	['Field', vscode.SymbolKind.Field],
	['Constructor', vscode.SymbolKind.Constructor],
	['Enum', vscode.SymbolKind.Enum],
	['Interface', vscode.SymbolKind.Interface],
	['Function', vscode.SymbolKind.Function],
	['Variable', vscode.SymbolKind.Variable],
	['Constant', vscode.SymbolKind.Constant],
	['String', vscode.SymbolKind.String],
	['Number', vscode.SymbolKind.Number],
	['Boolean', vscode.SymbolKind.Boolean],
	['Array', vscode.SymbolKind.Array],
	['Object', vscode.SymbolKind.Object],
	['Key', vscode.SymbolKind.Key],
	['Null', vscode.SymbolKind.Null],
	['EnumMember', vscode.SymbolKind.EnumMember],
	['Struct', vscode.SymbolKind.Struct],
	['Event', vscode.SymbolKind.Event],
	['Operator', vscode.SymbolKind.Operator],
	['TypeParameter', vscode.SymbolKind.TypeParameter]
]);

/**
 * @brief 从配置读取需要作为函数级变更分析的符号类型。
 */
function getFunctionSymbolKinds(): Set<vscode.SymbolKind> {
	const configuredNames = vscode.workspace.getConfiguration('diff2html-report').get<string[]>(
		'functionDiffSymbolKinds',
		defaultFunctionSymbolKindNames
	);
	return new Set((Array.isArray(configuredNames) ? configuredNames : [])
		.map(name => symbolKindsByName.get(name))
		.filter((kind): kind is vscode.SymbolKind => kind !== undefined));
}

/**
 * @brief 函数差异的完整展示阈值及精简差异上下文设置。
 */
interface FunctionDiffOptions {
	fullFunctionLineThreshold: number;
	fullFunctionChangePercentage: number;
	contextLines: number;
}

/**
 * @brief 函数差异策略的默认配置。
 */
const defaultFunctionDiffOptions: FunctionDiffOptions = {
	fullFunctionLineThreshold: 30,
	fullFunctionChangePercentage: 30,
	contextLines: 3
};

/**
 * @brief 分析一组文件差异，找出被新增、删除或修改的函数。
 * @param repositoryPath Git 仓库根目录。
 * @param diffFiles diff2html 解析得到的文件差异列表。
 * @param baseRevision 作为比较基准的提交引用。
 * @param currentRevision 当前提交引用；使用 --staged 时读取暂存区。
 * @returns 每个差异文件对应的函数变更分析结果。
 */
export async function findChangedFunctions(
	repositoryPath: string,
	diffFiles: DiffFile[],
	baseRevision: string,
	currentRevision: string,
	onProgress?: (current: number, total: number, filePath: string) => void
): Promise<ChangedFileFunctions[]> {
	appendLog(`Starting function diff analysis for ${diffFiles.length} file(s).`);
	// 先解析提交引用，避免后续逐文件读取时重复解析；--staged 表示读取 Git 暂存区。
	const staged = currentRevision === '--staged';
	let base: string;
	let current: string | undefined;
	try {
		base = await resolveRevision(repositoryPath, baseRevision);
		current = staged ? undefined : await resolveRevision(repositoryPath, currentRevision);
	} catch (error) {
		appendLog(`Failed to resolve revisions for function diff analysis: ${String(error)}`);
		throw error;
	}
	const options = getFunctionDiffOptions();
	const functionKinds = getFunctionSymbolKinds();
	let completedFiles = 0;
	const results = await Promise.all(diffFiles.map(async (file): Promise<ChangedFileFunctions | undefined> => {
		const oldPath = file.isNew ? undefined : file.oldName;
		const newPath = file.isDeleted ? undefined : file.newName;
		const displayPath = newPath || oldPath;
		if (!displayPath) {
			appendLog('Skipping a diff file without an old or new path.');
			return undefined;
		}
		appendLog(`Analyzing changed functions in '${displayPath}'.`);

		let result: ChangedFileFunctions;
		// 二进制文件和超大文件无法可靠地通过文档符号提供器分析，明确记录跳过原因。
		if (file.isBinary || file.isTooBig) {
			result = {
				path: displayPath,
				diffInfo: file,
				functions: [],
				nonFunctionDiffBlocks: [],
				symbolProviderAvailable: false,
				skipReason: file.isBinary ? 'binary' : 'tooBig'
			};
			appendLog(`Skipped function analysis for '${displayPath}' (${file.isBinary ? 'binary' : 'too large'} file).`);
		} else {
			try {
				// 从差异块提取两版各自修改的行，并从 Git 读取两版源码。
				const changedLines = collectChangedLines(file);
				const oldSource = oldPath
					? await readSource(repositoryPath, base, oldPath, false)
					: undefined;
				const newSource = newPath
					? await readSource(repositoryPath, current, newPath, staged)
					: undefined;
				// 新增文件没有旧源码，删除文件没有新源码；对应的空符号集便于统一后续匹配。
				const oldResult = oldSource === undefined
					? { symbols: [], available: true }
					: await getDocumentSymbols(oldSource, oldPath!);
				const newResult = newSource === undefined
					? { symbols: [], available: true }
					: await getDocumentSymbols(newSource, newPath!);
				const oldSymbols = flattenSymbols(oldResult.symbols, functionKinds);
				const newSymbols = flattenSymbols(newResult.symbols, functionKinds);
				// 从树顶向下选择变更符号；命中函数级符号后不再分析它的子级。
				const changes = pairChangedSymbols(
					collectChangedSymbols(oldResult.symbols, changedLines.oldLines, functionKinds),
					collectChangedSymbols(newResult.symbols, changedLines.newLines, functionKinds),
					oldSymbols,
					newSymbols,
					file,
					oldSource,
					newSource,
					options
				);
				const nonFunctionDiffBlocks = createNonFunctionDiffBlocks(
					file.blocks,
					oldSymbols,
					newSymbols,
					options.contextLines
				);
				result = {
					path: displayPath,
					diffInfo: file,
					functions: changes,
					nonFunctionDiffBlocks,
					symbolProviderAvailable: oldResult.available || newResult.available
				};
				//TODO
				if (!oldResult.available || !newResult.available) {
					appendLog(`A document symbol provider was unavailable for '${displayPath}' (old: ${oldResult.available}, new: ${newResult.available}).`);
				}
				appendLog(`Finished analyzing '${displayPath}': ${changes.length} function change(s), ${nonFunctionDiffBlocks.length} non-function diff block(s).`);
			} catch (error) {
				// 单个文件分析失败不应中断整个列表；将错误文本附在该文件结果上供调用方展示。
				appendLog(`Failed to analyze changed functions in '${displayPath}': ${String(error)}`);
				result = {
					path: displayPath,
					diffInfo: file,
					functions: [],
					nonFunctionDiffBlocks: [],
					symbolProviderAvailable: false,
					error: String(error)
				};
			}
		}

		completedFiles++;
		onProgress?.(completedFiles, diffFiles.length, displayPath);
		return result;
	}));
	const processedResults = results.filter((result): result is ChangedFileFunctions => result !== undefined);
	appendLog(`Completed function diff analysis: ${processedResults.length} of ${diffFiles.length} file(s) processed.`);
	return processedResults;
}

/**
 * @brief 从 VS Code 语言提供器获取指定源码的文档符号。
 * @param source 要分析的源码。
 * @param sourcePath 源文件路径，用于保留扩展名以识别语言。
 * @returns 提取到的符号树及符号提供器是否可用。
 */
async function getDocumentSymbols(
	source: string,
	sourcePath: string
): Promise<SymbolResult> {
	// 使用原文件名作为临时文件名，让语言扩展有机会按扩展名识别语言。
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diff2html-symbol-'));
	const temporaryFile = path.join(directory, path.basename(sourcePath));
	try {
		await fs.writeFile(temporaryFile, source, 'utf8');
		const document = await vscode.workspace.openTextDocument(vscode.Uri.file(temporaryFile));
		// 此命令会路由到相应语言扩展注册的 DocumentSymbolProvider。
		const symbols = await vscode.commands.executeCommand<Array<vscode.DocumentSymbol | vscode.SymbolInformation>>(
			'vscode.executeDocumentSymbolProvider',
			document.uri
		);
		return {
			symbols: mapSymbols(symbols || []),
			available: symbols !== undefined
		};
	} finally {
		// 无论符号查询成功与否都清理临时文件及目录。
		await fs.rm(directory, {
			recursive: true,
			force: true,
			maxRetries: 5,
			retryDelay: 100
		});
	}
}

/**
 * @brief 将 VS Code 文档符号转换为保留嵌套结构的内部表示。
 * @param symbols VS Code 符号提供器返回的符号。
 * @returns 保留子级关系的符号树。
 */
function mapSymbols(symbols: Array<vscode.DocumentSymbol | vscode.SymbolInformation>): SourceSymbol[] {
	type NestedSymbol = vscode.DocumentSymbol | (
		vscode.SymbolInformation & { children: Array<vscode.DocumentSymbol | vscode.SymbolInformation> }
	);
	const hasChildren = (
		symbol: vscode.DocumentSymbol | vscode.SymbolInformation
	): symbol is NestedSymbol => 'children' in symbol && Array.isArray(symbol.children);
	type DetailedSymbol = vscode.DocumentSymbol | (
		vscode.SymbolInformation & { detail: string }
	);
	const hasDetail = (
		symbol: vscode.DocumentSymbol | vscode.SymbolInformation
	): symbol is DetailedSymbol => 'detail' in symbol;

	const result: SourceSymbol[] = [];
	for (const symbol of symbols) {
		const range = 'location' in symbol ? symbol.location.range : symbol.range;
		result.push({
			name: symbol.name,
			detail: hasDetail(symbol) ? symbol.detail : undefined,
			kind: symbol.kind,
			range,
			children: hasChildren(symbol) ? mapSymbols(symbol.children) : []
		});
	}
	return result;
}

/**
 * @brief 将树形符号转换为需要参与配对的函数符号线性列表。
 */
function flattenSymbols(symbols: SourceSymbol[], functionKinds: Set<vscode.SymbolKind>): SourceSymbol[] {
	const result: SourceSymbol[] = [];
	const visit = (items: SourceSymbol[]) => {
		for (const symbol of items) {
			if (functionKinds.has(symbol.kind)) {
				result.push(symbol);
			}
			visit(symbol.children);
		}
	};
	visit(symbols);
	return result;
}

/**
 * @brief 从树顶向下收集变更符号；选中父级后跳过其所有子级。
 */
function collectChangedSymbols(
	symbols: SourceSymbol[],
	changedLines: Set<number>,
	functionKinds: Set<vscode.SymbolKind>
): SourceSymbol[] {
	const result: SourceSymbol[] = [];
	const visit = (items: SourceSymbol[]) => {
		for (const symbol of items) {
			if (functionKinds.has(symbol.kind) && intersectsLines(symbol.range, changedLines)) {
				result.push(symbol);
			} else {
				visit(symbol.children);
			}
		}
	};
	visit(symbols);
	return result;
}

/**
 * @brief 从文件差异中分别收集旧版删除行和新版插入行。
 * @param file diff2html 文件差异。
 * @returns 两个版本中所有变更行的行号集合。
 */
function collectChangedLines(file: DiffFile): FileChanges {
	const oldLines = new Set<number>();
	const newLines = new Set<number>();
	// 删除对应旧文件行号，插入对应新文件行号；上下文行不影响函数变更筛选。
	for (const block of file.blocks) {
		for (const line of block.lines) {
			if (line.type === 'delete') {
				oldLines.add(line.oldNumber);
			} else if (line.type === 'insert') {
				newLines.add(line.newNumber);
			}
		}
	}
	return { oldLines, newLines };
}

/**
 * @brief 根据变更行将旧版和新版函数配对，并生成函数级差异块。
 * @param oldChanged 旧版中与变更行相交的函数。
 * @param newChanged 新版中与变更行相交的函数。
 * @param oldAll 旧版文件中的全部函数，用于定位差异块锚点。
 * @param newAll 新版文件中的全部函数，用于定位差异块锚点。
 * @param file 当前文件的差异信息。
 * @param oldSource 旧版源码；新增文件时不存在。
 * @param newSource 新版源码；删除文件时不存在。
 * @param options 函数差异展示策略。
 * @returns 配对后的修改、新增和删除函数列表。
 */
function pairChangedSymbols(
	oldChanged: SourceSymbol[],
	newChanged: SourceSymbol[],
	oldAll: SourceSymbol[],
	newAll: SourceSymbol[],
	file: DiffFile,
	oldSource?: string,
	newSource?: string,
	options: FunctionDiffOptions = defaultFunctionDiffOptions
): ChangedFunction[] {
	const oldMatches = new Set<SourceSymbol>();
	const newMatches = new Set<SourceSymbol>();
	const changes: ChangedFunction[] = [];

	// 建立一对旧/新函数的修改记录，并记录双方已配对，避免重复输出。
	const pair = (oldSymbol: SourceSymbol, newSymbol: SourceSymbol) => {
		if (oldMatches.has(oldSymbol) || newMatches.has(newSymbol)) {
			return;
		}
		oldMatches.add(oldSymbol);
		newMatches.add(newSymbol);
		changes.push({
			name: newSymbol.name,
			detail: newSymbol.detail,
			kind: 'modified',
			oldRange: oldSymbol.range,
			newRange: newSymbol.range,
			diffBlocks: createFunctionDiffBlocks(
				oldSource,
				oldSymbol.range,
				newSource,
				newSymbol.range,
				options,
				'modified'
			)
		});
	};

	// 第一轮按名称配对；同名函数有多个时，选择起始行距离最近的候选项。
	for (const newSymbol of newChanged) {
		const oldSymbol = oldChanged
			.filter(candidate => !oldMatches.has(candidate) && candidate.name === newSymbol.name)
			.sort((left, right) => lineDistance(left.range, newSymbol.range) - lineDistance(right.range, newSymbol.range))[0];
		if (oldSymbol) {
			pair(oldSymbol, newSymbol);
		}
	}

	// 第二轮按差异块补充配对，处理改名或某一侧没有直接命中修改行的情况。
	for (const block of file.blocks) {
		let oldHits = oldChanged.filter(symbol =>
			!oldMatches.has(symbol) && intersectsBlock(symbol.range, block.oldStartLine, block.lines, 'delete'));
		let newHits = newChanged.filter(symbol =>
			!newMatches.has(symbol) && intersectsBlock(symbol.range, block.newStartLine, block.lines, 'insert'));

		// 只有新侧命中时，尝试用旧侧差异块起始位置所在的函数补齐。
		if (oldHits.length === 0 && newHits.length > 0) {
			const oldAnchor = oldAll.find(symbol =>
				!oldMatches.has(symbol) && rangeContainsLine(symbol.range, block.oldStartLine));
			if (oldAnchor) {
				oldHits = [oldAnchor];
			}
		}
		// 只有旧侧命中时，同样尝试用新侧差异块起始位置所在的函数补齐。
		if (newHits.length === 0 && oldHits.length > 0) {
			const newAnchor = newAll.find(symbol =>
				!newMatches.has(symbol) && rangeContainsLine(symbol.range, block.newStartLine));
			if (newAnchor) {
				newHits = [newAnchor];
			}
		}

		// 优先按名称配对；名称不一致时按剩余列表顺序配对，以识别函数改名。
		while (oldHits.length && newHits.length) {
			const oldSymbol = oldHits.shift()!;
			const matchingName = newHits.findIndex(symbol => symbol.name === oldSymbol.name);
			const newSymbol = newHits.splice(matchingName >= 0 ? matchingName : 0, 1)[0];
			pair(oldSymbol, newSymbol);
		}
	}

	// 未与新版函数配对的旧函数视为删除。
	for (const oldSymbol of oldChanged) {
		if (oldMatches.has(oldSymbol)) {
			continue;
		}
		changes.push({
			name: oldSymbol.name,
			detail: oldSymbol.detail,
			kind: 'deleted',
			oldRange: oldSymbol.range,
			diffBlocks: createFunctionDiffBlocks(
				oldSource,
				oldSymbol.range,
				undefined,
				undefined,
				options,
				'deleted'
			)
		});
	}

	// 未与旧版函数配对的新函数视为新增。
	for (const newSymbol of newChanged) {
		if (!newMatches.has(newSymbol)) {
			changes.push({
				name: newSymbol.name,
				detail: newSymbol.detail,
				kind: 'added',
				newRange: newSymbol.range,
				diffBlocks: createFunctionDiffBlocks(
					undefined,
					undefined,
					newSource,
					newSymbol.range,
					options,
					'added'
				)
			});
		}
	}
	// 按新位置（若无则按旧位置）排序，便于按文件阅读顺序展示。
	return changes.sort((left, right) =>
		(left.newRange?.start.line ?? left.oldRange?.start.line ?? 0) -
		(right.newRange?.start.line ?? right.oldRange?.start.line ?? 0));
}

/**
 * @brief 按函数长度和变更比例决定生成完整函数差异还是带上下文的精简差异。
 * @param oldSource 旧版源码。
 * @param oldRange 旧版函数范围。
 * @param newSource 新版源码。
 * @param newRange 新版函数范围。
 * @param options 展示阈值及上下文行设置。
 * @param kind 函数变更类型。
 * @returns 可由 diff2html 差异渲染组件直接处理的差异块。
 */
function createFunctionDiffBlocks(
	oldSource: string | undefined,
	oldRange: vscode.Range | undefined,
	newSource: string | undefined,
	newRange: vscode.Range | undefined,
	options: FunctionDiffOptions,
	kind: ChangedFunction['kind']
): DiffBlock[] {
	const oldFunction = getSourceLines(oldSource, oldRange);
	const newFunction = getSourceLines(newSource, newRange);
	const oldLines = oldFunction.lines;
	const newLines = newFunction.lines;
	const rawLines = buildDiffLines(oldLines, newLines, oldFunction.startLine, newFunction.startLine);
	const changedLineCount = rawLines.filter(line => line.type !== LineType.CONTEXT).length;
	const functionLineCount = Math.max(oldLines.length, newLines.length);
	const changePercentage = functionLineCount === 0
		? 0
		: changedLineCount / functionLineCount * 100;
	const showFullFunction = kind !== 'modified' ||
		functionLineCount <= options.fullFunctionLineThreshold ||
		changePercentage >= options.fullFunctionChangePercentage;

	return showFullFunction
		? [toDiffBlock(rawLines, oldFunction.startLine, newFunction.startLine)]
		: createContextBlocks(rawLines, options.contextLines, oldFunction.startLine, newFunction.startLine);
}

/**
 * @brief 根据 VS Code 符号范围提取源码行及其在文件中的起始行号。
 * @param source 文件源码；不存在时按空源码处理。
 * @param range 函数在源码中的范围；不存在时提取结果为空。
 * @returns 函数源码行和从 1 开始的文件行号。
 */
function getSourceLines(
	source: string | undefined,
	range: vscode.Range | undefined
): { lines: string[]; startLine: number } {
	if (source === undefined || range === undefined) {
		return { lines: [], startLine: 0 };
	}
	const lines = source.split(/\r?\n/).slice(
		range.start.line,
		range.end.line + (range.end.character > 0 ? 1 : 0)
	);
	return { lines, startLine: range.start.line + 1 };
}

/**
 * @brief 根据行数组差异生成带新旧文件行号的 diff2html 行记录。
 * @param oldLines 旧版函数源码行。
 * @param newLines 新版函数源码行。
 * @param oldStartLine 旧版函数在文件中的起始行号。
 * @param newStartLine 新版函数在文件中的起始行号。
 * @returns 包含上下文、删除和插入行的差异记录。
 */
function buildDiffLines(
	oldLines: string[],
	newLines: string[],
	oldStartLine: number,
	newStartLine: number
): DiffLine[] {
	const lines: DiffLine[] = [];
	let oldNumber = oldStartLine;
	let newNumber = newStartLine;

	for (const part of diffArrays(oldLines, newLines)) {
		for (const content of part.value) {
			if (part.added) {
				lines.push({ type: LineType.INSERT, oldNumber: undefined, newNumber: newNumber++, content });
			} else if (part.removed) {
				lines.push({ type: LineType.DELETE, oldNumber: oldNumber++, newNumber: undefined, content });
			} else {
				lines.push({ type: LineType.CONTEXT, oldNumber: oldNumber++, newNumber: newNumber++, content });
			}
		}
	}
	return lines;
}

/**
 * @brief 将完整差异行序列包装为一个 diff2html 差异块。
 * @param lines 差异行。
 * @param oldStartLine 旧版起始行号。
 * @param newStartLine 新版起始行号。
 * @returns 单个差异块。
 */
function toDiffBlock(lines: DiffLine[], oldStartLine: number, newStartLine: number): DiffBlock {
	return {
		oldStartLine,
		newStartLine,
		header: '',
		lines
	};
}

/**
 * @brief 保留变更行及其前后指定数量的上下文行，并按不连续区间拆分差异块。
 * @param lines 完整函数差异行。
 * @param contextLines 每侧保留的上下文行数。
 * @param oldStartLine 旧版函数起始行号。
 * @param newStartLine 新版函数起始行号。
 * @returns 一个或多个仅包含变更区间的差异块。
 */
function createContextBlocks(
	lines: DiffLine[],
	contextLines: number,
	oldStartLine: number,
	newStartLine: number
): DiffBlock[] {
	const changedIndices = lines
		.map((line, index) => line.type === LineType.CONTEXT ? -1 : index)
		.filter(index => index >= 0);
	if (changedIndices.length === 0) {
		return [];
	}

	const ranges: Array<{ start: number; end: number }> = [];
	for (const index of changedIndices) {
		const start = Math.max(0, index - contextLines);
		const end = Math.min(lines.length - 1, index + contextLines);
		const previous = ranges[ranges.length - 1];
		if (previous && start <= previous.end + 1) {
			previous.end = Math.max(previous.end, end);
		} else {
			ranges.push({ start, end });
		}
	}

	return ranges.map(range => {
		let oldLine = oldStartLine;
		let newLine = newStartLine;
		for (let index = 0; index < range.start; index++) {
			if (lines[index].type !== LineType.INSERT) {
				oldLine++;
			}
			if (lines[index].type !== LineType.DELETE) {
				newLine++;
			}
		}
		return toDiffBlock(lines.slice(range.start, range.end + 1), oldLine, newLine);
	});
}

/**
 * @brief 从文件差异中提取不属于任何函数范围的变更行。
 * @param blocks 文件原始差异块。
 * @param oldSymbols 旧版文件中的全部函数符号。
 * @param newSymbols 新版文件中的全部函数符号。
 * @param contextLines 非函数差异前后保留的上下文行数。
 * @returns 仅包含函数外变更及上下文的差异块。
 */
function createNonFunctionDiffBlocks(
	blocks: DiffBlock[],
	oldSymbols: SourceSymbol[],
	newSymbols: SourceSymbol[],
	contextLines: number
): DiffBlock[] {
	const result: DiffBlock[] = [];

	for (const block of blocks) {
		const changedIndices = block.lines
			.map((line, index) => {
				if (line.type === LineType.DELETE &&
					!isLineInSymbols(oldSymbols, line.oldNumber)) {
					return index;
				}
				if (line.type === LineType.INSERT &&
					!isLineInSymbols(newSymbols, line.newNumber)) {
					return index;
				}
				return -1;
			})
			.filter(index => index >= 0);

		const ranges: Array<{ start: number; end: number }> = [];
		for (const index of changedIndices) {
			let start = index;
			let end = index;
			for (let count = 0; count < contextLines && start > 0; count++) {
				if (block.lines[start - 1].type !== LineType.CONTEXT) {
					break;
				}
				start--;
			}
			for (let count = 0; count < contextLines && end + 1 < block.lines.length; count++) {
				if (block.lines[end + 1].type !== LineType.CONTEXT) {
					break;
				}
				end++;
			}

			const previous = ranges[ranges.length - 1];
			if (previous && start <= previous.end + 1) {
				previous.end = Math.max(previous.end, end);
			} else {
				ranges.push({ start, end });
			}
		}

		for (const range of ranges) {
			let oldStartLine = block.oldStartLine;
			let newStartLine = block.newStartLine;
			for (let index = 0; index < range.start; index++) {
				const line = block.lines[index];
				if (line.type !== LineType.INSERT) {
					oldStartLine++;
				}
				if (line.type !== LineType.DELETE) {
					newStartLine++;
				}
			}
			result.push({
				oldStartLine,
				newStartLine,
				header: block.header,
				lines: block.lines.slice(range.start, range.end + 1)
			});
		}
	}

	return result;
}

/**
 * @brief 判断给定文件行号是否位于任一函数符号范围内。
 * @param symbols 文件中的函数符号。
 * @param oneBasedLine 从 1 开始的文件行号。
 * @returns 行号属于某个函数时返回 true。
 */
function isLineInSymbols(symbols: SourceSymbol[], oneBasedLine: number): boolean {
	return symbols.some(symbol => rangeContainsLine(symbol.range, oneBasedLine));
}

/**
 * @brief 读取函数差异展示相关的 VS Code 插件配置。
 * @returns 校验过非负数范围的完整函数阈值、变更比例和上下文行数。
 */
function getFunctionDiffOptions(): FunctionDiffOptions {
	const configuration = vscode.workspace.getConfiguration('diff2html-report');
	return {
		fullFunctionLineThreshold: Math.max(0, configuration.get<number>(
			'functionDiffLineThreshold',
			defaultFunctionDiffOptions.fullFunctionLineThreshold
		)),
		fullFunctionChangePercentage: Math.min(100, Math.max(0, configuration.get<number>(
			'functionDiffChangePercentage',
			defaultFunctionDiffOptions.fullFunctionChangePercentage
		))),
		contextLines: Math.max(0, configuration.get<number>(
			'functionDiffContextLines',
			defaultFunctionDiffOptions.contextLines
		))
	};
}

/**
 * @brief 判断符号范围是否覆盖差异块中指定类型的变更行。
 * @param range VS Code 符号范围。
 * @param startLine 差异块在对应版本中的起始行号。
 * @param lines 差异块行列表。
 * @param type 要检查的插入或删除类型。
 * @returns 范围覆盖任一变更行或适用的差异块起始行时返回 true。
 */
function intersectsBlock(
	range: vscode.Range,
	startLine: number,
	lines: DiffFile['blocks'][number]['lines'],
	type: 'insert' | 'delete'
): boolean {
	// 仅提取当前版本对应的行号；当该类型没有显式变更行时，回退检查块起始行。
	const changedLines = lines
		.filter(line => line.type === type)
		.map(line => type === 'insert' ? line.newNumber : line.oldNumber)
		.filter((line): line is number => line !== undefined);
	return changedLines.some(line => rangeContainsLine(range, line)) ||
		(changedLines.length === 0 && rangeContainsLine(range, startLine));
}

/**
 * @brief 判断符号范围是否覆盖给定行号集合中的任意一行。
 * @param range VS Code 符号范围。
 * @param lines 从 1 开始的行号集合。
 * @returns 存在相交行时返回 true。
 */
function intersectsLines(range: vscode.Range, lines: Set<number>): boolean {
	for (const line of lines) {
		if (rangeContainsLine(range, line)) {
			return true;
		}
	}
	return false;
}

/**
 * @brief 判断 VS Code 的 0-based 范围是否包含指定的 1-based 行号。
 * @param range VS Code 符号范围。
 * @param oneBasedLine 从 1 开始的待检查行号。
 * @returns 行号位于范围内时返回 true。
 */
function rangeContainsLine(range: vscode.Range, oneBasedLine: number): boolean {
	// Range 的结束位置不包含在内；若结束行有字符范围，则该行仍属于符号范围。
	const line = oneBasedLine - 1;
	return line >= range.start.line &&
		(line < range.end.line || (line === range.end.line && range.end.character > 0));
}

/**
 * @brief 计算两个符号起始行之间的距离。
 * @param left 第一个符号范围。
 * @param right 第二个符号范围。
 * @returns 两个起始行的绝对行距。
 */
function lineDistance(left: vscode.Range, right: vscode.Range): number {
	return Math.abs(left.start.line - right.start.line);
}

/**
 * @brief 将分支名、标签或提交哈希解析为提交哈希。
 * @param repositoryPath Git 仓库根目录。
 * @param revision 待解析的版本引用。
 * @returns 可供 git show 使用的提交哈希。
 */
async function resolveRevision(repositoryPath: string, revision: string): Promise<string> {
	const { stdout } = await execCmdAsync(repositoryPath, 'git', [
		'rev-parse',
		'--verify',
		'--end-of-options',
		`${revision}^{commit}`
	], 'utf8');
	return stdout.trim();
}

/**
 * @brief 从指定提交或 Git 暂存区读取文件内容。
 * @param repositoryPath Git 仓库根目录。
 * @param revision 已解析的提交哈希；读取暂存区时不需要。
 * @param filePath 仓库中的文件路径。
 * @param staged 是否从暂存区读取文件。
 * @returns 文件源码文本。
 */
async function readSource(
	repositoryPath: string,
	revision: string | undefined,
	filePath: string,
	staged: boolean,
): Promise<string> {
	// git show 的 :path 语法读取暂存区；revision:path 语法读取指定提交中的文件。
	const object = staged ? `:${filePath}` : `${revision}:${filePath}`;
	const { stdout } = await execCmdAsync(repositoryPath, 'git', ['show', object]);
	return stdout;
}
