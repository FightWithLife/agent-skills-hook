# -*- coding: utf-8 -*-
"""
仓库编码扫描工具
扫描指定目录下所有文本文件，检测原始编码，识别中文字符位置（注释 vs 字符串字面量）。

用法：
    python scan_encoding.py [--root REPO_ROOT] [--out encoding_audit.md]

输出：encoding_audit.md（编码审计报告）
"""
import os
import sys
import argparse
import codecs

def get_default_args():
    parser = argparse.ArgumentParser(description='Scan repository text files for encoding and Chinese text locations.')
    parser.add_argument('--root', default='.', help='Repository root directory (default: current directory)')
    parser.add_argument('--out', default='encoding_audit.md', help='Output report file (default: encoding_audit.md)')
    parser.add_argument('--exts', default='.c,.h,.s,.S,.mk,.txt,.bat,.cmd', help='Comma-separated file extensions to scan')
    parser.add_argument('--exclude', default='stm32lib,stm32usb,ucos2,Libraries,__pycache__,.git,firmware,release,releases,dist,out,bin,build,.vscode', help='Comma-separated directory names to exclude')
    return parser.parse_args()

def should_scan(rel_path, target_exts, exclude_dirs):
    parts = rel_path.replace('\\', '/').split('/')
    for p in parts[:-1]:
        if p in exclude_dirs:
            return False
    _, ext = os.path.splitext(rel_path)
    return ext.lower() in target_exts

def detect_encoding(data):
    if data.startswith(codecs.BOM_UTF8):
        return 'utf-8-sig'
    if data.startswith(codecs.BOM_UTF16_LE) or data.startswith(codecs.BOM_UTF16_BE):
        return 'utf-16'
    try:
        data.decode('utf-8')
        return 'utf-8'
    except UnicodeDecodeError:
        pass
    try:
        data.decode('gbk')
        return 'gbk'
    except UnicodeDecodeError:
        pass
    try:
        data.decode('big5')
        return 'big5'
    except UnicodeDecodeError:
        pass
    return 'latin-1'

def is_chinese_char(c):
    cp = ord(c)
    return (0x4E00 <= cp <= 0x9FFF) or (0x3400 <= cp <= 0x4DBF) or (0xF900 <= cp <= 0xFAFF)

def analyze_line(line):
    in_string = False
    string_char = None
    in_comment = False
    comment_start = None
    results = []
    i = 0
    while i < len(line):
        c = line[i]
        if not in_comment and not in_string:
            if c == '"' or c == "'":
                in_string = True
                string_char = c
            elif c == '/' and i + 1 < len(line):
                if line[i + 1] == '/':
                    in_comment = True
                    comment_start = i
                    break
                elif line[i + 1] == '*':
                    in_comment = True
                    comment_start = i
                    i += 2
                    continue
        elif in_string:
            if c == '\\' and i + 1 < len(line):
                i += 2
                continue
            elif c == string_char:
                in_string = False
                string_char = None
        if is_chinese_char(c):
            loc = 'comment' if in_comment else ('string' if in_string else 'code')
            results.append((i, c, loc))
        i += 1
    return results

def main():
    args = get_default_args()
    repo_root = os.path.abspath(args.root)
    target_exts = set('.' + e.strip().lstrip('.') for e in args.exts.split(','))
    exclude_dirs = set(args.exclude.split(','))

    files = []
    for root, dirs, filenames in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for fname in filenames:
            full = os.path.join(root, fname)
            rel = os.path.relpath(full, repo_root)
            if should_scan(rel, target_exts, exclude_dirs):
                files.append(rel)

    results = []
    for rel in sorted(files):
        full = os.path.join(repo_root, rel)
        with open(full, 'rb') as f:
            data = f.read()
        if not data:
            continue
        enc = detect_encoding(data)
        try:
            text = data.decode(enc)
        except Exception as e:
            print(f"WARN: cannot decode {rel} with {enc}: {e}")
            continue
        has_chinese = False
        chinese_lines = []
        for line_no, line in enumerate(text.split('\n'), 1):
            chs = analyze_line(line)
            if chs:
                has_chinese = True
                chinese_lines.append((line_no, line.rstrip('\r'), chs))
        if has_chinese:
            results.append({
                'path': rel,
                'encoding': enc,
                'lines': chinese_lines,
            })

    out_path = os.path.join(repo_root, args.out)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('# 仓库原始编码审计\n\n')
        f.write('| 文件路径 | 原始编码 | 包含中文行数 | 字符串字面量 | 注释 | 代码区 |\n')
        f.write('|---|---|---|---|---|---|\n')
        for r in results:
            string_count = sum(1 for line in r['lines'] for _, _, loc in line[2] if loc == 'string')
            comment_count = sum(1 for line in r['lines'] for _, _, loc in line[2] if loc == 'comment')
            code_count = sum(1 for line in r['lines'] for _, _, loc in line[2] if loc == 'code')
            f.write(f"| {r['path']} | {r['encoding']} | {len(r['lines'])} | {string_count} | {comment_count} | {code_count} |\n")
        f.write('\n\n## 详细清单\n\n')
        for r in results:
            f.write(f"\n### {r['path']} (原始编码: {r['encoding']})\n\n")
            for line_no, line_text, chs in r['lines']:
                locs = {}
                for _, _, loc in chs:
                    locs[loc] = locs.get(loc, 0) + 1
                loc_str = ', '.join(f"{k}:{v}" for k, v in locs.items())
                f.write(f"**Line {line_no}** ({loc_str}): `{line_text}`\n\n")

    print(f"Scanned {len(files)} files, found {len(results)} files with Chinese characters.")
    print(f"Report written to {out_path}")

if __name__ == '__main__':
    main()
