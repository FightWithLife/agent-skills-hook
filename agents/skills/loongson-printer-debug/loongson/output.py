"""输出清理：去除 ANSI 转义、\r、命令回显、提示符行"""
import re

ANSI_RE = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')
# 只匹配典型提示符行：可选用户@主机前缀，末尾 # 或 $ 加可选空格
# 避免误删含 # 或 $ 的普通输出行
PROMPT_RE = re.compile(r'^(\S+@\S+[: ]\S*\s*)?[#$] ?$')


def clean(raw: str, cmd: str = '') -> str:
    """清理串口输出，返回纯净内容"""
    # 去 ANSI 转义
    text = ANSI_RE.sub('', raw)
    # 统一换行
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    lines = text.split('\n')

    result = []
    for line in lines:
        stripped = line.strip()
        # 跳过空行（开头）
        if not stripped:
            result.append('')
            continue
        # 跳过命令回显
        if cmd and stripped == cmd.strip():
            continue
        # 跳过提示符行
        if PROMPT_RE.match(stripped):
            continue
        result.append(line.rstrip())

    # 去掉首尾空行
    while result and not result[0].strip():
        result.pop(0)
    while result and not result[-1].strip():
        result.pop()

    return '\n'.join(result)
