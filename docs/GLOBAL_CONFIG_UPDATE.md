# 全局配置更新说明

## 文件位置

`~/.claude/CLAUDE.md`

## 更新内容

添加了"Codex Collaboration Mode (通用版本)"部分，包括：

### 1. 职责分工
- Claude：规划、验收、迭代指导
- Codex：具体实现

### 2. 执行模式选择
- 简单修改（<50行）：Claude 直接执行
- 中等功能（50-200行）：使用 codex-orchestrator
- 复杂重构（>200行）：plan mode + codex-orchestrator

### 3. Codex 调用规范
- 必须使用 `~/.local/bin/codex-quiet`
- 不要使用 `codex` 或 `codex exec`（除非用户明确要求）
- 提供详细的任务描述模板

### 4. 验收标准
1. 代码审查（质量、安全、风格、注释）
2. 构建测试（编译通过、无警告）
3. 功能测试（测试通过、无回归）
4. 性能检查（无明显退化）
5. 架构合规（遵循项目架构指南）

### 5. 迭代处理
- 验收失败时询问用户如何处理
- 提供 4 个选项（Codex 自动修复、用户指导、Claude 修复、中止）
- 最多迭代 3 次

### 6. 完成流程
- 使用 git-master skill 提交代码
- 提供完成总结

## 通用性

此配置是通用版本，适用于所有项目：
- ✅ 不包含特定项目的路径或命令
- ✅ 使用通用的构建/测试命令示例
- ✅ 支持多种编程语言和构建系统
- ✅ 可在项目的 CLAUDE.md 中添加项目特定规则

## 与项目配置的关系

- **全局配置**（`~/.claude/CLAUDE.md`）：通用的协作模式和验收标准
- **项目配置**（如 `/home/xmg/code/PCL/CLAUDE.md`）：项目特定的规则和约束

项目配置会继承全局配置，并可以添加项目特定的内容，例如：
- 特定的构建命令
- 特定的测试命令
- 特定的架构文档路径
- 特定的代码规范（如 Doxygen 中文注释）

## 使用方式

### 在任何项目中

```
用户: 使用 codex 实现一个排序算法
Claude: [自动应用全局配置的协作模式]
```

### 在有项目配置的项目中

```
用户: 使用 codex 实现 PCL6 的日志功能
Claude: [应用全局配置 + PCL 项目特定配置]
```

## 验证

全局配置已生效，可以通过以下方式验证：

```bash
# 查看全局配置
cat ~/.claude/CLAUDE.md

# 在任何项目中测试
cd /path/to/any/project
# 然后在 Claude Code 中说：
# "使用 codex 实现一个简单的测试功能"
```

## 相关文件

- 全局配置：`~/.claude/CLAUDE.md`
- Codex 包装器：`~/.local/bin/codex-quiet`
- Codex 配置：`~/.codex/config.toml`
- Skill：`~/.claude/skills/codex-orchestrator/`
- 源仓库：`~/code/agent-skills-hook/`

## 部署到新机器

如果需要在新机器上部署：

```bash
# 1. 克隆 agent-skills-hook 仓库
git clone <repo-url> ~/code/agent-skills-hook

# 2. 部署 codex 集成
cd ~/code/agent-skills-hook/codex
./setup.sh

# 3. 链接 skills（如果使用符号链接）
# 或者复制 skills 到 ~/.claude/skills/

# 4. 复制全局配置
cp ~/code/agent-skills-hook/claude/CLAUDE.md ~/.claude/CLAUDE.md
```

## 注意事项

1. **路径适配**：
   - 全局配置使用 `~/.local/bin/codex-quiet`（通用路径）
   - 如果 codex-quiet 在其他位置，需要调整

2. **项目特定配置**：
   - 每个项目可以在自己的 CLAUDE.md 中添加特定规则
   - 项目配置会补充（而非覆盖）全局配置

3. **Skill 更新**：
   - codex-orchestrator skill 已更新为通用版本
   - 不再包含 PCL 特定的内容

## 版本信息

- 更新日期：2026-03-20
- 版本：v1.0.0（通用版本）
