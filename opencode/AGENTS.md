# Global OpenCode Instructions (agent-skills-hook)

These instructions are loaded globally by OpenCode.

## SessionStart (once per session)
- On the first response of each new session, print a short block:
  - "SessionStart" header
  - Active instruction layers (global `~/.config/opencode/AGENTS.md`, repo `AGENTS.md` if present)
  - Skill sources (`~/.config/opencode/skills`, `./.opencode/skills`, `~/.agents/skills`, `./.agents/skills`, `~/.claude/skills`, `./.claude/skills`)
  - Optional instruction files (`~/.config/opencode/opencode.json`, `./opencode.json`) if present

## Skill Forced Eval (every user request)
- Before any work, always run the `skill` tool to load `skill-forced-eval` and follow its steps.

## Review Output Language
- When the user asks for a "review", the final response MUST be in Chinese. Keep all narrative/explanatory text in Chinese while preserving the required review structure and formatting rules.

## Tool Safety
- Obey tool permission rules. Never bypass safety checks unless the user explicitly asks and it is safe.

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)

## OpenCode Agent Teams
- Agent configs live in `opencode/agents/` and define two primary agents and four subagents.
- Primary agents: `orchestrator` (development team) and `triage` (hard-problem team, manual only).
- Subagents: `dev`, `qa`, `review`, `debug`.
- Escalation rule: `orchestrator` runs one quick `debug` pass on hard issues, then suggests manual `triage` if unresolved. No auto `triage`.

## Defaults (v2)
- `max_parallel_workers`: `4`
- `max_handoff_depth`: `3`
- `max_retries_per_stage`: `2`
- `triage_done_confidence_threshold`: `0.75`
- `orchestrator_self_execute_line_threshold`: `20`
- `max_state_loops`: `8`

## Routing Policy (v2)
- `orchestrator` is dispatch-first and should route work to subagents by default.
- `orchestrator` can only self-execute when all are true: low risk, single-file change, <= 20 changed lines, no cross-role verification needed.
- Use parallel dispatch for independent tasks (up to 4 workers). Use serial dispatch for shared-file dependencies.
- `triage` is manual-only and must never be auto-called.

## Completion Gates (v2)
- No evidence, no done.
- `triage` can return `done` only if `confidence >= triage_done_confidence_threshold`.
- `need-info` and `blocked` must include missing evidence and concrete `open_questions`.

## State Machine (v2)
- Allowed states: `todo -> in_progress -> done`.
- Exception states: `need-info`, `blocked`, `cancelled`.
- If retries exceed `max_retries_per_stage` or handoff depth exceeds `max_handoff_depth`, escalate or stop with explicit blocker.

## Task Protocol

Dispatch input (primary -> subagent):

```text
task_id:
goal:
context:
constraints:
inputs:
expected_outputs:
acceptance_criteria:
risks:
deadline:
```

Result output (subagent -> primary):

```text
task_id:
status: todo | in_progress | done | need-info | blocked | cancelled
findings:
evidence:
confidence:
next_actions:
open_questions:
```
