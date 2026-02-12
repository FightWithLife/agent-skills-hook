#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="$HOME/.opencode-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/agent-skills-hook-$STAMP"
CONFIG_ROOT="$HOME/.config/opencode"
GLOBAL_AGENTS="$CONFIG_ROOT/AGENTS.md"
GLOBAL_SKILLS="$CONFIG_ROOT/skills"
GLOBAL_OMO_CONFIG="$CONFIG_ROOT/oh-my-opencode.json"
LEGACY_AGENTS_SKILLS="$HOME/.agents/skills"
LEGACY_CLAUDE_SKILLS="$HOME/.claude/skills"
REPO_SKILLS="$REPO_ROOT/agents/skills"
REPO_OMO_CONFIG="$REPO_ROOT/opencode/oh-my-opencode.json"

# If skills are now a submodule, ensure it is initialized.
if [ -f "$REPO_ROOT/.gitmodules" ] && grep -q 'submodule "agents/skills"' "$REPO_ROOT/.gitmodules"; then
  if [ -L "$REPO_SKILLS" ]; then
    echo "Warning: $REPO_SKILLS is a symlink but is now a submodule. Removing symlink." >&2
    rm -f "$REPO_SKILLS"
  fi
  if command -v git >/dev/null 2>&1; then
    status_line="$(git -C "$REPO_ROOT" submodule status -- "$REPO_SKILLS" 2>/dev/null || true)"
    case "$status_line" in
      -* )
        echo "Initializing submodule $REPO_SKILLS..." >&2
        git -C "$REPO_ROOT" submodule update --init --recursive "$REPO_SKILLS"
        ;;
      +*|U* )
        echo "Warning: submodule $REPO_SKILLS is not at the recorded revision." >&2
        ;;
      "" )
        echo "Warning: unable to read submodule status for $REPO_SKILLS." >&2
        ;;
    esac
  else
    echo "Warning: git not found; cannot initialize submodule $REPO_SKILLS." >&2
  fi
fi

if [ ! -d "$REPO_SKILLS" ]; then
  echo "Error: $REPO_SKILLS is missing. Ensure the submodule is initialized." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR/opencode" "$BACKUP_DIR/agents" "$BACKUP_DIR/claude" "$BACKUP_DIR/repo"

# Backup existing config if present
if [ -f "$GLOBAL_AGENTS" ]; then
  cp -a "$GLOBAL_AGENTS" "$BACKUP_DIR/opencode/AGENTS.md"
fi
if [ -f "$GLOBAL_OMO_CONFIG" ]; then
  cp -a "$GLOBAL_OMO_CONFIG" "$BACKUP_DIR/opencode/oh-my-opencode.json"
fi
if [ -e "$GLOBAL_SKILLS" ]; then
  cp -a "$GLOBAL_SKILLS" "$BACKUP_DIR/opencode/"
fi
if [ -e "$LEGACY_AGENTS_SKILLS" ]; then
  cp -a "$LEGACY_AGENTS_SKILLS" "$BACKUP_DIR/agents/"
fi
if [ -e "$LEGACY_CLAUDE_SKILLS" ]; then
  cp -a "$LEGACY_CLAUDE_SKILLS" "$BACKUP_DIR/claude/"
fi
if [ -e "$REPO_SKILLS" ]; then
  cp -a "$REPO_SKILLS" "$BACKUP_DIR/repo/"
fi

# Deploy AGENTS
mkdir -p "$CONFIG_ROOT"
cp -a "$REPO_ROOT/opencode/AGENTS.md" "$GLOBAL_AGENTS"

if [ -f "$REPO_OMO_CONFIG" ]; then
  cp -a "$REPO_OMO_CONFIG" "$GLOBAL_OMO_CONFIG"
fi

# Validate existing links
if [ -L "$GLOBAL_SKILLS" ] && [ ! -e "$GLOBAL_SKILLS" ]; then
  echo "Error: $GLOBAL_SKILLS is a broken symlink." >&2
  exit 1
fi

merge_skills_dir() {
  local src="$1"
  local real="$src"
  if [ -L "$src" ]; then
    real="$(readlink -f "$src" 2>/dev/null || true)"
  fi
  if [ -z "$real" ] || [ "$real" = "$REPO_SKILLS" ]; then
    return
  fi
  if [ -e "$real" ] && [ ! -d "$real" ]; then
    echo "Error: $src exists but is not a directory." >&2
    exit 1
  fi
  if [ -d "$real" ]; then
    for item in "$real"/*; do
      [ -e "$item" ] || continue
      name="$(basename "$item")"
      dest="$REPO_SKILLS/$name"
      if [ -e "$dest" ]; then
        continue
      fi
      cp -a "$item" "$REPO_SKILLS/"
    done
  fi
}

# Merge any existing skills into the repo submodule before linking.
merge_skills_dir "$GLOBAL_SKILLS"
merge_skills_dir "$LEGACY_AGENTS_SKILLS"
merge_skills_dir "$LEGACY_CLAUDE_SKILLS"

# Link OpenCode global skills to repo skills (single source of truth)
mkdir -p "$(dirname "$GLOBAL_SKILLS")"
if [ -L "$GLOBAL_SKILLS" ]; then
  GLOBAL_REAL="$(readlink -f "$GLOBAL_SKILLS" 2>/dev/null || true)"
  if [ "$GLOBAL_REAL" != "$REPO_SKILLS" ]; then
    rm -f "$GLOBAL_SKILLS"
    ln -s "$REPO_SKILLS" "$GLOBAL_SKILLS"
  fi
elif [ -e "$GLOBAL_SKILLS" ]; then
  if [ ! -d "$GLOBAL_SKILLS" ]; then
    echo "Error: $GLOBAL_SKILLS exists but is not a directory." >&2
    exit 1
  fi
  rm -rf "$GLOBAL_SKILLS"
  ln -s "$REPO_SKILLS" "$GLOBAL_SKILLS"
else
  ln -s "$REPO_SKILLS" "$GLOBAL_SKILLS"
fi

cat <<MSG
Deploy complete.
Backup saved to: $BACKUP_DIR
Restart OpenCode to load new global instructions.
MSG
