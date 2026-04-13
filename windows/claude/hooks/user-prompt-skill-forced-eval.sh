#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "$HOME/.claude/skills/skill-forced-eval/SKILL.md" ] && [ ! -f "$HOME/.agents/skills/skill-forced-eval/SKILL.md" ]; then
  echo "已阻止：在 ~/.claude/skills 或 ~/.agents/skills 中找不到 skill-forced-eval" >&2
  exit 42
fi

context="强制要求：在处理这个用户提示之前，先调用 Skill(skill-forced-eval)，输出一个简短的 'Skill Match' 区块，然后遵循匹配到的技能。如果没有任何技能匹配，就输出 'Skill Match: none' 并正常继续。"

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
