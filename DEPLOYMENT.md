# 部署说明 / Deployment Guide

## 1) 一键部署 / One-shot deploy
```bash
bash scripts/deploy.sh
```
- 脚本会自动备份当前配置到 `~/.codex-backups/agent-skills-hook-YYYYmmdd-HHMMSS`。
- 完成后请重启 Codex CLI。

The script backs up your current config to `~/.codex-backups/agent-skills-hook-YYYYmmdd-HHMMSS` and then deploys the new settings. Restart Codex CLI afterwards.

## 2) 手动部署 / Manual deploy
1. 复制全局指令：
   - `codex/AGENTS.md` → `~/.codex/AGENTS.md`
2. 复制规则文件：
   - `codex/rules/default.rules` → `~/.codex/rules/default.rules`
3. 技能目录（单一来源，submodule）：
   - 初始化子模块：`git submodule update --init --recursive agents/skills`
   - `~/.codex/skills` → `agents/skills`（软链接）
   - 可选：`~/.agents/skills` → `~/.codex/skills`（软链接）
   - 如果你已有 `~/.codex/skills`，先把内容合并到 `agents/skills`，再建立软链接

1. Copy global instructions:
   - `codex/AGENTS.md` → `~/.codex/AGENTS.md`
2. Copy execpolicy rules:
   - `codex/rules/default.rules` → `~/.codex/rules/default.rules`
3. Skills directory (single source, submodule):
   - Initialize the submodule: `git submodule update --init --recursive agents/skills`
   - `~/.codex/skills` → `agents/skills` (symlink)
   - Optional: `~/.agents/skills` → `~/.codex/skills` (symlink)
   - If you already have `~/.codex/skills`, merge it into `agents/skills` before linking

## 3) 验证 / Verify
- 规则检查：
```bash
codex execpolicy check --pretty --rules ~/.codex/rules/default.rules -- rm -rf /
```
- 启动提示与技能评估：
  - 重新打开 Codex CLI，发送一句简单请求，应该看到 `SessionStart` 和 `Skill Match` 输出。

- Rule check:
```bash
codex execpolicy check --pretty --rules ~/.codex/rules/default.rules -- rm -rf /
```
- SessionStart + Skill Match should appear in the first response of a new session.

## 4) 回滚 / Rollback
```bash
bash scripts/restore.sh
```
如需指定备份目录，可传入路径：
```bash
bash scripts/restore.sh ~/.codex-backups/agent-skills-hook-YYYYmmdd-HHMMSS
```

Run `scripts/restore.sh` to restore the latest backup, or pass a specific backup path.

## 5) 技能更新 / Updating skills
如果你在本机新增/更新了技能，请修改 `agents/skills`（子模块）或 `~/.codex/skills`（指向子模块的软链接）。
如需提交到仓库，请在子模块仓库内提交，并在本仓库更新 submodule 引用后再提交。

If you add or update skills locally, edit `agents/skills` (the submodule) or `~/.codex/skills` (symlink to it).
If you need to commit to the repo, commit inside the submodule repo and then update the submodule reference in this repo.

# OpenCode 部署 / OpenCode Deployment Guide

## 1) 一键部署 / One-shot deploy
```bash
bash scripts/deploy-opencode.sh
```
- 脚本会自动备份当前配置到 `~/.opencode-backups/agent-skills-hook-YYYYmmdd-HHMMSS`。
- 完成后请重启 OpenCode。

The script backs up your current config to `~/.opencode-backups/agent-skills-hook-YYYYmmdd-HHMMSS` and then deploys the new settings. Restart OpenCode afterwards.

## 2) 手动部署 / Manual deploy
1. 复制全局指令：
   - `opencode/AGENTS.md` → `~/.config/opencode/AGENTS.md`
2. 技能目录（单一来源，submodule）：
   - 初始化子模块：`git submodule update --init --recursive agents/skills`
   - `~/.config/opencode/skills` → `agents/skills`（软链接）
   - 可选：`~/.agents/skills` 或 `~/.claude/skills` → `~/.config/opencode/skills`（软链接）
   - 如果你已有 `~/.config/opencode/skills`，先把内容合并到 `agents/skills`，再建立软链接

1. Copy global instructions:
   - `opencode/AGENTS.md` → `~/.config/opencode/AGENTS.md`
2. Skills directory (single source, submodule):
   - Initialize the submodule: `git submodule update --init --recursive agents/skills`
   - `~/.config/opencode/skills` → `agents/skills` (symlink)
   - Optional: `~/.agents/skills` or `~/.claude/skills` → `~/.config/opencode/skills` (symlink)
   - If you already have `~/.config/opencode/skills`, merge it into `agents/skills` before linking

## 3) 验证 / Verify
- 启动 OpenCode，发送一句简单请求，应该看到 `SessionStart` 和 `Skill Match` 输出。

- SessionStart + Skill Match should appear in the first response of a new session.

## 4) 回滚 / Rollback
```bash
bash scripts/restore-opencode.sh
```
如需指定备份目录，可传入路径：
```bash
bash scripts/restore-opencode.sh ~/.opencode-backups/agent-skills-hook-YYYYmmdd-HHMMSS
```

Run `scripts/restore-opencode.sh` to restore the latest backup, or pass a specific backup path.
