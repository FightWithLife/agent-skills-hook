# 龙芯打印机串口调试工具

对 AI 调试友好的串口交互工具，提示符驱动、批量命令、文件传输、系统信息、打印机专项。

## 安装依赖

```bash
pip install -r requirements.txt
# 确保用户在 dialout 组
sudo usermod -aG dialout $USER
```

## 工程结构

```
loongson-printer-debug/
├── serial_tool.py        # CLI 入口
├── requirements.txt
├── loongson/
│   ├── device.py         # SerialDevice 核心（提示符驱动）
│   ├── output.py         # 输出清理
│   └── transfer.py       # base64 文件传输
├── commands/
│   ├── basic.py          # cmd / cmds / login / shell
│   ├── network.py        # network / network-check / ssh-enable
│   ├── sysinfo.py        # sysinfo / dmesg / logcat
│   └── printer.py        # printer-status/log/reset/test
└── tools/
    └── serial_tool.py    # 旧版（保留备用）
```

## 快速上手

```bash
cd ~/.claude/skills/loongson-printer-debug

# 测试登录
newgrp dialout -c 'python3 serial_tool.py login'

# 执行单条命令
newgrp dialout -c 'python3 serial_tool.py cmd "uname -a"'

# 批量命令
newgrp dialout -c 'python3 serial_tool.py cmds my_cmds.txt'

# 拉起网络
newgrp dialout -c 'python3 serial_tool.py network'

# 检查网络
newgrp dialout -c 'python3 serial_tool.py network-check'

# 系统信息
newgrp dialout -c 'python3 serial_tool.py sysinfo'

# 上传文件
newgrp dialout -c 'python3 serial_tool.py upload /tmp/test.bin /tmp/test.bin'

# 下载文件
newgrp dialout -c 'python3 serial_tool.py download /tmp/test.bin /tmp/test.bin'

# 持续监听串口日志
newgrp dialout -c 'python3 serial_tool.py logcat /tmp/serial.log'

# 打印机状态
newgrp dialout -c 'python3 serial_tool.py printer-status'

# 交互式 shell（终端直接运行，Ctrl+] 退出）
newgrp dialout -c 'python3 serial_tool.py shell'
```

## 全局参数

```
-p PORT      串口设备（默认 /dev/ttyUSB0）
-u USER      登录用户名（默认 root）
-P PASS      登录密码（默认 root）
-t TIMEOUT   命令超时秒数（默认 30）
```

示例：
```bash
python3 serial_tool.py -p /dev/ttyUSB1 -t 60 cmd "dmesg | tail -50"
```

## 远端测试流程

当需要在龙芯机器上验证本机生成的二进制时，按以下顺序操作：

1. 先登录设备，确认系统可用。
2. 如果根文件系统只读，先执行 `mount -o remount,rw /`。
3. 选择一个可用空间较大的目录，例如 `/data`、`/mnt/data`、`/home`，或设备上 `df -h` 显示剩余最多的挂载点。
4. 将二进制和 `.prn` 测试用例上传到同一目录。
5. 给二进制加执行权限：`chmod +x`。
6. 在设备上直接运行测试并观察输出。

示例：
```bash
newgrp dialout -c 'python3 serial_tool.py cmd "mount -o remount,rw /"'
newgrp dialout -c 'python3 serial_tool.py cmd "df -h"'
newgrp dialout -c 'python3 serial_tool.py upload /home/xmg/code/PCL/PCL6/src/build/bin/pcl /data/pcl'
newgrp dialout -c 'python3 serial_tool.py upload /home/xmg/code/PCL/PCL6/ppt-test1.prn /data/ppt-test1.prn'
newgrp dialout -c 'python3 serial_tool.py cmd "chmod +x /data/pcl && /data/pcl < /data/ppt-test1.prn"'
```



- **波特率**：必须先以 9600 打开，再切换到 115200（硬件限制）
- **权限**：需在 `dialout` 组
- **网络**：用 `ifup eth0`，DHCP 客户端为 `dhcpcd`，约需 20 秒
- **shell 卡住**：工具会自动发 Ctrl+C×3 + Ctrl+D 恢复
