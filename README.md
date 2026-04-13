# agent-skills-hook

## 简介
这是一个把"Hook 机制"落地到 Codex CLI / OpenCode / Claude Code 的配置仓库，目标是：
- 提高 AI 对 skills 的触发与使用概率
- 固定会话起止输出（`SessionStart` / `Stop`）
- 在危险命令前给出 execpolicy 安全提示
- 强化嵌入式 C 开发工作流，优先覆盖 Make/CMake、构建诊断、固件审查与硬件影响分析

## 功能
- 会话启动提示（`SessionStart`）
- 每次请求前强制技能评估（`Skill Forced Eval`）
- 危险命令前缀提示（execpolicy rules）
- 任务完成收尾总结（`Stop`）
- Codex / Claude Code 的轻量优先协作路由
- 面向嵌入式 C 的 agent 分工：规划、实现、构建修复、固件审查、硬件影响审查

## 目录结构

```
agent-skills-hook/
├── linux/                    # Linux 版本（软链接部署）
│   ├── AGENTS.md             # 共享入口
│   ├── docs/agenting/        # 深文档分层
│   ├── claude/               # Claude Code 配置
│   ├── codex/                # Codex CLI 配置
│   ├── opencode/             # OpenCode 配置
│   └── deploy.sh             # 部署脚本（软链接方式）
│
├── windows/                  # Windows 版本（复制部署）
│   ├── claude/               # Claude Code 配置（单文件自包含）
│   ├── codex/                # Codex CLI 配置（单文件自包含）
│   ├── opencode/             # OpenCode 配置（单文件自包含）
│   └── deploy.ps1            # 部署脚本（复制方式）
│
├── agents/skills/            # 共享技能库（两个版本共用）
│
└── README.md
```

### 版本差异

