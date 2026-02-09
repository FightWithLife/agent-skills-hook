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
3. 技能目录（单一来源）：
   - 如果 `~/.codex/skills/` 不存在，先从 `agents/skills/` 复制过去
   - `agents/skills` → `~/.codex/skills`（软链接）
   - 可选：`~/.agents/skills` → `~/.codex/skills`（软链接）

1. Copy global instructions:
   - `codex/AGENTS.md` → `~/.codex/AGENTS.md`
2. Copy execpolicy rules:
   - `codex/rules/default.rules` → `~/.codex/rules/default.rules`
3. Skills directory (single source):
   - If `~/.codex/skills/` doesn't exist, seed it from `agents/skills/`
   - `agents/skills` → `~/.codex/skills` (symlink)
   - Optional: `~/.agents/skills` → `~/.codex/skills` (symlink)

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
如果你在本机新增/更新了技能，请直接修改 `~/.codex/skills/`。
如需提交到仓库，先移除 `agents/skills` 的软链接并复制回仓库后再提交。

If you add or update skills locally, edit `~/.codex/skills/`.
If you need to commit to the repo, remove the `agents/skills` symlink and copy contents back before committing.
