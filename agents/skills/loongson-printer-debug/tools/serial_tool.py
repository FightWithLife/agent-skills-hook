#!/usr/bin/env python3
"""龙芯打印机串口调试工具

用法:
  python3 serial_tool.py cmd "<shell命令>"   # 执行单条命令
  python3 serial_tool.py network              # 拉起 eth0 网络
  python3 serial_tool.py shell               # 交互式 shell
  python3 serial_tool.py login               # 仅登录测试
"""
import serial
import time
import sys
import os

DEVICE = '/dev/ttyUSB0'
BAUD = 115200
USER = 'root'
PASS = 'root'


def open_serial():
    """打开串口，必须先 9600 再切换 115200（硬件限制）"""
    ser = serial.Serial(DEVICE, 9600, timeout=1)
    time.sleep(0.5)
    ser.baudrate = BAUD
    ser.reset_input_buffer()
    return ser


def reset_shell(ser):
    """发送 Ctrl+C/D 清理卡住的 shell"""
    for _ in range(3):
        ser.write(b'\x03')
        time.sleep(0.3)
    ser.write(b'\x04')
    time.sleep(2)
    ser.read(4096)


def login(ser):
    """登录设备，返回是否成功"""
    reset_shell(ser)

    ser.write(b'\r\n')
    time.sleep(2)
    data = ser.read(1024).decode(errors='replace')

    # 已在 shell
    if '# ' in data or '$ ' in data:
        return True

    # 有登录提示
    if 'login' in data.lower():
        ser.write((USER + '\r\n').encode())
        time.sleep(2)
        data = ser.read(512).decode(errors='replace')

    if 'password' in data.lower() or 'Password' in data:
        ser.write((PASS + '\r\n').encode())
        time.sleep(2)
        ser.read(512)

    return True


def run_cmd(ser, command, wait=3):
    """执行命令并返回输出"""
    ser.reset_input_buffer()
    ser.write((command + '\r\n').encode())
    time.sleep(wait)
    buf = b''
    while True:
        chunk = ser.read(2048)
        if not chunk:
            break
        buf += chunk
    output = buf.decode(errors='replace')
    # 去掉命令回显和末尾提示符
    lines = output.split('\r\n')
    # 跳过第一行（命令回显）
    if lines and lines[0].strip() == command.strip():
        lines = lines[1:]
    return '\n'.join(lines).strip()


def cmd_mode(command):
    ser = open_serial()
    login(ser)
    result = run_cmd(ser, command)
    print(result)
    ser.close()


def network_mode():
    ser = open_serial()
    login(ser)
    print('正在拉起 eth0 网络（约 20 秒）...')
    result = run_cmd(ser, 'ifup eth0', wait=22)
    print(result)
    print()
    result = run_cmd(ser, 'ip addr show eth0', wait=2)
    print(result)
    ser.close()


def login_mode():
    ser = open_serial()
    ok = login(ser)
    result = run_cmd(ser, 'echo LOGIN_OK')
    if 'LOGIN_OK' in result:
        print('登录成功')
    else:
        print('登录失败，响应:', repr(result))
    ser.close()


def shell_mode():
    """交互式 shell 模式"""
    import threading
    ser = open_serial()
    login(ser)
    print(f'已连接到 {DEVICE}，输入命令（Ctrl+C 退出）')
    print('-' * 40)

    stop = threading.Event()

    def reader():
        while not stop.is_set():
            try:
                data = ser.read(256)
                if data:
                    sys.stdout.write(data.decode(errors='replace'))
                    sys.stdout.flush()
            except Exception:
                break

    t = threading.Thread(target=reader, daemon=True)
    t.start()

    try:
        while True:
            line = input()
            ser.write((line + '\r\n').encode())
            time.sleep(0.1)
    except (KeyboardInterrupt, EOFError):
        pass
    finally:
        stop.set()
        ser.close()
        print('\n已断开连接')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    mode = sys.argv[1]
    if mode == 'cmd':
        if len(sys.argv) < 3:
            print('用法: serial_tool.py cmd "<命令>"')
            sys.exit(1)
        cmd_mode(sys.argv[2])
    elif mode == 'network':
        network_mode()
    elif mode == 'login':
        login_mode()
    elif mode == 'shell':
        shell_mode()
    else:
        print(f'未知模式: {mode}')
        print(__doc__)
        sys.exit(1)
