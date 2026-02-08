#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="$HOME/.codex-backups"

if [ $# -ge 1 ]; then
  BACKUP_DIR="$1"
else
  BACKUP_DIR="$(ls -dt "$BACKUP_ROOT"/agent-skills-hook-* 2>/dev/null | head -1 || true)"
fi

if [ -z "${BACKUP_DIR:-}" ] || [ ! -d "$BACKUP_DIR" ]; then
  echo "No backup found. Provide a backup path as the first argument." >&2
  exit 1
fi

# Restore AGENTS and rules
if [ -f "$BACKUP_DIR/codex/AGENTS.md" ]; then
  mkdir -p "$HOME/.codex"
  cp -a "$BACKUP_DIR/codex/AGENTS.md" "$HOME/.codex/AGENTS.md"
fi
if [ -d "$BACKUP_DIR/codex/rules" ]; then
  mkdir -p "$HOME/.codex"
  rm -rf "$HOME/.codex/rules"
  cp -a "$BACKUP_DIR/codex/rules" "$HOME/.codex/"
fi

# Restore skills
if [ -d "$BACKUP_DIR/agents/skills" ]; then
  mkdir -p "$HOME/.agents"
  rm -rf "$HOME/.agents/skills"
  cp -a "$BACKUP_DIR/agents/skills" "$HOME/.agents/"
fi

cat <<MSG
Restore complete from: $BACKUP_DIR
Restart Codex CLI to reload settings.
MSG
