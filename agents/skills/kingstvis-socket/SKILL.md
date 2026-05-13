---
name: kingstvis-socket
description: Use when running KingstVIS capture/export through SocketAPI with one explicit `capture` command and fully specified parameters.
---

# KingstVIS Socket Automation

Use this skill when the user wants AI-assisted KingstVIS automation through the official SocketAPI.

## Prerequisites

- KingstVIS is running.
- KingstVIS Socket function is enabled in the application.
- Default endpoint is `127.0.0.1:23367`.
- Python 3 is available.

## Required Rule

- Default to `capture`. Do not use `start`, `stop`, `export`, or raw `send` as the normal workflow.
- Every normal data-collection task should be expressed as one complete `capture` command with explicit parameters.
- `capture` is a foreground blocking command. It does not return until the full capture/export flow finishes or fails.
- If other operations must continue while capture is running, use the explicit background workflow: `capture-bg` plus `capture-status` or `capture-wait`.
- Only use `connect` for connectivity check.
- Only use `get-last-error` for dedicated diagnosis after a failed run.
- Do not split one capture task into multiple manual socket steps unless the user explicitly asks to debug SocketAPI details.

## Tool

Use the bundled client:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py --help
```

Default output directory:

```text
kingstvis_captures/
```

## Standard Workflow

First verify connectivity if needed:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py connect
```

Then run one complete capture command.

Minimal example:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --count 1 --format csv --output-dir kingstvis_captures
```

Common explicit example:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --count 1 --sample-rate 10000000 --sample-time 0.5 --threshold-voltage 1.65 --reset-trigger --pos-edge 0 --channels 0 1 --format csv --output-dir kingstvis_captures
```

Current capture sequence inside the script is:

`start` -> wait `--wait-after-start` -> `stop` -> optional wait `--wait-after-stop` -> `export`

The agent should still call only `capture`, not the internal steps directly.

Execution semantics:

- Foreground `capture` blocks until the whole sequence above completes.
- If the task requires more commands to run in parallel, use `capture-bg`.
- When using background execution, the agent must later call `capture-status` or `capture-wait` and confirm completion state before claiming success.

## Recommended Capture Patterns

Single capture:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --count 1 --format csv --output-dir kingstvis_captures
```

Single capture with selected channels:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --count 1 --channels 0 1 --format csv --output-dir kingstvis_captures
```

Single capture with sample and trigger settings:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --count 1 --sample-rate 10000000 --sample-time 0.5 --threshold-voltage 1.65 --reset-trigger --pos-edge 0 --high-level 1 2 --low-level 3 4 --channels 0 1 --format csv --output-dir kingstvis_captures
```

Simulated capture when hardware is unavailable:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --simulate --count 1 --format csv --output-dir kingstvis_captures
```

Multiple captures:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --count 3 --interval 0.5 --format csv --output-dir kingstvis_captures
```

If CSV export is rejected by the installed KingstVIS version:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --count 1 --format csv --fallback-kvdat --output-dir kingstvis_captures
```

If export timing is unstable after stop:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --count 1 --wait-after-stop 0.5 --format csv --output-dir kingstvis_captures
```

Background capture when later steps must continue immediately:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture-bg --status-file kingstvis_captures\capture_status.json --count 1 --sample-rate 10000000 --sample-time 0.5 --channels 0 1 --format csv --output-dir kingstvis_captures
```

Check whether it is still running:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture-status --status-file kingstvis_captures\capture_status.json
```

Wait for completion before reporting success:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture-wait --status-file kingstvis_captures\capture_status.json --wait-timeout 60
```

## Diagnosis Only

Connectivity check:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py connect
```

Read last error after a failed capture:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py get-last-error
```

Do not use the commands below in normal agent workflow:

- `send`
- `start`
- `start --simulate`
- `stop`
- `export`
- direct parameter-setting commands such as `set-sample-rate`, `set-sample-time`, `set-trigger`

Those commands are implementation details or low-level diagnosis tools. Prefer putting all required parameters onto one `capture` command.

## Response Rules

- Treat any response beginning with `NAK` as failure.
- Report the exact `capture` command, response, output path, and whether the output file exists.
- If `capture` was started in the background, report that it is still running until completion evidence is collected.
- Do not claim export succeeded unless KingstVIS returned a non-`NAK` response or the output file actually appears.
- If the file does not appear after a successful response, report it as a residual risk because KingstVIS may write asynchronously or reject the extension silently.
- If `capture` fails and further diagnosis is needed, run `get-last-error` separately.

## Allowed Commands For Normal Use

- `connect`
- `capture`
- `capture-bg`
- `capture-status`
- `capture-wait`
- `get-last-error` only after failure diagnosis is needed
