"""系统信息子命令：sysinfo / dmesg / logcat"""
import sys
from loongson.device import SerialDevice


def sysinfo(args, dev_args):
    """一键打印系统信息"""
    cmds = [
        'uname -a',
        'cat /proc/cpuinfo | head -20',
        'free',
        'df -h',
        'ps aux 2>/dev/null || ps',
        'ip addr',
    ]
    with SerialDevice(**dev_args) as dev:
        results = dev.run_many(cmds)
    for c, out in results:
        print(f'=== {c} ===')
        print(out)
        print()


def dmesg(args, dev_args):
    """抓取 dmesg 日志"""
    with SerialDevice(**dev_args) as dev:
        out = dev.run('dmesg', timeout=15)
    print(out)


def logcat(args, dev_args):
    """持续监听串口输出，写入日志文件（Ctrl+C 停止）"""
    import serial as _serial
    outfile = args.logfile if hasattr(args, 'logfile') and args.logfile else None
    fh = open(outfile, 'a') if outfile else None

    ser = _serial.Serial(dev_args['port'], 9600, timeout=0.1)
    ser.baudrate = 115200
    print(f'监听 {dev_args["port"]}，Ctrl+C 停止' + (f'，写入 {outfile}' if outfile else ''))

    # KeyboardInterrupt 是 SIGINT 的默认行为，无需额外 handler
    try:
        while True:
            data = ser.read(256)
            if data:
                text = data.decode(errors='replace')
                sys.stdout.write(text)
                sys.stdout.flush()
                if fh:
                    fh.write(text)
                    fh.flush()
    except KeyboardInterrupt:
        print('\n监听结束')
    finally:
        ser.close()
        if fh:
            fh.close()
