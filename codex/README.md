# Codex Integration for Claude Code

为 Claude Code 提供 Codex CLI 静默调用包装器，优化 Claude-to-Codex 协作工作流。

## 功能特性

- **静默执行**：压制 Codex 的冗长思考输出，只返回最终结果
- **专用 Profile**：使用 `claude_quiet` profile 优化 Claude 调用体验
- **错误处理**：失败时输出完整日志，便于调试
- **一键部署**：自动化安装脚本，快速配置

## 目录结构

```
codex/
├── bin/
│   └── codex-quiet          # 静默包装器脚本
├── config.template.toml     # Codex 配置模板
├── setup.sh                 # 一键部署脚本
└── README.md                # 本文件
```

## 快速开始

### 方式 1：一键部署（推荐）

```bash
cd ~/code/agent-skills-hook/codex
./setup.sh
```

脚本会自动：
1. 检查 Codex CLI 是否安装
2. 安装 codex-quiet 到 `~/.local/bin/`
3. 配置 `claude_quiet` profile 到 `~/.codex/config.toml`
4. 更新 Claude 全局配置（如果存在）

### 方式 2：手动安装

#### 1. 安装包装器

```bash
cp bin/codex-quiet ~/.local/bin/
chmod +x ~/.local/bin/codex-quiet
```

#### 2. 配置 Codex Profile

在 `~/.codex/config.toml` 中添加：

```toml
[profiles.claude_quiet]
approval_policy = "never"
sandbox_mode = "danger-full-access"
model = "gpt-5.4"  # 或你的首选模型
model_reasoning_summary = "none"
model_verbosity = "low"
hide_agent_reasoning = true
```

#### 3. 更新 Claude 全局配置

在 `~/.claude/CLAUDE.md` 中添加：

```markdown
## Codex Integration
- When delegating tasks to Codex CLI, ALWAYS use the quiet wrapper:
  ```bash
  ~/.local/bin/codex-quiet "<task description>"
  ```
- This wrapper suppresses verbose thinking output and returns only final results
- Do NOT use `codex` or `codex exec` directly unless explicitly requested by user
```

## 使用方式

### 基本用法

```bash
~/.local/bin/codex-quiet "实现一个函数计算斐波那契数列"
```

### 在 Claude Code 中使用

当你在 Claude Code 中说：

```
使用 codex 实现一个排序算法
```

Claude 会自动调用 `codex-quiet` 执行任务。

### 详细任务描述

```bash
~/.local/bin/codex-quiet "
实现需求：实现快速排序算法

工作目录：/path/to/project

要修改的文件：
- src/sort.js

功能需求：
1. 实现 quickSort(arr) 函数
2. 支持升序和降序排序
3. 处理边界情况（空数组、单元素）

代码规范：
- 使用 ES6+ 语法
- 添加 JSDoc 注释
- 遵循项目代码风格

验收标准：
- 通过 tests/sort.test.js 测试
- 时间复杂度 O(n log n)
"
```

## 工作原理

### codex-quiet 脚本

```bash
#!/usr/bin/env bash
set -euo pipefail

# 创建临时文件存储输出和日志
tmp_out=$(mktemp)
tmp_log=$(mktemp)

# 清理函数
cleanup() {
  rm -f "$tmp_out" "$tmp_log"
}
trap cleanup EXIT

# 使用 claude_quiet profile 执行 codex
if ! codex -p claude_quiet exec -o "$tmp_out" "$@" >"$tmp_log" 2>&1; then
  # 失败时输出日志
  cat "$tmp_log" >&2
  exit 1
fi

# 成功时只输出最终结果
cat "$tmp_out"
```

### claude_quiet Profile

```toml
[profiles.claude_quiet]
approval_policy = "never"           # 不询问用户批准
sandbox_mode = "danger-full-access" # 完全访问权限
model = "gpt-5.4"                   # 使用最新模型
model_reasoning_summary = "none"    # 不显示推理摘要
model_verbosity = "low"             # 低冗余度
hide_agent_reasoning = true         # 隐藏代理推理过程
```

## 配置选项

### 修改模型

编辑 `~/.codex/config.toml`：

```toml
[profiles.claude_quiet]
model = "gpt-4"  # 改为其他模型
```

### 调整沙箱权限

```toml
[profiles.claude_quiet]
sandbox_mode = "workspace-write"  # 更安全的选项
```

⚠️ 注意：`danger-full-access` 提供完全访问权限，适合可信环境。

### 启用推理输出（调试用）

```toml
[profiles.claude_quiet]
model_reasoning_summary = "brief"  # 显示简要推理
hide_agent_reasoning = false       # 显示代理推理
```

## 验证安装

运行验证命令：

```bash
# 检查 codex-quiet 是否安装
which codex-quiet
# 应该输出: /home/<user>/.local/bin/codex-quiet

# 检查 codex 是否安装
which codex
codex --version

# 测试 codex-quiet
~/.local/bin/codex-quiet "echo 'Hello from Codex'"
```

## 故障排查

### 问题 1：codex-quiet 未找到

```bash
# 检查是否在 PATH 中
echo $PATH | grep -o "$HOME/.local/bin"

# 如果没有，添加到 ~/.bashrc 或 ~/.zshrc
export PATH="$HOME/.local/bin:$PATH"
```

### 问题 2：Codex CLI 未安装

```bash
# 安装 Codex CLI
# 访问: https://codex.anthropic.com
```

### 问题 3：Profile 未生效

```bash
# 检查配置文件
cat ~/.codex/config.toml | grep -A 5 "claude_quiet"

# 测试 profile
codex -p claude_quiet exec "echo test"
```

### 问题 4：权限错误

```bash
# 确保脚本可执行
chmod +x ~/.local/bin/codex-quiet

# 检查权限
ls -l ~/.local/bin/codex-quiet
```

## 与 Codex Orchestrator 配合

`codex-quiet` 是 `codex-orchestrator` skill 的核心组件：

1. **规划阶段**：Claude 分析需求，制定技术方案
2. **执行阶段**：Claude 调用 `codex-quiet` 执行实现
3. **验收阶段**：Claude 进行代码审查、测试、性能检查
4. **迭代阶段**：验收失败时，Claude 询问用户并重新调用 `codex-quiet`
5. **完成阶段**：验收通过后，Claude 提交代码

详见：`~/.claude/skills/codex-orchestrator/README.md`

## 高级用法

### 自定义工作目录

Codex 会自动识别任务描述中的工作目录：

```bash
~/.local/bin/codex-quiet "
工作目录：/path/to/project
实现功能 X
"
```

### 指定输出文件

```bash
# codex-quiet 不支持 -o 参数，因为它已经内部使用
# 如果需要保存输出，使用重定向
~/.local/bin/codex-quiet "任务描述" > output.txt
```

### 调试模式

如果需要查看完整的 Codex 输出（包括推理过程），直接使用 `codex`：

```bash
codex -p claude_quiet exec "任务描述"
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 相关链接

- [Codex CLI 官方文档](https://codex.anthropic.com)
- [Claude Code 文档](https://claude.ai/code)
- [agent-skills-hook 仓库](https://github.com/yourusername/agent-skills-hook)
