---
name: wx-dev-planner
description: Generate a deterministic plan.json from spec.json for WeChat Mini Program automation, including ordered tasks, dependencies, and execution metadata. Use after requirement specification and before implementation.
---

# wx-dev-planner

## Goal

Turn `artifacts/spec.json` into `artifacts/plan.json`.

## Execution

Run from `agents/skills/wx-full-pipeline`:

```bash
npm run wx:plan -- --spec artifacts/spec.json --output artifacts/plan.json
```

## Required Behavior

- Produce an ordered task list for preview, e2e, visual compare, and reporting.
- Attach source references to the spec artifact.
- Keep plan data deterministic.
