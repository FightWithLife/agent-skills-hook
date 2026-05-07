# -*- coding: utf-8 -*-
"""
仓库编码规范化执行工具
将扫描识别出的 GBK/非 UTF-8 文件统一转换为 UTF-8 with BOM，迁移运行期中文文本到宏头文件。

用法：
    python normalize_encoding.py --root REPO_ROOT --compiler armcc|armclang \
        --files file1,file2,... \
        --macro-header src/tp_text.h \
        --macro-name TP_TEXT_TEST_SAMPLE \
        --macro-value "PT562\xB2\xE2\xCA\xD4\xD1\xF9\xD5\xC5\n" \
        --source-file src/tp.c \
        --old-string '"PT562测试样张\\n"'

注意：
- 本工具为模板脚本，实际使用前需根据 scan_encoding.py 的审计结果调整参数。
- Makefile(.mk) 建议转为 UTF-8 无 BOM，因为 Make 工具通常不支持 BOM。
"""
import os
import sys
import argparse
import codecs

BOM = codecs.BOM_UTF8

def parse_args():
    parser = argparse.ArgumentParser(description='Normalize repository encoding.')
    parser.add_argument('--root', default='.', help='Repository root')
    parser.add_argument('--compiler', default='armcc', choices=['armcc', 'armclang'], help='Compiler type')
    parser.add_argument('--files', default='', help='Comma-separated list of files to convert (relative to root)')
    parser.add_argument('--no-bom-files', default='', help='Comma-separated list of files to convert to UTF-8 without BOM (e.g. Makefile)')
    parser.add_argument('--macro-header', default='', help='Path to new macro header file (relative to root)')
    parser.add_argument('--macro-name', default='', help='Macro name for migrated Chinese string')
    parser.add_argument('--macro-value', default='', help='Macro value with GBK hex escapes, e.g. "PT562\\xB2\\xE2\\n"')
    parser.add_argument('--macro-comment', default='', help='Chinese comment for the macro')
    parser.add_argument('--source-file', default='', help='Source file containing the old Chinese string')
    parser.add_argument('--old-string', default='', help='Old Chinese string literal to replace')
    parser.add_argument('--include-marker', default='#include "includes.h"', help='Marker line to insert new include after')
    return parser.parse_args()

def convert_file(filepath, use_bom=True):
    with open(filepath, 'rb') as f:
        data = f.read()
    if data.startswith(BOM):
        enc = 'utf-8-sig'
    else:
        try:
            data.decode('utf-8')
            enc = 'utf-8'
        except UnicodeDecodeError:
            try:
                data.decode('gbk')
                enc = 'gbk'
            except UnicodeDecodeError:
                enc = 'latin-1'
    text = data.decode(enc)
    text = text.replace('\r\n', '\n').replace('\n', '\r\n')
    with open(filepath, 'wb') as f:
        if use_bom:
            f.write(BOM)
        f.write(text.encode('utf-8'))
    print(f"Converted: {filepath} ({enc} -> utf-8{'-sig' if use_bom else ''})")

def create_macro_header(filepath, macro_name, macro_value, macro_comment):
    content = '\r\n'.join([
        '#ifndef _TEXT_H',
        '#define _TEXT_H',
        '',
        '/*',
        ' * 中文文本集中定义',
        ' * 来源：由历史非 UTF-8/GBK 编码源码中的运行期中文字符串迁移而来。',
        ' * 说明：本文件使用 UTF-8 with BOM 保存；宏值使用 GBK 字节转义，保持运行期字节不变。',
        ' */',
        '',
        f'/* ===== 运行期中文文本 ===== */',
        f'#define {macro_name}  "{macro_value}"  /* {macro_comment} */',
        '',
        '#endif /* _TEXT_H */',
        '',
    ])
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'wb') as f:
        f.write(BOM)
        f.write(content.encode('utf-8'))
    print(f"Created macro header: {filepath}")

def replace_string_in_source(filepath, include_marker, macro_header, old_string, macro_name):
    with open(filepath, 'rb') as f:
        data = f.read()
    if data.startswith(BOM):
        data = data[3:]
    # Try decode as utf-8 first, fallback to gbk
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        text = data.decode('gbk')

    # Add include
    inc_line = f'#include "{os.path.basename(macro_header)}"'
    if include_marker in text and inc_line not in text:
        text = text.replace(include_marker, include_marker + '\r\n' + inc_line)

    # Replace string literal
    # Note: old_string may contain actual Chinese chars; we do a simple replace.
    # For more complex cases, use line-by-line matching.
    if old_string in text:
        text = text.replace(old_string, macro_name)
        print(f"Replaced old string in: {filepath}")
    else:
        # Try line-by-line for strings with different quote escaping
        lines = text.split('\r\n')
        replaced = False
        for i, line in enumerate(lines):
            if 'snprintf' in line and old_string[:10] in line:
                lines[i] = line.replace(old_string, macro_name)
                replaced = True
                print(f"Replaced line {i+1} in: {filepath}")
                break
        if not replaced:
            print(f"WARN: could not find old string in {filepath}")
        text = '\r\n'.join(lines)

    text = text.replace('\r\n', '\n').replace('\n', '\r\n')
    with open(filepath, 'wb') as f:
        f.write(BOM)
        f.write(text.encode('utf-8'))
    print(f"Fixed source: {filepath}")

def main():
    args = parse_args()
    root = os.path.abspath(args.root)
    use_bom = args.compiler == 'armcc'

    # Convert regular files
    if args.files:
        for rel in args.files.split(','):
            rel = rel.strip()
            if not rel:
                continue
            convert_file(os.path.join(root, rel), use_bom=use_bom)

    # Convert no-BOM files (e.g. Makefile)
    if args.no_bom_files:
        for rel in args.no_bom_files.split(','):
            rel = rel.strip()
            if not rel:
                continue
            convert_file(os.path.join(root, rel), use_bom=False)

    # Create macro header and replace in source
    if args.macro_header and args.macro_name and args.macro_value:
        header_path = os.path.join(root, args.macro_header)
        create_macro_header(header_path, args.macro_name, args.macro_value, args.macro_comment or args.macro_name)
        if args.source_file and args.old_string:
            replace_string_in_source(
                os.path.join(root, args.source_file),
                args.include_marker,
                args.macro_header,
                args.old_string,
                args.macro_name
            )

    print("Done")

if __name__ == '__main__':
    main()
