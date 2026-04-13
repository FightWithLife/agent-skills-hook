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
  [ -e "$HOME/.codex/skills" ] && cp -a "$HOME/.codex/skills" "$BACKUP_C/codex/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_C/agents/"
  cp -a "$REPO_SKILLS" "$BACKUP_C/repo/"

  # 部署配置（从 config/ 复制）
  mkdir -p "$HOME/.codex"
  cp -a "$CONFIG_ROOT/codex/AGENTS.md" "$HOME/.codex/AGENTS.md"

  # 合并 skills
  merge_missing_skills "$HOME/.codex/skills"
  merge_missing_skills "$HOME/.agents/skills"

  # 创建软链接
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
  [ -e "$HOME/.config/opencode/skills" ] && cp -a "$HOME/.config/opencode/skills" "$BACKUP_O/opencode/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_O/agents/"
  [ -e "$HOME/.claude/skills" ] && cp -a "$HOME/.claude/skills" "$BACKUP_O/claude/"
  cp -a "$REPO_SKILLS" "$BACKUP_O/repo/"

  # 部署配置（从 config/ 复制）
  mkdir -p "$HOME/.config/opencode"
  cp -a "$CONFIG_ROOT/opencode/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"

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
  [ -e "$HOME/.claude/skills" ] && cp -a "$HOME/.claude/skills" "$BACKUP_CL/claude/"
  [ -e "$HOME/.agents/skills" ] && cp -a "$HOME/.agents/skills" "$BACKUP_CL/agents/"
  cp -a "$REPO_SKILLS" "$BACKUP_CL/repo/"

  # 部署配置（从 config/ 复制）
  mkdir -p "$HOME/.claude"
  cp -a "$CONFIG_ROOT/AGENTS.md" "$HOME/.claude/AGENTS.md"
  cp -a "$CONFIG_ROOT/claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"

  # 合并 skills
  merge_missing_skills "$HOME/.claude/skills"
  merge_missing_skills "$HOME/.agents/skills"

  # 创建软链接
  safe_link "$HOME/.claude/skills" "$REPO_SKILLS"
  safe_link "$HOME/.agents/skills" "$HOME/.claude/skills"

  echo "Claude Code deployed. Backup: $BACKUP_CL"
fi

echo "Deployment complete."