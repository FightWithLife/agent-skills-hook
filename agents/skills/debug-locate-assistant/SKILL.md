---
name: debug-locate-assistant
description: Use when regression localization is needed to pinpoint where a problem occurs (file:line/function) in native C/C++ systems.
---

# Debug Locate Assistant

## Overview
This is the merged localization skill for native regressions.

Goal: identify the exact `file:line` + function + trigger condition using evidence.

Tactics (choose per iteration):
- Route A: logging probes + rerun narrowing (coarse to fine)
- Route B: GDB stack/frame/memory/core analysis for host-runnable binaries or host-generated core dumps

This skill is for localization first, not direct fixing.

## Mandatory artifact: Markdown investigation log
- For every debugging task, create and maintain one shared Markdown log file with table-based records, default path: `debug_investigation.md` (or user-provided path).
- Reuse the same Markdown file across all iterations in the task. Do not create a new file per iteration.
- Update the Markdown log after every investigation iteration.
- Each iteration entry must capture:
  - Timestamp
  - What was investigated
  - How it was investigated (commands, files, inserted logs, breakpoints)
  - Observed result/evidence
  - Conclusion and next step
- Keep this Markdown log as a deliverable. Do not remove it during cleanup unless the user explicitly asks.
- Append-only rule:
  - If `debug_investigation.md` already exists, append entries/session blocks; do not rewrite the whole file.
  - Only initialize the Markdown skeleton when the file does not exist.
  - For a new debug task in the same project/session, add a new task/session section in the same file.
- Language rule:
  - All human-readable debug records must be in Simplified Chinese, including session title, investigation notes, conclusions, and cleanup notes.
  - Commands, code snippets, and raw tool output can keep their original language, but must be accompanied by Chinese explanations.

Minimum extensible structure (append one table row per iteration under the current session):

```md
# 调试排查记录

## 会话：SESSION_TITLE（SESSION_ID）

| 时间 | 排查内容 | 排查方法 | 结果 / 证据 | 结论 / 下一步 |
|---|---|---|---|---|
| 2026-02-28 10:00 | 示例：定位 `parse_packet` 异常返回 | `ctest -R parser`; 在 `parser.c:120` 和 `parser.c:148` 插入日志 | 发现长度字段在进入 `validate_len` 前已被截断 | 下一步检查上游读取逻辑 |

<!-- 在当前会话下持续追加表格行；多会话时追加新的 "## 会话：" 标题和表格 -->
```

## Route selection
- Prefer Route A (logs) when behavior is wrong but process is still runnable and path narrowing is needed.
- Prefer Route B (GDB) for crash/hang/core/thread/memory-state issues on host-runnable binaries or host-generated core dumps, but only after confirming the target binary was built with debug symbols enabled.
- Do not use Route B as the default for flashed embedded firmware unless you have an explicitly supported remote-debug setup for that firmware.
- You may switch routes across iterations, but keep one shared `debug_investigation.md`.

## Quick start
1) If `debug_investigation.md` does not exist, create it; otherwise reuse it and create/locate the current session block, then add an initial context entry.
2) Capture reproducible trigger input and expected vs actual.
3) Choose Route A or Route B based on symptom.
  - If choosing Route B, first verify the build enables debug symbols.
  - Acceptable signals include compile flags such as `-g`, or build types such as `Debug` / `RelWithDebInfo`.
  - If debug symbols are missing, record that fact in `debug_investigation.md`, rebuild with symbols if feasible, or switch to Route A.
  - If the issue only reproduces on flashed firmware and no remote-debug-capable setup is available, do not force GDB; use Route A or board-side evidence instead.
4) Run one focused iteration and append evidence.
5) Continue until exact location is pinned.
6) Report exact location + evidence + likely cause + fix plan.
7) Remove temporary logs, temporary debug instrumentation code, and temporary files/test artifacts (except the Markdown investigation log).

## Workflow

### 0) Initialize the Markdown log
- If `debug_investigation.md` is missing, create it using the extensible skeleton.
- If it exists, do not recreate it; append a new session block (or continue current session by agreement).
- Add a first entry with issue summary, repro command/input, and initial hypothesis, and write the record in Simplified Chinese.

### 1) Capture repro + inputs
- Confirm the input file, command, or sequence that triggers the issue.
- Record expected vs actual outcome.
- Append repro details and expectation gap to the Markdown table log.

### 2A) Route A: Logging probes (coarse to fine)
- Discover project logging system (`log_`, `LOG_`, `logger`, `syslog`) and reuse existing macros.
- If absent, use `fprintf(stderr, ...)` with structured prefix.
- Insert coarse logs first (entry/exit, key branches, error returns), then bisect with finer probes.
- Re-run with minimal incremental probes to reduce noise.
- Stop when exact function + condition is identified.

Reference: `references/logging_discovery_checklist.md`

### 2B) Route B: GDB localization
- Scope: host-runnable executables, test binaries, or host-generated core dumps only.
- Out of scope: flashed embedded firmware on target boards unless the firmware and toolchain explicitly support remote debugging in that environment.
- Before launching GDB, explicitly confirm that debug symbols are enabled in the build.
  - Check build flags, build type, or generated binaries to confirm symbols are present.
  - Typical acceptable configurations: `-g`, `Debug`, or `RelWithDebInfo`; minimal optimization such as `-O0` / `-Og` is preferred.
  - Quick checks you can run before debugging:
    - Build system/config: inspect compiler flags or build presets for `-g`, `Debug`, or `RelWithDebInfo`.
    - Generic binary check: `file ./prog`
    - Linux/ELF section check: `readelf -S ./prog | rg '\\.debug_info|\\.zdebug_info|\\.debug_line|\\.symtab'`
    - Linux symbol spot-check: `nm -an ./prog | head`
    - macOS symbol spot-check: `dsymutil -s ./prog | head` or `xcrun dwarfdump ./prog | head`
  - If symbols are absent, note that GDB will not provide reliable `file:line` / local variable visibility, so do not treat the resulting output as sufficient localization evidence.
  - When symbols are missing, rebuild with symbols first if feasible; otherwise fall back to Route A and record the limitation in the Markdown log.
- Use short scenario-driven command sets:
  - Crash: `gdb --args ./prog <args>` -> `run` -> `bt` -> `frame 0` -> `info locals`
  - Hang: attach/interruption -> `info threads` -> per-thread `bt`
  - Core dump: `gdb ./prog core` -> `bt` -> `frame` -> `info locals`
- Inspect stack/frame/locals/arguments/pointers to narrow exact fault location.
- Append each GDB iteration evidence and interpretation in Chinese.

### 3) Converge and report
Provide a short localization report:
- Trigger condition
- Exact location: `file:line + function`
- Evidence lines/outputs
- Likely cause
- Fix plan
- Log path: `debug_investigation.md`
- Cleanup notes

### 4) Cleanup
- Remove temporary probe logs and temporary debug instrumentation.
- Delete temporary reproduction artifacts (scratch logs, dumps, reports, core files) unless user asks to keep them.
- Keep `debug_investigation.md` as final trace.

## Output format
Use this template for final response in Simplified Chinese:

错误定位报告
- 触发条件: ...
- 问题位置: file:line + function
- 证据: 日志片段或 GDB 关键输出（可保留原文）
- 可能原因: ...
- 修复计划: ...
- 排查记录: `debug_investigation.md` 路径
- 清理情况: 临时日志/临时代码/临时文件的移除或保留说明

## Resources
- scripts/run_collect_logs.sh
- references/logging_discovery_checklist.md
