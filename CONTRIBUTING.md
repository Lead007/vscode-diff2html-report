# Contributing to Git Diff Report

Thanks for taking the time to contribute. This document covers how to set up the project, the conventions we follow, and the checklist for adding a user-facing feature.

## Ways to contribute

- **Bug reports** — use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).
- **Feature ideas** — open an issue first and describe the workflow you are trying to support. "I need to attach a change summary to a ticket" is more useful than "add a PDF button".
- **Documentation** — typos, unclear steps, and missing screenshots are all welcome as PRs.
- **Translations** — UI strings live in `package.nls.json` and `package.nls.zh-cn.json`.
- **Code** — see the checklist below before opening a pull request.

## Before you start

For anything larger than a typo or a one-line fix, **open an issue first**. It avoids the case where you spend a weekend on a feature that does not fit the roadmap.

Changes to symbol-level analysis should mention which language extension you tested with (e.g. `ms-vscode.cpptools`, `vscjava.vscode-java-pack`), because symbol detection depends entirely
on what that extension reports.

## Development setup

Requirements:

- Node.js 20 or newer
- npm
- Git
- VS Code 1.68.0 or newer

```
git clone https://github.com/Lead007/vscode-diff2html-report.git

cd vscode-diff2html-report

npm install

npm run build:debug
```

Then press `F5` in VS Code to launch the Extension Development Host. Open a Git repository in that window and run either report command from the Source Control view's repository title menu.

## Project layout

| Path | Contents |
|---|---|
| `src/` | Extension host code (TypeScript). Compiled with `tsc`, then bundled into `dist/` with esbuild. |
| `src/webview/` (or the Vite root) | Preview and report UI. Vue 3 + Element Plus + UnoCSS, bundled by Vite. |
| `dist/` | Build output. **Never edit by hand** and never commit it. |
| `package.nls.json`, `package.nls.zh-cn.json` | All user-visible strings for commands, settings and menu labels. |
| `assets/icon.png` | Marketplace icon, 128×128. |

If a path above differs from what you see, trust the repository and send a docs PR — the table is maintained by hand.

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Type-check the webview, build the webview, compile and bundle the extension. Use this before packaging. |
| `npm run build:debug` | Same as above without minification. Faster, better stack traces. |
| `npm run watch` | `tsc` in watch mode for the extension host code. |
| `npm run dev:webview` | Vite dev server for the webview UI. |
| `npm run watch:webview` | Vite build in watch mode. |
| `npm run check:webview` | `vue-tsc` type check of the webview only. |
| `npm run lint` | ESLint over `src/`. |
| `npm test` | Runs the extension test suite via `vscode-test`. |
| `npm run release` | Packages a `.vsix` with `vsce`. |

## Guidelines

- **No outbound network requests.** Running fully offline is a core promise of this extension. A PR that adds a CDN reference, a telemetry call, or a "check for updates" ping will be declined.
- **Keep the dependency footprint small.** Every runtime dependency is shipped inside the VSIX and affects activation time. Prefer the VS Code API over a new package.
- **Escape everything that ends up in the report.** Diff content, file names and change-item titles are rendered into an HTML document that users open in a browser. Treat all of it as untrusted input.
- **Pass Git arguments as arrays**, never as a shell string. Branch names and commit hashes come from user input.
- `npm run lint` must pass. Match the existing code style rather than reformatting neighbouring files.
- User-visible strings must be added to **both** `package.nls.json` and `package.nls.zh-cn.json`, with identical keys.

## Checklist: adding a command or setting

1. Register it under `contributes.commands` / `contributes.configuration` in `package.json`.
2. Add the `%key%` placeholder to `package.nls.json` **and** `package.nls.zh-cn.json`.
3. If the command should be reachable from the Source Control title bar, add a `menus.scm/title` entry **and** an `icon` (a [codicon](https://code.visualstudio.com/api/references/icons-in-labels) id such as `$(git-compare)`), otherwise it renders as text in the inline group.
4. Update the settings table and the usage section in both the English and Chinese sections of `README.md`.
5. Add an entry to `CHANGELOG.md`.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `perf:`, `refactor:`, `chore:`.
- One pull request, one concern. Do not mix a bug fix with a refactor.
- UI changes need a before/after screenshot in the PR description.
- Before pushing, run:

```
npm run lint

npm test

npm run build
```

- Reference the issue number in the PR body (`Closes #12`).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE), the same terms that cover this project.