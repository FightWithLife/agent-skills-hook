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
├── config/                   # 单一配置源（自包含）
│   ├── AGENTS.md            # 共享入口
│   ├── claude/CLAUDE.md     # Claude Code 配置
│   ├── codex/AGENTS.md      # Codex CLI 配置
│   ├── opencode/AGENTS.md   # OpenCode 配置
│
├── linux/deploy.sh          # Linux 部署脚本（软链接）
├── windows/deploy.ps1       # Windows 部署脚本（复制）
│
├── agents/skills/           # 共享技能库
│
└── README.md
```

### 设计原则
- **单一配置源**：所有运行时配置位于 `config/`，避免双线维护
- **自包含文件**：每个入口文件包含完整规则，不依赖外部引用
- **平台差异仅在部署**：Linux 用软链接，Windows 用复制，配置内容完全相同

## 快速开始

### 1. 初始化 Skills Submodule

```bash
git submodule update --init --recursive agents/skills
```

### 2. 部署配置

#### Linux

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

#### Windows

```powershell
cd windows

# 部署所有运行时
.\deploy.ps1 -Target "all"

# 或指定目标
.\deploy.ps1 -Target "codex"
.\deploy.ps1 -Target "opencode"
.\deploy.ps1 -Target "claude"
.\deploy.ps1 -Target "both"
```

### 3. 重启运行时

部署后重启对应运行时生效：
- Codex CLI: 重启终端或重新运行 `codex`
- OpenCode: 重启 OpenCode
- Claude Code: 重启 Claude Code

## 嵌入式 C 工作流

当前仓库的默认协作方式偏向嵌入式开发：

- 小改动默认直接处理，避免把简单工作流变重。
- 遇到 Make/CMake、交叉编译、链接、启动文件、宏或包含路径问题时，优先升级给 `build_resolver`。
- 遇到 ISR、`volatile`、共享状态、寄存器访问、缓冲区、超时等固件风险时，要求经过 `firmware_reviewer`。
- 遇到 GPIO、时钟、UART、SPI、I2C、CAN、DMA、timer、board-support 等改动时，要求经过 `hardware_impact`。
- 多文件功能、状态机、初始化时序或模块边界调整时，先拆解，再落地，最后回归审查。

## 验证与回滚

### 验证部署

**Linux（软链接）**：
```bash
ls -la ~/.codex/skills ~/.codex/AGENTS.md
ls -la ~/.config/opencode/skills ~/.config/opencode/AGENTS.md
ls -la ~/.claude/skills ~/.claude/CLAUDE.md
```

**Windows（复制）**：
```powershell
Test-Path "$env:USERPROFILE\.codex\AGENTS.md"
Test-Path "$env:USERPROFILE\.config\opencode\AGENTS.md"
Test-Path "$env:USERPROFILE\.claude\CLAUDE.md"
```

### 回滚

备份目录位于：
- Linux: `~/.codex-backups/`, `~/.opencode-backups/`, `~/.claude-backups/`
- Windows: `$env:USERPROFILE\.codex-backups\`, 等

恢复备份：
```bash
# Linux
cp -a ~/.codex-backups/agent-skills-hook-<timestamp>/codex/* ~/.codex/
```

```powershell
# Windows
Copy-Item "$env:USERPROFILE\.codex-backups\agent-skills-hook-<timestamp>\codex\*" "$env:USERPROFILE\.codex\" -Recurse -Force
```

## 文件说明

| 文件 | 用途 |
|------|------|
| `config/AGENTS.md` | 共享入口，定义仓库总则 |
| `config/claude/CLAUDE.md` | Claude Code 运行时配置（自包含） |
| `config/codex/AGENTS.md` | Codex CLI 运行时配置（自包含） |
| `config/opencode/AGENTS.md` | OpenCode 运行时配置（自包含） |
| `linux/deploy.sh` | Linux 部署脚本（软链接方式） |
| `windows/deploy.ps1` | Windows 部署脚本（复制方式） |

## 维护说明

更新配置只需修改 `config/` 目录下的文件，然后重新运行部署脚本即可。

- Linux 用户：修改后重新运行 `linux/deploy.sh`（软链接自动指向新内容）
- Windows 用户：修改后重新运行 `windows/deploy.ps1`（复制新内容）