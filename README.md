# agent-skills-hook

## 简介 / Overview
这是一个把“Hook 机制”落地到 Codex CLI 的配置包，目标是提高 AI 对技能的使用概率，并在会话开始/结束提供固定流程输出，同时加上危险命令提示规则。

This repo applies a “hook-like” workflow to Codex CLI to increase skill usage, add session start/stop framing, and enforce execpolicy prompts for risky commands.

## 功能 / Features
- 会话启动提示（SessionStart）
- 每次请求前强制技能评估（Skill Forced Eval）
- 危险命令前缀提示（execpolicy rules）
- 任务完成收尾总结（Stop）

- Session start banner (SessionStart)
- Skill Forced Eval before every request
- Execpolicy prompts on risky command prefixes
- Stop summary when task is done

## 快速开始 / Quick Start
### Codex CLI
```bash
bash scripts/deploy.sh
```
完成后重启 Codex CLI 以加载新的全局指令。
部署会把 `~/.codex/skills` 软链接到仓库内的 `agents/skills` 子模块，保持本机只保留一份 skills。

Restart Codex CLI after deployment to load the global instructions.
Deployment links `~/.codex/skills` to the repo submodule at `agents/skills` so there is only one local skills directory.

### OpenCode
```bash
bash scripts/deploy-opencode.sh
```
完成后重启 OpenCode 以加载新的全局指令。
部署会把 `~/.config/opencode/skills` 软链接到仓库内的 `agents/skills` 子模块，保持本机只保留一份 skills。

Restart OpenCode after deployment to load the global instructions.
Deployment links `~/.config/opencode/skills` to the repo submodule at `agents/skills` so there is only one local skills directory.

## 文档 / Docs
详见 `DEPLOYMENT.md`。
See `DEPLOYMENT.md`.
