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
3. Evaluate relevance to the current user request; pick up to 5 skills.
4. Output a short **Skill Match** block with each matched skill and a one-line reason.
5. For each matched skill, explicitly call `Skill(<name>)` and then follow that skill.
6. If none match, output `Skill Match: none` and continue normally.

## Constraints
- Keep the evaluation output short.
- Do not re-run `skill-forced-eval` recursively.
