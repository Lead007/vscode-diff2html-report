import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import type { DiffFile } from 'diff2html/lib/types';
import { execCmdAsync } from './scmHelper';

export interface ChangedFunction {
	name: string;
	kind: 'added' | 'deleted' | 'modified';
	oldRange?: vscode.Range;
	newRange?: vscode.Range;
	oldCode?: string;
	newCode?: string;
}

export interface ChangedFileFunctions {
	path: string;
	functions: ChangedFunction[];
	symbolProviderAvailable: boolean;
	skipReason?: 'binary' | 'tooBig';
	error?: string;
}

interface SourceSymbol {
	name: string;
	range: vscode.Range;
}

interface SymbolResult {
	symbols: SourceSymbol[];
	available: boolean;
}

interface FileChanges {
	oldLines: Set<number>;
	newLines: Set<number>;
}

const functionKinds = new Set([
	vscode.SymbolKind.Function,
	vscode.SymbolKind.Method,
	vscode.SymbolKind.Constructor,
	vscode.SymbolKind.Operator
]);

export async function findChangedFunctions(
	repositoryPath: string,
	diffFiles: DiffFile[],
	baseRevision: string,
	currentRevision: string,
): Promise<ChangedFileFunctions[]> {
	const base = await resolveRevision(repositoryPath, baseRevision);
	const staged = currentRevision === '--staged';
	const current = staged ? undefined : await resolveRevision(repositoryPath, currentRevision);
	const results: ChangedFileFunctions[] = [];

	for (const file of diffFiles) {
		const oldPath = file.isNew ? undefined : file.oldName;
		const newPath = file.isDeleted ? undefined : file.newName;
		const displayPath = newPath || oldPath;
		if (!displayPath) {
			continue;
		}
		if (file.isBinary || file.isTooBig) {
			results.push({
				path: displayPath,
				functions: [],
				symbolProviderAvailable: false,
				skipReason: file.isBinary ? 'binary' : 'tooBig'
			});
			continue;
		}

		try {
			const changedLines = collectChangedLines(file);
			const oldSource = oldPath
				? await readSource(repositoryPath, base, oldPath, false)
				: undefined;
			const newSource = newPath
				? await readSource(repositoryPath, current, newPath, staged)
				: undefined;
			const oldResult = oldSource === undefined
				? { symbols: [], available: true }
				: await getDocumentSymbols(oldSource, oldPath!);
			const newResult = newSource === undefined
				? { symbols: [], available: true }
				: await getDocumentSymbols(newSource, newPath!);
			const oldSymbols = oldResult.symbols;
			const newSymbols = newResult.symbols;
			const changes = pairChangedSymbols(
				oldSymbols.filter(symbol => intersectsLines(symbol.range, changedLines.oldLines)),
				newSymbols.filter(symbol => intersectsLines(symbol.range, changedLines.newLines)),
				oldSymbols,
				newSymbols,
				file,
				oldSource,
				newSource
			);
			results.push({
				path: displayPath,
				functions: changes,
				symbolProviderAvailable: oldResult.available || newResult.available
			});
		} catch (error) {
			results.push({
				path: displayPath,
				functions: [],
				symbolProviderAvailable: false,
				error: String(error)
			});
		}
	}
	return results;
}

async function getDocumentSymbols(source: string, sourcePath: string): Promise<SymbolResult> {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'diff2html-symbol-'));
	const temporaryFile = path.join(directory, path.basename(sourcePath));
	try {
		await fs.writeFile(temporaryFile, source, 'utf8');
		const document = await vscode.workspace.openTextDocument(vscode.Uri.file(temporaryFile));
		const symbols = await vscode.commands.executeCommand<Array<vscode.DocumentSymbol | vscode.SymbolInformation>>(
			'vscode.executeDocumentSymbolProvider',
			document.uri
		);
		return {
			symbols: flattenSymbols(symbols || []),
			available: symbols !== undefined
		};
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
}

function flattenSymbols(symbols: Array<vscode.DocumentSymbol | vscode.SymbolInformation>): SourceSymbol[] {
	const result: SourceSymbol[] = [];
	const visit = (items: Array<vscode.DocumentSymbol | vscode.SymbolInformation>) => {
		for (const symbol of items) {
			if (symbol instanceof vscode.DocumentSymbol) {
				if (functionKinds.has(symbol.kind)) {
					result.push({ name: symbol.name, range: symbol.range });
				}
				visit(symbol.children);
			} else if (functionKinds.has(symbol.kind)) {
				result.push({ name: symbol.name, range: symbol.location.range });
			}
		}
	};
	visit(symbols);
	return result;
}

