# serial-log-debug

本目录提供通用的 Windows 本地串口调试 skill 与 supporting CLI。

默认建议：

- 凡是后续动作可能触发设备复位、重新上电、重新枚举、模式切换或瞬时关键日志输出，先执行 `open` 开启持续抓取。
- 典型场景包括固件刷写前、USB 通信测试前、发送复位类命令前。
- 不要在动作结束后才启动串口，否则容易漏掉首段启动日志。

## 文件

```text
<skill-root>/
├── SKILL.md
├── serial_tool.py
├── examples/
│   ├── send_text.txt
│   └── sample_log.txt
└── README.md
```

## 依赖

- Python 3.9+
- `pyserial`

安装方式：

```bash
pip install pyserial
```

## 最小验证

```bash
python <serial_tool.py 路径> --help
python <serial_tool.py 路径> send-hex --port COM3 --hex "AA ZZ" --json
python <serial_tool.py 路径> connect-test --port COM3 --json
```

推荐前置抓取示例：

```bash
python <serial_tool.py 路径> open --port COM3 --baudrate 115200 --output-dir serial_logs --json
```

说明：

- 如果 `pyserial` 未安装，工具会返回 `dependency_missing`。
- 如果 hex 输入非法，工具会返回 `invalid_param`。
- 真实串口联调前，请确保目标端口能被独占打开。
- 示例中的 `<serial_tool.py 路径>` 是占位符，不要假设该 skill 固定放在某个仓库路径下。
