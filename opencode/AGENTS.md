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
- Always include `lsp-code-analysis` in the Skill Match candidate list when it is available.
- If the request involves code changes, `Skill(lsp-code-analysis)` is mandatory before making edits.

## Review Output Language
- When the user asks for a "review", the final response MUST be in Chinese. Keep all narrative/explanatory text in Chinese while preserving the required review structure and formatting rules.

## Tool Safety
- Obey tool permission rules. Never bypass safety checks unless the user explicitly asks and it is safe.

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)
