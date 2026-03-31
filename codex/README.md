# Codex Integration for Embedded C Workflows

This directory turns Codex into a focused execution layer for embedded firmware work instead of a heavy always-on orchestrator.

## Design Goals

- Keep the default path simple for one-file or low-risk changes.
- Escalate to Codex when build failures, multi-file firmware work, or hardware risk justify it.
- Reuse the stronger orchestration ideas from `everything-claude-code` without copying personal config or a heavy MCP footprint into the repo.
- Give Codex explicit architecture capability so it can reason about system structure before planning and implementation.

## Recommended Flow

1. Use Claude or Codex directly for small, local edits.
2. Route structural work through `architect` before implementation:
   - `architect`: module boundaries, BSP or HAL layering, startup sequencing, portability, and evolution paths
   - `planner`: executable implementation phases after the architecture direction is chosen
   - `worker`: minimal implementation in assigned scope
   - `build-resolver`: `Make` or `CMake`, compile, link, include, or toolchain failures
   - `firmware-reviewer`: ISR, `volatile`, register, DMA, timeout, or buffer risk review
   - `hardware-impact`: peripheral, clock, board-support, and bus impact review
   - `reviewer`: final regression pass
   - `explorer`: read-only tracing and codebase lookup
   - `monitor`: long-running build or serial-log observation
3. Keep default verification grounded in the repo's normal firmware commands, usually `make`, `cmake --build`, unit tests, and any board-level smoke checks you already use.

## Repo Files

- `AGENTS.md`: routing and escalation rules for embedded C work
- `config.toml`: shared, de-personalized repo config
- `config.template.toml`: local overlay template for providers, models, and trusted repos
- `agents/*.toml`: agent-specific prompt specializations
- `setup.sh`: minimal local install helper

## What Changed Relative to the Older Layout

- The shared config no longer contains personal provider endpoints or personal trusted project paths.
- Default profiles are split into `light`, `review`, `orchestrated`, and `claude_quiet`.
- The agent set is expanded from generic `explorer/worker/reviewer/monitor` to include embedded-C-specific architecture, planning, build repair, and risk review roles.
- MCP defaults stay light: `github`, `context7`, `memory`, and `sequential-thinking`.

## Local Setup

Run from the `codex/` directory:

```bash
./setup.sh
```

The helper:

- installs or refreshes `~/.local/bin/codex-quiet` if present in `codex/bin/`
- ensures `~/.codex/config.toml` exists
- appends the shared profile names if they are missing
- avoids writing personal provider config into the repo copy

## Local Overlay Guidance

Put these in your local `~/.codex/config.toml`, not in the repo:

- custom provider endpoints
- API auth preferences
- model overrides for your machine or budget
- trusted project paths for your private firmware repos
- heavier MCP servers you do not want as repo defaults

## Suggested Embedded C Delegation Rules

- Single file, no build fallout, low hardware risk: stay local.
- Architecture or module-boundary uncertainty: use `architect` first.
- Build break, linker failure, generated-file mismatch: use `build-resolver`.
- ISR or shared-state edits: require `firmware-reviewer`.
- Peripheral or board-init edits: require `hardware-impact`.
- Larger features or refactors: `architect` when structure is in play, then `planner`, then `worker`, then `reviewer`.
