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
3. 技能目录：
   - `agents/skills/` → `~/.agents/skills/`
4. 为兼容旧路径，给每个技能创建符号链接：
   - `~/.codex/skills/<skill>` → `~/.agents/skills/<skill>`

1. Copy global instructions:
   - `codex/AGENTS.md` → `~/.codex/AGENTS.md`
2. Copy execpolicy rules:
   - `codex/rules/default.rules` → `~/.codex/rules/default.rules`
3. Skills directory:
   - `agents/skills/` → `~/.agents/skills/`
4. Create symlinks for compatibility:
   - `~/.codex/skills/<skill>` → `~/.agents/skills/<skill>`

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
如果你在本机新增/更新了技能：
```bash
cp -a ~/.agents/skills/* agents/skills/
```
然后提交到仓库。

If you add or update skills locally, copy them into `agents/skills/` and commit.
