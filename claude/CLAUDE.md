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

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)
