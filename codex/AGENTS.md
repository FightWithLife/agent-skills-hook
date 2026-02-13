# Global Codex Instructions (agent-skills-hook)

These instructions are loaded globally by Codex CLI.

## SessionStart (once per session)
- On the first response of each new session, print a short block:
  - "SessionStart" header
  - Active instruction layers (global `~/.codex/AGENTS.md`, repo `AGENTS.md` if present)
  - Skill sources (`~/.agents/skills`, `./.agents/skills`)
  - Execpolicy rules path (`~/.codex/rules/*.rules`)

## Skill Forced Eval (every user request)
- Before any work, always run `Skill(skill-forced-eval)` and follow its steps.

## Review Output Language
- When the user asks for a "review", write the final response in Chinese while keeping the required review structure and formatting rules intact.

## Tool Safety
- Obey execpolicy rules. Never bypass safety checks unless the user explicitly asks and it is safe.

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)
