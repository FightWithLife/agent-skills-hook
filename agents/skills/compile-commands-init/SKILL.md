---
name: compile-commands-init
description: 为 C/C++ 项目初始化 compile_commands.json 和 .clangd 配置文件，使 clangd LSP 能正确进行代码补全、跳转和诊断。Linux 下使用 bear 拦截构建命令生成，Windows 下使用构建日志配合 CompilerGen.py 生成。自动扫描项目 include 目录并注入 .clangd。触发词：compile_commands.json、clangd、编译数据库、代码跳转、LSP 配置、生成 compile_commands。
---

# Compile Commands 初始化

## 概述

为 C/C++ 项目生成 `compile_commands.json`（clangd 编译数据库）和 `.clangd` 配置文件，
使 clangd 能正确解析项目头文件路径、宏定义和编译选项。

## 核心流程

1. 检测运行平台（Linux / Windows）
2. 按平台选择生成策略，生成 `compile_commands.json`
3. 生成 `.clangd` 配置文件
4. 扫描项目 include 目录，注入 `.clangd` 的 `CompileFlags.Add`
5. 验证生成结果

---

## 步骤 1：平台检测

```bash
uname -s  # Linux 或 MINGW*/MSYS*/CYGWIN*
```

- `Linux` → 使用 bear
- `MINGW*` / `MSYS*` / `CYGWIN*`（Windows）→ 使用 CompilerGen.py

---

## 步骤 2：生成 compile_commands.json

### Linux — bear

```bash
# 安装（如未安装）
sudo apt install bear -y 2>/dev/null || sudo dnf install bear -y 2>/dev/null

# 构建并拦截（根据实际构建命令调整）
make clean 2>/dev/null || true
bear -- make -j$(nproc)
```

如果项目使用 CMake：
```bash
cmake -B build -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
cp build/compile_commands.json .
```

### Windows — 构建日志 + CompilerGen.py

**第一步：获取构建日志**

将完整编译输出保存为 `build_log.txt`。方式取决于构建系统：

- **Makefile**（Git Bash/MSYS2）：
  ```bash
  make clean 2>/dev/null || true
  make -j 2>&1 | tee build_log.txt
  ```
- **Keil MDK / IAR**：从 IDE 构建输出窗口复制完整编译日志，保存为 `build_log.txt`
- **已有日志文件**：直接使用现有的构建日志

**第二步：用 CompilerGen.py 生成**

```bash
python <skill-dir>/scripts/CompilerGen.py <compiler>
```

脚本支持的编译器名：
| 名称 | 匹配的编译器 |
|------|-------------|
| `armcc` | armcc / armcc.exe |
| `armclang` | armclang / armclang.exe |
| `gcc` | gcc / arm-none-eabi-gcc |

脚本自动生成 `compile_commands.json` 和 `.clangd`。

---

## 步骤 3：.clangd 增强 — 注入项目 Include 路径

`.clangd` 生成后，必须扫描项目目录结构，将头文件目录注入到 `CompileFlags.Add` 中。

### 扫描策略

用 Glob 查找以下目录模式（按优先级）：

```bash
# 嵌入式固件配置头文件目录（最高优先级）
find . -type d -name "include_cfg" 2>/dev/null

# 通用头文件目录
find . -maxdepth 3 -type d -name "include" 2>/dev/null
find . -maxdepth 3 -type d -name "inc" 2>/dev/null
find . -maxdepth 3 -type d -name "config" 2>/dev/null
```

### 更新 .clangd

读取 `.clangd` 文件，在 `CompileFlags.Add:` 列表末尾追加扫描到的路径：

```yaml
CompileFlags:
  Add:
    - -I<absolute-path-to>/include_cfg
    - -I<absolute-path-to>/include
    - -I<absolute-path-to>/lib/include
```

操作要点：
- 使用绝对路径
- 不对已存在的 `-I` 路径重复添加
- `compile_commands.json` 已含完整编译参数的场景，`.clangd` 的 `-I` 作为兜底

### ARM 嵌入式项目特殊处理

若为 ARM 嵌入式项目且 `.clangd` 中未含目标架构参数，补充：

```yaml
CompileFlags:
  Add:
    - --target=arm-none-eabi
```

---

## 步骤 4：验证

```bash
# 检查文件存在
ls -la compile_commands.json .clangd

# 验证 JSON
python -c "import json; data=json.load(open('compile_commands.json')); print(f'OK: {len(data)} entries')"

# 检查 clangd（如已安装）
which clangd && clangd --version || echo "clangd 未安装，可后续安装验证"
```

---

## 资源

| 资源 | 路径 | 用途 |
|------|------|------|
| CompilerGen.py | `scripts/CompilerGen.py` | Windows 下从构建日志解析生成 compile_commands.json 和 .clangd |
