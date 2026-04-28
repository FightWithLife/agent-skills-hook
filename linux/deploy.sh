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

# 配置源位于 config/ 目录（自包含）
CONFIG_ROOT="$REPO_ROOT/config"
CODEX_AGENTS="$CONFIG_ROOT/codex/agents"

if [ ! -d "$REPO_SKILLS" ]; then
  echo "ERROR: $REPO_SKILLS missing. Run 'git submodule update --init --recursive agents/skills' first." >&2
  exit 1
fi

if [ ! -d "$CODEX_AGENTS" ]; then
  echo "ERROR: $CODEX_AGENTS missing." >&2
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
  mkdir -p "$BACKUP_C/codex" "$BACKUP_C/repo"

  # 备份现有配置
  [ -f "$HOME/.codex/AGENTS.md" ] && cp -a "$HOME/.codex/AGENTS.md" "$BACKUP_C/codex/AGENTS.md"
  [ -e "$HOME/.codex/agents" ] && cp -a "$HOME/.codex/agents" "$BACKUP_C/codex/"
  [ -e "$HOME/.codex/skills" ] && cp -a "$HOME/.codex/skills" "$BACKUP_C/codex/"
  cp -a "$REPO_SKILLS" "$BACKUP_C/repo/"

  # 部署配置（从 config/ 复制）
  mkdir -p "$HOME/.codex"
  cp -a "$CONFIG_ROOT/codex/AGENTS.md" "$HOME/.codex/AGENTS.md"
  safe_link "$HOME/.codex/agents" "$CODEX_AGENTS"

  # 合并 skills
  merge_missing_skills "$HOME/.codex/skills"

  # 创建软链接
  safe_link "$HOME/.codex/skills" "$REPO_SKILLS"

  if [ -e "$HOME/.agents/skills" ]; then
    echo "Legacy Codex skill root detected at $HOME/.agents/skills. Archive or remove it to avoid duplicate skill scanning."
  fi

  echo "Codex deployed. Backup: $BACKUP_C"
fi

# OpenCode 部署
if [ "$TARGET" = "opencode" ] || [ "$TARGET" = "both" ] || [ "$TARGET" = "all" ]; then
  BACKUP_O="$HOME/.opencode-backups/agent-skills-hook-$STAMP"
  mkdir -p "$BACKUP_O/opencode" "$BACKUP_O/claude" "$BACKUP_O/repo"

  # 备份现有配置
  [ -f "$HOME/.config/opencode/AGENTS.md" ] && cp -a "$HOME/.config/opencode/AGENTS.md" "$BACKUP_O/opencode/AGENTS.md"
  [ -e "$HOME/.config/opencode/skills" ] && cp -a "$HOME/.config/opencode/skills" "$BACKUP_O/opencode/"
  [ -e "$HOME/.claude/skills" ] && cp -a "$HOME/.claude/skills" "$BACKUP_O/claude/"
  cp -a "$REPO_SKILLS" "$BACKUP_O/repo/"

  # 部署配置（从 config/ 复制）
  mkdir -p "$HOME/.config/opencode"
  cp -a "$CONFIG_ROOT/opencode/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"

  # 合并 skills
  merge_missing_skills "$HOME/.config/opencode/skills"
  merge_missing_skills "$HOME/.claude/skills"

  # 创建软链接
  safe_link "$HOME/.config/opencode/skills" "$REPO_SKILLS"
  safe_link "$HOME/.claude/skills" "$HOME/.config/opencode/skills"

  if [ -e "$HOME/.agents/skills" ]; then
    echo "Legacy shared skill root detected at $HOME/.agents/skills. OpenCode now uses $HOME/.config/opencode/skills as the primary user skill root."
  fi

  echo "OpenCode deployed. Backup: $BACKUP_O"
fi

# Claude Code 部署
if [ "$TARGET" = "claude" ] || [ "$TARGET" = "all" ]; then
  BACKUP_CL="$HOME/.claude-backups/agent-skills-hook-$STAMP"
  mkdir -p "$BACKUP_CL/claude" "$BACKUP_CL/repo"

  # 备份现有配置
  [ -f "$HOME/.claude/AGENTS.md" ] && cp -a "$HOME/.claude/AGENTS.md" "$BACKUP_CL/claude/AGENTS.md"
  [ -f "$HOME/.claude/CLAUDE.md" ] && cp -a "$HOME/.claude/CLAUDE.md" "$BACKUP_CL/claude/CLAUDE.md"
  [ -e "$HOME/.claude/skills" ] && cp -a "$HOME/.claude/skills" "$BACKUP_CL/claude/"
  cp -a "$REPO_SKILLS" "$BACKUP_CL/repo/"

  # 部署配置（从 config/ 复制）
  mkdir -p "$HOME/.claude"
  cp -a "$CONFIG_ROOT/AGENTS.md" "$HOME/.claude/AGENTS.md"
  cp -a "$CONFIG_ROOT/claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"

  # 合并 skills
  merge_missing_skills "$HOME/.claude/skills"

  # 创建软链接
  safe_link "$HOME/.claude/skills" "$REPO_SKILLS"

  echo "Claude Code deployed. Backup: $BACKUP_CL"
fi

echo "Deployment complete."
