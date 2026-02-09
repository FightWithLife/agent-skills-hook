#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="$HOME/.codex-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/agent-skills-hook-$STAMP"
GLOBAL_SKILLS="$HOME/.codex/skills"
LEGACY_SKILLS="$HOME/.agents/skills"
REPO_SKILLS="$REPO_ROOT/agents/skills"

mkdir -p "$BACKUP_DIR/codex" "$BACKUP_DIR/agents" "$BACKUP_DIR/repo"

# Backup existing config if present
if [ -f "$HOME/.codex/AGENTS.md" ]; then
  cp -a "$HOME/.codex/AGENTS.md" "$BACKUP_DIR/codex/AGENTS.md"
fi
if [ -d "$HOME/.codex/rules" ]; then
  cp -a "$HOME/.codex/rules" "$BACKUP_DIR/codex/"
fi
if [ -e "$GLOBAL_SKILLS" ]; then
  cp -a "$GLOBAL_SKILLS" "$BACKUP_DIR/codex/"
fi
if [ -e "$LEGACY_SKILLS" ]; then
  cp -a "$LEGACY_SKILLS" "$BACKUP_DIR/agents/"
fi
if [ -e "$REPO_SKILLS" ]; then
  cp -a "$REPO_SKILLS" "$BACKUP_DIR/repo/"
fi

# Deploy AGENTS and rules
mkdir -p "$HOME/.codex/rules"
cp -a "$REPO_ROOT/codex/AGENTS.md" "$HOME/.codex/AGENTS.md"
cp -a "$REPO_ROOT/codex/rules/." "$HOME/.codex/rules/"

# Ensure global skills exists (seed from repo if needed)
if [ -L "$GLOBAL_SKILLS" ] && [ ! -e "$GLOBAL_SKILLS" ]; then
  echo "Error: $GLOBAL_SKILLS is a broken symlink." >&2
  exit 1
fi
if [ -e "$GLOBAL_SKILLS" ] && [ ! -d "$GLOBAL_SKILLS" ]; then
  echo "Error: $GLOBAL_SKILLS exists but is not a directory." >&2
  exit 1
fi
if [ ! -e "$GLOBAL_SKILLS" ]; then
  mkdir -p "$GLOBAL_SKILLS"
  if [ -d "$REPO_SKILLS" ] && [ ! -L "$REPO_SKILLS" ]; then
    cp -a "$REPO_SKILLS/." "$GLOBAL_SKILLS/"
  fi
fi

# Merge legacy skills into global and link legacy path
if [ -e "$LEGACY_SKILLS" ]; then
  if [ -L "$LEGACY_SKILLS" ] && [ ! -e "$LEGACY_SKILLS" ]; then
    rm -f "$LEGACY_SKILLS"
    mkdir -p "$(dirname "$LEGACY_SKILLS")"
    ln -s "$GLOBAL_SKILLS" "$LEGACY_SKILLS"
  else
  GLOBAL_REAL="$(readlink -f "$GLOBAL_SKILLS")"
  LEGACY_REAL="$(readlink -f "$LEGACY_SKILLS" 2>/dev/null || true)"
  if [ -n "$LEGACY_REAL" ] && [ "$LEGACY_REAL" != "$GLOBAL_REAL" ]; then
    if [ -d "$LEGACY_SKILLS" ]; then
      for src in "$LEGACY_SKILLS"/*; do
        [ -e "$src" ] || continue
        name="$(basename "$src")"
        dst="$GLOBAL_SKILLS/$name"
        if [ -e "$dst" ]; then
          if [ -L "$dst" ]; then
            dst_target="$(readlink -f "$dst" 2>/dev/null || true)"
            case "$dst_target" in
              "$LEGACY_REAL"/*)
                rm -f "$dst"
                cp -a "$src" "$GLOBAL_SKILLS/"
                ;;
            esac
          fi
        else
          cp -a "$src" "$GLOBAL_SKILLS/"
        fi
      done
    else
      echo "Error: $LEGACY_SKILLS exists but is not a directory." >&2
      exit 1
    fi
    rm -rf "$LEGACY_SKILLS"
    mkdir -p "$(dirname "$LEGACY_SKILLS")"
    ln -s "$GLOBAL_SKILLS" "$LEGACY_SKILLS"
  fi
  fi
else
  mkdir -p "$(dirname "$LEGACY_SKILLS")"
  ln -s "$GLOBAL_SKILLS" "$LEGACY_SKILLS"
fi

# Link repo skills to global (single source of truth)
if [ -L "$REPO_SKILLS" ]; then
  REPO_REAL="$(readlink -f "$REPO_SKILLS" 2>/dev/null || true)"
  GLOBAL_REAL="$(readlink -f "$GLOBAL_SKILLS")"
  if [ "$REPO_REAL" != "$GLOBAL_REAL" ]; then
    rm -f "$REPO_SKILLS"
    ln -s "$GLOBAL_SKILLS" "$REPO_SKILLS"
  fi
else
  if [ -e "$REPO_SKILLS" ]; then
    rm -rf "$REPO_SKILLS"
  fi
  ln -s "$GLOBAL_SKILLS" "$REPO_SKILLS"
fi

cat <<MSG
Deploy complete.
Backup saved to: $BACKUP_DIR
Restart Codex CLI to load new global instructions.
MSG
