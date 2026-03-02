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
- Agent configs live in `opencode/agents/` and define two primary agents plus native/extended subagents.
- Primary agents: `orchestrator` (development team) and `triage` (hard-problem team, manual only).
- Subagents:
  - Native: `explore` (OpenCode upstream native subagent; do not add local `explore.md` pseudo-implementation)
  - Local: `dev`, `qa`, `review`, `debug`, `scoper`, `impact`, `security`
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
- Any substantive review output MUST be executed by `review` subagent; `orchestrator` must not act as reviewer.
- Use parallel dispatch for independent tasks (up to 4 workers). Use serial dispatch for shared-file dependencies.
- `triage` is manual-only and must never be auto-called.
- Route hints:
  - Unknown context / unclear scope first goes to `explore` (native).
  - Scope ambiguity can route to `scoper`.
  - Cross-module regression risk can route to `impact`.
  - Sensitive paths (auth/input/data exposure) can route to `security`.

## Completion Gates (v2)
- No evidence, no done.
- Gate-0 (Scope Ready): before dispatching any execution subagent (`dev/qa/review/debug/impact/security`), `task_contract.version == v1` and `gate0_evidence.scope_ready == true` are required.
- Gate-0 is a contract-readiness gate (not a fixed pipeline gate): after Gate-0 passes, orchestrator can route by `task_contract.intent`.
- Only when `task_contract.intent == dev-feature`, enforce `dev -> qa -> review` and keep existing Gate-2 `code-review` checks unchanged.
- `triage` can return `done` only if `confidence >= triage_done_confidence_threshold`.
- `need-info` and `blocked` must include missing evidence and concrete `open_questions`.
- Phase order: `explore/scoper/impact/security (optional)` -> `dev` -> `qa` -> `review`.
- `review_mode`:
  - `plan-review`: opt-in only (not default).
  - `code-review`: strict gate, must satisfy all:
    - `dev.status == done`
    - `dev.evidence.commands` has >= 1 command with `result_summary`
    - `qa.status == done` and `qa.verdict == pass`
    - `qa.evidence.checks` has >= 1 check with `result` + `summary`
  - If any condition is missing, orchestrator MUST NOT trigger `code-review`.

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

task_contract:
  version: v1
  intent: review-only | qa-only | debug-only | dev-feature | impact | security
  out_of_scope:
  target_files:

gate0_evidence:
  scope_ready: true | false
  source: scoper | orchestrator
  summary:
  refs:
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
