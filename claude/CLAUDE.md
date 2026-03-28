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
- This wrapper suppresses verbose thinking output and returns only final results
- Do NOT use `codex` or `codex exec` directly unless explicitly requested by user
- The quiet wrapper is optimized for Claude-to-Codex delegation workflow

## Codex Collaboration Mode (默认自动路由)

When handling development requests, Claude acts as orchestrator by default:
- Claude decomposes tasks, writes implementation plan, and defines acceptance criteria.
- Medium/complex implementation is delegated to Codex for execution.
- Claude performs validation, regression checks, and iteration control.

### Division of Responsibilities

- **Claude's Role**:
  - Requirements analysis and technical planning
  - Architecture design and solution review
  - Code validation (code review, testing, performance, architecture compliance)
  - Iteration guidance and problem diagnosis

- **Codex's Role**:
  - Concrete code implementation
  - Execute development tasks according to Claude's plan

### Execution Mode Selection

Route by complexity (without requiring explicit "use codex" keywords):

- **Simple changes** (<50 lines, single file, no build/test chain): Claude executes directly.
- **Medium features** (50-200 lines, multi-step or multi-file): Auto-use `codex-orchestrator`.
- **Complex refactoring** (>200 lines, architecture impact, migration): Plan first, then auto-use `codex-orchestrator`.
- **User override**: if user explicitly requests "Claude direct" or "Codex direct", respect it.

### Codex Invocation Specification

When calling Codex, you MUST:
- **Use quiet wrapper**: `~/.local/bin/codex-quiet "<task description>"`
- **Do NOT use**: `codex` or `codex exec` commands (unless user explicitly requests)
- Set workdir explicitly when needed: `CODEX_QUIET_WORKDIR=/abs/path ~/.local/bin/codex-quiet "..."`
- The quiet wrapper suppresses verbose output, bounds final output size, and returns only final results
- Provide detailed implementation instructions including:
  - Working directory
  - Specific files to modify/create
  - Architecture constraints (refer to project architecture docs if available)
  - Code standards (comments, style, documentation format)
  - Acceptance criteria (testable, verifiable)
  - **Output contract**: no full-file dumps, no full logs, concise summary only

Example:
```bash
CODEX_QUIET_WORKDIR=/abs/project/root ~/.local/bin/codex-quiet "
Implementation requirement: [specific description]

Working directory: [project root path]

Files to create/modify:
- src/xxx.js
- include/xxx.h

Functional requirements:
1. ...
2. ...

Architecture constraints:
- Follow project architecture guidelines
- Reuse existing module boundaries
- Do not create parallel implementations

Code standards:
- Follow project code style
- Add necessary comments/documentation
- Keep code concise and maintainable

Acceptance criteria:
- Build passes without warnings
- Tests pass
- No performance degradation

Output constraints:
- Return concise markdown only
- Keep result under 200 lines
- If tests fail, include only key failing snippets
"
```

### Delegation Safety Checks

Before the first Codex delegation in a task:

1. Confirm `~/.local/bin/codex-quiet` exists and is executable.
2. Confirm `claude_quiet` profile exists in `~/.codex/config.toml`.
3. Ensure workspace is writable by Codex (use `CODEX_QUIET_WORKDIR` for target repo).
4. If delegation output is large, keep only concise summary in chat context.

### Validation Standards

After Codex completes implementation, Claude MUST perform comprehensive validation:

1. **Code Review**:
   - Code quality, security, style consistency
   - Comment/documentation completeness
   - Use `requesting-code-review` skill or manual review

2. **Build Test**:
   ```bash
   # Adjust based on project build system
   make clean && make -j$(nproc)
   # or npm run build
   # or cargo build
   ```
   - Must compile/build successfully without errors
   - Check for new warnings

3. **Functional Test**:
   - Run relevant test cases
   - Verify output correctness
   - Check for regressions

4. **Performance Check**:
   - Compare before/after performance (if relevant)
   - Check memory usage
   - Verify no obvious performance degradation

5. **Architecture Compliance**:
   - Verify adherence to project architecture guidelines
   - Check module boundaries are respected
   - Ensure no parallel implementations created
   - Validate against project change guidelines (if available)

### Iteration Handling

When validation fails:
1. Claude summarizes specific validation failures
2. Use `AskUserQuestion` to ask user how to proceed:
   - Option a: Let Codex automatically fix the issues
   - Option b: User provides specific fix guidance
   - Option c: Claude fixes issues directly
   - Option d: Abort and review manually
3. Execute corresponding action based on user choice
4. Maximum 3 iterations before escalating to user

### Completion Flow

After all validations pass:
1. Use `git-master` skill to commit code
2. Provide completion summary:
   - What was implemented
   - Validation results (all passed)
   - Files changed
   - Suggested next steps

## Stop (when task is complete)
- End with a short "Stop" block:
  - What changed
  - Tests/verification (or "Not run")
  - Suggested next step (if any)
