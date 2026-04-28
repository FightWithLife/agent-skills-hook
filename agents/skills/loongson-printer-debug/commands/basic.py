"""基础子命令：cmd / cmds / login / shell"""
import sys
import tty
import termios
import select
from loongson.device import SerialDevice


def cmd(args, dev_args):
    """执行单条命令"""
    if not args.command:
        print('用法: serial_tool.py cmd "<命令>"', file=sys.stderr)
        sys.exit(1)
    with SerialDevice(**dev_args) as dev:
        output = dev.run(args.command, timeout=args.timeout)
    print(output)


def cmds(args, dev_args):
    """从文件批量执行命令（每行一条，# 开头为注释）"""
    if not args.file:
        print('用法: serial_tool.py cmds <命令文件>', file=sys.stderr)
        sys.exit(1)
    commands = []
    with open(args.file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                commands.append(line)
    with SerialDevice(**dev_args) as dev:
        results = dev.run_many(commands, timeout=args.timeout)
    for c, out in results:
        print(f'=== {c} ===')
        print(out)
        print()


def login(args, dev_args):
    """测试登录，打印基本信息"""
    with SerialDevice(**dev_args) as dev:
        uname = dev.run('uname -a')
        uptime = dev.run('uptime')
    print('登录成功')
    print(uname)
    print(uptime)


def shell(args, dev_args):
    """交互式串口 shell（原始模式）"""
    import serial
    ser = serial.Serial(dev_args['port'], 9600, timeout=0.05)
    ser.baudrate = 115200
    print(f'已连接 {dev_args["port"]}，按 Ctrl+] 退出')

    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        while True:
            # 设备 -> 终端
            data = ser.read(256)
            if data:
                sys.stdout.buffer.write(data)
                sys.stdout.buffer.flush()
            # 终端 -> 设备
            if select.select([sys.stdin], [], [], 0)[0]:
                ch = sys.stdin.buffer.read(1)
                if ch == b'\x1d':  # Ctrl+]
                    break
                ser.write(ch)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
        ser.close()
        print('\n已断开')
