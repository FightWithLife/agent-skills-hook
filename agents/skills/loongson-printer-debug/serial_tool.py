#!/usr/bin/env python3
"""龙芯打印机串口调试工具 — CLI 入口

用法:
  serial_tool.py [-p PORT] [-u USER] [-P PASS] [-t TIMEOUT] <子命令> [参数]

子命令:
  基础:    cmd <命令>  cmds <文件>  login  shell
  网络:    network  network-check  ssh-enable
  传输:    upload <本地> <远程>  download <远程> <本地>
  系统:    sysinfo  dmesg  logcat [日志文件]
  打印机:  printer-status  printer-log  printer-reset  printer-test
"""
import sys
import os
import argparse

# 将工程根目录加入 sys.path，支持直接运行和从其他目录调用
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from commands import basic, network, sysinfo, printer
from loongson.transfer import upload, download


def build_parser():
    p = argparse.ArgumentParser(
        description='龙芯打印机串口调试工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument('-p', '--port', default='/dev/ttyUSB0', help='串口设备 (默认 /dev/ttyUSB0)')
    p.add_argument('-u', '--user', default='root', help='登录用户名 (默认 root)')
    p.add_argument('-P', '--password', default='root', help='登录密码 (默认 root)')
    p.add_argument('-t', '--timeout', type=int, default=30, help='命令超时秒数 (默认 30)')

    sub = p.add_subparsers(dest='subcmd', metavar='<子命令>')

    # 基础
    sp = sub.add_parser('cmd', help='执行单条命令')
    sp.add_argument('command', nargs='?', default='', help='要执行的 shell 命令')

    sp = sub.add_parser('cmds', help='从文件批量执行命令')
    sp.add_argument('file', nargs='?', default='', help='命令文件路径')

    sub.add_parser('login', help='测试登录并显示系统信息')
    sub.add_parser('shell', help='进入交互式串口 shell')

    # 网络
    sub.add_parser('network', help='拉起 eth0 网络')
    sub.add_parser('network-check', help='检查网络状态')
    sub.add_parser('ssh-enable', help='启动 sshd')

    # 文件传输
    sp = sub.add_parser('upload', help='上传文件到设备')
    sp.add_argument('local', help='本地文件路径')
    sp.add_argument('remote', help='设备目标路径')

    sp = sub.add_parser('download', help='从设备下载文件')
    sp.add_argument('remote', help='设备源文件路径')
    sp.add_argument('local', help='本地保存路径')

    # 系统信息
    sub.add_parser('sysinfo', help='打印系统信息')
    sub.add_parser('dmesg', help='抓取 dmesg 日志')
    sp = sub.add_parser('logcat', help='持续监听串口输出')
    sp.add_argument('logfile', nargs='?', default='', help='日志文件路径（可选）')

    # 打印机
    sub.add_parser('printer-status', help='查询打印机服务状态')
    sub.add_parser('printer-log', help='抓取打印相关日志')
    sub.add_parser('printer-reset', help='重启打印服务')
    sub.add_parser('printer-test', help='发送测试打印任务')

    return p


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.subcmd:
        parser.print_help()
        sys.exit(0)

    dev_args = {
        'port': args.port,
        'user': args.user,
        'password': args.password,
        'cmd_timeout': args.timeout,
    }

    dispatch = {
        'cmd':            lambda: basic.cmd(args, dev_args),
        'cmds':           lambda: basic.cmds(args, dev_args),
        'login':          lambda: basic.login(args, dev_args),
        'shell':          lambda: basic.shell(args, dev_args),
        'network':        lambda: network.network(args, dev_args),
        'network-check':  lambda: network.network_check(args, dev_args),
        'ssh-enable':     lambda: network.ssh_enable(args, dev_args),
        'sysinfo':        lambda: sysinfo.sysinfo(args, dev_args),
        'dmesg':          lambda: sysinfo.dmesg(args, dev_args),
        'logcat':         lambda: sysinfo.logcat(args, dev_args),
        'printer-status': lambda: printer.printer_status(args, dev_args),
        'printer-log':    lambda: printer.printer_log(args, dev_args),
        'printer-reset':  lambda: printer.printer_reset(args, dev_args),
        'printer-test':   lambda: printer.printer_test(args, dev_args),
        'upload':         lambda: _upload(args, dev_args),
        'download':       lambda: _download(args, dev_args),
    }

    try:
        dispatch[args.subcmd]()
    except KeyboardInterrupt:
        print('\n中断')
        sys.exit(1)
    except Exception as e:
        print(f'错误: {e}', file=sys.stderr)
        sys.exit(1)


def _upload(args, dev_args):
    from loongson.device import SerialDevice
    with SerialDevice(**dev_args) as dev:
        upload(dev, args.local, args.remote)


def _download(args, dev_args):
    from loongson.device import SerialDevice
    with SerialDevice(**dev_args) as dev:
        download(dev, args.remote, args.local)


if __name__ == '__main__':
    main()
