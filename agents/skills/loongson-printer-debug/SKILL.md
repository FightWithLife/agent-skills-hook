---
name: loongson-printer-debug
description: Use when debugging Loongson printer devices over serial, running batch commands, transferring files, checking system status, or troubleshooting printer services and network setup.
---

# loongson-printer-debug Skill

龙芯打印机串口调试工具，提示符驱动、批量命令、文件传输、系统信息、打印机专项。

## 工程位置

```
~/.claude/skills/loongson-printer-debug/
```

## 快速使用

```bash
cd ~/.claude/skills/loongson-printer-debug

# 测试登录
newgrp dialout -c 'python3 serial_tool.py login'

# 执行命令
newgrp dialout -c 'python3 serial_tool.py cmd "uname -a"'

# 拉起网络
newgrp dialout -c 'python3 serial_tool.py network'

# 系统信息
newgrp dialout -c 'python3 serial_tool.py sysinfo'

# 打印机状态
newgrp dialout -c 'python3 serial_tool.py printer-status'

# 上传文件
newgrp dialout -c 'python3 serial_tool.py upload /local/file /remote/path'

# 交互式 shell（Ctrl+] 退出）
python3 serial_tool.py shell
```

## 龙芯远端测试流程

当需要把本机二进制和测试用例发到龙芯机器上执行时，按以下顺序操作：

1. 先登录并确认有可写空间。
2. 如果根文件系统不可写，先执行 `mount -o remount,rw /`。
3. 选择一个空间较大的磁盘路径，例如 `/data`、`/mnt/data`、`/home` 或设备上实际剩余空间最多的目录。
4. 上传二进制和测试用例到该目录。
5. 给二进制加执行权限：`chmod +x <binary>`。
6. 在远端直接运行测试用例，必要时记录输出日志。

示例：
```bash
newgrp dialout -c 'python3 serial_tool.py cmd "mount -o remount,rw /"'
newgrp dialout -c 'python3 serial_tool.py cmd "df -h"'
newgrp dialout -c 'python3 serial_tool.py upload /home/xmg/code/PCL/PCL6/src/build/bin/pcl /data/pcl'
newgrp dialout -c 'python3 serial_tool.py upload /home/xmg/code/PCL/PCL6/ppt-test1.prn /data/ppt-test1.prn'
newgrp dialout -c 'python3 serial_tool.py cmd "chmod +x /data/pcl && /data/pcl < /data/ppt-test1.prn"'
```



| 子命令 | 说明 |
|--------|------|
| `cmd "<命令>"` | 执行单条命令 |
| `cmds <文件>` | 从文件批量执行命令 |
| `login` | 测试登录 |
| `shell` | 交互式串口 shell |
| `network` | 拉起 eth0（ifup） |
| `network-check` | 检查 IP/路由/ping 网关 |
| `ssh-enable` | 启动 sshd |
| `upload <本地> <远程>` | base64 上传文件，md5 校验 |
| `download <远程> <本地>` | base64 下载文件，md5 校验 |
| `sysinfo` | uname/CPU/内存/磁盘/进程/IP |
| `dmesg` | 抓取 dmesg 日志 |
| `logcat [日志文件]` | 持续监听串口输出 |
| `printer-status` | 打印服务状态/队列/设备 |
| `printer-log` | 打印相关日志 |
| `printer-reset` | 重启打印服务 |
| `printer-test` | 发送测试打印任务 |

## 全局参数

```
-p PORT      串口设备（默认 /dev/ttyUSB0）
-u USER      用户名（默认 root）
-P PASS      密码（默认 root）
-t TIMEOUT   命令超时秒数（默认 30）
```

## 关键注意事项

### 1. 波特率切换（硬件限制，必须遵守）
必须先以 9600 打开，再切换到 115200，否则连接失败。

### 2. 权限
用户需在 `dialout` 组：
```bash
sudo usermod -aG dialout $USER
# 当前会话生效：
newgrp dialout
```

### 3. 网络
- 用 `ifup eth0`，DHCP 客户端是 `dhcpcd`
- `ifup` 约需 20 秒完成
- `/var/db/dhcpcd/` 报错可忽略

### 4. 提示符统一
登录后自动执行 `export PS1='# '`，确保提示符检测可靠。
