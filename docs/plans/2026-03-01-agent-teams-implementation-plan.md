# Agent Teams Configuration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build repository documentation that defines two agent teams (development orchestration and issue triage), their operating protocol, and an HTML architecture diagram for OpenCode usage.

**Architecture:** Use one shared operating model with platform-specific instruction packaging. The documentation defines role boundaries, task handoff protocol, and escalation behavior; the HTML diagram visualizes team topology, data flow, and model allocation. The final output is documentation-first and does not change runtime code.

**Tech Stack:** Markdown, HTML, inline CSS, ASCII diagrams/spec tables

---

## Master Todo List

- [ ] Define deliverables and acceptance criteria for AGENTS-oriented documentation
- [ ] Specify role model for Team A (`orchestrator`) and Team B (`triage`)
- [ ] Define subagent contracts (`dev`, `qa`, `review`, `debug`) with I/O protocol
- [ ] Encode escalation policy (`orchestrator` -> quick `debug` -> suggest manual `triage`)
- [ ] Assign models by role and usage intent
- [ ] Produce architecture diagram in HTML with team lanes and flow arrows
- [ ] Add verification checklist for maintainers

## Scope

This plan documents how to structure instructions for OpenCode:

- `opencode/AGENTS.md` (OpenCode instruction layer)
- optional OpenCode agent configuration and markdown agent files

It does not introduce runnable multi-agent framework code. It defines instructions, workflow contracts, and implementation guidance.

## Team Design

### Team A: Development Team

- **Primary agent:** `orchestrator`
- **Mission:** Decompose and dispatch development tasks, collect outputs, and deliver integrated progress.
- **Allowed subagents:** `dev`, `qa`, `review`, `debug`
- **Escalation behavior:**
  1. For suspected hard problems, dispatch `debug` for one quick triage pass.
  2. If unresolved, instruct user to manually invoke `triage`.
  3. Do not auto-invoke `triage`.
  4. `debug` is callable by `orchestrator` without manual user trigger.

### Team B: Hard-Problem Team

- **Primary agent:** `triage` (manual user invocation only)
- **Mission:** Locate root cause through hypothesis-driven narrowing and verification loops.
- **Allowed subagents:** `debug`, `dev`
- **Completion:** Root-cause report with reproducible evidence and fix validation.
- **Manual trigger boundary:** only `triage` requires manual invocation; `debug` does not.

## Subagent Contracts

### `dev`

- Implement minimal, testable changes against explicit acceptance criteria.
- Return changed file paths, validation commands, and known risks.

### `qa`

- Validate feature behavior and regression boundaries.
- Return pass/fail matrix, reproduction steps for failures, and environment notes.

### `review`

- Perform structured review with severity and impact.
- Return findings in `critical/high/medium/low` with actionable recommendations.

### `debug`

- Perform localization and may implement fix when feasible.
- Required evidence chain: `symptom -> localization evidence -> fix evidence -> regression evidence`.

## Task Protocol Template

### Dispatch Input (primary -> subagent)

```text
task_id:
goal:
context:
constraints:
inputs:
expected_outputs:
acceptance_criteria:
risks:
deadline:
```

### Result Output (subagent -> primary)

```text
task_id:
status: done | blocked | need-info
findings:
evidence:
next_actions:
open_questions:
```

## Model Allocation Plan

- `orchestrator`: **GPT-5.2**
- `dev`: **GPT-5.3 Codex**
- `triage`: **GPT-5.2**
- `qa`: **GPT-5.3 Codex**
- `debug`: **GPT-5.3 Codex**
- `review`: **GPT-5.2 Codex**

Rationale:

- High-iteration implementation/testing agents (`dev`, `qa`, `debug`) use Codex-oriented model.
- Strategy/control agents (`orchestrator`, `triage`) use GPT-5.2 for orchestration and reasoning.
- Review remains on GPT-5.2 Codex for code-sensitive critique and consistency.

## OpenCode Authoring Guidance

### For `opencode/AGENTS.md`

- Keep a template section for each primary agent behavior and invocation policy.
- Add explicit task delegation rules and tool-safety expectations.
- Include manual invocation note for `triage`.
- Keep references aligned with OpenCode agent invocation patterns.

### For OpenCode agent config (optional)

- Mirror the same role names for primary/subagent definitions.
- Keep model mapping and responsibility boundaries consistent with AGENTS.md.
- Preserve the manual-only trigger policy for `triage`.

## Verification Checklist

- [ ] Role names are consistent across OpenCode instruction and agent config
- [ ] `triage` is manual-only everywhere
- [ ] `orchestrator` escalation rule matches: quick `debug` then suggest manual `triage`
- [ ] `debug` is explicitly marked as auto-callable by `orchestrator`
- [ ] Task input/output templates are present and complete
- [ ] Model mapping exactly matches requested assignment
- [ ] Architecture HTML renders team lanes and flow clearly

## Execution Tasks (Bite-Sized)

### Task 1: Plan Doc Finalization

**Files:**
- Create: `docs/plans/2026-03-01-agent-teams-implementation-plan.md`

**Step 1: Draft final structure**

Write sections for goal, architecture, roles, protocol, and models.

**Step 2: Add todo checklist and verification list**

Include checkbox-based lists for progress and auditability.

**Step 3: Verify content consistency**

Confirm role names and escalation logic are consistent.

**Step 4: Confirm model mapping**

Check each role maps to the exact requested model.

### Task 2: Architecture Diagram Delivery

**Files:**
- Create: `docs/architecture/agent-teams-architecture.html`

**Step 1: Build team-lane diagram skeleton**

Create two major team containers and six role nodes.

**Step 2: Draw flow links and policy notes**

Represent dispatch, quick debug, manual triage, and report feedback paths.

**Step 3: Add model mapping legend**

Include each role with assigned model.

**Step 4: Add implementation notes panel**

Describe how this architecture maps into OpenCode AGENTS and agent configuration.
