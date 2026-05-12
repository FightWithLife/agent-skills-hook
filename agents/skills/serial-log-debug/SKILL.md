---
name: serial-log-debug
description: Use when debugging hardware over a Windows local serial port, especially when UART logs must be captured, text or hex commands sent manually, and TX/RX traces reviewed during bring-up, reproduction, or log-based fault isolation.
---

# serial-log-debug

用于 Windows 下的本地串口联调。核心原则是：**先保留原始证据，再做轻量分析**。这个 skill 只覆盖 Windows 下的本地直连串口收发、日志落盘和基于日志的初步定位，不覆盖刷写、产测和远程串口场景。

## When to Use

当出现以下情况时使用：

- 需要打开某个 `COMx` 串口观察设备启动或运行日志。
- 需要给设备手动发送文本命令、hex 字节串或简单测试输入。
- 需要同时保留原始字节流和可读日志，方便后续回放或复盘。
- 需要让 AI 基于 TX/RX 记录回答“最后停在哪一步”。
- 需要对超时、无响应、乱码、回显异常做第一轮日志归类。

不要在以下情况使用本 skill：

- 需要执行固件刷写、升级编排或镜像验证。
- 需要跑产测、量产工站或批量设备并发调试。
- 需要远程串口服务器、网络透传或多机集中调度。
- 需要自动解码完整业务协议、还原状态机或直接判定业务根因。

## Preconditions

使用前必须确认：

- 宿主机环境为 **Windows**。
- 设备通过 **本地直连串口** 接入。
- 目标串口必须能被当前工具 **独占打开**。
- 调试设备已上电，且具备输出日志或接收串口输入的条件。
- 串口驱动正常、日志输出目录可写。

如果任何一条不满足，先报告前置条件不成立，不要假装 skill 已具备对应能力。

## Quick Reference

## 工程位置

```text
agents/skills/serial-log-debug/
```

## 快速使用

```bash
# 查看总帮助
python agents/skills/serial-log-debug/serial_tool.py --help

# 检查串口是否可独占打开
python agents/skills/serial-log-debug/serial_tool.py connect-test --port COM3 --baudrate 115200 --json

# 发送文本
python agents/skills/serial-log-debug/serial_tool.py send-text --port COM3 --text reboot --line-ending crlf --json

# 发送 hex
python agents/skills/serial-log-debug/serial_tool.py send-hex --port COM3 --hex "AA 55 01 02" --json

# 抓取 3 秒日志
python agents/skills/serial-log-debug/serial_tool.py capture --port COM3 --duration 3 --output-dir serial_logs --json

# 启动一次完整会话
python agents/skills/serial-log-debug/serial_tool.py session --port COM3 --send-text reboot --duration 3 --output-dir serial_logs --json
```

### 输入参数

优先使用以下参数口径：

- `--port`
- `--baudrate`
- `--timeout`
- `--parity`
- `--bytesize`
- `--stopbits`
- `--output-dir`
- `--json`

### 建议支持的动作

| 动作 | 目的 |
|---|---|
| `connect-test` | 验证目标串口是否能独占打开 |
| `send-text` | 发送文本命令，可选编码和行尾 |
| `send-hex` | 发送十六进制字节串 |
| `listen` | 持续监听串口输出 |
| `capture` | 按时长或字节数抓取一段日志 |
| `session` | 完成一次监听 → 发送 → 接收 → 落盘闭环 |

### 结果要求

每次执行都应尽量返回 machine-readable 结果，至少包含：

- `ok`
- `command`
- `port`
- `baudrate`
- `timeout`
- `log_path_raw`
- `log_path_text`
- `tx_bytes`
- `rx_bytes`
- `error_type`
- `error_message`

`error_type` 至少区分：`port_not_found`、`port_busy`、`invalid_param`、`read_timeout`、`write_failed`、`log_write_failed`。

## Operating Pattern

1. 先确认场景属于“Windows + 本地直连串口 + 独占访问”。
2. 明确串口参数，不自动猜测端口号、波特率或协议。
3. 先建立连接或启动监听，再发送测试输入。
   - 默认直接以目标波特率（例如 `115200`）打开串口；若现场存在异常，应按真实日志和错误类型继续排查，而不是在 skill 内隐式切换波特率重试。
   - 若未显式提供 `--port`，可以先枚举本机可见串口，并优先尝试 USB 串口设备（例如 CH340）。
4. 同时保留两类日志：
   - 原始日志：完整字节流
   - 可读日志：时间戳 + TX/RX + text/hex + 摘要
5. 分析时只基于实际日志片段做轻量归纳，不补全不存在的证据。

## Logging Rules

- 不因文本解码失败而丢弃原始字节。
- 不可打印字符优先转为 hex 展示。
- 摘要允许截断，但原始日志文件必须完整保留。
- 会话应有独立 ID、文件名和输出目录。
- 长时间监听应有显式停止方式，例如 `Ctrl+C`，必要时支持时长或字节上限。

## Analysis Boundaries

允许做的事：

- 标记 TX / RX。
- 总结最后一个可见状态。
- 抽取关键错误片段。
- 将异常初步归类为超时、无响应、乱码、参数错误、端口占用等。

不要做的事：

- 不把日志自动解释成完整业务协议语义。
- 不在证据不足时臆测设备内部状态。
- 不把串口观测结果直接升级成“根因已确定”。

## Common Mistakes

- 端口被其他串口助手占用却继续重试，导致误判设备无响应。
- 只保存文本日志，导致二进制数据丢失。
- 把乱码直接当协议异常，而不是先检查波特率或参数。
- 在没有证据时把“无回显”直接解释成死机。
- 把本 skill 与固件刷写 skill 混用，扩散了范围。

## Current Implementation

当前 skill 已包含 supporting CLI：

- `agents/skills/serial-log-debug/serial_tool.py`
- `agents/skills/serial-log-debug/examples/send_text.txt`
- `agents/skills/serial-log-debug/examples/sample_log.txt`
- `agents/skills/serial-log-debug/README.md`

当前实现已经覆盖参数解析、统一 JSON 输出、错误分类、日志双文件落盘和最小子命令骨架。若宿主机未安装 `pyserial`，工具会返回结构化 `dependency_missing` 错误，而不是伪造串口执行结果。

当前实现还包含以下打开策略：

- 未传 `--port` 时，自动枚举当前可见串口，并优先选择 USB 串口设备。
- 实际打开串口时，直接按请求的目标波特率打开，并保留有限次重试。
- Windows 下 `PermissionError` / `access is denied` 会映射为 `port_busy`，避免误报成 `port_not_found`。
