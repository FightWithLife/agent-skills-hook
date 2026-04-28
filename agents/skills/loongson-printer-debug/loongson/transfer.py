"""文件传输：通过串口 base64 编码上传/下载文件"""
import base64
import hashlib
import os

CHUNK = 400  # 每块 base64 字符数，避免串口缓冲区溢出


def upload(dev, local_path, remote_path):
    """上传本地文件到设备，完成后 md5 校验"""
    with open(local_path, 'rb') as f:
        data = f.read()
    b64 = base64.b64encode(data).decode()
    local_md5 = hashlib.md5(data).hexdigest()

    tmp = remote_path + '.b64'
    dev.run(f'rm -f {tmp}')

    total = len(b64)
    for i in range(0, total, CHUNK):
        chunk = b64[i:i + CHUNK]
        dev.run(f"printf '%s' '{chunk}' >> {tmp}")
        pct = min(100, (i + CHUNK) * 100 // total)
        print(f'\r上传中 {pct}%...', end='', flush=True)

    print()
    dev.run(f'base64 -d {tmp} > {remote_path} && rm -f {tmp}')

    # 校验
    remote_md5 = dev.run(f'md5sum {remote_path}').split()[0]
    if remote_md5 != local_md5:
        raise RuntimeError(f'MD5 不匹配：本地 {local_md5}，远端 {remote_md5}')
    print(f'上传成功：{local_path} -> {remote_path} (md5={local_md5})')


def download(dev, remote_path, local_path):
    """从设备下载文件到本地，完成后 md5 校验"""
    remote_md5 = dev.run(f'md5sum {remote_path}').split()[0]

    b64_raw = dev.run(f'base64 {remote_path}')
    b64 = ''.join(b64_raw.split())  # 去除换行/空格
    data = base64.b64decode(b64)

    local_md5 = hashlib.md5(data).hexdigest()
    if local_md5 != remote_md5:
        raise RuntimeError(f'MD5 不匹配：远端 {remote_md5}，下载后 {local_md5}')

    os.makedirs(os.path.dirname(os.path.abspath(local_path)), exist_ok=True)
    with open(local_path, 'wb') as f:
        f.write(data)
    print(f'下载成功：{remote_path} -> {local_path} (md5={local_md5})')
