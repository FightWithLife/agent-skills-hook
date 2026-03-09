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

## Multi-Agent Defaults
- When a task has 2 or more independent subtasks, proactively use subagents without waiting for the user to ask.
- Stay single-agent for trivial tasks, tightly coupled refactors, or work that is likely to edit the same files.
- Prefer `explorer` for read-only investigation, root-cause analysis, and answering scoped codebase questions.
- Prefer `worker` for isolated implementation tasks with a clearly assigned file or module scope.
- Prefer `monitor` for long waits, polling, or background observation that would otherwise block the main agent.
- Prefer `reviewer` for code review, change-risk checks, and scoped verification feedback before finalizing.
- Treat subagents as scoped resources with an explicit lifecycle.
- Default to temporary subagents. Keep a subagent open only when near-term follow-up work will materially benefit from preserved context.
- Before spawning a new subagent, first decide whether an existing subagent can be reused for the same role and scope.
- If no reuse is justified, close completed or idle subagents that are no longer needed before spawning another one.
- Temporary subagents must be closed immediately after their output has been integrated.
- Long-lived subagents may be reused across related work, but must be explicitly closed as soon as they are no longer needed, including before ending the turn.
- If a subagent errors, is abandoned, or is being replaced, explicitly close it before spawning a replacement.
- If concurrent subagent slots are full or nearly full, do not spawn blindly; reclaim capacity through reuse or close-out first.
- After subagents finish, integrate results, close them according to the lifecycle rule, resolve conflicts, and verify before answering.

## Code Comment Requirement
- Any code you write or modify must include Chinese Doxygen-standard comments.

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)
