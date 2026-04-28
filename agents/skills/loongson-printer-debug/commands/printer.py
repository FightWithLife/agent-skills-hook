"""打印机专项子命令：printer-status / printer-log / printer-reset / printer-test"""
from loongson.device import SerialDevice

# 常见打印服务名称
PRINT_SERVICES = ['cupsd', 'lpd', 'lpsched', 'printd']


def printer_status(args, dev_args):
    """查询打印机服务状态、打印队列、驱动信息"""
    cmds = [
        'ps aux 2>/dev/null | grep -E "cup|lpd|print" | grep -v grep || ps | grep -E "cup|lpd|print" | grep -v grep',
        'lpq 2>/dev/null || echo "lpq not available"',
        'lpstat -s 2>/dev/null || echo "lpstat not available"',
        'ls /dev/usb/ 2>/dev/null || ls /dev/lp* 2>/dev/null || echo "no printer device found"',
        'cat /etc/cups/printers.conf 2>/dev/null | head -30 || echo "no cups config"',
    ]
    with SerialDevice(**dev_args) as dev:
        results = dev.run_many(cmds)
    for c, out in results:
        print(f'=== {c} ===')
        print(out)
        print()


def printer_log(args, dev_args):
    """抓取打印相关日志"""
    cmds = [
        'cat /var/log/cups/error_log 2>/dev/null | tail -50 || echo "no cups log"',
        'dmesg | grep -i -E "usb|printer|lp" | tail -30',
        'cat /var/log/syslog 2>/dev/null | grep -i print | tail -20 || echo "no syslog"',
    ]
    with SerialDevice(**dev_args) as dev:
        results = dev.run_many(cmds)
    for c, out in results:
        print(f'=== {c} ===')
        print(out)
        print()


def printer_reset(args, dev_args):
    """重启打印服务"""
    with SerialDevice(**dev_args) as dev:
        for svc in PRINT_SERVICES:
            status = dev.run(f'which {svc} 2>/dev/null || type {svc} 2>/dev/null')
            if status.strip():
                print(f'重启 {svc}...')
                out = dev.run(f'killall {svc} 2>/dev/null; sleep 1; {svc} &', timeout=10)
                print(out)
                break
        else:
            # 尝试 /etc/init.d
            out = dev.run('ls /etc/init.d/ | grep -E "cup|lpd|print"')
            if out.strip():
                svc_name = out.strip().splitlines()[0]
                print(f'重启 /etc/init.d/{svc_name}...')
                print(dev.run(f'/etc/init.d/{svc_name} restart', timeout=15))
            else:
                print('未找到已知打印服务')


def printer_test(args, dev_args):
    """发送测试打印任务"""
    with SerialDevice(**dev_args) as dev:
        # 尝试 lpr，失败则直接写设备
        out = dev.run('echo "Test Print from Loongson" | lpr 2>/dev/null && echo OK || '
                      'echo "Test Print" > /dev/lp0 2>/dev/null && echo OK || echo FAIL')
        print(out)
        queue = dev.run('lpq 2>/dev/null || echo "lpq not available"')
        print(queue)
