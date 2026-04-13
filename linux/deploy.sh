#!/bin/bash
# agent-skills-hook Linux 部署脚本
# 使用软链接方式部署配置

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(dirname "$SCRIPT_DIR")}"
TARGET="${TARGET:-both}"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Skills 位于仓库根目录
REPO_SKILLS="$REPO_ROOT/agents/skills"

# 各运行时配置位于 linux/ 目录
LINUX_ROOT="$REPO_ROOT/linux"

if [ ! -d "$REPO_SKILLS" ]; then
  echo "ERROR: $REPO_SKILLS missing. Run 'git submodule update --init --recursive agents/skills' first." >&2
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

# Codex 部署
if [ "$TARGET" = "codex" ] || [ "$TARGET" = "both" ] || [ "$TARGET" = "all" ]; then
  BACKUP_C="$HOME/.codex-backups/agent-skills-hook-$STAMP"
  mkdir -p "$BACKUP_C/codex" "$BACKUP_C/agents" "$BACKUP_C/repo"

  # 备份现有配置
  [ -f "$HOME/.codex/AGENTS.md" ] && cp -a "$HOME/.codex/AGENTS.md" "$BACKUP_C/codex/AGENTS.md"
  [ -f "$HOME/.codex/config.toml" ] && cp -a "$HOME/.codex/config.toml" "$BACKUP_C/codex/config.toml"
  [ -e "$HOME/.codex/agents" ] && cp -a "$HOME/.codex/agents" "$BACKUP_C/codex/"
  [ -d "$HOME/.codex/rules" ] && cp -a "$HOME/.codex/rules" "$BACKUP_C/codex/"
  [ -e "$HOME/.codex/skills" ] && cp -a "$HOME/.codex/skills" "$BACKUP_C/codex/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_C/agents/"
  cp -a "$REPO_SKILLS" "$BACKUP_C/repo/"

  # 创建目录
  mkdir -p "$HOME/.codex/rules" "$LINUX_ROOT/codex/agents"

  # 部署配置
  [ -f "$HOME/.codex/config.toml" ] && cp -an "$HOME/.codex/config.toml" "$LINUX_ROOT/codex/config.toml"
  cp -a "$LINUX_ROOT/codex/AGENTS.md" "$HOME/.codex/AGENTS.md"
  cp -a "$LINUX_ROOT/codex/rules/." "$HOME/.codex/rules/"
  [ -d "$HOME/.codex/agents" ] && cp -an "$HOME/.codex/agents/." "$LINUX_ROOT/codex/agents/"

  # 合并 skills
  merge_missing_skills "$HOME/.codex/skills"
  merge_missing_skills "$HOME/.agents/skills"

  # 创建软链接
  safe_link "$HOME/.codex/config.toml" "$LINUX_ROOT/codex/config.toml"
  safe_link "$HOME/.codex/agents" "$LINUX_ROOT/codex/agents"
  safe_link "$HOME/.codex/skills" "$REPO_SKILLS"
  safe_link "$HOME/.agents/skills" "$HOME/.codex/skills"

  echo "Codex deployed. Backup: $BACKUP_C"
fi

# OpenCode 部署
if [ "$TARGET" = "opencode" ] || [ "$TARGET" = "both" ] || [ "$TARGET" = "all" ]; then
  BACKUP_O="$HOME/.opencode-backups/agent-skills-hook-$STAMP"
  mkdir -p "$BACKUP_O/opencode" "$BACKUP_O/agents" "$BACKUP_O/claude" "$BACKUP_O/repo"

  # 备份现有配置
  [ -f "$HOME/.config/opencode/AGENTS.md" ] && cp -a "$HOME/.config/opencode/AGENTS.md" "$BACKUP_O/opencode/AGENTS.md"
  [ -d "$HOME/.config/opencode/agents" ] && cp -a "$HOME/.config/opencode/agents" "$BACKUP_O/opencode/"
  [ -e "$HOME/.config/opencode/skills" ] && cp -a "$HOME/.config/opencode/skills" "$BACKUP_O/opencode/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_O/agents/"
  [ -e "$HOME/.claude/skills" ] && cp -a "$HOME/.claude/skills" "$BACKUP_O/claude/"
  cp -a "$REPO_SKILLS" "$BACKUP_O/repo/"

  # 创建目录
  mkdir -p "$HOME/.config/opencode" "$HOME/.config/opencode/agents"

  # 部署配置
  cp -a "$LINUX_ROOT/opencode/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"
  if [ -d "$LINUX_ROOT/opencode/agents" ]; then
    cp -a "$LINUX_ROOT/opencode/agents/." "$HOME/.config/opencode/agents/"
  fi

  # 合并 skills
  merge_missing_skills "$HOME/.config/opencode/skills"
  merge_missing_skills "$HOME/.agents/skills"
  merge_missing_skills "$HOME/.claude/skills"

  # 创建软链接
  safe_link "$HOME/.config/opencode/skills" "$REPO_SKILLS"
  safe_link "$HOME/.agents/skills" "$HOME/.config/opencode/skills"
  safe_link "$HOME/.claude/skills" "$HOME/.config/opencode/skills"

  echo "OpenCode deployed. Backup: $BACKUP_O"
