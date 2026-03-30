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

## Multi-Agent Defaults
- When a task has 2 or more independent subtasks, proactively use subagents without waiting for the user to ask.
- Stay single-agent for trivial tasks, tightly coupled refactors, or work that is likely to edit the same files.
- Only the main agent may delegate to subagents. Child agents must not spawn or wait on other subagents; if broader coordination is needed, they must return control to the main agent.
- Prefer `explorer` for read-only investigation, root-cause analysis, and answering scoped codebase questions.
- Prefer `worker` for isolated implementation tasks with a clearly assigned file or module scope.
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
- `wait_agent` 只负责等待子代理结果；如果返回超时、空状态，或尚未收到 `completed`，主代理只能继续等待或报告”仍在等待”，不得自行补齐调查、代替子代理下结论，或把未完成状态当成完成。
- 只要仍有活跃子代理在处理同一任务，主代理就不得自行补充调查、不得读取同一作用域的新材料，也不得提前给出结论；必要时只能等待或切到不重叠的其他任务。
- 如需核验结论，优先派发独立 `reviewer` 子代理，而不是由主代理代替复核后直接收尾。

## Reviewer Contract Freeze
- Once a reviewer is launched, its contract is frozen until it returns `final` or is explicitly canceled.
- While frozen, the main agent must not send follow-up instructions that narrow, compress, reprioritize, or otherwise reshape the active review, including requests such as `findings only`, `short answer`, `just give the conclusion`, or `only check X`.
- The only allowed messages to an active reviewer are explicit cancellation, scope correction, or answers to blocking questions asked by that reviewer.
- Repeated `wait_agent` calls that return timeout, empty status, or `No agents completed yet` do not unlock any additional authority over the active reviewer.
- If the scope or output format must change, cancel the current reviewer first, then launch a new reviewer with the new contract.
- If a reviewer is stalled, the only permitted recovery is cancel-and-restart. Pinging for a faster answer is prohibited.
- In wait mode, the main agent must not read the same diff, reopen the same files, infer a conclusion from partial output, or "finish the review" on its own.

## Subagent Wait Discipline
- Before a subagent returns `completed` or `final`, the main agent must not rush it, ping for status, ask it to answer faster, ask for a partial conclusion first, or otherwise compress the active contract.
- Prohibited follow-up messages include `ping`, `check in`, `status?`, `how long`, `quick update`, `just give me the conclusion`, `short answer`, `findings only`, or equivalent催促/压缩性表述。
- While a subagent is still running, the main agent must not "help out" by reading the same scope again,补做同一调查、代写同一实现、补齐同一结论，或以“先看一下/先补一下/先写个草稿”为名绕过等待。
- Once ownership has been assigned to a subagent, the main agent must not抢做、插手、并行覆盖其作用域内的同一任务；如果 ownership 不再合适，只能取消后重派，不能边等边接管。
- If `wait_agent` returns timeout, empty status, or no completion, the main agent may only continue waiting, report that it is still waiting, or switch to a non-overlapping task. It must not treat the unfinished task as completed.
- The main agent must not use repeated `wait_agent` timeouts as justification to infer likely results, summarize expected conclusions, or continue as though the delegated work had already landed.
- If scope, priority, output format, or depth must change, the current subagent must be explicitly canceled before launching a replacement. Do not reshape an in-flight assignment through follow-up pressure.
- If a subagent is stalled, the only permitted recovery is cancel-and-restart or reassignment with a new contract. Nudging for speed is prohibited.

## Multi-Agent Enforcement (Strong-by-Default)
- If a task can be split into 2+ independent parallelizable subtasks, spawn subagents first instead of defaulting to single-agent trial.
- For non-trivial tasks, use at least 2 subagents by default.
- Treat a task as trivial only when all conditions are met: single objective, single step, no cross-module impact, no new verification chain, <=20 changed lines, and single-file completion.
- Main agent responsibility is orchestration only: decomposition, delegation, integration, conflict handling, and final verification.
- Child agents are execution-only and must not recursively delegate, wait on additional subagents, or re-run the orchestration policy.
- Delegation must include explicit ownership (file/module write scope) for each subagent.
- If write scopes overlap and cannot be cleanly split, downgrade to single-agent or serialized execution.
- Temporary subagents must not be closed before their `final` output has been received and integrated, except when the task is canceled, the subagent is unusable or stalled, or capacity must be reclaimed.
- Single-agent whitelist: one-file micro edit (<20 lines), tightly coupled same-file refactor, one-shot query/explanation task.
- For each parallel round, record `spawn/reuse/close`, and include assignment summary, output summary, and close-out record.

## Code Comment Requirement
- Any code you write or modify must include Chinese Doxygen-standard comments.

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)
