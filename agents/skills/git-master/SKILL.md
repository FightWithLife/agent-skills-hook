---
name: git-master
description: "Unified Git workflow for commit execution and changelog/release automation. Use when users ask to commit changes, standardize commit conventions, generate release notes/changelog, or set up semantic versioning and release pipelines."
license: MIT
allowed-tools: Bash
---

# Git Master

Unified Git skill with two modes:

1. Commit Mode: execute safe, high-quality commits.
2. Release Mode: automate changelog and release workflow.

## Mode Routing

Use **Commit Mode** when the user asks to:

- commit changes
- stage files and create a commit
- fix commit message format
- run `/commit`

Use **Release Mode** when the user asks to:

- generate changelog or release notes
- set up Conventional Commits + semantic versioning
- configure standard-version / semantic-release / release workflow

If both are requested, do Commit Mode first, then Release Mode.

## Commit Mode

### Commit Message Rules

- Use Conventional Commits `type` and optional `scope` in English lowercase.
- `description` must be Chinese and concise.
- Always include body with:
  - `变更点`
  - `原因`
- Use `BREAKING CHANGE` footer when needed.

Recommended template:

```text
<type>[scope]: <中文描述>

变更点：
- ...
- ...

原因：
- ...
- ...
```

### Commit Types

| Type       | Purpose                        |
| ---------- | ------------------------------ |
| `feat`     | New feature                    |
| `fix`      | Bug fix                        |
| `docs`     | Documentation only             |
| `style`    | Formatting/style (no logic)    |
| `refactor` | Code refactor (no feature/fix) |
| `perf`     | Performance improvement        |
| `test`     | Add/update tests               |
| `build`    | Build/dependencies             |
| `ci`       | CI/config changes              |
| `chore`    | Maintenance/misc               |
| `revert`   | Revert commit                  |

### Execution Workflow

1. Inspect changes:
```bash
git status --porcelain
git diff --staged
git diff
```
2. Stage only task-related files.
3. Generate commit message using rules above.
4. Commit:
```bash
git commit -m "<type>[scope]: <description>" -m "<body>"
```

### Safety Rules

- Never run destructive commands without explicit request.
- Never force push to `main`/`master`.
- Never skip hooks with `--no-verify` unless explicitly requested.
- Never commit secrets.
- If hooks fail, fix issues and create a new commit (do not amend unless requested).

## Release Mode

### Goals

- Keep changelog consistent (Keep a Changelog style is recommended).
- Derive version bumps from Conventional Commits.
- Make release repeatable in CI.

### Commit Type to Changelog Mapping

| Commit Type | Suggested Changelog Section |
| ----------- | --------------------------- |
| `feat`      | Added                       |
| `fix`       | Fixed                       |
| `refactor`  | Changed                     |
| `perf`      | Changed                     |
| `revert`    | Removed                     |
| `docs`      | usually hidden              |
| `style`     | usually hidden              |
| `test`      | usually hidden              |
| `chore`     | usually hidden              |
| `build`     | usually hidden              |
| `ci`        | usually hidden              |

### Option A: standard-version (simple and explicit)

```bash
npm install -D @commitlint/cli @commitlint/config-conventional husky standard-version
npx husky init
```

Commitlint:

```js
// commitlint.config.js
module.exports = {
  extends: ["@commitlint/config-conventional"],
};
```

Release scripts:

```json
{
  "scripts": {
    "release": "standard-version",
    "release:patch": "standard-version --release-as patch",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major",
    "release:dry": "standard-version --dry-run"
  }
}
```

### Option B: semantic-release (fully automated)

```bash
npm install -D semantic-release @semantic-release/changelog @semantic-release/git @semantic-release/github
```

```js
// release.config.js
module.exports = {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],
    "@semantic-release/github",
    ["@semantic-release/git", { assets: ["CHANGELOG.md"] }]
  ]
};
```

### Release Checklist

1. Ensure clean working tree.
2. Ensure CI/test pass.
3. Ensure commit format is valid.
4. Run dry-run first (`release:dry` or semantic-release dry mode).
5. Run release and verify tag/changelog/release artifacts.

## Quick Recipes

### A) User asks: "帮我提交当前改动"

Run Commit Mode only.

### B) User asks: "帮我配置自动生成 changelog"

Run Release Mode only.

### C) User asks: "提交并发版"

Run Commit Mode first, then Release Mode.
