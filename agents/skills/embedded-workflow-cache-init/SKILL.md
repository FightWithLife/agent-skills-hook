---
name: embedded-workflow-cache-init
description: 当需要为嵌入式调试、固件刷写或逻辑分析流程初始化项目内 `.agents/cache` 文件时使用，尤其是需要沉淀 `VID/PID`、固件产物、传输协议参数，或在用户已提供逻辑分析仪通道映射和测试方法时初始化 KingstVIS 相关缓存。
---

# 初始化嵌入式工作流缓存

## 何时使用

- 需要首次为某个项目落盘 `.agents/cache/` 下的嵌入式工作流缓存文件。
- 需要为固件刷写流程生成一份可复用的下载配置草稿，再由后续 skill 或人工补齐事实字段。
- 用户已经给出逻辑分析仪通道映射、触发方式或测试方法，需要顺手初始化 KingstVIS 时序经验文件与映射文件。
- 需要把零散的设备识别、固件信息、协议参数先收口为项目内可维护的缓存，而不是散落在对话里。

## 不适用

- 已经能从仓库中确定完整刷写参数，且目标是直接探测、分包或刷写。此时优先使用 `repo-firmware-flasher`。
- 已经有完整的逻辑分析仪抓取命令，只差实际抓波形。此时优先使用 `kingstvis-socket`。
- 只做一次性说明，不需要在仓库内落盘缓存。

## 核心工作流

1. 先读 `references/cache-layout.md`，确认要初始化哪些缓存文件。
2. 从用户提供的信息中拆分两类事实：
   - 固件刷写事实：目标名、`VID/PID`、传输类型、固件路径、分包和 ACK 规则
   - 逻辑分析事实：测试方法、测试用例、触发方式、通道映射、建议窗口
3. 运行脚本初始化缓存：

```powershell
python agents\skills\embedded-workflow-cache-init\scripts\init_embedded_workflow_cache.py --project-root . --target <target-name>
```

4. 如果只有固件刷写信息，就只创建：
   - `.agents/cache/<target-name>_download.cfg`
5. 如果用户还提供了逻辑分析仪相关映射或测试方法，再额外创建或补充：
   - `.agents/cache/logic_timing_windows.csv`
   - `.agents/cache/kingstvis_channel_maps.json`
6. 生成后快速检查文件是否已落盘，并确认占位字段没有伪造事实。

## 执行要求

- 没有事实支撑时，字段保留为空或占位值，不要猜 `VID/PID`、ACK、命令字。
- 配置文件要放在项目内 `.agents/cache/`，不要写到 skill 目录里。
- `logic_timing_windows.csv` 只在用户提供测试方法、测试用例或建议抓取窗口时初始化。
- `kingstvis_channel_maps.json` 只在用户提供了逻辑分析仪通道/引脚映射时创建或更新。
- 如果缓存已存在，优先保留现有内容；仅补齐缺失文件或新增缺失条目。

## 参考

- `references/cache-layout.md`：缓存文件用途、字段说明和最小示例。
- `scripts/init_embedded_workflow_cache.py`：初始化 `.agents/cache` 文件的入口脚本。
