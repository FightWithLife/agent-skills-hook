---
name: daily-news-brief
description: Generate a daily news briefing and deep evaluation when the user asks to collect or summarize daily news (e.g., "daily news", "today's news", "news brief", or Chinese-language equivalents). Always use the china-news-crawler skill to collect Chinese news sources first, then write the brief and in-depth evaluation in Simplified Chinese unless the user requests another language.
---

# Daily News Brief

## Overview
Provide a concise daily news briefing plus a separate deep evaluation. Always collect sources via the china-news-crawler skill before writing.

## Workflow
1. Confirm scope.
   - If no date is specified, use the current date and state it explicitly.
   - If a date range is specified, restate it and proceed.
   - If the user wants non-China coverage, ask whether China-focused sources are acceptable before proceeding.
2. Collect news using the `china-news-crawler` skill.
   - Prefer the platform's native skill invocation flow when available.
   - If native skill invocation is unavailable, open the selected `SKILL.md` and follow it manually.
   - Request multiple categories (politics, economy, tech, society, international).
   - Prefer multiple sources and keep 6-12 items.
3. Write the News Brief.
   - Include: Date, Top Highlights (3-5), then Category sections.
   - Each item must include: title, source, 1-2 sentence summary, and "Why it matters" (1 sentence).
4. Write the Deep Evaluation.
   - Provide 3-5 thematic analyses or focus on the top stories.
   - For each evaluation, cover: context/drivers, stakeholder impact, second-order effects, risks/uncertainties, and likely follow-ups.
   - Avoid shallow sentiment; use evidence from the collected news and note uncertainty or bias.
5. Ask a brief follow-up question about the user's preferred focus for tomorrow or for deeper dives.

## Resource Directories
- Automation helpers: `scripts/`
- Source notes and references: `references/`
- Brief templates and assets: `assets/`

## Output Format (Markdown)
```
# Daily News Brief (YYYY-MM-DD) [write headings and content in Simplified Chinese]

## Top Highlights (3-5)
1. Title (Source)
   - Summary:
   - Why it matters:

## By Category
### Politics
- Title (Source)
  - Summary:
  - Why it matters:

### Economy
...

## Deep Evaluation
1. Theme/Event
   - Context and drivers:
   - Stakeholder impact:
   - Second-order effects:
   - Risks and uncertainty:
   - Likely follow-ups:

## Follow-up Question
```
