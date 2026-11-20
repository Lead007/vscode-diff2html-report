# Security Policy

## Supported versions

Security fixes land in the latest published version only.

| Version | Supported |
|---|---|
| Latest on the Marketplace | ✅ |
| Older versions | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Preferred channel: GitHub private vulnerability reporting — go to the [Security tab](https://github.com/Lead007/vscode-diff2html-report/security) and click **Report a vulnerability**.

If that is unavailable, open a minimal public issue asking for a private contact channel, without describing the vulnerability itself.

Please include:

- Extension version and VS Code version
- Operating system
- A minimal reproduction — a synthetic repository or diff is enough, **never paste proprietary source code**
- What an attacker could achieve, and what preconditions are needed

You will get an acknowledgement as soon as possible. This is a spare-time project, so please allow a few days before following up.

## How this extension handles your data

- No outbound network requests of any kind: no telemetry, no crash reporting, no update checks.
- No account, no cloud service, no upload of source code.
- Reads repository contents through your local Git installation and the VS Code API.
- Writes only to the file or folder you explicitly choose when exporting.

The exported HTML report contains your diff, which means it contains your source code. Treat an exported report with the same care as the code it came from.

## Areas we care about

These are the parts of the design where a mistake would matter. Reports about them are especially welcome.

1. **Command injection.** Revisions, tags, commit hashes, pathspec filters and diff options originate from user input. They must be passed to `git` as argument arrays, never interpolated into a shell string. A branch named `` `rm -rf ~` `` must be handled as a plain string.
2. **HTML injection in the report.** Diff content, file paths and change-item titles/descriptions are rendered into an HTML document that is later opened in a browser. All of it is untrusted: a repository containing `<script>` in a file name or a source line must not be able to execute code in the preview or in the exported report.
3. **Webview content security.** The preview webview should not permit arbitrary remote content or unrestricted inline script.
4. **Export path handling.** The export target must be exactly the path the user selected, with no traversal outside it and no silent overwrite of unrelated files.
5. **Denial of service.** A huge or pathological diff should fail gracefully rather than hang the extension host. `diff2html-report.maxGitDiffFileSize` exists for this reason; a way to bypass it is worth reporting.

## Out of scope

- Vulnerabilities in Git, VS Code, or third-party libraries that are bundled or invoked. Report
  those upstream — but do tell us if it affects this extension.
- The fact that the exported report contains source code. That is the intended behaviour.
- Issues that require an attacker to already control the user's machine or VS Code settings.

## Disclosure

Please give us a reasonable window to ship a fix before publishing details. Credit is given in the release notes unless you prefer otherwise.