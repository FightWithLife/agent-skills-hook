---
name: wx-visual-regression
description: Compare baseline and current Mini Program screenshots with pixel-level diff and threshold gating. Use for automated visual regression checks and diff artifact generation.
---

# wx-visual-regression

## Goal

Compare baseline and current screenshots and output pass/fail.

## Execution

Run from `agents/skills/wx-full-pipeline`:

```bash
npm run wx:visual -- --baseline baseline/index.png --current artifacts/e2e-current.png
```

## Outputs

- `artifacts/visual-diff.png`
- `artifacts/visual-report.json`

## Notes

- Use `--init-baseline` on first run to initialize baseline from current image.
