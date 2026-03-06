# agent-skills-hook

## 简介
这是一个把“Hook 机制”落地到 Codex CLI / OpenCode / Claude Code 的配置仓库，目标是：
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
- [OpenCode Agents 部署（给人）](#opencode-agents-部署给人)
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
目标：Codex CLI / OpenCode / Claude Code 使用同一份 skills（仓库内 agents/skills）。
要求：先备份，再部署，再验证，最后回报变更与验证结果。
```

## OpenCode Agents 部署（给人）
本仓库里 OpenCode Agents 定义文件：
- `opencode/AGENTS.md`
- `opencode/agents/*.md`

当前 agents 清单（OpenCode）：
- Primary：`orchestrator`、`triage`（`triage` 仅手动调用）
- Native subagent：`explore`（由 OpenCode upstream 提供，**不要**在本地创建 `explore.md`）
- Local subagents：`dev`、`qa`、`review`、`debug`、`scoper`、`impact`、`security`

本次新增能力/门禁摘要：
- 新增 `scoper/impact/security` 三个本地子代理，并纳入路由策略。
- 新增 Gate-0（合同就绪）：进入 `dev/qa/review/debug/impact/security` 前，必须具备 `task_contract(v1)` + `gate0_evidence.scope_ready=true`。
- Gate-0 通过后按 `task_contract.intent` 自由分流（`review-only | qa-only | debug-only | dev-feature | impact | security`）。
- 仅 `intent=dev-feature` 强制执行 `dev -> qa -> review` 回归链条；`qa-only`/`debug-only` 不强制走完整开发链。
- 引入 strict review gate：`code-review` 触发前必须满足 `dev.status=done` + `dev` 有命令级证据 + `qa.status=done` 且 `qa.verdict=pass`。
- `plan-review` 改为 opt-in（默认不启用）。
- `explore` 明确为原生子代理，不走本地伪实现。
- `orchestrator` 新增 No Phantom Artifacts 规则：无 `dev/debug` 证据不得宣称文件已落地。

OpenCode 全局读取位置：
- `~/.config/opencode/AGENTS.md`
- `~/.config/opencode/agents/`

从仓库根目录执行（先备份再覆盖）：

```bash
set -euo pipefail

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$HOME/.opencode-backups/agent-skills-hook-$STAMP/opencode"

mkdir -p "$BACKUP" "$HOME/.config/opencode/agents"

[ -f "$HOME/.config/opencode/AGENTS.md" ] && cp -a "$HOME/.config/opencode/AGENTS.md" "$BACKUP/AGENTS.md"
[ -d "$HOME/.config/opencode/agents" ] && cp -a "$HOME/.config/opencode/agents" "$BACKUP/"

cp -a "./opencode/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"
cp -a "./opencode/agents/." "$HOME/.config/opencode/agents/"

echo "OpenCode Agents 已部署。备份目录：$BACKUP"
```

部署后请重启 OpenCode 生效。
另外，模型 ID 建议统一使用 `openai/*`（例如 `openai/gpt-5.3-codex`）。

## AI Deployment Spec (English, for AI)
Use this section as the source of truth for deployment behavior.

### Goals
- Keep one single skills source: `<repo>/agents/skills`.
- Deploy Codex/OpenCode/Claude config without repo scripts.
- Be idempotent and rollback-friendly.

### Constraints
- Always backup before mutating user config.
- Merge legacy skills into repo skills with `no overwrite` policy.
- Keep plugin/tool versions unpinned (latest) unless user requests pinning.
- Do not run destructive git commands.

### One-Shot Idempotent Command Block
Run from repo root. Optional: `TARGET=codex|opencode|claude|both|all` (default `both`, where `both` means Codex+OpenCode).

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

if [ "$TARGET" = "codex" ] || [ "$TARGET" = "both" ] || [ "$TARGET" = "all" ]; then
  BACKUP_C="$HOME/.codex-backups/agent-skills-hook-$STAMP"
  mkdir -p "$BACKUP_C/codex" "$BACKUP_C/agents" "$BACKUP_C/repo"

  [ -f "$HOME/.codex/AGENTS.md" ] && cp -a "$HOME/.codex/AGENTS.md" "$BACKUP_C/codex/AGENTS.md"
  [ -f "$HOME/.codex/config.toml" ] && cp -a "$HOME/.codex/config.toml" "$BACKUP_C/codex/config.toml"
  [ -e "$HOME/.codex/agents" ] && cp -a "$HOME/.codex/agents" "$BACKUP_C/codex/"
  [ -d "$HOME/.codex/rules" ] && cp -a "$HOME/.codex/rules" "$BACKUP_C/codex/"
  [ -e "$HOME/.codex/skills" ] && cp -a "$HOME/.codex/skills" "$BACKUP_C/codex/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_C/agents/"
  cp -a "$REPO_SKILLS" "$BACKUP_C/repo/"

  mkdir -p "$HOME/.codex/rules" "$REPO_ROOT/codex/agents"
  [ -f "$HOME/.codex/config.toml" ] && cp -an "$HOME/.codex/config.toml" "$REPO_ROOT/codex/config.toml"
  cp -a "$REPO_ROOT/codex/AGENTS.md" "$HOME/.codex/AGENTS.md"
  cp -a "$REPO_ROOT/codex/rules/." "$HOME/.codex/rules/"
  [ -d "$HOME/.codex/agents" ] && cp -an "$HOME/.codex/agents/." "$REPO_ROOT/codex/agents/"

  merge_missing_skills "$HOME/.codex/skills"
  merge_missing_skills "$HOME/.agents/skills"

  safe_link "$HOME/.codex/config.toml" "$REPO_ROOT/codex/config.toml"
  safe_link "$HOME/.codex/agents" "$REPO_ROOT/codex/agents"
  safe_link "$HOME/.codex/skills" "$REPO_SKILLS"
  safe_link "$HOME/.agents/skills" "$HOME/.codex/skills"

  echo "Codex deployed. Backup: $BACKUP_C"
fi

if [ "$TARGET" = "opencode" ] || [ "$TARGET" = "both" ] || [ "$TARGET" = "all" ]; then
  BACKUP_O="$HOME/.opencode-backups/agent-skills-hook-$STAMP"
  mkdir -p "$BACKUP_O/opencode" "$BACKUP_O/agents" "$BACKUP_O/claude" "$BACKUP_O/repo"

  [ -f "$HOME/.config/opencode/AGENTS.md" ] && cp -a "$HOME/.config/opencode/AGENTS.md" "$BACKUP_O/opencode/AGENTS.md"
  [ -d "$HOME/.config/opencode/agents" ] && cp -a "$HOME/.config/opencode/agents" "$BACKUP_O/opencode/"
  [ -e "$HOME/.config/opencode/skills" ] && cp -a "$HOME/.config/opencode/skills" "$BACKUP_O/opencode/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_O/agents/"
  [ -e "$HOME/.claude/skills" ] && cp -a "$HOME/.claude/skills" "$BACKUP_O/claude/"
  cp -a "$REPO_SKILLS" "$BACKUP_O/repo/"

  mkdir -p "$HOME/.config/opencode" "$HOME/.config/opencode/agents"
  cp -a "$REPO_ROOT/opencode/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"
  cp -a "$REPO_ROOT/opencode/agents/." "$HOME/.config/opencode/agents/"

  merge_missing_skills "$HOME/.config/opencode/skills"
  merge_missing_skills "$HOME/.agents/skills"
  merge_missing_skills "$HOME/.claude/skills"

  safe_link "$HOME/.config/opencode/skills" "$REPO_SKILLS"

  # optional legacy links
  safe_link "$HOME/.agents/skills" "$HOME/.config/opencode/skills"
  safe_link "$HOME/.claude/skills" "$HOME/.config/opencode/skills"

  echo "OpenCode deployed. Backup: $BACKUP_O"
fi

if [ "$TARGET" = "claude" ] || [ "$TARGET" = "all" ]; then
  BACKUP_CL="$HOME/.claude-backups/agent-skills-hook-$STAMP"
  mkdir -p "$BACKUP_CL/claude" "$BACKUP_CL/agents" "$BACKUP_CL/repo"

  [ -f "$HOME/.claude/AGENTS.md" ] && cp -a "$HOME/.claude/AGENTS.md" "$BACKUP_CL/claude/AGENTS.md"
  [ -f "$HOME/.claude/CLAUDE.md" ] && cp -a "$HOME/.claude/CLAUDE.md" "$BACKUP_CL/claude/CLAUDE.md"
  [ -f "$HOME/.claude/settings.json" ] && cp -a "$HOME/.claude/settings.json" "$BACKUP_CL/claude/settings.json"
  [ -d "$HOME/.claude/hooks" ] && cp -a "$HOME/.claude/hooks" "$BACKUP_CL/claude/"
  [ -e "$HOME/.claude/skills" ] && cp -a "$HOME/.claude/skills" "$BACKUP_CL/claude/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_CL/agents/"
  cp -a "$REPO_SKILLS" "$BACKUP_CL/repo/"

  mkdir -p "$HOME/.claude" "$HOME/.claude/hooks"
  cp -a "$REPO_ROOT/claude/AGENTS.md" "$HOME/.claude/AGENTS.md"
  if [ -f "$REPO_ROOT/claude/CLAUDE.md" ]; then
    cp -a "$REPO_ROOT/claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
  else
    cp -a "$REPO_ROOT/claude/AGENTS.md" "$HOME/.claude/CLAUDE.md"
  fi
  if [ -f "$REPO_ROOT/claude/hooks/user-prompt-skill-forced-eval.sh" ]; then
    cp -a "$REPO_ROOT/claude/hooks/user-prompt-skill-forced-eval.sh" "$HOME/.claude/hooks/user-prompt-skill-forced-eval.sh"
    chmod +x "$HOME/.claude/hooks/user-prompt-skill-forced-eval.sh"
  fi

  if [ -f "$REPO_ROOT/claude/settings.json" ]; then
    if [ -f "$HOME/.claude/settings.json" ] && command -v python3 >/dev/null 2>&1; then
      python3 - "$REPO_ROOT" <<'PY'
import json
import sys
from pathlib import Path

user_path = Path.home() / ".claude" / "settings.json"
repo_path = Path(sys.argv[1]) / "claude" / "settings.json"

try:
    user = json.loads(user_path.read_text(encoding="utf-8"))
except Exception:
    user = {}
repo = json.loads(repo_path.read_text(encoding="utf-8"))

user.setdefault("hooks", {})
for event, rules in repo.get("hooks", {}).items():
    existing = user["hooks"].get(event, [])
    keys = {json.dumps(r, sort_keys=True, ensure_ascii=False) for r in existing}
    for r in rules:
        k = json.dumps(r, sort_keys=True, ensure_ascii=False)
        if k not in keys:
            existing.append(r)
            keys.add(k)
    user["hooks"][event] = existing

user_path.write_text(json.dumps(user, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
    elif [ ! -f "$HOME/.claude/settings.json" ]; then
      cp -a "$REPO_ROOT/claude/settings.json" "$HOME/.claude/settings.json"
    fi
  fi

  merge_missing_skills "$HOME/.claude/skills"
  merge_missing_skills "$HOME/.agents/skills"

  safe_link "$HOME/.claude/skills" "$REPO_SKILLS"
  safe_link "$HOME/.agents/skills" "$HOME/.claude/skills"

  echo "Claude deployed. Backup: $BACKUP_CL"
fi
```

### AI Output Requirements
After running deployment, output:
1. Changed files/links.
2. Backup directory paths.
3. Verification results.
4. Any blocked step with exact reason.

### OpenCode Post-Deploy Quick Verification
Run these checks to confirm Gate-0/intent rules are in place:

```bash
test -f ~/.config/opencode/AGENTS.md && grep -n 'Gate-0\|task_contract\|intent\|code-review' ~/.config/opencode/AGENTS.md
```

```bash
test -f ~/.config/opencode/agents/orchestrator.md && grep -n 'No Phantom Artifacts\|Gate-0\|dev-feature' ~/.config/opencode/agents/orchestrator.md
```

```bash
test -f ~/.config/opencode/agents/scoper.md && grep -n 'task_contract\|gate0_evidence\|preconditions' ~/.config/opencode/agents/scoper.md
```

```bash
test ! -f ~/.config/opencode/agents/explore.md && echo 'OK: explore is native (no local explore.md)'
```

Rollback hint: restore `~/.config/opencode/AGENTS.md` and `~/.config/opencode/agents/` from latest `$BACKUP_O/opencode/`.

## 验证与回滚
### 验证
- Codex 规则检查：
```bash
codex execpolicy check --pretty --rules ~/.codex/rules/default.rules -- rm -rf /
```
- Codex 配置检查：`readlink -f ~/.codex/config.toml` 应指向 `<repo>/codex/config.toml`。
- Codex agents 检查：`readlink -f ~/.codex/agents` 应指向 `<repo>/codex/agents`。
- 新会话首条回复应出现：`SessionStart` 与 `Skill Match`。
- OpenCode 新会话首条回复应出现：`SessionStart` 与 `Skill Match`。
- Claude Code 新会话首条回复应出现：`SessionStart` 与 `Skill Match`。
- Claude 检查：`readlink -f ~/.claude/skills` 应指向 `<repo>/agents/skills`。

```bash
readlink -f ~/.codex/config.toml
```

```bash
readlink -f ~/.codex/agents
```

```bash
readlink -f ~/.claude/skills
```

```bash
test -f ~/.claude/CLAUDE.md && grep -n 'Skill Forced Eval' ~/.claude/CLAUDE.md
```

```bash
# 兼容保留：如果你仍在使用 AGENTS.md
test -f ~/.claude/AGENTS.md && grep -n 'Skill Forced Eval' ~/.claude/AGENTS.md
```

```bash
test -f ~/.claude/settings.json && python3 -m json.tool ~/.claude/settings.json >/dev/null
```

```bash
test -f ~/.claude/skills/skill-forced-eval/SKILL.md
```

```bash
# 可选：检查 hook 片段是否已合并
grep -n 'UserPromptSubmit' ~/.claude/settings.json
```

```bash
test -x ~/.claude/hooks/user-prompt-skill-forced-eval.sh
```

```bash
# 语义验证：新开 Claude 会话，首条响应包含 SessionStart，任意请求前有 Skill Match。
```



### 回滚
从最近备份目录手动恢复以下路径即可：
- Codex：`~/.codex/AGENTS.md`、`~/.codex/config.toml`、`~/.codex/agents/`、`~/.codex/rules/`、`~/.codex/skills`、`~/.agents/skills`
- OpenCode：`~/.config/opencode/AGENTS.md`、`~/.config/opencode/skills`、`~/.agents/skills`、`~/.claude/skills`
- Claude：`~/.claude/CLAUDE.md`、`~/.claude/AGENTS.md`、`~/.claude/settings.json`、`~/.claude/hooks/`、`~/.claude/skills`、`~/.agents/skills`

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
> 配置提示：若模型支持 variant 级别，GPT 系列 API 建议统一设置为 `xhigh`。

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
    "opencode-mem",
    "opencode-dcp",
    "opencode-browser"
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
