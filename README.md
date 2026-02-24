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
本仓库已移除一键部署脚本，改为 **AI 自部署（scriptless）** 模式。

This repo has removed one-shot deploy scripts and now uses an **AI-driven scriptless deployment** mode.

### 给 AI 的指令模板 / Prompt Template for AI
```text
请在仓库根目录按 README 的“AI 自部署协议”完成部署。
要求：先备份，再初始化 agents/skills 子模块，再执行配置复制与 skills 软链接，最后做验证并汇报结果。
目标：Codex CLI 与 OpenCode 使用同一份 skills（仓库内 agents/skills）。
```

## AI 自部署协议（无脚本） / AI Deployment Protocol (Scriptless)
以下步骤是给 AI 执行的标准流程。要求幂等、安全、可回滚。

The following steps are the standard runbook for AI agents. Keep it idempotent, safe, and rollback-ready.

### 0) 通用前置 / Common preflight
```bash
git submodule update --init --recursive agents/skills
REPO_SKILLS="$(pwd)/agents/skills"
```

### 1) Codex CLI 部署 / Codex CLI deployment
1. 备份当前配置到带时间戳目录（例如 `~/.codex-backups/agent-skills-hook-YYYYmmdd-HHMMSS`）。
2. 复制：
- `codex/AGENTS.md` -> `~/.codex/AGENTS.md`
- `codex/rules/*` -> `~/.codex/rules/`
3. 如存在旧 skills 目录（`~/.codex/skills`、`~/.agents/skills`）且不是指向 `agents/skills`，先把缺失条目合并到 `agents/skills`（不覆盖同名）。
4. 建立单一来源软链接：
- `~/.codex/skills` -> `<repo>/agents/skills`
- `~/.agents/skills` -> `~/.codex/skills`
5. 重启 Codex CLI。

1. Backup current config to a timestamped folder (for example `~/.codex-backups/agent-skills-hook-YYYYmmdd-HHMMSS`).
2. Copy:
- `codex/AGENTS.md` -> `~/.codex/AGENTS.md`
- `codex/rules/*` -> `~/.codex/rules/`
3. If legacy skill dirs exist (`~/.codex/skills`, `~/.agents/skills`) and do not point to `agents/skills`, merge missing entries into `agents/skills` (no overwrite).
4. Set single-source symlinks:
- `~/.codex/skills` -> `<repo>/agents/skills`
- `~/.agents/skills` -> `~/.codex/skills`
5. Restart Codex CLI.

### 2) OpenCode 部署 / OpenCode deployment
1. 备份当前配置到带时间戳目录（例如 `~/.opencode-backups/agent-skills-hook-YYYYmmdd-HHMMSS`）。
2. 复制：
- `opencode/AGENTS.md` -> `~/.config/opencode/AGENTS.md`
- `opencode/oh-my-opencode.json` -> `~/.config/opencode/oh-my-opencode.json`
3. 如存在旧 skills 目录（`~/.config/opencode/skills`、`~/.agents/skills`、`~/.claude/skills`）且不是指向 `agents/skills`，先把缺失条目合并到 `agents/skills`（不覆盖同名）。
4. 建立单一来源软链接：
- `~/.config/opencode/skills` -> `<repo>/agents/skills`
- 可选：`~/.agents/skills`、`~/.claude/skills` -> `~/.config/opencode/skills`
5. 重启 OpenCode。

1. Backup current config to a timestamped folder (for example `~/.opencode-backups/agent-skills-hook-YYYYmmdd-HHMMSS`).
2. Copy:
- `opencode/AGENTS.md` -> `~/.config/opencode/AGENTS.md`
- `opencode/oh-my-opencode.json` -> `~/.config/opencode/oh-my-opencode.json`
3. If legacy skill dirs exist (`~/.config/opencode/skills`, `~/.agents/skills`, `~/.claude/skills`) and do not point to `agents/skills`, merge missing entries into `agents/skills` (no overwrite).
4. Set single-source symlinks:
- `~/.config/opencode/skills` -> `<repo>/agents/skills`
- Optional: `~/.agents/skills`, `~/.claude/skills` -> `~/.config/opencode/skills`
5. Restart OpenCode.

### 3) 验证 / Verify
- Codex 规则检查：
```bash
codex execpolicy check --pretty --rules ~/.codex/rules/default.rules -- rm -rf /
```
- 新会话首条回复应出现：`SessionStart` 与 `Skill Match`。

- Codex rule check:
```bash
codex execpolicy check --pretty --rules ~/.codex/rules/default.rules -- rm -rf /
```
- First reply in a new session should include `SessionStart` and `Skill Match`.

### 4) 回滚 / Rollback
- 从最近备份目录中手动恢复被替换文件与目录。
- Codex 恢复目标：`~/.codex/AGENTS.md`、`~/.codex/rules/`、`~/.codex/skills`、`~/.agents/skills`。
- OpenCode 恢复目标：`~/.config/opencode/AGENTS.md`、`~/.config/opencode/oh-my-opencode.json`、`~/.config/opencode/skills`、`~/.agents/skills`、`~/.claude/skills`。

- Manually restore replaced files/directories from the latest backup folder.
- Codex restore targets: `~/.codex/AGENTS.md`, `~/.codex/rules/`, `~/.codex/skills`, `~/.agents/skills`.
- OpenCode restore targets: `~/.config/opencode/AGENTS.md`, `~/.config/opencode/oh-my-opencode.json`, `~/.config/opencode/skills`, `~/.agents/skills`, `~/.claude/skills`.

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

