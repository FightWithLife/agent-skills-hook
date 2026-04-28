"""网络子命令：network / network-check / ssh-enable"""
from loongson.device import SerialDevice


def network(args, dev_args):
    """拉起 eth0，等待 DHCP，显示 IP"""
    with SerialDevice(**dev_args) as dev:
        print('正在执行 ifup eth0...')
        out = dev.run('ifup eth0', timeout=max(getattr(args, 'timeout', 30), 30))
        print(out)
        ip = dev.run('ip addr show eth0')
        print(ip)


def network_check(args, dev_args):
    """检查网络状态：IP、路由、ping 网关"""
    with SerialDevice(**dev_args) as dev:
        results = dev.run_many([
            'ip addr show eth0',
            'ip route',
            'cat /etc/resolv.conf',
        ])
        for c, out in results:
            print(f'--- {c} ---')
            print(out)
            print()
        # ping 默认网关
        gw = ''
        for _, out in results:
            for line in out.splitlines():
                if 'default' in line:
                    parts = line.split()
                    if len(parts) >= 3:
                        gw = parts[2]
                        break
        if gw:
            print(f'--- ping {gw} ---')
            print(dev.run(f'ping -c 3 {gw}', timeout=15))
        else:
            print('未找到默认网关')


def ssh_enable(args, dev_args):
    """检查并启动 sshd"""
    with SerialDevice(**dev_args) as dev:
        status = dev.run('ps | grep sshd | grep -v grep')
        if 'sshd' in status:
            print('sshd 已在运行')
            print(status)
        else:
            print('启动 sshd...')
            out = dev.run('/usr/sbin/sshd || sshd', timeout=10)
            print(out)
            status = dev.run('ps | grep sshd | grep -v grep')
            print(status)
        ip = dev.run('ip addr show eth0 | grep "inet "')
        print(f'SSH 地址: {ip.strip()}')
