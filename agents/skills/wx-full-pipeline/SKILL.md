---
name: wx-full-pipeline
description: "One-command orchestration for automated WeChat Mini Program delivery: requirement spec, planning, preview, smoke test, visual regression, and acceptance report generation. Use when user requests end-to-end unattended Mini Program workflow execution."
---

# wx-full-pipeline

## Goal

Run the full pipeline with a single command.

## Setup

From `agents/skills/wx-full-pipeline`:

```bash
npm install
copy .env.example .env
```

See `references/setup.md` for details.
Pipeline helper scripts are available under `scripts/`.

## Main Command

```bash
npm run wx:pipeline -- --requirement input/requirement.txt
```

## Stage Commands

```bash
npm run wx:spec
npm run wx:plan
npm run wx:preview
npm run wx:e2e
npm run wx:visual
npm run wx:judge
```

## Generated Artifacts

- `artifacts/spec.json`
- `artifacts/plan.json`
- `artifacts/preview-result.json`
- `artifacts/e2e-result.json`
- `artifacts/visual-report.json`
- `reports/acceptance_report.md`
