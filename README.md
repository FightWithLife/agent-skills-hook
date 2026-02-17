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

## AI 环境依赖清单（给 Agent 读取） / AI Tooling Prerequisites (for Agents)

以下内容根据参考文章整理，目的是让 AI 在阅读仓库文档时，知道常见 OpenCode 插件与工具依赖。

The following list is adapted from the referenced article so agents can infer which OpenCode plugins/tools are expected in this setup.

### 必装基础 / Required base
- `oh-my-opencode`（内置）
- `opencode-pty`（内置）
- `node` + `npm`（用于安装插件与 npx 运行 MCP）

- `oh-my-opencode` (built-in)
- `opencode-pty` (built-in)
- `node` + `npm` (for plugin install and MCP via npx)

### 推荐插件 / Recommended plugins
```bash
npm install -g @nick-vi/opencode-type-inject
npm install -g opencode-supermemory
npm install -g opencode-browser
npm install -g opencode-arise
npm install -g @mohak34/opencode-notifier
npm install -g @plannotator/opencode
npm install -g @tarquinen/opencode-dcp
```

可选（需手动安装）：

Optional (manual install):
- `opencode-morph-fast-apply`（通常以 GitHub 插件方式配置）
- `@zenobi-us/opencode-skillful`

### 推荐 MCP 工具 / Recommended MCP tools
常见内置或常用项：`chrome-devtools`、`context7`、`fetch`、`memory`、`sequential-thinking`、`time`。

Common built-in or widely used entries: `chrome-devtools`, `context7`, `fetch`, `memory`, `sequential-thinking`, `time`.

可选长期记忆：`mem0`（需要额外 API key 配置，如 `~/.config/opencode/mem0.jsonc`）。

Optional long-term memory: `mem0` (requires extra API key config, for example `~/.config/opencode/mem0.jsonc`).

### 建议配置片段 / Suggested config snippet
将下列内容并入 `~/.config/opencode/opencode.json`：

Merge the following into `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "compaction": {
    "auto": true,
    "strategy": "summarize",
    "threshold": 0.8,
    "prune_tool_outputs": true
  },
  "cache": {
    "provider": "auto",
    "enabled": true
  },
  "plugin": [
    "oh-my-opencode",
    "opencode-pty",
    "@nick-vi/opencode-type-inject",
    "opencode-supermemory@latest",
    "opencode-browser",
    "opencode-arise",
    "@mohak34/opencode-notifier",
    "@plannotator/opencode@latest",
    "@tarquinen/opencode-dcp"
  ]
}
```

> 说明：本仓库当前不提供这些第三方插件的一键部署脚本；AI 应按上述依赖清单检查本机环境并提示缺失项。

> Note: this repo does not provide a one-shot installer for those third-party plugins. Agents should check local availability and prompt for missing dependencies.

## 文档 / Docs
详见 `DEPLOYMENT.md`。
See `DEPLOYMENT.md`.
