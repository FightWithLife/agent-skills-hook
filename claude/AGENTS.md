# Global Claude Instructions (agent-skills-hook)

These instructions are loaded globally by Claude Code.

## SessionStart (once per session)
- On the first response of each new session, print a short block:
  - "SessionStart" header
  - Active instruction layers (global `~/.claude/CLAUDE.md`, repo `CLAUDE.md` if present; include `AGENTS.md` only if used in current workspace)
  - Skill sources (`~/.claude/skills`, `./.claude/skills`, `~/.agents/skills`, `./.agents/skills`)
  - Optional instruction files (`~/.claude/settings.json`, `./.claude/settings.json`) if present

## Skill Forced Eval (every user request)
- Before any work, always run `Skill(skill-forced-eval)` and follow its steps.

## Review Output Language
- When the user asks for a "review", write the final response in Chinese while keeping the required review structure and formatting rules intact.

## Tool Safety
- Obey tool permission rules. Never bypass safety checks unless the user explicitly asks and it is safe.

## Embedded C Collaboration Mode
- Default to Claude direct execution for simple embedded C work: single-file edits, comment updates, constant adjustments, or scoped logic fixes with no build-system or hardware-facing risk.
- Escalate to Codex only when the task benefits from stronger execution bandwidth, broader file scope, build repair, or firmware-risk isolation.
- Preserve a lightweight default path. Do not delegate medium work automatically just because it is multi-step.
- Prioritize Make/CMake, cross-compilation, linker, startup, interrupt, register, and peripheral-risk awareness over generic app-development routing.

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)
