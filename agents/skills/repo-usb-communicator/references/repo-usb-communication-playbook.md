# 仓库 USB 通信参考手册

## 目标

目标是让 AI 先从仓库中查出 USB 通信所需参数，再把参数写入项目内配置文件，最后复用统一脚本完成探测、打开、发送和收包。

## 可以复用哪份配置

优先复用已经用于刷写的：

- `.agents/cache/<目标名>_download.cfg`

原因：

- 设备识别信息通常相同
- 同一目标的 `VID/PID`、路径线索、命令前缀可以共用
- 避免同一设备维护多份互相漂移的配置

如果通信用途和刷写用途差异很大，也可以拆分出：

- `.agents/cache/<目标名>_usb.cfg`

但默认优先共用。

## 先查什么

1. 设备识别
- `VID/PID`
- 接口类型
- 是否通过 `CreateFile` 打开
- 设备路径或 FriendlyName 线索

2. 通信方式
- 是 `usbprint`、`winusb` 还是其他
- 是否有公共命令前缀
- 文本命令还是二进制报文

3. 收发规则
- 是否要追加 `\r\n`
- 设备响应是固定长度还是不定长
- 读取超时和命令间隔要求

## 去哪里查

- 上位机工具源码
- Windows 设备枚举代码
- 协议发送函数
- 测试脚本、调试脚本
- 板级或项目配置文件中的 USB 标识定义

## 推荐搜索关键词

- `VID_`
- `PID_`
- `usbprint`
- `WinUsb`
- `CreateFile`
- `WriteFile`
- `ReadFile`
- `DevicePath`
- `SymbolicName`
- `command`
- `send`
- `recv`
- `request`

## 配置模板

建议仍写到 `.agents/cache/<目标名>_download.cfg`，示例如下：

```ini
[device]
transport = usbprint
vid = 1234
pid = abcd
path_hint =

[protocol]
command_prefix_hex = 1b1c2620563120

[usb_comm]
default_mode = text
default_payload_hex =
default_text =
text_encoding = ascii
append_crlf = false
read_length = 0
read_timeout_ms = 3000
request_delay = 0.05
```

## 字段解释

- `default_mode`：`text` 或 `hex`
- `default_payload_hex`：默认二进制报文
- `default_text`：默认文本命令
- `text_encoding`：常用 `ascii`、`utf-8`
- `append_crlf`：是否自动追加 `\r\n`
- `read_length`：默认读取长度，`0` 表示本次只发送不读取
- `read_timeout_ms`：读取超时
- `request_delay`：发送后到读取前的等待时间

## 推荐命令

先探测：

```powershell
python C:\Users\DELL\.codex\skills\repo-usb-communicator\scripts\repo_usb_comm.py probe --config .agents/cache/<目标名>_download.cfg
```

验证可打开：

```powershell
python C:\Users\DELL\.codex\skills\repo-usb-communicator\scripts\repo_usb_comm.py open --config .agents/cache/<目标名>_download.cfg
```

发送文本：

```powershell
python C:\Users\DELL\.codex\skills\repo-usb-communicator\scripts\repo_usb_comm.py send --config .agents/cache/<目标名>_download.cfg --text "status"
```

发送十六进制：

```powershell
python C:\Users\DELL\.codex\skills\repo-usb-communicator\scripts\repo_usb_comm.py send --config .agents/cache/<目标名>_download.cfg --hex "1b1c26010203"
```

发送并读取响应：

```powershell
python C:\Users\DELL\.codex\skills\repo-usb-communicator\scripts\repo_usb_comm.py request --config .agents/cache/<目标名>_download.cfg --text "status" --read-length 16
```

## 适用边界

当前脚本更适合：

- Windows
- 通过 `CreateFile + ReadFile + WriteFile` 访问的设备
- 文本命令或简单二进制报文
- 固定长度响应

如果目标协议需要 `WinUSB`、端点枚举、重叠 IO、流式读写或不定长报文解析，应保留这套发现方法，但按目标协议另写脚本。
