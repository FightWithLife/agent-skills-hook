---
name: wx-code-implementer
description: Execute implementation tasks from plan.json in a WeChat Mini Program repository with minimal diffs and verifiable outputs. Use when plan tasks require code updates before preview and automated testing.
---

# wx-code-implementer

## Goal

Implement plan tasks in the target Mini Program codebase with minimal changes.

## Inputs

- `artifacts/plan.json`
- Target repository path (current working repository)

## Required Behavior

- Apply only plan-scoped code changes.
- Preserve existing code style and project conventions.
- Produce verifiable outputs for downstream preview and testing.

## Verification

- Run project build/test commands if available.
- Ensure no new diagnostics introduced in edited files.