function collectChangedLines(file: DiffFile): FileChanges {
	const oldLines = new Set<number>();
	const newLines = new Set<number>();
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

function pairChangedSymbols(
	oldChanged: SourceSymbol[],
	newChanged: SourceSymbol[],
	oldAll: SourceSymbol[],
	newAll: SourceSymbol[],
	file: DiffFile,
	oldSource?: string,
	newSource?: string
): ChangedFunction[] {
	const oldMatches = new Set<SourceSymbol>();
	const newMatches = new Set<SourceSymbol>();
	const changes: ChangedFunction[] = [];

	const pair = (oldSymbol: SourceSymbol, newSymbol: SourceSymbol) => {
		if (oldMatches.has(oldSymbol) || newMatches.has(newSymbol)) {
			return;
		}
		oldMatches.add(oldSymbol);
		newMatches.add(newSymbol);
		changes.push({
			name: newSymbol.name,
			kind: 'modified',
			oldRange: oldSymbol.range,
			newRange: newSymbol.range,
			oldCode: getSourceRange(oldSource, oldSymbol.range),
			newCode: getSourceRange(newSource, newSymbol.range)
		});
	};

	for (const newSymbol of newChanged) {
		const oldSymbol = oldChanged
			.filter(candidate => !oldMatches.has(candidate) && candidate.name === newSymbol.name)
			.sort((left, right) => lineDistance(left.range, newSymbol.range) - lineDistance(right.range, newSymbol.range))[0];
		if (oldSymbol) {
			pair(oldSymbol, newSymbol);
		}
	}

	for (const block of file.blocks) {
		let oldHits = oldChanged.filter(symbol =>
			!oldMatches.has(symbol) && intersectsBlock(symbol.range, block.oldStartLine, block.lines, 'delete'));
		let newHits = newChanged.filter(symbol =>
			!newMatches.has(symbol) && intersectsBlock(symbol.range, block.newStartLine, block.lines, 'insert'));

		if (oldHits.length === 0 && newHits.length > 0) {
			const oldAnchor = oldAll.find(symbol =>
				!oldMatches.has(symbol) && rangeContainsLine(symbol.range, block.oldStartLine));
			if (oldAnchor) {
				oldHits = [oldAnchor];
			}
		}
		if (newHits.length === 0 && oldHits.length > 0) {
			const newAnchor = newAll.find(symbol =>
				!newMatches.has(symbol) && rangeContainsLine(symbol.range, block.newStartLine));
			if (newAnchor) {
				newHits = [newAnchor];
			}
		}

		while (oldHits.length && newHits.length) {
			const oldSymbol = oldHits.shift()!;
			const matchingName = newHits.findIndex(symbol => symbol.name === oldSymbol.name);
			const newSymbol = newHits.splice(matchingName >= 0 ? matchingName : 0, 1)[0];
			pair(oldSymbol, newSymbol);
		}
	}

	for (const oldSymbol of oldChanged) {
		if (oldMatches.has(oldSymbol)) {
			continue;
		}
		changes.push({
			name: oldSymbol.name,
			kind: 'deleted',
			oldRange: oldSymbol.range,
			oldCode: getSourceRange(oldSource, oldSymbol.range)
		});
	}

	for (const newSymbol of newChanged) {
		if (!newMatches.has(newSymbol)) {
			changes.push({
				name: newSymbol.name,
				kind: 'added',
				newRange: newSymbol.range,
				newCode: getSourceRange(newSource, newSymbol.range)
			});
		}
	}
	return changes.sort((left, right) =>
		(left.newRange?.start.line ?? left.oldRange?.start.line ?? 0) -
		(right.newRange?.start.line ?? right.oldRange?.start.line ?? 0));
}

function intersectsBlock(
	range: vscode.Range,
	startLine: number,
	lines: DiffFile['blocks'][number]['lines'],
	type: 'insert' | 'delete'
): boolean {
	const changedLines = lines
		.filter(line => line.type === type)
		.map(line => type === 'insert' ? line.newNumber : line.oldNumber)
		.filter((line): line is number => line !== undefined);
	return changedLines.some(line => rangeContainsLine(range, line)) ||
		(changedLines.length === 0 && rangeContainsLine(range, startLine));
}

function intersectsLines(range: vscode.Range, lines: Set<number>): boolean {
	for (const line of lines) {
		if (rangeContainsLine(range, line)) {
			return true;
		}
	}
	return false;
}

function rangeContainsLine(range: vscode.Range, oneBasedLine: number): boolean {
	const line = oneBasedLine - 1;
	return line >= range.start.line &&
		(line < range.end.line || (line === range.end.line && range.end.character > 0));
}

function lineDistance(left: vscode.Range, right: vscode.Range): number {
	return Math.abs(left.start.line - right.start.line);
}

function getSourceRange(source: string | undefined, range: vscode.Range): string | undefined {
	if (source === undefined) {
		return undefined;
	}
	return source.split(/\r?\n/).slice(range.start.line, range.end.line + (range.end.character > 0 ? 1 : 0)).join('\n');
}

async function resolveRevision(repositoryPath: string, revision: string): Promise<string> {
	const { stdout } = await execCmdAsync(repositoryPath, 'git', [
		'rev-parse',
		'--verify',
		'--end-of-options',
		`${revision}^{commit}`
	], 'utf8');
	return stdout.trim();
}

async function readSource(
	repositoryPath: string,
	revision: string | undefined,
	filePath: string,
	staged: boolean,
): Promise<string> {
	const object = staged ? `:${filePath}` : `${revision}:${filePath}`;
	const { stdout } = await execCmdAsync(repositoryPath, 'git', ['show', object]);
	return stdout;
}
