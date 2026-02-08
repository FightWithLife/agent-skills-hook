---
name: gdb-debugging
description: "Practical workflows and reference for using GDB to debug C/C++ and other native binaries in a Linux terminal: setting breakpoints, stepping, inspecting variables and memory, analyzing backtraces, watchpoints, handling core dumps, and attaching to running processes. Use when the user is debugging with gdb, wants to understand gdb commands or output, or needs a step-by-step debugging plan for a crashing, hanging, or misbehaving program."
---

# GDB Debugging

## Overview

This skill helps systematically debug native programs with GDB, focusing on practical workflows instead of just listing commands. It guides question-asking, proposes concise command sequences, and helps interpret GDB output to converge on root causes efficiently.

## Workflow: How to Help with GDB

When this skill triggers, follow this workflow:

1. Clarify context
   - Ask (or infer) at least:
     - Language and build system (e.g., CMake/Make, Rust, Go, etc.)
     - Target executable path and how the user normally runs it
     - Current symptoms: crash (SIGSEGV, SIGABRT, etc.), hang, wrong result, performance issue
     - Whether they can rebuild with debug symbols (`-g`, no or minimal `-O`)
   - If information is missing, state assumptions explicitly.

2. Ensure a good debug build
   - Recommend rebuilding with:
     - `-g` for debug symbols
     - Lower optimization for easier debugging, e.g. `-O0` or `-Og`
   - Example (Makefile-style): suggest adding `CFLAGS += -g -O0` (or `CXXFLAGS` for C++).
   - If the user cannot rebuild (e.g., system binaries), skip this but mention limitations.

3. Propose a focused GDB session
   - Give a short, copy‑pasteable sequence tailored to the scenario instead of a long command dump.
   - Example (simple crash repro):
     - `gdb ./a.out`
     - In GDB: `run <args>` → crash → `bt` → `frame 0` → inspect locals.
   - Always explain briefly what each key command is doing (“this prints stack trace”, “this inspects locals”, etc.).

4. Interpret and iterate
   - Ask the user to paste relevant GDB output (e.g., backtrace, selected frames, `info locals`).
   - Help them interpret:
     - Where the bug likely lives (file:line, function)
     - Whether it’s a null pointer, use‑after‑free, out‑of‑bounds, logic error, etc.
   - Suggest the next 3–5 concrete commands or source code checks.

5. Keep answers practical
   - Prefer short sequences with explanations over exhaustive cheat sheets.
   - Tailor to the user’s level: for beginners, explain basics; for advanced users, focus on efficient workflows.

## Common GDB Tasks and Command Sets

### 1. Basic session and breakpoints

- Start GDB:
  - `gdb ./prog` or `gdb --args ./prog arg1 arg2`
- Run the program:
  - `run` (or `r`) and re‑run with `run <args>`
- Breakpoints:
  - `break main` or `b main`
  - `break file.c:42`
  - `break func_name`
  - `delete` / `disable` / `enable` to manage breakpoints
- Stepping:
  - `next` (`n`): step over
  - `step` (`s`): step into
  - `continue` (`c`): run until next breakpoint
  - `finish`: run until current function returns

### 2. Inspecting stack and variables

- Stack / frames:
  - `bt` or `backtrace`: show call stack
  - `bt full`: stack + locals
  - `frame N`: select frame
- Locals and arguments:
  - `info locals`
  - `info args`
- Print / examine:
  - `print var` or `p var`
  - `print *ptr`
  - `ptype var` (show type)
  - For arrays: `print arr[0]@10` (10 elements from arr[0])

### 3. Memory, pointers, and watchpoints

- Examine memory:
  - `x/10x addr` (10 words in hex)
  - `x/20i $pc` (disassemble around program counter)
- Watchpoints:
  - `watch var` (stop when var changes)
  - `rwatch var` (stop when var is read)
  - `awatch var` (stop on any access)

### 4. Attaching to processes and core dumps

- Attach to a running process:
  - Find PID (e.g. `ps aux | grep prog`)
  - `gdb ./prog <PID>` (or `gdb -p <PID>`)
- Core dumps:
  - Make sure core dumps are enabled (`ulimit -c unlimited`)
  - After a crash, locate `core` or `core.<pid>`
  - `gdb ./prog core` then:
    - `bt`, `frame`, `info locals`, `info threads`

### 5. Multithreading basics

- `info threads`: list threads
- `thread N`: switch thread
- `bt` (per‑thread backtrace)
- For deadlocks/hangs, inspect all threads’ stacks and highlight where they are blocked.

## Patterns for Common Bugs

### Segmentation faults and crashes

When the user reports a SIGSEGV/SIGABRT or crash:

1. Ask them to run:
   - `gdb ./prog`
   - `run <args>`
   - On crash: `bt`, then `frame 0`, `info locals`.
2. Help interpret:
   - Null pointers, invalid indices, freed memory, stack overflows.
3. Suggest code‑level fixes and how to confirm with another GDB run.

### Hangs, infinite loops, and performance issues

For hangs:
- Suggest attaching to the running process or interrupting with Ctrl‑C in GDB, then:
  - `bt` / `info threads` to see where it is stuck.

For suspected infinite loops or high CPU:
- Inspect the hottest frame, loop conditions, and state of key variables.

## Using Bundled Resources

This skill ships with example `scripts/`, `references/`, and `assets/` directories. They can be customized for GDB if needed, for example:

- `references/`: add a concise GDB command cheat sheet or internal debugging conventions.
- `scripts/`: helper scripts to launch GDB with common arguments or to collect core dumps.
- `assets/`: templates for bug reports (what info to capture from GDB).

If these resources are not needed for a particular use case, they can be ignored or deleted.
