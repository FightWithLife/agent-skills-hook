#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="$HOME/.codex-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/agent-skills-hook-$STAMP"
GLOBAL_SKILLS="$HOME/.codex/skills"
LEGACY_SKILLS="$HOME/.agents/skills"
REPO_SKILLS="$REPO_ROOT/agents/skills"

# If skills are now a submodule, ensure it is initialized.
if [ -f "$REPO_ROOT/.gitmodules" ] && grep -q 'submodule "agents/skills"' "$REPO_ROOT/.gitmodules"; then
  if [ -L "$REPO_SKILLS" ]; then
    echo "Warning: $REPO_SKILLS is a symlink but is now a submodule. Removing symlink." >&2
    rm -f "$REPO_SKILLS"
  fi
  if command -v git >/dev/null 2>&1; then
    status_line="$(git -C "$REPO_ROOT" submodule status -- "$REPO_SKILLS" 2>/dev/null || true)"
    case "$status_line" in
      -*)
        echo "Initializing submodule $REPO_SKILLS..." >&2
        git -C "$REPO_ROOT" submodule update --init --recursive "$REPO_SKILLS"
        ;;
      +*|U*)
        echo "Warning: submodule $REPO_SKILLS is not at the recorded revision." >&2
        ;;
      "")
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

# Validate existing links
if [ -L "$GLOBAL_SKILLS" ] && [ ! -e "$GLOBAL_SKILLS" ]; then
  echo "Error: $GLOBAL_SKILLS is a broken symlink." >&2
  exit 1
fi
if [ -L "$LEGACY_SKILLS" ] && [ ! -e "$LEGACY_SKILLS" ]; then
  echo "Error: $LEGACY_SKILLS is a broken symlink." >&2
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
merge_skills_dir "$LEGACY_SKILLS"

# Link global skills to repo skills (single source of truth)
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

# Link legacy skills to global
mkdir -p "$(dirname "$LEGACY_SKILLS")"
if [ -L "$LEGACY_SKILLS" ]; then
  LEGACY_REAL="$(readlink -f "$LEGACY_SKILLS" 2>/dev/null || true)"
  GLOBAL_REAL="$(readlink -f "$GLOBAL_SKILLS" 2>/dev/null || true)"
  if [ "$LEGACY_REAL" != "$GLOBAL_REAL" ]; then
    rm -f "$LEGACY_SKILLS"
    ln -s "$GLOBAL_SKILLS" "$LEGACY_SKILLS"
  fi
elif [ -e "$LEGACY_SKILLS" ]; then
  if [ ! -d "$LEGACY_SKILLS" ]; then
    echo "Error: $LEGACY_SKILLS exists but is not a directory." >&2
    exit 1
  fi
  rm -rf "$LEGACY_SKILLS"
  ln -s "$GLOBAL_SKILLS" "$LEGACY_SKILLS"
else
  ln -s "$GLOBAL_SKILLS" "$LEGACY_SKILLS"
fi

cat <<MSG
Deploy complete.
Backup saved to: $BACKUP_DIR
Restart Codex CLI to load new global instructions.
MSG
