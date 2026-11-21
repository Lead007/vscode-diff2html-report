/// <reference types="mocha" />

import * as assert from 'assert';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import * as diff2html from 'diff2html';
import { findChangedFunctions } from '../documentSymbols';

const execFileAsync = promisify(execFile);

suite('Changed function symbols', () => {
	let repositoryPath: string;
	let baseRevision: string;
	let currentRevision: string;
	let symbolProvider: vscode.Disposable;

	setup(async () => {
		repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), 'diff2html-symbol-test-'));
		await runGit(['init', '-q']);
		await runGit(['config', 'user.name', 'Test User']);
		await runGit(['config', 'user.email', 'test@example.invalid']);
		await runGit(['config', 'core.autocrlf', 'false']);
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), 'function oldName() {\n  return 1;\n}\n');
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', 'base']);
		baseRevision = (await runGit(['rev-parse', 'HEAD'])).trim();
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), 'function newName() {\n  return 2;\n}\n');
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', 'change']);
		currentRevision = (await runGit(['rev-parse', 'HEAD'])).trim();

		symbolProvider = vscode.languages.registerDocumentSymbolProvider(
			{ language: 'plaintext', scheme: 'file' },
			{
				provideDocumentSymbols(document) {
					const text = document.getText();
					const symbols: vscode.DocumentSymbol[] = [];
					const match = /function\s+(\w+)/.exec(text);
					if (match) {
						const start = document.positionAt(match.index);
						const closingBrace = text.indexOf('\n}', match.index);
						const end = document.positionAt(closingBrace >= 0 ? closingBrace + 2 : text.length);
						const range = new vscode.Range(start, end);
						symbols.push(new vscode.DocumentSymbol(
							match[1],
							'',
							vscode.SymbolKind.Function,
							range,
							new vscode.Range(start, start.translate(0, match[0].length))
						));
					}
					const classMatch = /class\s+(\w+)/.exec(text);
					if (classMatch) {
						const start = document.positionAt(classMatch.index);
						const closingBrace = text.indexOf('\n}', classMatch.index);
						const end = document.positionAt(closingBrace >= 0 ? closingBrace + 2 : text.length);
						const range = new vscode.Range(start, end);
						symbols.push(new vscode.DocumentSymbol(
							classMatch[1],
							'',
							vscode.SymbolKind.Class,
							range,
							new vscode.Range(start, start.translate(0, classMatch[0].length))
						));
					}
					return symbols;
				}
			}
		);
	});

	teardown(async () => {
		symbolProvider.dispose();
		await fs.rm(repositoryPath, { recursive: true, force: true });
	});

	test('uses VS Code document symbols to match changed functions across revisions', async () => {
		const { stdout: diff } = await execFileAsync('git', ['diff', baseRevision, currentRevision], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const files = await findChangedFunctions(
			repositoryPath,
			diff2html.parse(diff),
			baseRevision,
			currentRevision,
		);

		assert.strictEqual(files.length, 1);
		assert.strictEqual(files[0].path, 'sample.txt');
		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['newName', 'modified']]
		);
		assert.strictEqual(files[0].functions[0].symbolKind, vscode.SymbolKind.Function);
		const diffLines = files[0].functions[0].diffBlocks.flatMap(block => block.lines);
		assert.ok(diffLines.some(line => line.type === 'delete' && line.content.includes('oldName')));
		assert.ok(diffLines.some(line => line.type === 'insert' && line.content.includes('newName')));
	});

	test('reports a changed parent function instead of its changed nested function', async () => {
		symbolProvider.dispose();
		symbolProvider = vscode.languages.registerDocumentSymbolProvider(
			{ language: 'plaintext', scheme: 'file' },
			{
				provideDocumentSymbols(document) {
					const text = document.getText();
					const outerIndex = text.indexOf('function outer');
					const innerIndex = text.indexOf('function inner');
					if (outerIndex < 0 || innerIndex < 0) {
						return [];
					}

					const outerEnd = text.lastIndexOf('}') + 1;
					const innerClosingBrace = text.indexOf('\n  }', innerIndex);
					const innerEnd = innerClosingBrace < 0 ? text.length : innerClosingBrace + 4;
					const outerRange = new vscode.Range(
						document.positionAt(outerIndex),
						document.positionAt(outerEnd)
					);
					const innerRange = new vscode.Range(
						document.positionAt(innerIndex),
						document.positionAt(innerEnd)
					);
					const outer = new vscode.DocumentSymbol(
						'outer',
						'',
						vscode.SymbolKind.Function,
						outerRange,
						new vscode.Range(
							document.positionAt(outerIndex),
							document.positionAt(outerIndex + 'function outer'.length)
						)
					);
					outer.children.push(new vscode.DocumentSymbol(
						'inner',
						'',
						vscode.SymbolKind.Function,
						innerRange,
						new vscode.Range(
							document.positionAt(innerIndex),
							document.positionAt(innerIndex + 'function inner'.length)
						)
					));
					return [outer];
				}
			}
		);

		const originalSource = [
			'function outer() {',
			'  function inner() {',
			'    return 1;',
			'  }',
			'  return inner();',
			'}',
			''
		].join('\n');
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), originalSource);
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', 'nested function base']);
		const nestedBaseRevision = (await runGit(['rev-parse', 'HEAD'])).trim();

		await fs.writeFile(
			path.join(repositoryPath, 'sample.txt'),
			originalSource.replace('return 1;', 'return 2;')
		);
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', 'change nested function']);
		const nestedCurrentRevision = (await runGit(['rev-parse', 'HEAD'])).trim();
		const { stdout: diff } = await execFileAsync('git', ['diff', nestedBaseRevision, nestedCurrentRevision], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const files = await findChangedFunctions(
			repositoryPath,
			diff2html.parse(diff),
			nestedBaseRevision,
			nestedCurrentRevision,
		);

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['outer', 'modified']]
		);
	});

	test('analyzes files concurrently while preserving input order and reporting completed progress', async () => {
		await fs.writeFile(path.join(repositoryPath, 'second.txt'), 'function second() {\n  return 1;\n}\n');
		await runGit(['add', 'second.txt']);
		await runGit(['commit', '-qm', 'add second file']);
		const multiFileRevision = (await runGit(['rev-parse', 'HEAD'])).trim();
		const { stdout: diff } = await execFileAsync('git', ['diff', baseRevision, multiFileRevision], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const diffFiles = diff2html.parse(diff).reverse();
		const inputPaths = diffFiles.map(file => file.newName || file.oldName);
		const progress: Array<{ current: number; filePath: string }> = [];
		const results = await findChangedFunctions(
			repositoryPath,
			diffFiles,
			baseRevision,
			multiFileRevision,
			(current, _total, filePath) => progress.push({ current, filePath }),
		);

		assert.deepStrictEqual(results.map(file => file.path), inputPaths);
		assert.deepStrictEqual(progress.map(item => item.current), [1, 2]);
		assert.deepStrictEqual(progress.map(item => item.filePath).sort(), [...inputPaths].sort());
	});

	test('includes configured document symbol kinds in function-level changes', async () => {
		const configuration = vscode.workspace.getConfiguration('diff2html-report');
		const previousGlobalValue = configuration.inspect<string[]>('symbolDiffSymbolKinds')?.globalValue;
		await configuration.update('symbolDiffSymbolKinds', ['Class'], vscode.ConfigurationTarget.Global);
		try {
			await fs.writeFile(
				path.join(repositoryPath, 'sample.txt'),
				'class Example {\n  value = 1;\n}\n'
			);
			await runGit(['add', 'sample.txt']);
			await runGit(['commit', '-qm', 'class base']);
			const classBaseRevision = (await runGit(['rev-parse', 'HEAD'])).trim();

			await fs.writeFile(
				path.join(repositoryPath, 'sample.txt'),
				'class Example {\n  value = 2;\n}\n'
			);
			await runGit(['add', 'sample.txt']);
			await runGit(['commit', '-qm', 'change class']);
			const classCurrentRevision = (await runGit(['rev-parse', 'HEAD'])).trim();
			const { stdout: diff } = await execFileAsync('git', ['diff', classBaseRevision, classCurrentRevision], {
				cwd: repositoryPath,
				encoding: 'utf8'
			});
			const files = await findChangedFunctions(
				repositoryPath,
				diff2html.parse(diff),
				classBaseRevision,
				classCurrentRevision,
			);

			assert.deepStrictEqual(
				files[0].functions.map(fn => [fn.name, fn.kind]),
				[['Example', 'modified']]
			);
			assert.strictEqual(files[0].functions[0].symbolKind, vscode.SymbolKind.Class);
		} finally {
			await configuration.update('symbolDiffSymbolKinds', previousGlobalValue, vscode.ConfigurationTarget.Global);
		}
	});

	test('associates an insertion-only hunk with the containing function on both revisions', async () => {
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), 'function newName() {\n  return 2;\n  log();\n}\n');
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', 'insert in function']);
		const insertedRevision = (await runGit(['rev-parse', 'HEAD'])).trim();
		const { stdout: diff } = await execFileAsync('git', ['diff', currentRevision, insertedRevision], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const files = await findChangedFunctions(
			repositoryPath,
			diff2html.parse(diff),
			currentRevision,
			insertedRevision,
		);

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['newName', 'modified']]
		);
	});

	test('reports a deletion-only edit inside its containing function', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource(
			'function target() {\n  obsolete();\n}\n',
			'deletion-only base'
		);
		const current = await commitSource(
			'function target() {\n}\n',
			'deletion-only change'
		);
		const files = await analyzeDiff(base, current);
		const changedFunction = files[0].functions[0];
		const lines = changedFunction.diffBlocks.flatMap(block => block.lines);

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['target', 'modified']]
		);
		assert.ok(lines.some(line => line.type === 'delete' && line.content.includes('obsolete')));
		assert.ok(!lines.some(line => line.type === 'insert'));
	});

	test('does not pair a function inserted at the start with one deleted at the end', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource([
			'function first() {',
			'  return 1;',
			'}',
			'function tail() {',
			'  return 2;',
			'}',
			''
		].join('\n'), 'boundary base');
		const current = await commitSource([
			'function inserted() {',
			'  return 3;',
			'}',
			'function first() {',
			'  return 1;',
			'}',
			''
		].join('\n'), 'boundary changes');
		const files = await analyzeDiff(base, current);

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['inserted', 'added'], ['tail', 'deleted']]
		);
	});

	test('keeps duplicate-name function changes assigned to the correct occurrence', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource([
			'function duplicate() {',
			'  return 1;',
			'}',
			'function duplicate() {',
			'  return 1;',
			'}',
			''
		].join('\n'), 'duplicate names base');
		const current = await commitSource([
			'function duplicate() {',
			'  return 1;',
			'}',
			'function duplicate() {',
			'  return 2;',
			'}',
			''
		].join('\n'), 'duplicate names change');
		const files = await analyzeDiff(base, current);

		assert.strictEqual(files[0].functions.length, 1);
		assert.strictEqual(files[0].functions[0].name, 'duplicate');
		assert.strictEqual(files[0].functions[0].oldRange?.start.line, 3);
		assert.strictEqual(files[0].functions[0].newRange?.start.line, 3);
	});

	test('reports deletion of one duplicate-name function as a deletion', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource([
			'function duplicate() {',
			'  return 1;',
			'}',
			'function duplicate() {',
			'  return 1;',
			'}',
			''
		].join('\n'), 'duplicate deletion base');
		const current = await commitSource(
			'function duplicate() {\n  return 1;\n}\n',
			'duplicate deletion'
		);
		const files = await analyzeDiff(base, current);

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['duplicate', 'deleted']]
		);
		assert.strictEqual(files[0].functions[0].oldRange?.start.line, 3);
	});

	test('does not pair unrelated functions when a hunk spans multiple function changes', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource([
			'function obsoleteFirst() {',
			'  firstBody();',
			'}',
			'function obsoleteSecond() {',
			'  secondBody();',
			'}',
			''
		].join('\n'), 'multiple removals base');
		const current = await commitSource(
			'function replacement() {\n  replacementBody();\n}\n',
			'multiple changes'
		);
		const files = await analyzeDiff(base, current);
		const changes = files[0].functions
			.map(fn => [fn.name, fn.kind])
			.sort(([leftName], [rightName]) => leftName.localeCompare(rightName));

		assert.deepStrictEqual(
			changes,
			[['obsoleteFirst', 'deleted'], ['obsoleteSecond', 'deleted'], ['replacement', 'added']]
		);
	});

	test('returns file-level changes outside function ranges separately', async () => {
		await fs.writeFile(
			path.join(repositoryPath, 'sample.txt'),
			'const setting = true;\nfunction newName() {\n  return 3;\n}\n'
		);
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', 'change file-level setting']);
		const changedRevision = (await runGit(['rev-parse', 'HEAD'])).trim();
		const { stdout: diff } = await execFileAsync('git', ['diff', baseRevision, changedRevision], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const files = await findChangedFunctions(
			repositoryPath,
			diff2html.parse(diff),
			baseRevision,
			changedRevision,
		);

		assert.ok(files[0].functions.length > 0);
		const fileLevelLines = files[0].nonFunctionDiffBlocks.flatMap(block => block.lines);
		assert.ok(fileLevelLines.some(line =>
			line.type === 'insert' && line.content.includes('const setting = true;')
		));
		assert.ok(!fileLevelLines.some(line => /function (oldName|newName)/.test(line.content)));
	});

	test('keeps only changed lines and configured context for small edits in long functions', async () => {
		const originalLines = [
			'function newName() {',
			...Array.from({ length: 38 }, (_, index) => `  line${index}();`),
			'}'
		];
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), `${originalLines.join('\n')}\n`);
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', 'long function base']);
		const longBaseRevision = (await runGit(['rev-parse', 'HEAD'])).trim();

		const changedLines = [...originalLines];
		changedLines[20] = '  changedLine();';
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), `${changedLines.join('\n')}\n`);
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', 'small long-function edit']);
		const longCurrentRevision = (await runGit(['rev-parse', 'HEAD'])).trim();
		const { stdout: diff } = await execFileAsync('git', ['diff', longBaseRevision, longCurrentRevision], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const files = await findChangedFunctions(
			repositoryPath,
			diff2html.parse(diff),
			longBaseRevision,
			longCurrentRevision,
		);

		assert.strictEqual(files[0].functions.length, 1);
		assert.strictEqual(files[0].functions[0].diffBlocks.length, 1);
		const diffLines = files[0].functions[0].diffBlocks[0].lines;
		assert.strictEqual(diffLines.length, 8);
		assert.ok(diffLines.some(line => line.type === 'insert' && line.content === '  changedLine();'));
		assert.ok(!diffLines.some(line => line.content === '  line0();'));
		assert.ok(!diffLines.some(line => line.content === '  line37();'));
	});

	test('keeps the full function when a large portion of a long function changes', async () => {
		const originalLines = [
			'function newName() {',
			...Array.from({ length: 38 }, (_, index) => `  line${index}();`),
			'}'
		];
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), `${originalLines.join('\n')}\n`);
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', 'large-change function base']);
		const largeBaseRevision = (await runGit(['rev-parse', 'HEAD'])).trim();

		const changedLines = [...originalLines];
		for (let index = 1; index <= 15; index++) {
			changedLines[index] = `  changedLine${index}();`;
		}
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), `${changedLines.join('\n')}\n`);
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', 'large long-function edit']);
		const largeCurrentRevision = (await runGit(['rev-parse', 'HEAD'])).trim();
		const { stdout: diff } = await execFileAsync('git', ['diff', largeBaseRevision, largeCurrentRevision], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const files = await findChangedFunctions(
			repositoryPath,
			diff2html.parse(diff),
			largeBaseRevision,
			largeCurrentRevision,
		);

		assert.strictEqual(files[0].functions.length, 1);
		assert.strictEqual(files[0].functions[0].diffBlocks.length, 1);
		const diffLines = files[0].functions[0].diffBlocks[0].lines;
		assert.ok(diffLines.some(line => line.content === '  line37();'));
		assert.ok(diffLines.some(line => line.content === '  changedLine15();'));
	});

	test('keeps one modified entry when two distant hunks touch the same function', async () => {
		registerAllFunctionSymbols();
		const baseLines = [
			'function target() {',
			...Array.from({ length: 40 }, (_, index) => `  line${index}();`),
			'}'
		];
		const base = await commitSource(`${baseLines.join('\n')}\n`, 'multi-hunk base');
		const changedLines = [...baseLines];
		changedLines[1] = '  changedA();';
		changedLines[32] = '  changedB();';
		const current = await commitSource(`${changedLines.join('\n')}\n`, 'multi-hunk change');
		const files = await analyzeDiff(base, current);

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['target', 'modified']]
		);
		assert.strictEqual(files[0].functions[0].diffBlocks.length, 2);
		const diffLines = files[0].functions[0].diffBlocks.flatMap(block => block.lines);
		assert.ok(diffLines.some(line => line.content === '  changedA();'));
		assert.ok(diffLines.some(line => line.content === '  changedB();'));
	});

	test('reports functions in a newly added file as added', async () => {
		registerAllFunctionSymbols();
		const base = (await runGit(['rev-parse', 'HEAD'])).trim();
		await fs.writeFile(
			path.join(repositoryPath, 'added.txt'),
			'const top = 1;\nfunction added() {\n  return 1;\n}\n'
		);
		await runGit(['add', 'added.txt']);
		await runGit(['commit', '-qm', 'add file']);
		const current = (await runGit(['rev-parse', 'HEAD'])).trim();
		const files = await analyzeDiff(base, current);

		assert.strictEqual(files.length, 1);
		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['added', 'added']]
		);
		const fileLevelLines = files[0].nonFunctionDiffBlocks.flatMap(block => block.lines);
		assert.ok(fileLevelLines.some(line =>
			line.type === 'insert' && line.content.includes('const top = 1;')
		));
	});

	test('reports functions in a deleted file as deleted', async () => {
		registerAllFunctionSymbols();
		await fs.writeFile(path.join(repositoryPath, 'gone.txt'), 'function gone() {\n  return 1;\n}\n');
		await runGit(['add', 'gone.txt']);
		await runGit(['commit', '-qm', 'add gone file']);
		const base = (await runGit(['rev-parse', 'HEAD'])).trim();
		await fs.rm(path.join(repositoryPath, 'gone.txt'));
		await runGit(['add', '-A']);
		await runGit(['commit', '-qm', 'delete gone file']);
		const current = (await runGit(['rev-parse', 'HEAD'])).trim();
		const files = await analyzeDiff(base, current);

		assert.strictEqual(files.length, 1);
		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['gone', 'deleted']]
		);
	});

	test('reports a signature-only change as modified', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource(
			'function target(a) {\n  return a;\n}\n',
			'signature base'
		);
		const current = await commitSource(
			'function target(a, b) {\n  return a;\n}\n',
			'signature change'
		);
		const files = await analyzeDiff(base, current);

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['target', 'modified']]
		);
		const diffLines = files[0].functions[0].diffBlocks.flatMap(block => block.lines);
		assert.ok(diffLines.some(line => line.type === 'delete' && line.content.includes('target(a)')));
		assert.ok(diffLines.some(line => line.type === 'insert' && line.content.includes('target(a, b)')));
	});

	test('pairs a one-line function rename as modified', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource('function a() { return 1; }\n', 'one-line rename base');
		const current = await commitSource('function b() { return 1; }\n', 'one-line rename change');
		const files = await analyzeDiff(base, current);

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['b', 'modified']]
		);
	});

	test('stays conservative when a rename shares one change group with another edit', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource(
			'function a() { x(); }\nfunction b() { y(); }\n',
			'rename plus edit base'
		);
		const current = await commitSource(
			'function a() { z(); }\nfunction c() { y(); }\n',
			'rename plus edit change'
		);
		const files = await analyzeDiff(base, current);
		const changes = files[0].functions
			.map(fn => [fn.name, fn.kind])
			.sort(([leftName], [rightName]) => leftName.localeCompare(rightName));

		assert.deepStrictEqual(
			changes,
			[['a', 'modified'], ['b', 'deleted'], ['c', 'added']]
		);
	});

	test('falls back to file-level changes without a symbol provider', async () => {
		symbolProvider.dispose();
		const base = await commitSource('function f() {\n  return 1;\n}\n', 'no provider base');
		const current = await commitSource('function f() {\n  return 2;\n}\n', 'no provider change');
		const files = await analyzeDiff(base, current);

		assert.strictEqual(files[0].functions.length, 0);
		assert.strictEqual(files[0].symbolProviderAvailable, false);
		const fileLevelLines = files[0].nonFunctionDiffBlocks.flatMap(block => block.lines);
		assert.ok(fileLevelLines.some(line =>
			line.type === 'insert' && line.content.includes('return 2;')
		));
	});

	test('identifies a moved function through the anchor fallback', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource(
			'function a() {\n  return 1;\n}\nfunction b() {\n  return 2;\n}\n',
			'move base'
		);
		const current = await commitSource(
			'function b() {\n  return 2;\n}\nfunction a() {\n  return 1;\n}\n',
			'move change'
		);
		const files = await analyzeDiff(base, current);

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['a', 'modified']]
		);
	});

	test('analyzes a renamed file using both old and new paths', async () => {
		registerAllFunctionSymbols();
		const originalLines = [
			'function renamed() {',
			...Array.from({ length: 8 }, (_, index) => `  line${index}();`),
			'}'
		];
		await fs.writeFile(path.join(repositoryPath, 'oldname.txt'), `${originalLines.join('\n')}\n`);
		await runGit(['add', 'oldname.txt']);
		await runGit(['commit', '-qm', 'rename base']);
		const base = (await runGit(['rev-parse', 'HEAD'])).trim();

		await runGit(['mv', 'oldname.txt', 'newname.txt']);
		const changedLines = [...originalLines];
		changedLines[4] = '  changed();';
		await fs.writeFile(path.join(repositoryPath, 'newname.txt'), `${changedLines.join('\n')}\n`);
		await runGit(['add', '-A']);
		await runGit(['commit', '-qm', 'rename change']);
		const current = (await runGit(['rev-parse', 'HEAD'])).trim();
		const { stdout: diff } = await execFileAsync('git', ['diff', '-M', base, current], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const files = await findChangedFunctions(repositoryPath, diff2html.parse(diff), base, current);

		assert.strictEqual(files.length, 1);
		assert.strictEqual(files[0].path, 'newname.txt');
		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['renamed', 'modified']]
		);
	});

	test('reads new content from the index in staged mode', async () => {
		registerAllFunctionSymbols();
		const base = (await runGit(['rev-parse', 'HEAD'])).trim();
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), 'function newName() {\n  return 7;\n}\n');
		await runGit(['add', 'sample.txt']);
		const { stdout: diff } = await execFileAsync('git', ['diff', '--cached'], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const files = await findChangedFunctions(repositoryPath, diff2html.parse(diff), base, '--staged');

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['newName', 'modified']]
		);
		const diffLines = files[0].functions[0].diffBlocks.flatMap(block => block.lines);
		assert.ok(diffLines.some(line => line.type === 'insert' && line.content.includes('return 7;')));
	});

	test('skips binary files with a skip reason', async () => {
		const { stdout: diff } = await execFileAsync('git', ['diff', baseRevision, currentRevision], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const diffFiles = diff2html.parse(diff);
		diffFiles[0].isBinary = true;
		const files = await findChangedFunctions(repositoryPath, diffFiles, baseRevision, currentRevision);

		assert.strictEqual(files[0].skipReason, 'binary');
		assert.strictEqual(files[0].symbolProviderAvailable, false);
		assert.deepStrictEqual(files[0].functions, []);
		assert.deepStrictEqual(files[0].nonFunctionDiffBlocks, []);
	});

	test('skips oversized files with a skip reason', async () => {
		const { stdout: diff } = await execFileAsync('git', ['diff', baseRevision, currentRevision], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const diffFiles = diff2html.parse(diff);
		diffFiles[0].isTooBig = true;
		const files = await findChangedFunctions(repositoryPath, diffFiles, baseRevision, currentRevision);

		assert.strictEqual(files[0].skipReason, 'tooBig');
		assert.strictEqual(files[0].symbolProviderAvailable, false);
		assert.deepStrictEqual(files[0].functions, []);
	});

	test('reports all changes as file-level when no function symbol kinds are configured', async () => {
		const configuration = vscode.workspace.getConfiguration('diff2html-report');
		const previousGlobalValue = configuration.inspect<string[]>('symbolDiffSymbolKinds')?.globalValue;
		await configuration.update('symbolDiffSymbolKinds', [], vscode.ConfigurationTarget.Global);
		try {
			const files = await analyzeDiff(baseRevision, currentRevision);

			assert.deepStrictEqual(files[0].functions, []);
			assert.strictEqual(files[0].symbolProviderAvailable, true);
			const fileLevelLines = files[0].nonFunctionDiffBlocks.flatMap(block => block.lines);
			assert.ok(fileLevelLines.some(line => line.content.includes('newName')));
		} finally {
			await configuration.update('symbolDiffSymbolKinds', previousGlobalValue, vscode.ConfigurationTarget.Global);
		}
	});

	test('assigns a change in the first duplicate-name function to that occurrence', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource([
			'function duplicate() {',
			'  return 1;',
			'}',
			'function duplicate() {',
			'  return 1;',
			'}',
			''
		].join('\n'), 'duplicate first base');
		const current = await commitSource([
			'function duplicate() {',
			'  return 9;',
			'}',
			'function duplicate() {',
			'  return 1;',
			'}',
			''
		].join('\n'), 'duplicate first change');
		const files = await analyzeDiff(base, current);

		assert.strictEqual(files[0].functions.length, 1);
		assert.strictEqual(files[0].functions[0].oldRange?.start.line, 0);
		assert.strictEqual(files[0].functions[0].newRange?.start.line, 0);
	});

	test('pairs multiple same-name changes inside one continuous change group', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource(
			'function a() { x(); }\nfunction b() { y(); }\n',
			'group base'
		);
		const current = await commitSource(
			'function a() { z(); }\nfunction b() { w(); }\n',
			'group change'
		);
		const files = await analyzeDiff(base, current);
		const changes = files[0].functions
			.map(fn => [fn.name, fn.kind])
			.sort(([leftName], [rightName]) => leftName.localeCompare(rightName));

		assert.deepStrictEqual(
			changes,
			[['a', 'modified'], ['b', 'modified']]
		);
	});

	test('isolates a file analysis error from the other files', async () => {
		registerAllFunctionSymbols();
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), 'function first() {\n  return 1;\n}\n');
		await fs.writeFile(path.join(repositoryPath, 'second.txt'), 'function second() {\n  return 1;\n}\n');
		await runGit(['add', '-A']);
		await runGit(['commit', '-qm', 'isolation base']);
		const base = (await runGit(['rev-parse', 'HEAD'])).trim();
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), 'function first() {\n  return 2;\n}\n');
		await fs.writeFile(path.join(repositoryPath, 'second.txt'), 'function second() {\n  return 2;\n}\n');
		await runGit(['add', '-A']);
		await runGit(['commit', '-qm', 'isolation change']);
		const current = (await runGit(['rev-parse', 'HEAD'])).trim();
		const { stdout: diff } = await execFileAsync('git', ['diff', base, current], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		const diffFiles = diff2html.parse(diff);
		const brokenFile = diffFiles.find(file => (file.newName || file.oldName) === 'second.txt');
		assert.ok(brokenFile);
		brokenFile.oldName = 'missing.txt';
		brokenFile.newName = 'missing.txt';
		const files = await findChangedFunctions(repositoryPath, diffFiles, base, current);
		const brokenResult = files.find(file => file.error !== undefined);
		const healthyResult = files.find(file => file.error === undefined);

		assert.ok(brokenResult);
		assert.ok(healthyResult);
		assert.strictEqual(healthyResult.path, 'sample.txt');
		assert.deepStrictEqual(
			healthyResult.functions.map(fn => [fn.name, fn.kind]),
			[['first', 'modified']]
		);
	});

	test('handles CRLF content and a missing trailing newline', async () => {
		registerAllFunctionSymbols();
		const base = await commitSource('function target() {\r\n  return 1;\r\n}', 'crlf base');
		const current = await commitSource('function target() {\r\n  return 2;\r\n}', 'crlf change');
		const files = await analyzeDiff(base, current);

		assert.deepStrictEqual(
			files[0].functions.map(fn => [fn.name, fn.kind]),
			[['target', 'modified']]
		);
	});

	async function runGit(args: string[]): Promise<string> {
		const { stdout } = await execFileAsync('git', args, { cwd: repositoryPath, encoding: 'utf8' });
		return stdout;
	}

	async function commitSource(source: string, message: string): Promise<string> {
		await fs.writeFile(path.join(repositoryPath, 'sample.txt'), source);
		await runGit(['add', 'sample.txt']);
		await runGit(['commit', '-qm', message]);
		return (await runGit(['rev-parse', 'HEAD'])).trim();
	}

	async function analyzeDiff(base: string, current: string) {
		const { stdout } = await execFileAsync('git', ['diff', base, current], {
			cwd: repositoryPath,
			encoding: 'utf8'
		});
		return findChangedFunctions(repositoryPath, diff2html.parse(stdout), base, current);
	}

	function registerAllFunctionSymbols(): void {
		symbolProvider.dispose();
		symbolProvider = vscode.languages.registerDocumentSymbolProvider(
			{ language: 'plaintext', scheme: 'file' },
			{
				provideDocumentSymbols(document) {
					const text = document.getText();
					const symbols: vscode.DocumentSymbol[] = [];
					const functionPattern = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
					let match: RegExpExecArray | null;
					while ((match = functionPattern.exec(text)) !== null) {
						const openingBrace = match.index + match[0].lastIndexOf('{');
						let depth = 0;
						let end = text.length;
						for (let index = openingBrace; index < text.length; index++) {
							if (text[index] === '{') {
								depth++;
							} else if (text[index] === '}' && --depth === 0) {
								end = index + 1;
								break;
							}
						}
						const startPosition = document.positionAt(match.index);
						const range = new vscode.Range(startPosition, document.positionAt(end));
						symbols.push(new vscode.DocumentSymbol(
							match[1],
							'',
							vscode.SymbolKind.Function,
							range,
							new vscode.Range(startPosition, document.positionAt(openingBrace))
						));
					}
					return symbols;
				}
			}
		);
	}
});
