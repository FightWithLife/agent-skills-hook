# serial-log-debug

本目录提供通用的 Windows 本地串口调试 skill 与 supporting CLI。

## 文件

```text
serial-log-debug/
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
python agents/skills/serial-log-debug/serial_tool.py --help
python agents/skills/serial-log-debug/serial_tool.py send-hex --port COM3 --hex "AA ZZ" --json
python agents/skills/serial-log-debug/serial_tool.py connect-test --port COM3 --json
```

说明：

- 如果 `pyserial` 未安装，工具会返回 `dependency_missing`。
- 如果 hex 输入非法，工具会返回 `invalid_param`。
- 真实串口联调前，请确保目标端口能被独占打开。
