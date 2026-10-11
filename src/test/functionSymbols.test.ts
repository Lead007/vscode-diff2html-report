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
					const match = /function\s+(\w+)/.exec(text);
					if (!match) {
						return [];
					}
					const start = document.positionAt(match.index);
					const end = document.positionAt(text.length);
					const range = new vscode.Range(start, end);
					return [new vscode.DocumentSymbol(
						match[1],
						'',
						vscode.SymbolKind.Function,
						range,
						new vscode.Range(start, start.translate(0, match[0].length))
					)];
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
		assert.ok(files[0].functions[0].oldCode?.includes('oldName'));
		assert.ok(files[0].functions[0].newCode?.includes('newName'));
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

	async function runGit(args: string[]): Promise<string> {
		const { stdout } = await execFileAsync('git', args, { cwd: repositoryPath, encoding: 'utf8' });
		return stdout;
	}
});
