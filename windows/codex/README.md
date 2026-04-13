# 嵌入式 C 工作流的 Codex 集成

这个目录把 Codex 变成面向嵌入式固件工作的聚焦执行层，而不是一个沉重、始终在线的编排器。

## 设计目标

- 保持默认路径简单，适合单文件或低风险改动。
- 当构建失败、多文件固件工作或硬件风险足以证明值得升级时，再升级给 Codex。
- 复用 `everything-claude-code` 里更强的编排思路，但不要把个人配置或沉重的 MCP 依赖复制进仓库。
- 给 Codex 明确的架构能力，让它在规划和实现之前能推理系统结构。

## 推荐流程

1. 对于小型、本地改动，直接使用 Claude 或 Codex。
2. 结构性工作在实现前先走 `architect`：
   - `architect`：模块边界、BSP 或 HAL 分层、启动顺序、可移植性和演进路径
   - `planner`：在架构方向选定后，把工作拆成可执行的实施阶段
   - `worker`：在分配范围内做最小实现
   - `build-resolver`：`Make` 或 `CMake`、编译、链接、包含路径或工具链失败
   - `firmware-reviewer`：ISR、`volatile`、寄存器、DMA、超时或缓冲区风险复核
   - `hardware-impact`：外设、时钟、板级支持和总线影响复核
   - `reviewer`：最终回归检查
   - `explorer`：只读追踪和代码库检索
   - `monitor`：长时间构建或串口日志观察
3. 默认验证要回到仓库里常规的固件命令，通常是 `make`、`cmake --build`、单元测试，以及你已经在用的板级冒烟检查。

## 仓库文件

- `AGENTS.md`：嵌入式 C 工作的路由和升级规则
- `config.toml`：共享的、去个人化的仓库配置
- `config.template.toml`：提供方、模型和受信任仓库的本地覆盖模板
- `agents/*.toml`：各代理的提示词专用配置
- `setup.sh`：最小化的本地安装辅助脚本

## 相比旧布局的变化

- 共享配置不再包含个人提供方端点或个人受信任项目路径。
- 默认 profile 拆成了 `light`、`review`、`orchestrated` 和 `claude_quiet`。
- 代理集合从通用的 `explorer/worker/reviewer/monitor` 扩展为包含嵌入式 C 专用的架构、规划、构建修复和风险复核角色。
- MCP 默认保持轻量：`github`、`context7`、`memory` 和 `sequential-thinking`。

## 本地安装

在 `codex/` 目录下运行：

```bash
./setup.sh
```

该辅助脚本会：

- 如果 `codex/bin/` 中存在，则安装或刷新 `~/.local/bin/codex-quiet`
- 确保 `~/.codex/config.toml` 存在
- 如果缺少共享 profile 名称，就补进去
- 避免把个人提供方配置写入仓库副本

## 本地覆盖说明

把这些放到本地 `~/.codex/config.toml` 里，不要放进仓库：

- 自定义提供方端点
- API 鉴权偏好
- 适合你机器或预算的模型覆盖项
- 你私有固件仓库的受信任项目路径
- 你不想作为仓库默认值的较重 MCP 服务

## 建议的嵌入式 C 委派规则

- 单文件、无构建回归、低硬件风险：留在本地处理。
- 架构或模块边界不明确：先用 `architect`。
- 构建断裂、链接失败、生成文件不匹配：用 `build-resolver`。
- ISR 或共享状态改动：必须经过 `firmware-reviewer`。
- 外设或板级初始化改动：必须经过 `hardware-impact`。
- 较大功能或重构：结构相关时先 `architect`，再 `planner`，然后 `worker`，最后 `reviewer`。