fi

# Claude Code 部署
if [ "$TARGET" = "claude" ] || [ "$TARGET" = "all" ]; then
  BACKUP_CL="$HOME/.claude-backups/agent-skills-hook-$STAMP"
  mkdir -p "$BACKUP_CL/claude" "$BACKUP_CL/agents" "$BACKUP_CL/repo"

  # 备份现有配置
  [ -f "$HOME/.claude/AGENTS.md" ] && cp -a "$HOME/.claude/AGENTS.md" "$BACKUP_CL/claude/AGENTS.md"
  [ -f "$HOME/.claude/CLAUDE.md" ] && cp -a "$HOME/.claude/CLAUDE.md" "$BACKUP_CL/claude/CLAUDE.md"
  [ -f "$HOME/.claude/settings.json" ] && cp -a "$HOME/.claude/settings.json" "$BACKUP_CL/claude/settings.json"
  [ -d "$HOME/.claude/hooks" ] && cp -a "$HOME/.claude/hooks" "$BACKUP_CL/claude/"
  [ -d "$HOME/.claude/agents" ] && cp -a "$HOME/.claude/agents" "$BACKUP_CL/claude/"
  [ -e "$HOME/.claude/skills" ] && cp -a "$HOME/.claude/skills" "$BACKUP_CL/claude/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_CL/agents/"
  cp -a "$REPO_SKILLS" "$BACKUP_CL/repo/"

  # 创建目录
  mkdir -p "$HOME/.claude" "$HOME/.claude/hooks"

  # 部署配置
  cp -a "$LINUX_ROOT/AGENTS.md" "$HOME/.claude/AGENTS.md"
  if [ -f "$LINUX_ROOT/claude/CLAUDE.md" ]; then
    cp -a "$LINUX_ROOT/claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
  else
    cp -a "$LINUX_ROOT/AGENTS.md" "$HOME/.claude/CLAUDE.md"
  fi
  if [ -d "$LINUX_ROOT/claude/hooks" ]; then
    cp -a "$LINUX_ROOT/claude/hooks/." "$HOME/.claude/hooks/"
    chmod +x "$HOME/.claude/hooks/user-prompt-skill-forced-eval.sh" 2>/dev/null || true
  fi
  if [ -d "$LINUX_ROOT/claude/agents" ]; then
    cp -a "$LINUX_ROOT/claude/agents/." "$HOME/.claude/agents/"
  fi

  # 合并 settings.json（如果存在）
  if [ -f "$LINUX_ROOT/claude/settings.json" ]; then
    if [ -f "$HOME/.claude/settings.json" ] && command -v python3 >/dev/null 2>&1; then
      python3 - "$REPO_ROOT" "$LINUX_ROOT" <<'PY'
import json
import sys
from pathlib import Path

user_path = Path.home() / ".claude" / "settings.json"
repo_path = Path(sys.argv[2]) / "claude" / "settings.json"

with open(user_path) as f:
    user_cfg = json.load(f)
with open(repo_path) as f:
    repo_cfg = json.load(f)

merged = user_cfg
merged_keys_merged = ["env"]
merged_keys_replaced = ["skills", "skillsOrder", "skillsDisabled", "mcpServers", "mcpServersOrder", "mcpServersDisabled"]

for key in merged_keys_merged:
    if key in repo_cfg:
        if key not in merged:
            merged[key] = {}
        for k, v in repo_cfg[key].items():
            if k not in merged[key]:
                merged[key][k] = v

for key in merged_keys_replaced:
    if key in repo_cfg:
        merged[key] = repo_cfg[key]

with open(user_path, "w") as f:
    json.dump(merged, f, indent=2, ensure_ascii=False)
PY
    elif [ ! -f "$HOME/.claude/settings.json" ]; then
      cp -a "$LINUX_ROOT/claude/settings.json" "$HOME/.claude/settings.json"
    fi
  fi

  # 合并 skills
  merge_missing_skills "$HOME/.claude/skills"
  merge_missing_skills "$HOME/.agents/skills"

  # 创建软链接
  safe_link "$HOME/.claude/skills" "$REPO_SKILLS"
  safe_link "$HOME/.agents/skills" "$HOME/.claude/skills"

  echo "Claude Code deployed. Backup: $BACKUP_CL"
fi

echo "Deployment complete."
