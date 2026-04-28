---
name: wx-regression-judge
description: Aggregate preview, smoke E2E, and visual regression outputs into a final acceptance report for WeChat Mini Program automation. Use as the final gate in the pipeline.
---

# wx-regression-judge

## Goal

Produce a final acceptance report artifact from upstream JSON outputs.

## Execution

Run from `agents/skills/wx-full-pipeline`:

```bash
npm run wx:judge
```

## Output

- `reports/acceptance_report.md`

## Required Behavior

- Include pass/fail decision.
- Include evidence file paths.
- Include failure reasons from preview/e2e/visual stages.
