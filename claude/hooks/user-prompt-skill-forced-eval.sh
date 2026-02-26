#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "$HOME/.claude/skills/skill-forced-eval/SKILL.md" ] && [ ! -f "$HOME/.agents/skills/skill-forced-eval/SKILL.md" ]; then
  echo "Blocked: skill-forced-eval not found in ~/.claude/skills or ~/.agents/skills" >&2
  exit 42
fi

context="MANDATORY: Before any work on this user prompt, call Skill(skill-forced-eval), output a short 'Skill Match' block, then follow matched skills. If no skill matches, output 'Skill Match: none' and continue normally."

escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

context_escaped="$(escape_for_json "$context")"

cat <<EOF
{
  "additional_context": "${context_escaped}",
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "${context_escaped}"
  }
}
EOF
