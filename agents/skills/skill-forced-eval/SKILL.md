---
name: skill-forced-eval
description: Force evaluation of available skills for every user request and invoke relevant skills.
---

# Skill Forced Eval

## Trigger
- Always run for every user request (global `AGENTS.md` enforces this).

## Steps
1. Load available skills from `~/.agents/skills` and `./.agents/skills` (if present).
2. Exclude `skill-forced-eval` from the candidate list.
3. Evaluate relevance to the current user request and add up to 5 matched skills.
4. Output a short **Skill Match** block with each matched skill and a one-line reason.
5. For each matched skill, use the platform's native skill invocation flow if one exists; otherwise open the selected `SKILL.md` directly and follow it.
6. If no skill matches, output `Skill Match: none` and continue normally.

## Fallback When Native Skill Invocation Is Unavailable

If the environment does not provide a dedicated native skill selector, mention syntax, or skill tool:

1. Read only the needed `SKILL.md` files with the available file/shell tools.
2. Follow the matched skill workflows manually.
3. Keep the fallback quiet and lightweight.
4. Do not stall, and do not emit dummy commands such as `true`.

## Constraints
- Keep the evaluation output short.
- Do not re-run `skill-forced-eval` recursively.
