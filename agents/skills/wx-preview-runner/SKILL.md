---
name: wx-preview-runner
description: Run WeChat Mini Program preview and smoke E2E automation through miniprogram-ci and miniprogram-automator. Use for automatic preview generation, page launch, click/input actions, screenshots, and machine-readable smoke results.
---

# wx-preview-runner

## Goal

Generate preview artifacts and smoke test evidence.

## Execution

Run from `agents/skills/wx-full-pipeline`:

```bash
npm run wx:preview
npm run wx:e2e -- --actions input/e2e-actions.json
```

## Required Environment

- `APPID`
- `PRIVATE_KEY_PATH`
- `ROBOT` (default `1`)
- `PROJECT_PATH` (optional, default current directory)

## Outputs

- `artifacts/preview-result.json`
- `artifacts/e2e-result.json`
- `artifacts/e2e-current.png`
