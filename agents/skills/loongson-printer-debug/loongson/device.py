"""SerialDevice — 提示符驱动的串口设备核心类"""
import serial
import time
from .output import clean


class LoginError(Exception):
    pass


class DeviceTimeoutError(Exception):
    pass


class SerialDevice:
    PROMPTS = (b'# ', b'$ ')

    def __init__(self, port='/dev/ttyUSB0', user='root', password='root', cmd_timeout=30):
        self.port = port
        self.user = user
        self.password = password
        self.cmd_timeout = cmd_timeout
        self.ser = None

    def connect(self):
        """打开串口（9600→115200），重置 shell，登录，统一提示符"""
        self.ser = serial.Serial(self.port, 9600, timeout=0.1)
        time.sleep(0.5)
        self.ser.baudrate = 115200
        self.ser.reset_input_buffer()
        self._reset_shell()
        self._login()
        # 统一提示符为 '# '，避免带路径的花式提示符
        self.ser.write(b"export PS1='# '\r\n")
        self.wait_prompt(timeout=5)

    def disconnect(self):
        if self.ser and self.ser.is_open:
            self.ser.close()
            self.ser = None

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *_):
        self.disconnect()

    # ------------------------------------------------------------------
    # 内部：重置和登录
    # ------------------------------------------------------------------

    def _reset_shell(self):
        """发送 Ctrl+C x3 + Ctrl+D 清理卡住的 shell"""
        for _ in range(3):
            self.ser.write(b'\x03')
            time.sleep(0.2)
        self.ser.write(b'\x04')
        time.sleep(1.5)
        self.ser.reset_input_buffer()

    def _read_until(self, targets, timeout):
        """读数据直到出现任意 target 字节串，返回累积 bytes"""
        buf = b''
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            chunk = self.ser.read(256)
            if chunk:
                buf += chunk
                for t in targets:
                    if t in buf:
                        return buf
            else:
                time.sleep(0.05)
        return buf

    def _login(self):
        """登录：先发回车探测，已在 shell 则直接返回，否则走 login/password 流程"""
        self.ser.write(b'\r\n')
        buf = self._read_until([b'# ', b'$ ', b'login:', b'Login:'], timeout=5)
        text = buf.decode(errors='replace')

        if '# ' in text or '$ ' in text:
            return  # 已登录

        if 'login' in text.lower():
            self.ser.write((self.user + '\r\n').encode())
            buf = self._read_until([b'Password:', b'password:'], timeout=5)
            text = buf.decode(errors='replace')

        if 'password' in text.lower():
            self.ser.write((self.password + '\r\n').encode())
            buf = self._read_until([b'# ', b'$ '], timeout=10)
            text = buf.decode(errors='replace')

        if '# ' not in text and '$ ' not in text:
            raise LoginError(f'登录失败，设备响应：{text[-200:]!r}')

    # ------------------------------------------------------------------
    # 公共接口
    # ------------------------------------------------------------------

    def wait_prompt(self, timeout=None):
        """等待提示符，返回本次输出的原始字符串"""
        if timeout is None:
            timeout = self.cmd_timeout
        buf = b''
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            chunk = self.ser.read(256)
            if chunk:
                buf += chunk
                text = buf.decode(errors='replace')
                rstripped = text.rstrip()
                if rstripped.endswith('# ') or rstripped.endswith('#') or \
                   rstripped.endswith('$ ') or rstripped.endswith('$'):
                    return text
            else:
                time.sleep(0.05)
        # 超时：发 Ctrl+C
        self.ser.write(b'\x03')
        time.sleep(0.3)
        raise DeviceTimeoutError(f'等待提示符超时（{timeout}s），已发 Ctrl+C')

    def run(self, cmd, timeout=None):
        """执行单条命令，返回清理后的输出"""
        if timeout is None:
            timeout = self.cmd_timeout
        self.ser.reset_input_buffer()
        self.ser.write((cmd + '\r\n').encode())
        raw = self.wait_prompt(timeout=timeout)
        return clean(raw, cmd)

    def run_many(self, cmds, timeout=None):
        """批量执行命令，返回 [(cmd, output), ...]"""
        results = []
        for cmd in cmds:
            output = self.run(cmd, timeout=timeout)
            results.append((cmd, output))
        return results
