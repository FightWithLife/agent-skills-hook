---
name: kingstvis-socket
description: Use when connecting to KingstVIS through its SocketAPI to send commands, start captures, simulate captures, export capture data, or batch-save local CSV/KVDAT files.
---

# KingstVIS Socket Automation

Use this skill when the user wants AI-assisted KingstVIS automation through the official SocketAPI: connect to KingstVIS, send commands, start captures, and export data into the current workspace.

## Prerequisites

- KingstVIS is running.
- KingstVIS Socket function is enabled in the application.
- Default endpoint is `127.0.0.1:23367`.
- Python 3 is available.

## Tool

Use the bundled client:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py --help
```

Default output directory:

```text
kingstvis_captures/
```

## Common Workflows

Send a raw command:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py send "start"
```

Test connection only:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py connect
```

Start capture:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py start
```

说明：
- `start` 返回 `ACK` 时可直接视为成功。
- 不要在同一个 socket 会话里，`start` 后马上再发 `get-last-error`。
- 若需排查 `start` 失败，请结束当前连接，按需另起新连接单独执行 `get-last-error`。

Start simulated capture:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py start --simulate
```

Export data to a local CSV path:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py export kingstvis_captures\capture.csv
```

说明：
- 导出应在 `stop` 之后执行。
- 不要假设 `start` 后立刻 `export` 一定成立。

Run an automated capture and save loop:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --count 3 --format csv --output-dir kingstvis_captures
```

当前脚本执行顺序为：`start` → 等待 `--wait-after-start` → `stop` → `export`。

连接时序要求：
- `start`、`stop`、`export` 各自使用独立 socket 连接。
- `start` 之后只在本地等待采样时长，不在同一连接里追加其他命令。

显式分步执行时，推荐按以下顺序：

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py start
Start-Sleep -Seconds 1
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py stop
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py export kingstvis_captures\capture.csv
```

如现场发现 `stop` 后立即导出仍不稳定，可增加：

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --wait-after-stop 0.5 --count 1 --format csv
```

Run capture and export only selected channels:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --channels 0 1 --format csv
```

Run capture with sample settings and trigger settings:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --sample-rate 10000000 --sample-time 0.5 --threshold-voltage 1.65 --reset-trigger --pos-edge 0 --high-level 1 2 --low-level 3 4 --channels 0 1 --format csv
```

Use simulated capture when hardware is not connected:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --simulate --count 1 --format csv
```

If CSV export is not accepted by the installed KingstVIS version, retry with KVDAT:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py capture --count 1 --format csv --fallback-kvdat
```

## SocketAPI Command Coverage

Error query:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py get-last-error
```

Capture control:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py start
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py start --simulate
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py stop
```

Sample rate and depth:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py set-sample-rate 10000000
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py get-sample-rate
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py get-supported-sample-rate
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py set-sample-depth 20000000
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py get-actual-sample-depth
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py set-sample-time 0.5
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py get-actual-sample-time
```

Threshold and trigger:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py set-threshold-voltage 1.65
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py set-trigger --reset
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py set-trigger --reset --pos-edge 0 --high-level 1 2 --low-level 3 4
```

Export selected channels and time span:

```powershell
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py export kingstvis_captures\capture.csv --channels 0 1
python agents\skills\kingstvis-socket\scripts\kingstvis_socket_client.py export kingstvis_captures\capture.csv --channels 0 1 --time-span 0.01 0.5
```

## Response Rules

- Treat any response beginning with `NAK` as failure.
- Do not send `get-last-error` immediately after `start` in the same socket session.
- If `start` / `start --simulate` fails and further diagnosis is needed, reconnect first and then query `get-last-error` separately.
- Report the exact command, response, output path, and whether the output file exists.
- Do not claim export succeeded unless it happens after `stop`, and KingstVIS returned a non-`NAK` response or the output file actually appears.
- If the file does not appear after a successful response, report it as a residual risk because KingstVIS may write asynchronously or reject the extension silently.

## Known Commands From SDK Examples

- `get-last-error`
- `start`
- `start --simulate`
- `stop`
- `set-sample-rate <value>`
- `get-sample-rate`
- `get-supported-sample-rate`
- `set-sample-depth <value>`
- `get-actual-sample-depth`
- `set-sample-time <seconds>`
- `get-actual-sample-time`
- `set-threshold-voltage <value>`
- `set-trigger [--reset] [--low-level channels] [--high-level channels] [--pos-edge channel] [--neg-edge channel]`
- `export-data <path> [--chn-select channels] [--time-span start [end]]`

For unlisted SocketAPI commands, use `send` to pass the raw command through unchanged.
