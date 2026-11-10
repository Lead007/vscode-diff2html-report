/// <reference types="mocha" />

import * as assert from 'assert';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import * as diff2html from 'diff2html';
import { findChangedFunctions } from '../functionSymbols';

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
		const previousGlobalValue = configuration.inspect<string[]>('functionDiffSymbolKinds')?.globalValue;
		await configuration.update('functionDiffSymbolKinds', ['Class'], vscode.ConfigurationTarget.Global);
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
			await configuration.update('functionDiffSymbolKinds', previousGlobalValue, vscode.ConfigurationTarget.Global);
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

	async function runGit(args: string[]): Promise<string> {
		const { stdout } = await execFileAsync('git', args, { cwd: repositoryPath, encoding: 'utf8' });
		return stdout;
	}
});