### OpenCode 配置优化（性能与稳定性） / OpenCode optimization (performance + stability)
- 上下文压缩：`compaction.auto=true`、`strategy=summarize`、`threshold=0.8`、`prune_tool_outputs=true`
- 缓存：`cache.enabled=true`，降低重复请求开销
- 插件集合：将高频插件统一写入 `plugin`，避免每个项目重复手配
- MCP：建议启用 `chrome-devtools`、`context7`、`fetch`、`memory`、`sequential-thinking`、`time`

- Context compaction: `compaction.auto=true`, `strategy=summarize`, `threshold=0.8`, `prune_tool_outputs=true`
- Cache: `cache.enabled=true` to reduce repeated work
- Plugin baseline: keep commonly-used plugins in a shared `plugin` list
- MCP baseline: enable `chrome-devtools`, `context7`, `fetch`, `memory`, `sequential-thinking`, `time`

参考 MCP 配置（Linux/macOS 常见写法）：

Reference MCP block (common Linux/macOS form):

```json
{
  "mcp": {
    "chrome-devtools": {
      "command": ["npx", "-y", "chrome-devtools-mcp@latest"],
      "enabled": true,
      "type": "local"
    },
    "context7": {
      "command": ["npx", "-y", "@upstash/context7-mcp"],
      "enabled": true,
      "type": "local"
    },
    "fetch": {
      "command": ["uvx", "mcp-server-fetch"],
      "enabled": true,
      "type": "local"
    },
    "memory": {
      "command": ["npx", "-y", "@modelcontextprotocol/server-memory"],
      "enabled": true,
      "type": "local"
    },
    "sequential-thinking": {
      "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      "enabled": true,
      "type": "local"
    },
    "time": {
      "command": ["npx", "-y", "@modelcontextprotocol/server-time"],
      "enabled": true,
      "type": "local"
    }
  }
}
```

可选长期记忆：`mem0` 需要单独 API key 文件（例如 `~/.config/opencode/mem0.jsonc`），未配置 key 前不建议默认启用。

Optional long-term memory: `mem0` needs a dedicated API key file (for example `~/.config/opencode/mem0.jsonc`), so do not enable it by default before key setup.

### 当前模型配置（可直接复制） / Current model profile (copy-ready)
下面是当前本机在用的 OpenCode 模型编排（已去掉敏感字段）。AI 可直接按此映射执行。

Below is the active OpenCode model orchestration (sensitive fields removed). Agents can follow this mapping directly.

`~/.config/opencode/opencode.json`（模型与代理映射片段）：

`~/.config/opencode/opencode.json` (models + agents excerpt):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "openai": {
      "options": {
        "baseURL": "<YOUR_BASE_URL>",
        "apiKey": "<YOUR_API_KEY>",
        "timeout": 45000
      },
      "models": {
        "gpt-5.3-codex": { "name": "GPT-5.3 Codex" },
        "gpt-5.2-codex": { "name": "GPT-5.2 Codex" },
        "gpt-5-codex": { "name": "GPT-5 Codex" },
        "gpt-5.1": { "name": "GPT-5.1" },
        "gpt-4o-2024-11-20": { "name": "GPT-4o 2024-11-20" },
        "gpt-4o-mini": { "name": "GPT-4o Mini" },
        "gpt-4.1-nano": { "name": "GPT-4.1 Nano" }
      }
    }
  },
  "model": "openai/gpt-5.2-codex",
  "default_agent": "build",
  "agent": {
    "build": { "model": "openai/gpt-5.2-codex" },
    "plan": { "model": "openai/gpt-5.2-codex" },
    "sisyphus": { "model": "openai/gpt-5.3-codex" },
    "hephaestus": { "model": "openai/gpt-5.2-codex" },
    "prometheus": { "model": "openai/gpt-5.2-codex" },
    "atlas": { "model": "openai/gpt-5.2-codex" },
    "sisyphus-junior": { "model": "openai/gpt-5-codex" },
    "oracle": { "model": "openai/gpt-5.1" },
    "explore": { "model": "openai/gpt-4.1-nano" },
    "multimodal-looker": { "model": "openai/gpt-4o-2024-11-20" },
    "metis": { "model": "openai/gpt-4o-mini" },
    "momus": { "model": "openai/gpt-4o-mini" },
    "general": { "model": "openai/gpt-5.2-codex" },
    "compaction": { "model": "openai/gpt-5.2-codex" },
    "summary": { "model": "openai/gpt-5.2-codex" },
    "title": { "model": "openai/gpt-5.2-codex" }
  }
}
```

如果启用了 `opencode-arise`，建议同时使用以下模型映射：

If `opencode-arise` is enabled, also use this model mapping:

```json
{
  "agents": {
    "monarch": { "model": "openai/gpt-5.3-codex" },
    "beru": { "model": "openai/gpt-4.1-nano" },
    "igris": { "model": "openai/gpt-5.2-codex" },
    "bellion": { "model": "openai/gpt-5.2-codex" },
    "tusk": { "model": "openai/gpt-4o-2024-11-20" },
    "tank": { "model": "openai/gpt-4o-mini" },
    "shadow-sovereign": { "model": "openai/gpt-5.2-codex" }
  }
}
```

## 文档 / Docs
部署说明已并入本 README（见 “AI 自部署协议”）。
Deployment instructions are now embedded in this README (see "AI Deployment Protocol").
