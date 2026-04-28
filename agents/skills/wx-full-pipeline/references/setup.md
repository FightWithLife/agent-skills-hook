# Setup

## 1) Install

Run in `agents/skills/wx-full-pipeline`:

```bash
npm install
```

## 2) Environment

```bash
copy .env.example .env
```

Required values:

- `APPID`: Mini Program appid
- `PRIVATE_KEY_PATH`: path to CI private key file
- `ROBOT`: upload robot id, usually `1`

Optional values:

- `PROJECT_PATH`: target Mini Program repository path (defaults to current working dir)
- `PREVIEW_PAGE`: preview page route
- `VISUAL_THRESHOLD`: diff ratio gate, default `0.01`

## 3) First Baseline

If baseline image does not exist, run:

```bash
npm run wx:visual -- --init-baseline
```

## 4) Full Pipeline

```bash
npm run wx:pipeline -- --requirement input/requirement.txt
```
