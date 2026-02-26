# agent-skills-hook

## 简介
这是一个把“Hook 机制”落地到 Codex CLI / OpenCode 的配置仓库，目标是：
- 提高 AI 对 skills 的触发与使用概率
- 固定会话起止输出（`SessionStart` / `Stop`）
- 在危险命令前给出 execpolicy 安全提示

## 功能
- 会话启动提示（`SessionStart`）
- 每次请求前强制技能评估（`Skill Forced Eval`）
- 危险命令前缀提示（execpolicy rules）
- 任务完成收尾总结（`Stop`）

## 目录
- [快速开始（给人）](#快速开始给人)
- [AI 部署规范（给 AI，English）](#ai-deployment-spec-english-for-ai)
- [验证与回滚](#验证与回滚)
- [AI 环境依赖清单](#ai-环境依赖清单)
- [OpenCode 推荐配置（保持最新）](#opencode-推荐配置保持最新)
- [当前模型映射示例](#当前模型映射示例)

## 快速开始（给人）
本仓库已移除一键部署脚本，改为 **AI 自部署（scriptless）**。

1. 在仓库根目录初始化 submodule：
```bash
git submodule update --init --recursive agents/skills
```
2. 把下面这段话发给 AI：
```text
请在仓库根目录按 README 的 “AI Deployment Spec” 执行部署。
目标：Codex CLI 与 OpenCode 使用同一份 skills（仓库内 agents/skills）。
要求：先备份，再部署，再验证，最后回报变更与验证结果。
```

## AI Deployment Spec (English, for AI)
Use this section as the source of truth for deployment behavior.

### Goals
- Keep one single skills source: `<repo>/agents/skills`.
- Deploy Codex/OpenCode config without repo scripts.
- Be idempotent and rollback-friendly.

### Constraints
- Always backup before mutating user config.
- Merge legacy skills into repo skills with `no overwrite` policy.
- Keep plugin/tool versions unpinned (latest) unless user requests pinning.
- Do not run destructive git commands.

### One-Shot Idempotent Command Block
Run from repo root. Optional: `TARGET=codex|opencode|both` (default `both`).

```bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(pwd)}"
TARGET="${TARGET:-both}"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPO_SKILLS="$REPO_ROOT/agents/skills"

if [ ! -d "$REPO_SKILLS" ]; then
  git -C "$REPO_ROOT" submodule update --init --recursive agents/skills
fi

if [ ! -d "$REPO_SKILLS" ]; then
  echo "ERROR: $REPO_SKILLS missing" >&2
  exit 1
fi

merge_missing_skills() {
  local src="$1"
  local real="$src"
  [ -e "$src" ] || return 0
  if [ -L "$src" ]; then
    real="$(readlink -f "$src" 2>/dev/null || true)"
  fi
  [ -d "$real" ] || return 0

  shopt -s nullglob dotglob
  for item in "$real"/*; do
    [ -e "$item" ] || continue
    local name
    name="$(basename "$item")"
    if [ ! -e "$REPO_SKILLS/$name" ]; then
      cp -a "$item" "$REPO_SKILLS/"
    fi
  done
  shopt -u nullglob dotglob
}

safe_link() {
  local link_path="$1"
  local target_path="$2"
  mkdir -p "$(dirname "$link_path")"

  if [ -L "$link_path" ]; then
    local real
    real="$(readlink -f "$link_path" 2>/dev/null || true)"
    if [ "$real" = "$target_path" ]; then
      return 0
    fi
    rm -f "$link_path"
  elif [ -e "$link_path" ]; then
    rm -rf "$link_path"
  fi

  ln -s "$target_path" "$link_path"
}

if [ "$TARGET" = "codex" ] || [ "$TARGET" = "both" ]; then
  BACKUP_C="$HOME/.codex-backups/agent-skills-hook-$STAMP"
  mkdir -p "$BACKUP_C/codex" "$BACKUP_C/agents" "$BACKUP_C/repo"

  [ -f "$HOME/.codex/AGENTS.md" ] && cp -a "$HOME/.codex/AGENTS.md" "$BACKUP_C/codex/AGENTS.md"
  [ -d "$HOME/.codex/rules" ] && cp -a "$HOME/.codex/rules" "$BACKUP_C/codex/"
  [ -e "$HOME/.codex/skills" ] && cp -a "$HOME/.codex/skills" "$BACKUP_C/codex/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_C/agents/"
  cp -a "$REPO_SKILLS" "$BACKUP_C/repo/"

  mkdir -p "$HOME/.codex/rules"
  cp -a "$REPO_ROOT/codex/AGENTS.md" "$HOME/.codex/AGENTS.md"
  cp -a "$REPO_ROOT/codex/rules/." "$HOME/.codex/rules/"

  merge_missing_skills "$HOME/.codex/skills"
  merge_missing_skills "$HOME/.agents/skills"

  safe_link "$HOME/.codex/skills" "$REPO_SKILLS"
  safe_link "$HOME/.agents/skills" "$HOME/.codex/skills"

  echo "Codex deployed. Backup: $BACKUP_C"
fi

if [ "$TARGET" = "opencode" ] || [ "$TARGET" = "both" ]; then
  BACKUP_O="$HOME/.opencode-backups/agent-skills-hook-$STAMP"
  mkdir -p "$BACKUP_O/opencode" "$BACKUP_O/agents" "$BACKUP_O/claude" "$BACKUP_O/repo"

  [ -f "$HOME/.config/opencode/AGENTS.md" ] && cp -a "$HOME/.config/opencode/AGENTS.md" "$BACKUP_O/opencode/AGENTS.md"
  [ -f "$HOME/.config/opencode/oh-my-opencode.json" ] && cp -a "$HOME/.config/opencode/oh-my-opencode.json" "$BACKUP_O/opencode/oh-my-opencode.json"
  [ -e "$HOME/.config/opencode/skills" ] && cp -a "$HOME/.config/opencode/skills" "$BACKUP_O/opencode/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_O/agents/"
  [ -e "$HOME/.claude/skills" ] && cp -a "$HOME/.claude/skills" "$BACKUP_O/claude/"
  cp -a "$REPO_SKILLS" "$BACKUP_O/repo/"

  mkdir -p "$HOME/.config/opencode"
  cp -a "$REPO_ROOT/opencode/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"
  cp -a "$REPO_ROOT/opencode/oh-my-opencode.json" "$HOME/.config/opencode/oh-my-opencode.json"

  merge_missing_skills "$HOME/.config/opencode/skills"
  merge_missing_skills "$HOME/.agents/skills"
  merge_missing_skills "$HOME/.claude/skills"

  safe_link "$HOME/.config/opencode/skills" "$REPO_SKILLS"

  # optional legacy links
  safe_link "$HOME/.agents/skills" "$HOME/.config/opencode/skills"
  safe_link "$HOME/.claude/skills" "$HOME/.config/opencode/skills"

  echo "OpenCode deployed. Backup: $BACKUP_O"
fi
```

### AI Output Requirements
After running deployment, output:
1. Changed files/links.
2. Backup directory paths.
3. Verification results.
4. Any blocked step with exact reason.

## 验证与回滚
### 验证
- Codex 规则检查：
```bash
codex execpolicy check --pretty --rules ~/.codex/rules/default.rules -- rm -rf /
```
- 新会话首条回复应出现：`SessionStart` 与 `Skill Match`。
- OpenCode 新会话首条回复应出现：`SessionStart` 与 `Skill Match`。

### 回滚
从最近备份目录手动恢复以下路径即可：
- Codex：`~/.codex/AGENTS.md`、`~/.codex/rules/`、`~/.codex/skills`、`~/.agents/skills`
- OpenCode：`~/.config/opencode/AGENTS.md`、`~/.config/opencode/oh-my-opencode.json`、`~/.config/opencode/skills`、`~/.agents/skills`、`~/.claude/skills`

## AI 环境依赖清单
以下用于帮助 AI 判断环境是否完整。

### 必装基础
- `oh-my-opencode`（内置）
- `opencode-pty`（内置）
- `node` + `npm`（安装插件和 npx 运行 MCP）

### 推荐插件（保持最新）
```bash
npm install -g @nick-vi/opencode-type-inject@latest
npm install -g opencode-supermemory@latest
npm install -g opencode-browser@latest
npm install -g opencode-arise@latest
npm install -g @mohak34/opencode-notifier@latest
npm install -g @plannotator/opencode@latest
npm install -g @tarquinen/opencode-dcp@latest
```

可选：
- `opencode-morph-fast-apply`（通常以 GitHub 插件方式配置）
- `@zenobi-us/opencode-skillful`

### 推荐 MCP 工具
- `chrome-devtools`
- `context7`
- `fetch`
- `memory`
- `sequential-thinking`
- `time`
- 可选长期记忆：`mem0`（需额外 API key）

## OpenCode 推荐配置（保持最新）
> 这是“合并片段”，不是完整 `opencode.json`。请做字段级 merge，不要整文件覆盖。

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
    "@nick-vi/opencode-type-inject@latest",
    "opencode-supermemory@latest",
    "opencode-browser@latest",
    "opencode-arise@latest",
    "@mohak34/opencode-notifier@latest",
    "@plannotator/opencode@latest",
    "@tarquinen/opencode-dcp@latest"
  ],
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
      "command": ["uvx", "mcp-server-time"],
      "enabled": true,
      "type": "local"
    }
  }
}
```

### MCP 排障经验（2026-02-26 实测）
- `time` MCP：`@modelcontextprotocol/server-time` 当前在 npm registry 返回 `404 Not Found`，请改用 `uvx mcp-server-time`。
- `chrome-devtools` 若报 `ENOTEMPTY ... ~/.npm/_npx/...`，可按下列步骤处理：
1. 定位冲突目录：`ls -1 ~/.npm/_npx`
2. 备份冲突目录：`mv ~/.npm/_npx/<hash> ~/.npm/_npx/<hash>.bak.$(date +%Y%m%d-%H%M%S)`
3. 重新验证连接：`opencode mcp list`

## 当前模型映射示例
> 以下是可复制模板（敏感字段请自行填充）。

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

如果启用了 `opencode-arise`，可补充：

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
