#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="$HOME/.opencode-backups"

if [ $# -ge 1 ]; then
  BACKUP_DIR="$1"
else
  BACKUP_DIR="$(ls -dt "$BACKUP_ROOT"/agent-skills-hook-* 2>/dev/null | head -1 || true)"
fi

if [ -z "${BACKUP_DIR:-}" ] || [ ! -d "$BACKUP_DIR" ]; then
  echo "No backup found. Provide a backup path as the first argument." >&2
  exit 1
fi

# Restore AGENTS and skills
if [ -f "$BACKUP_DIR/opencode/AGENTS.md" ]; then
  mkdir -p "$HOME/.config/opencode"
  cp -a "$BACKUP_DIR/opencode/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"
fi
if [ -e "$BACKUP_DIR/opencode/skills" ]; then
  mkdir -p "$HOME/.config/opencode"
  rm -rf "$HOME/.config/opencode/skills"
  cp -a "$BACKUP_DIR/opencode/skills" "$HOME/.config/opencode/"
fi

# Restore legacy skills
if [ -e "$BACKUP_DIR/agents/skills" ]; then
  mkdir -p "$HOME/.agents"
  rm -rf "$HOME/.agents/skills"
  cp -a "$BACKUP_DIR/agents/skills" "$HOME/.agents/"
fi
if [ -e "$BACKUP_DIR/claude/skills" ]; then
  mkdir -p "$HOME/.claude"
  rm -rf "$HOME/.claude/skills"
  cp -a "$BACKUP_DIR/claude/skills" "$HOME/.claude/"
fi

cat <<MSG
Restore complete from: $BACKUP_DIR
Restart OpenCode to reload settings.
MSG
