# Global OpenCode Instructions (agent-skills-hook)

These instructions are loaded globally by OpenCode.

## Scope
- This file keeps only OpenCode runtime-specific behavior.
- Shared repository rules live in the repo root `AGENTS.md` and `docs/agenting/*.md`.
- Detailed team routing, gates, and task protocol should live outside this entry file.

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

## Default Execution Style
- Default to delivery-first work: aim for a runnable, reviewable result instead of extended meta discussion.
- Prefer the smallest verifiable loop first, then iterate.
- Make reasonable assumptions to keep moving; only stop for irreversible decisions, destructive actions, or missing contract details.

## OpenCode Teaming
- Agent configs live in `opencode/agents/` and define the available primary agents and subagents.
- The orchestrator owns task splitting, dependency coordination, integration, verification, and cleanup.
- Use parallel dispatch only for independent work; serialize changes when tasks share files or environments.
- Close completed or stale subagents promptly instead of keeping unused context around.
- Detailed routing rules, gates, defaults, and task protocol live in `docs/agenting/opencode-runtime.md`, not in this entry file.

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Risks/uncovered items
  - Suggested next step (if any)
