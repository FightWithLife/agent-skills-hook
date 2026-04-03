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

## Codex Integration (Plugin-Based)

Use the Codex plugin skills for delegation:
- `Skill(skill: "codex:rescue")` - Delegate investigation, fix requests, or rescue work to Codex
- The plugin handles runtime management, authentication, and result formatting automatically
- Use Codex as an escalation path for embedded development, not as the default executor for every medium task

## Codex Collaboration Mode (embedded C, light first)

When handling development requests, Claude is the front controller:
- Claude should solve small, low-risk tasks directly
- Claude should escalate to Codex when the task crosses architecture, build, hardware, concurrency, or multi-file risk boundaries
- Claude remains responsible for routing, acceptance criteria, validation, and final user-facing summary

### When to Escalate to Codex

Escalate using `Skill(skill: "codex:rescue")` when one or more of these are present:
- More than one source/header/build file likely changes
- Build/test/debug loop is expected
- `Make`/`CMake` or linker behavior is part of the task
- Interrupt, shared-state, or `volatile` semantics are involved
- Register-level or peripheral-facing code is touched
- Startup order, board init, or transport timing may change
- Module boundaries or layering need to be redesigned
- Portability, board-family reuse, or long-term structure is part of the task
- Architecture, build failures, or firmware safety reviews are needed

Do not escalate solely because a task "looks medium." Preserve the simple path when risk and scope are small.

### Claude Direct (No Escalation)

Handle these directly without Codex:
- Single-file edits
- Comment or naming cleanup
- Low-risk logic tweaks
- Configuration text updates
- Changes that do not alter build graph, startup order, interrupt behavior, architecture boundaries, or hardware interaction

### Validation Standards

After Codex completes work, Claude MUST validate with current evidence:

1. **Build validation** - run the real project build command (`make`, `cmake --build`, etc.)
2. **Functional validation** - run available unit tests, integration tests, or smoke tests
3. **Firmware risk validation** - check ISR/shared-state/register/init-sequence assumptions for relevant tasks
4. **Architecture validation** - verify implementation follows intended boundaries

### Completion Flow

After validations finish:
1. Report what changed
2. Report exact verification status
3. Call out any residual embedded-system risk that still needs on-target validation
4. If architecture changed, summarize the chosen boundaries or trade-offs

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)
