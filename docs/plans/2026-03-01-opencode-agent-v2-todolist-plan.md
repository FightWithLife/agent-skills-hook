# OpenCode Agent Team v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the OpenCode agent system so `orchestrator` is dispatch-first for daily coding work, while `triage` is manual-only for hard-problem localization and root-cause convergence.

**Architecture:** Keep the six-agent topology (`orchestrator`, `triage`, `dev`, `qa`, `review`, `debug`) and strengthen it through prompt constraints, structured handoff protocol, and explicit routing thresholds. The design enforces evidence-first decisions, bounded delegation, and predictable escalation from quick `debug` to manual `triage`.

**Tech Stack:** Markdown agent prompts, OpenCode frontmatter fields (`mode`, `model`, `tools`, `permission`), git, shell validation.

---

## Master Todo List

- [ ] Freeze default routing parameters in docs and prompts
- [ ] Enforce dispatch-first behavior in `orchestrator`
- [ ] Enforce hypothesis-driven workflow in `triage`
- [ ] Standardize evidence-chain outputs in `debug`
- [ ] Align `dev`/`qa`/`review` boundaries and handoff fields
- [ ] Add unified protocol + state machine rules in `opencode/AGENTS.md`
- [ ] Run review and regression checks before rollout
- [ ] Sync to global OpenCode directory with backup

## Default Parameters (Approved)

- `max_parallel_workers`: `4`
- `max_handoff_depth`: `3`
- `max_retries_per_stage`: `2`
- `triage_done_confidence_threshold`: `0.75`
- `orchestrator_self_execute_line_threshold`: `20`
- `max_state_loops`: `8`

## Task 1: Lock Protocol Defaults

**Files:**
- Modify: `opencode/AGENTS.md`
- Reference: `docs/plans/2026-03-01-agent-teams-implementation-plan.md`

**Step 1: Add default parameter block**

Document approved thresholds in one place so every agent prompt can reference them.

**Step 2: Add routing policy section**

State that orchestrator is dispatch-first, triage is manual-only, and quick debug is the first escalation action.

**Step 3: Add state-machine gates**

Define when `done` is allowed (`evidence` present + confidence threshold met for triage results).

## Task 2: Strengthen Orchestrator Prompt

**Files:**
- Modify: `opencode/agents/orchestrator.md`

**Step 1: Add dispatch-first hard rule**

Make self-execution an exception path, not default behavior.

**Step 2: Add self-execution exception criteria**

Allow only if low risk + single-file + small change (<= 20 lines) + no cross-role verification needed.

**Step 3: Add parallel scheduling rule**

Enable parallel dispatch up to 4 workers when tasks are independent; force serial mode on shared-file dependencies.

**Step 4: Add escalation clause**

Require one quick debug pass before suggesting manual triage invocation.

## Task 3: Upgrade Triage Prompt for Hard Problems

**Files:**
- Modify: `opencode/agents/triage.md`

**Step 1: Add hypothesis loop**

Force `hypothesis -> test -> verdict -> confidence -> next_action` for each iteration.

**Step 2: Add minimum reproducible case requirement**

Require trigger conditions, expected vs actual output, and environment context.

**Step 3: Add completion gate**

Allow `done` only when confidence >= 0.75 and evidence chain is complete.

**Step 4: Add blocked/need-info template**

If unresolved, require missing information list and next experiment plan.

## Task 4: Normalize Debug Evidence Chain

**Files:**
- Modify: `opencode/agents/debug.md`

**Step 1: Add reproduction-first rule**

Require reproduce -> localize -> change -> regress flow.

**Step 2: Enforce four-part evidence chain**

Mandate `symptom -> localization evidence -> fix evidence -> regression evidence` in output.

**Step 3: Add escalation trigger**

If two iterations fail or evidence conflicts, return escalation recommendation to triage.

## Task 5: Align Dev, QA, Review Boundaries

**Files:**
- Modify: `opencode/agents/dev.md`
- Modify: `opencode/agents/qa.md`
- Modify: `opencode/agents/review.md`

**Step 1: Tighten role scope text**

Ensure each file states clear can-do / cannot-do boundaries.

**Step 2: Align protocol field wording**

Keep input/output field names consistent with global protocol.

**Step 3: Add evidence expectations**

Require test commands/results for dev/qa and severity-tagged findings for review.

## Task 6: Regression and Consistency Check

**Files:**
- Check: `opencode/AGENTS.md`
- Check: `opencode/agents/*.md`

**Step 1: Verify model IDs**

Confirm all model IDs use `openai/*`.

**Step 2: Verify routing constraints**

Ensure orchestrator cannot auto-call triage and triage remains manual-only.

**Step 3: Verify protocol parity**

Ensure all agents use the same task input/output schema.

**Step 4: Verify default thresholds presence**

Ensure all six default parameters are represented either globally or by explicit agent references.

## Task 7: Rollout and Deployment

**Files:**
- Source: `opencode/AGENTS.md`
- Source: `opencode/agents/*.md`
- Target: `~/.config/opencode/AGENTS.md`
- Target: `~/.config/opencode/agents/*.md`

**Step 1: Backup global config**

Create `~/.opencode-backups/agent-skills-hook-<timestamp>/opencode` and copy existing global files.

**Step 2: Sync repository config**

Copy repo files to global OpenCode directories.

**Step 3: Verify deployment**

List files in `~/.config/opencode/agents/` and confirm expected six files exist.

## Task 8: Commit and Push

**Files:**
- Stage only: `opencode/AGENTS.md`, `opencode/agents/*.md`, optional docs update if changed

**Step 1: Stage related files only**

Use `git add` on task-related files.

**Step 2: Commit with Chinese message body**

Use conventional commit with `变更点` and `原因` sections.

**Step 3: Push to remote**

Push current working branch after local verification is clean; use PR flow when branch protection is enabled.
