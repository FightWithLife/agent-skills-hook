---
name: wx-requirement-spec
description: Convert raw WeChat Mini Program requirements into a deterministic spec.json artifact with pages, acceptance criteria, expected screenshots, and metadata. Use when starting automated WeChat Mini Program delivery from natural language requirements.
---

# wx-requirement-spec

## Goal

Turn a requirement text file into `artifacts/spec.json`.

## Inputs

- Requirement text file (default: `input/requirement.txt`)

## Output

- `artifacts/spec.json`

## Execution

Run from `agents/skills/wx-full-pipeline`:

```bash
npm run wx:spec -- --input input/requirement.txt --output artifacts/spec.json
```

## Required Behavior

- Preserve original requirement text.
- Extract page paths like `/pages/**`.
- Build acceptance criteria from list-like lines.
- Extract expected screenshot names ending with `.png/.jpg/.jpeg`.
- Keep output stable and JSON-serializable.