| 特性 | Linux 版本 | Windows 版本 |
|------|-----------|-------------|
| 配置结构 | 分层结构（AGENTS.md + docs/agenting/*.md） | 单文件自包含（所有规则合入入口文件） |
| 部署方式 | 软链接（`ln -s`） | 复制（`Copy-Item`） |
| Skills 引用 | 软链接到仓库根目录的 `agents/skills` | 复制副本到用户目录 |
| 更新方式 | 修改仓库文件自动生效 | 需重新运行部署脚本 |

## 快速开始

### 1. 初始化 Skills Submodule

```bash
git submodule update --init --recursive agents/skills
```

### 2. 选择部署版本

#### Linux 版本部署（软链接方式）

```bash
cd linux
chmod +x deploy.sh

# 部署所有运行时
./deploy.sh TARGET=all

# 或指定目标
./deploy.sh TARGET=codex      # 仅 Codex
./deploy.sh TARGET=opencode   # 仅 OpenCode
./deploy.sh TARGET=claude     # 仅 Claude Code
./deploy.sh TARGET=both       # Codex + OpenCode
```

#### Windows 版本部署（复制方式）

```powershell
cd windows

# 部署所有运行时
.\deploy.ps1 -Target "all"

# 或指定目标
.\deploy.ps1 -Target "codex"      # 仅 Codex
.\deploy.ps1 -Target "opencode"   # 仅 OpenCode
.\deploy.ps1 -Target "claude"     # 仅 Claude Code
.\deploy.ps1 -Target "both"       # Codex + OpenCode
```

### 3. 重启运行时

部署后重启对应运行时生效：
- Codex CLI: 重启终端或重新运行 `codex`
- OpenCode: 重启 OpenCode
- Claude Code: 重启 Claude Code

## 嵌入式 C 工作流

当前仓库对 `Codex` 和 `Claude Code` 的默认协作方式已经偏向嵌入式开发：

- 小改动默认由 Claude 直接处理，避免把简单工作流变重。
- 遇到 Make/CMake、交叉编译、链接、启动文件、宏或包含路径问题时，优先升级给 Codex 的 `build_resolver`。
- 遇到 ISR、`volatile`、共享状态、寄存器访问、缓冲区、超时等固件风险时，要求经过 `firmware_reviewer`。
- 遇到 GPIO、时钟、UART、SPI、I2C、CAN、DMA、timer、board-support 等改动时，要求经过 `hardware_impact`。
- 多文件功能、状态机、初始化时序或模块边界调整时，先让 `planner` 拆解，再由 `worker` 落地，最后由 `reviewer` 做回归审查。

这套策略的目标不是强制所有任务走多 agent，而是在保留当前简易工作流的前提下，把真正高风险的嵌入式变更自动导向更稳妥的路径。

## 验证与回滚

### 验证部署

部署后检查以下路径是否正确配置：

**Linux（软链接）**：
```bash
# Codex
ls -la ~/.codex/skills ~/.codex/AGENTS.md ~/.agents/skills

# OpenCode
ls -la ~/.config/opencode/skills ~/.config/opencode/AGENTS.md

# Claude Code
ls -la ~/.claude/skills ~/.claude/CLAUDE.md
```

**Windows（复制）**：
```powershell
# Codex
Test-Path "$env:USERPROFILE\.codex\AGENTS.md"
Test-Path "$env:USERPROFILE\.codex\skills"

# OpenCode
Test-Path "$env:USERPROFILE\.config\opencode\AGENTS.md"

# Claude Code
Test-Path "$env:USERPROFILE\.claude\CLAUDE.md"
```

### 回滚

备份目录位于：
- Linux: `~/.codex-backups/`, `~/.opencode-backups/`, `~/.claude-backups/`
- Windows: `$env:USERPROFILE\.codex-backups\`, `$env:USERPROFILE\.opencode-backups\`, `$env:USERPROFILE\.claude-backups\`

恢复备份：
```bash
# Linux 示例
cp -a ~/.codex-backups/agent-skills-hook-<timestamp>/codex/* ~/.codex/
```

```powershell
# Windows 示例
Copy-Item "$env:USERPROFILE\.codex-backups\agent-skills-hook-<timestamp>\codex\*" "$env:USERPROFILE\.codex\" -Recurse -Force
```

## AI 自部署（Scriptless）

如需让 AI 自行部署，可发送以下指令：

```text
请在仓库根目录按 README 的部署说明执行部署。
目标：Codex CLI / OpenCode / Claude Code 使用同一份 skills（仓库内 agents/skills）。
版本：根据当前系统选择 linux/ 或 windows/ 目录。
要求：先备份，再部署，再验证，最后回报变更与验证结果。
```

## 文件说明

### Linux 版本文件

| 文件 | 用途 |
|------|------|
| `linux/AGENTS.md` | 共享入口，定义仓库总则和共享边界 |
| `linux/docs/agenting/architecture.md` | 架构边界和分层原则 |
| `linux/docs/agenting/verification.md` | 验证标准和证据格式 |
| `linux/docs/agenting/delegation.md` | 委派策略和协作规则 |
| `linux/docs/agenting/runtime-style.md` | 默认处理方式和沟通风格 |
| `linux/claude/CLAUDE.md` | Claude 运行时增量（引用 docs/agenting） |
| `linux/codex/AGENTS.md` | Codex 运行时增量（引用 docs/agenting） |
| `linux/opencode/AGENTS.md` | OpenCode 运行时增量（引用 docs/agenting） |

### Windows 版本文件

| 文件 | 用途 |
|------|------|
| `windows/claude/CLAUDE.md` | Claude 运行时配置（自包含所有规则） |
| `windows/codex/AGENTS.md` | Codex 运行时配置（自包含所有规则） |
| `windows/opencode/AGENTS.md` | OpenCode 运行时配置（自包含所有规则） |

Windows 版本将 Linux 版本的分层内容合并到单一入口文件，便于在 Windows 环境中直接编辑和维护。