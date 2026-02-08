#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="$HOME/.codex-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/agent-skills-hook-$STAMP"

mkdir -p "$BACKUP_DIR/codex" "$BACKUP_DIR/agents"

# Backup existing config if present
if [ -f "$HOME/.codex/AGENTS.md" ]; then
  cp -a "$HOME/.codex/AGENTS.md" "$BACKUP_DIR/codex/AGENTS.md"
fi
if [ -d "$HOME/.codex/rules" ]; then
  cp -a "$HOME/.codex/rules" "$BACKUP_DIR/codex/"
fi
if [ -d "$HOME/.agents/skills" ]; then
  cp -a "$HOME/.agents/skills" "$BACKUP_DIR/agents/"
fi

# Deploy AGENTS and rules
mkdir -p "$HOME/.codex/rules"
cp -a "$REPO_ROOT/codex/AGENTS.md" "$HOME/.codex/AGENTS.md"
cp -a "$REPO_ROOT/codex/rules/." "$HOME/.codex/rules/"

# Deploy skills
mkdir -p "$HOME/.agents/skills"
cp -a "$REPO_ROOT/agents/skills/." "$HOME/.agents/skills/"

# Ensure ~/.codex/skills has symlinks for non-system skills
mkdir -p "$HOME/.codex/skills"
for d in "$HOME/.agents/skills"/*; do
  name="$(basename "$d")"
  target="$HOME/.codex/skills/$name"
  if [ ! -e "$target" ]; then
    ln -s "$d" "$target"
  fi
done

cat <<MSG
Deploy complete.
Backup saved to: $BACKUP_DIR
Restart Codex CLI to load new global instructions.
MSG
