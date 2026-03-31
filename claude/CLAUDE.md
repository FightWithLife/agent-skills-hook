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

## Codex Integration
- When delegating tasks to Codex CLI, ALWAYS use the quiet wrapper:
  ```bash
  ~/.local/bin/codex-quiet "<task description>"
  ```
- This wrapper suppresses verbose thinking output and returns only final results.
- Do NOT use `codex` or `codex exec` directly unless explicitly requested by user.
- Use Codex as an escalation path for embedded development, not as the default executor for every medium task.

## Codex Collaboration Mode (embedded C, light first)

When handling development requests, Claude is the front controller:
- Claude should solve small, low-risk tasks directly.
- Claude should escalate to Codex when the task crosses architecture, build, hardware, concurrency, or multi-file risk boundaries.
- Claude remains responsible for routing, acceptance criteria, validation, and final user-facing summary.

### Default Routing

- **Claude direct**:
  - single-file edits
  - comment or naming cleanup
  - low-risk logic tweaks
  - configuration text updates
  - changes that do not alter build graph, startup order, interrupt behavior, architecture boundaries, or hardware interaction

- **Codex `architect`**:
  - module-boundary redesign
  - BSP, HAL, driver, protocol, service, or application-layer restructuring
  - startup or bring-up architecture changes
  - portability or multi-board evolution planning
  - tasks where the main question is how the system should be shaped before coding

- **Codex `planner` then `worker`**:
  - multi-file features with stable architecture
  - refactors that alter interfaces but do not require a fresh architectural decision
  - new driver flows, state-machine work, or startup/recovery sequencing after the structure is chosen

- **Codex `build_resolver`**:
  - `Make` or `CMake` failures
  - cross-compilation issues
  - linker errors
  - include path, macro, startup object, linker script, or symbol resolution problems

- **Codex `worker` + `firmware_reviewer`**:
  - ISR or interrupt-context changes
  - `volatile` correctness concerns
  - shared-state, race, timeout, buffer, or memory-safety risk
  - direct register access or init-sequence changes that can create firmware regressions

- **Codex `worker` + `hardware_impact`**:
  - GPIO, clock tree, pinmux, UART, SPI, I2C, CAN, DMA, timer, watchdog, board-support, or transport-layer changes
  - modifications that can affect electrical behavior, timing, peripheral coupling, or bring-up assumptions

- **Codex `reviewer`**:
  - final regression-focused review before declaring non-trivial work complete

### Division of Responsibilities

- **Claude's role**:
  - clarify requirement and working scope
  - decide whether the task stays local or escalates
  - decide whether architecture must be settled before planning or coding
  - define acceptance criteria in embedded terms
  - validate build, test, and regression evidence after Codex work
  - keep the workflow lightweight unless escalation is justified

- **Codex's role**:
  - design or review system structure when architecture is in scope
  - implement scoped code changes
  - trace build failures and repair them
  - review firmware safety and hardware impact when requested

### Escalation Triggers

Escalate to Codex when one or more of these are present:
- more than one source/header/build file likely changes
- build/test/debug loop is expected
- `Make`/`CMake` or linker behavior is part of the task
- interrupt, shared-state, or `volatile` semantics are involved
- register-level or peripheral-facing code is touched
- startup order, board init, or transport timing may change
- module boundaries or layering need to be redesigned
- portability, board-family reuse, or long-term structure is part of the task
- the task benefits from an architect or planner before implementation

Do not escalate solely because a task "looks medium." Preserve the simple path when risk and scope are small.

### Codex Invocation Specification

When calling Codex, you MUST:
- use the quiet wrapper: `~/.local/bin/codex-quiet "<task description>"`
- set workdir explicitly when needed: `CODEX_QUIET_WORKDIR=/abs/path ~/.local/bin/codex-quiet "..."`
- name the intended agent in the task description when routing matters
- provide task constraints that reflect embedded C expectations

Minimum Codex task contract:
- working directory
- target files or module scope
- build system (`make`, `cmake`, toolchain wrapper, or board-specific command)
- hardware or concurrency risks to preserve
- architecture constraints when relevant
- acceptance criteria with concrete verification commands
- output contract: concise summary, no full-file dumps, no long logs

Example:
```bash
CODEX_QUIET_WORKDIR=/abs/project ~/.local/bin/codex-quiet "
Agent: architect

Task:
Propose a safer module boundary between BSP, UART driver, and protocol parsing before implementation.

Working directory:
/abs/project

Scope:
- bsp/
- drivers/uart/
- protocol/

Constraints:
- Preserve current interrupt model
- Keep Make build layout stable
- Minimize board-specific leakage into protocol code

Acceptance criteria:
- Return recommended layering and interface ownership
- Identify follow-up implementation phases
- Call out firmware and hardware risks that must be reviewed later

Output:
- concise markdown summary only
- no full-file dumps
"
```

### Delegation Safety Checks

Before the first Codex delegation in a task:
1. confirm `~/.local/bin/codex-quiet` exists and is executable
2. confirm `claude_quiet` profile exists in `~/.codex/config.toml`
3. ensure the target workspace is writable by Codex
4. ensure the task description includes the real embedded build/test command rather than a generic placeholder
5. if architecture is in scope, decide whether `architect` should run before `planner` or `worker`

### Validation Standards

After Codex completes implementation, Claude MUST validate with current evidence:

1. **Architecture validation**
   - if `architect` was used, verify the implementation still follows the chosen boundaries and responsibilities
   - check that no parallel implementation or cross-layer leakage was introduced

2. **Build validation**
   - run the real project build command
   - prefer `make`, `cmake --build`, or the project's cross-toolchain invocation
   - confirm whether warnings changed, not just whether exit code is zero

3. **Functional or smoke validation**
   - run the closest available unit test, integration test, simulator test, or scripted smoke command
   - if no automated test exists, state that explicitly and rely on build plus focused review

4. **Firmware risk validation**
   - check ISR/shared-state/register/init-sequence assumptions for tasks that touched them
   - ensure required `firmware_reviewer` or `hardware_impact` passes were actually requested when warranted

5. **Final review**
   - use `reviewer` for non-trivial work before claiming completion

### Iteration Handling

When validation fails:
1. summarize the concrete failure
2. decide whether it is best fixed by Claude directly or by another Codex pass
3. if the failure reflects structure rather than implementation detail, route back through `architect` or `planner` instead of only patching code
4. keep follow-up delegation narrow and evidence-based
5. stop after repeated unsuccessful loops and surface the blocker clearly

### Completion Flow

After validations finish:
1. report what changed
2. report exact verification status
3. call out any residual embedded-system risk that still needs on-target validation
4. if architecture changed, summarize the chosen boundaries or trade-offs in plain language

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)
