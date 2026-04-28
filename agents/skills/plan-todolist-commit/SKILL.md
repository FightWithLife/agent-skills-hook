---
name: plan-todolist-commit
description: Use when executing a plan with a todolist/todo/checklist file and there is a risk of checking off progress without creating the matching git commit for that completed item.
---

# Plan Todolist Commit Discipline

## Overview
Enforce todo-by-todo commits and todolist synchronization during plan-driven implementation.

**Core principle:** a todo item is not complete until its todolist update and its local git commit both exist.

**Violating the letter of these rules is violating the spirit of these rules.**

**REQUIRED SUB-SKILL:** Use `verification-before-completion` before claiming a todo item, phase, or task is complete.

## Iron Law

```
NO COMPLETED TODO ITEM WITHOUT A FRESH LOCAL COMMIT
```

If this skill is active, it counts as explicit user authorization to run `git add` and `git commit` for the completed todo item. Do not ask again unless a higher-priority instruction forbids committing.

## Required Workflow
1. Detect whether the current plan includes a todolist document (for example: `todolist.md`, `humantodo.md`, `todo.md`, `checklist.md`, or an explicitly named todo file).
2. Before starting each phase, identify the todolist items that belong to this phase, then name the single todo item you are completing now.
3. Record the current `HEAD` for that todo item before you stage or commit anything.
4. Every time one todo item is completed, update the todolist immediately before continuing.
5. After that update, stage the todolist file and only the implementation/doc files for that todo item.
6. Check the staged file list and ensure no unrelated file is staged for this commit.
7. Create exactly one local commit for this completed todo item.
8. Verify that the commit really exists before moving to the next todo item or claiming progress.
9. This commit must include both: (a) the change points of this todo item, and (b) the todolist document update for this item.
10. If one phase contains multiple todo items, repeat steps 4-9 per item; do not wait until the phase end to commit.
11. Commit message for each todo-item commit must be written in Chinese and clearly describe that item.

## Todolist Update Rules (per completed item)
For each completed todo entry, record all three parts in the todolist:
- **做了什么**: concrete deliverable or change.
- **怎么做的**: key implementation steps, commands, or method.
- **为什么这么做**: reason/trade-off that led to this approach.

If the existing todolist format is checkbox-based, keep that format and append these details under the completed item.

## Commit Execution Gate
After each completed todo item, run the real commit flow. The minimum acceptable sequence is:

```bash
before_head=$(git rev-parse --short HEAD)
git status --short
git add <todo-file> <related-files>
git diff --cached --name-only
git commit -m "<中文提交标题>" -m "<提交说明>"
after_head=$(git rev-parse --short HEAD)
git log -1 --stat --name-only
```

The todo item is complete only if all of the following are true:
- `git commit` returned success.
- `before_head` and `after_head` are different.
- `git diff --cached --name-only` showed only this todo item's files before the commit.
- The latest commit includes the todolist document.
- The latest commit includes the related implementation/doc files for that same todo item.

Phrases like “稍后提交”, “准备提交”, “已经打勾”, or “这一项已完成只差 commit” still mean the todo item is **not complete**.

If `git log --oneline -1` does not show the new todo-item commit yet, do not say the item is complete.

## Reporting Gate
After a completed todo item, any progress update or final response must include commit evidence for that item:
- report the new commit SHA or `git log -1 --oneline` result; or
- explicitly report the blocker that prevented `git commit` from succeeding.

Saying “已完成”, “已更新待办”, or “可以提交了” without commit evidence is a violation of this skill.

## Commit Rules
- One completed todo item must map to one commit.
- Do not batch multiple completed todo items into one commit.
- Each time an AI completes one todo item, it must create one commit immediately for that item before proceeding.
- It is forbidden to finish multiple todo items first and then submit them together in a single commit.
- If multiple todo items were completed before committing, the AI must still split the corresponding code changes and the checkbox/documentation updates into separate commits, one commit per todo item.
- Every item commit must include both implementation/doc change points and the todolist update for that same item.
- If a todo item is done but not documented yet, update todolist first, then commit.
- Do not finish a phase while any completed todo item is still uncommitted.
- Commit message must be Chinese and describe the completed todo item concretely.
- If two todo items cannot be split into isolated commits in a technically coherent way, stop and report that the plan document is underspecified; recommend merging those todo items in the plan/todolist before continuing.

## Failure Handling
- If `git commit` fails because hooks, tests, merge conflicts, or formatting checks reject it, the todo item remains incomplete.
- If unrelated files are already staged, unstage or isolate them before committing this todo item.
- Fix the blocker, restage the todo-item files, and retry the commit.
- If the todolist item was already checked off, revert it to unchecked or mark it blocked until the matching commit actually exists.
- Do not start the next todo item while the current completed item is still uncommitted.
- If a higher-priority instruction truly forbids committing, stop and report that blocker explicitly. Do not imply that the todo item or phase is complete.
- If multiple todo items were implemented together by mistake, do not keep them bundled in one commit by convenience; first attempt to separate the changes and todolist checkmarks into one commit per todo item.
- If that separation is not realistically possible because the changes are inherently entangled, explicitly report that the current todo granularity is invalid and that those todo items should be merged in the plan document.

## Rationalization Prevention
- “用户没有再次明确说要提交” -> This skill already provides that authorization.
- “先把这个 phase 做完再一起提交” -> Violation. Commit per completed todo item.
- “我一次做完两个 todo，最后一起提交更省事” -> Violation. Split them into one commit per todo item.
- “两个 todo 已经一起改了，没必要拆” -> Only acceptable if the changes truly cannot be isolated; in that case report that the plan items should be merged instead of forcing an incoherent commit split.
- “我已经更新 todolist 了” -> Still incomplete without a fresh commit.
- “仓库里还有别的改动，先不提交” -> Stage only this todo item's files and commit now. Unrelated local changes are not an excuse.
- “别的文件已经 staged 了，顺手一起提交” -> Violation. One todo item maps to one isolated commit.
- “我会在最终总结里说明没提交” -> Not allowed if the todo item was claimed complete.

## Red Flags - STOP
- You are about to say “完成了” but have not run `git log --oneline -1`.
- You are about to move to the next todo item while the current one has no matching commit.
- You are leaving a checked checkbox in the todolist even though `git commit` failed.
- You are describing an intended commit instead of running `git commit`.
- `git diff --cached --name-only` shows files unrelated to the current todo item.

## Quick Commit Checklist
Before each todo-item commit, verify:
- [ ] Exactly one todo item has just been completed.
- [ ] The previous `HEAD` for this todo item was recorded.
- [ ] Relevant todo items are marked and documented with 做了什么 / 怎么做的 / 为什么这么做.
- [ ] Todolist document is staged.
- [ ] Related implementation/doc files for this todo item are staged.
- [ ] No unrelated file is staged for this todo-item commit.
- [ ] Commit message is in Chinese and clearly describes this todo item.
- [ ] `git commit` has actually succeeded and produced a new `HEAD`.
- [ ] The response will include commit evidence instead of only describing intent.
