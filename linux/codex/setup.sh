#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEX_HOME="${HOME}/.codex"
LOCAL_BIN="${HOME}/.local/bin"
TARGET_CONFIG="${CODEX_HOME}/config.toml"

ensure_profile() {
  local profile_name="$1"
  local sandbox_mode="$2"
  local reasoning_effort="$3"

  if grep -q "^\[profiles\.${profile_name}\]$" "$TARGET_CONFIG"; then
    return 0
  fi

  cat >>"$TARGET_CONFIG" <<EOF

[profiles.${profile_name}]
approval_policy = "never"
sandbox_mode = "${sandbox_mode}"
model = "gpt-5.4"
model_reasoning_effort = "${reasoning_effort}"
EOF
}

mkdir -p "$CODEX_HOME" "$LOCAL_BIN"

if [ ! -f "$TARGET_CONFIG" ]; then
  cp "$SCRIPT_DIR/config.toml" "$TARGET_CONFIG"
fi

ensure_profile "light" "workspace-write" "low"
ensure_profile "review" "read-only" "high"
ensure_profile "orchestrated" "workspace-write" "high"
ensure_profile "claude_quiet" "workspace-write" "low"

if [ -f "$SCRIPT_DIR/bin/codex-quiet" ]; then
  cp "$SCRIPT_DIR/bin/codex-quiet" "$LOCAL_BIN/codex-quiet"
  chmod +x "$LOCAL_BIN/codex-quiet"
fi

printf 'Codex setup complete.\n'
printf 'Config: %s\n' "$TARGET_CONFIG"
printf 'Profiles ensured: light, review, orchestrated, claude_quiet\n'
