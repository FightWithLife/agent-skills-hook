# Global Codex Instructions (agent-skills-hook)

These instructions are loaded globally by Codex CLI.

## SessionStart (once per session)
- On the first response of each new session, print a short block:
  - "SessionStart" header
  - Active instruction layers (global `~/.codex/AGENTS.md`, repo `AGENTS.md` if present)
  - Skill sources (`~/.agents/skills`, `./.agents/skills`)
  - Execpolicy rules path (`~/.codex/rules/*.rules`)

## Skills (every user request)
- Before any substantial work, evaluate whether any available skill matches the request using Codex's native skill mechanism.
- Use Codex-native skill semantics:
  - explicit invocation uses `$skill-name`;
  - implicit invocation is allowed when the request clearly matches a skill `description`;
  - load full `SKILL.md` content only for the skills that are actually selected.
- Do not require or simulate non-native function-style calls such as `Skill(...)` or `skills(...)`.
- Prefer repository and user skill metadata first; only read the selected skill's files when needed.
- If the current runtime does not expose native skill selection UI or native skill mentions, manually read only the matched `SKILL.md` files with normal file/shell tools and follow them quietly.
- Do not emit boilerplate fallback text, fake tool calls, or no-op commands just to satisfy the skill workflow.

## Review Output Language
- When the user asks for a "review", write the final response in Chinese while keeping the required review structure and formatting rules intact.

## Tool Safety
- Obey execpolicy rules. Never bypass safety checks unless the user explicitly asks and it is safe.

## Embedded C Collaboration Mode
- Optimize for embedded firmware work that is mostly C with `Make` or `CMake`.
- Stay lightweight by default. Do not escalate to extra agents when a direct answer or one-file fix is enough.
- Treat Codex as a full workflow layer for architecture, planning, execution, build repair, and focused risk review.
- Keep default recommendations compatible with low-friction workflows: local edit, local build, then focused review.

## Agent Routing
- Use `explorer` for read-only codebase understanding, build graph tracing, macro/config lookup, and locating init or call paths.
- Use `architect` before structural changes: module boundaries, BSP or HAL layering, startup sequencing, interface ownership, portability strategy, or long-term extensibility decisions.
- Use `planner` after architecture is clear to turn the chosen direction into low-risk implementation phases and concrete acceptance checks.
- Use `worker` for isolated implementation once the target files and acceptance criteria are clear.
- Use `build-resolver` when the issue is in `Make` or `CMake`, toolchain setup, compile flags, include paths, linker scripts, map files, unresolved symbols, or generated-code steps.
- Use `firmware-reviewer` when changes touch ISR context, `volatile`, register access, shared state, memory-mapped IO, DMA buffers, timeouts, or buffer ownership.
- Use `hardware-impact` when changes affect clocks, GPIO, UART, SPI, I2C, CAN, timers, DMA channels, board-support packages, or peripheral muxing.
- Use `reviewer` as the final general regression pass after implementation and focused risk review are done.
- Use `monitor` only for long-running build, flash, log-tail, or hardware-test observation.

## Default Development Flow
- Small, single-file, low-risk fixes: stay local or use `worker` directly.
- New subsystem, module split, BSP refactor, or interface redesign: `architect` -> `planner` -> `worker`.
- Multi-file feature with stable architecture: `planner` -> `worker`.
- Build failure or toolchain break: `build-resolver`, then `reviewer` if the fix is non-trivial.
- ISR, shared-state, register, DMA, or timeout-sensitive changes: `worker` -> `firmware-reviewer` -> `reviewer`.
- Peripheral, clock, board-support, or bus-level changes: `worker` -> `hardware-impact` -> `reviewer`.

## Escalation Rules
- Stay single-agent for small, single-file, low-risk changes with no build fallout and no hardware-facing behavior change.
- Escalate to `architect` when any of these appear:
  - module boundary or ownership confusion
  - BSP, HAL, driver, protocol, and application layering changes
  - startup order or board initialization redesign
  - portability, reuse, or future board-family support requirements
  - large refactors where structure matters more than code motion
- Escalate to `planner` when architecture is already understood but the implementation still spans multiple files or verification steps.
- If two independent checks are required, split by responsibility rather than having one agent do everything.

## Embedded C Architecture Checklist
- Confirm layer boundaries across BSP, HAL, drivers, protocol, services, and application logic.
- Confirm init order, reset state, and ownership of board bring-up responsibilities.
- Check global-state surface area, interrupt-to-task handoff boundaries, and dependency direction.
- Prefer interfaces that support board variation without scattering conditionals and hardware details.
- Prefer changes that improve testability, replaceability, and fault isolation without over-engineering.

## Embedded C Review Checklist
- Confirm init order, reset state, and failure paths are explicit.
- Check `volatile`, lockless shared-state access, ISR/task handoff, and timeout behavior.
- Check buffer bounds, units, integer width, signedness, and endianness where relevant.
- Check register writes for read-modify-write hazards and peripheral enable/clock dependencies.
- Check `Make` or `CMake` deltas for include-path drift, macro drift, and linker-script impact.

## Code Comment Requirement
- Any code you write or modify must include Chinese Doxygen-standard comments.

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)
