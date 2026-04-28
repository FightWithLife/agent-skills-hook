# Codex Orchestrator - 使用指南

## 概述

Codex Orchestrator 是一个协作工作流，让 Claude 担任架构师和验收者，Codex CLI 担任代码执行者。

## 工作流程

```
用户需求
    ↓
Claude 分析 & 规划
    ↓
Codex 执行实现
    ↓
Claude 全面验收
    ↓
验收通过? ──否──→ 询问用户 ──→ 迭代修复
    ↓是
提交代码 & 完成
```

## 使用方式

### 方式 1：显式调用 Skill

```
用户: 使用 codex 实现一个新功能
Claude: [自动触发 codex-orchestrator skill]
```

### 方式 2：在任务描述中说明

```
用户: 让 codex 来实现性能优化
Claude: [识别关键词，触发 codex-orchestrator]
```

### 方式 3：手动指定

```
用户: /codex-orchestrator 实现功能 X
Claude: [执行 codex-orchestrator workflow]
```

## 触发关键词

中文：
- "使用 codex 实现"
- "让 codex 来做"
- "codex 执行"
- "用 codex 开发"

英文：
- "use codex to implement"
- "let codex do"
- "codex execute"

## 验收标准详解

### 1. 代码审查

检查项：
- ✅ 代码质量（可读性、可维护性）
- ✅ 安全漏洞（命令注入、缓冲区溢出等）
- ✅ 风格一致性（与现有代码保持一致）
- ✅ 注释完整性（根据项目规范）
- ✅ 错误处理（边界条件、异常情况）

### 2. 构建测试

```bash
# 根据项目构建系统调整
make clean && make -j$(nproc)
# 或
npm run build
# 或
cargo build
```

要求：
- ✅ 编译/构建成功，无错误
- ✅ 无新增警告（或警告已确认无害）
- ✅ 链接成功

### 3. 功能测试

```bash
# 运行相关测试用例
npm test
# 或
pytest tests/
# 或
cargo test
# 或运行项目特定的测试
```

要求：
- ✅ 测试通过
- ✅ 无崩溃或异常
- ✅ 无回归问题

### 4. 性能检查

```bash
# 性能对比（如适用）
time <command>  # 修改前
time <command>  # 修改后
```

要求：
- ✅ 性能无明显退化
- ✅ 内存使用合理
- ✅ 如有性能优化，需有可测量的提升

### 5. 架构合规性

检查项：
- ✅ 遵循项目架构指南
- ✅ 未创建并行实现
- ✅ 复用现有基础设施
- ✅ 符合项目变更约束

## 迭代处理示例

### 场景：验收失败

```
Claude: 验收失败，发现以下问题：
1. 新增函数缺少文档注释
2. 存在潜在的安全风险
3. 性能测试显示 15% 的性能退化

如何处理？
a) 让 Codex 自动修复这些问题
b) 我会提供具体的修复指导
c) 让 Claude 直接修复这些问题
d) 中止并手动审查

用户: a

Claude: [调用 Codex 修复]
```

## 最佳实践

### 1. 提供清晰的需求

❌ 不好：
```
用户: 优化一下性能
```

✅ 好：
```
用户: 使用 codex 优化 processData 函数的性能，目标是将处理速度提升 20%，
重点优化数据解析部分，可以考虑使用并行处理
```

### 2. 明确验收标准

❌ 不好：
```
用户: 实现数据压缩功能
```

✅ 好：
```
用户: 使用 codex 实现数据压缩功能，要求：
- 支持 gzip 和 zstd 格式
- 压缩率达到 50% 以上
- 处理 1MB 数据不超过 100ms
- 通过 tests/compression_*.test.js 测试
```

### 3. 分阶段实现

对于复杂任务，建议分阶段：

```
阶段 1: 使用 codex 实现基础功能
阶段 2: 使用 codex 添加错误处理和边界检查
阶段 3: 使用 codex 进行性能优化
```

## 配置选项

### Codex 静默包装器

**重要**：必须使用静默包装器调用 Codex：

```bash
~/.local/bin/codex-quiet "<任务描述>"
```

特点：
- 压制冗长的思考输出
- 只返回最终结果
- 专为 Claude-to-Codex 工作流优化

**不要使用**：
- `codex` 命令
- `codex exec` 命令
- 除非用户明确要求

### 任务描述格式

```bash
~/.local/bin/codex-quiet "
实现需求：[具体描述]

工作目录：[项目根目录]

要修改的文件：
- src/xxx.js
- include/xxx.h

架构约束：
- 遵循项目架构指南
- 复用现有模块边界

代码规范：
- 遵循项目代码风格
- 添加必要的注释

验收标准：
- 构建通过，无警告
- 测试通过
"
```

## 与其他 Skills 的配合

### 与 writing-plans 配合

```
用户: 先规划一下如何实现功能 X
Claude: [使用 writing-plans skill 创建详细计划]
用户: 好的，使用 codex 按照这个计划实现
Claude: [使用 codex-orchestrator 执行计划]
```

### 与 git-master 配合

```
Claude: 验收全部通过！
[自动调用 git-master skill 提交代码]
```

### 与 systematic-debugging 配合

```
用户: 测试失败了，帮我调试一下
Claude: [使用 systematic-debugging skill 定位问题]
Claude: 问题定位到 xxx.js:234，使用 codex 修复
[使用 codex-orchestrator 修复]
```

## 故障排查

### 问题 1：Codex 执行失败

```
错误: codex exec failed with exit code 1
```

解决：
1. 检查 codex 是否正确安装：`which codex`
2. 检查 codex-quiet 是否存在：`which codex-quiet`
3. 查看详细错误日志

### 问题 2：验收一直失败

如果迭代 3 次仍未通过验收：
1. Claude 会上报详细的失败原因
2. 建议切换到手动模式（选项 c 或 d）
3. 或者调整验收标准

### 问题 3：Codex 理解错误

如果 Codex 实现的功能不符合预期：
1. 检查传递给 Codex 的 prompt 是否足够详细
2. 增加架构上下文和示例代码
3. 明确指定要修改的文件和函数

## 限制与注意事项

1. **不适用场景**：
   - 简单修改（<50行）：Claude 直接执行更快
   - 探索性任务：使用 Explore agent 更合适
   - 纯研究任务：不需要 Codex

2. **性能考虑**：
   - Codex 执行需要时间，不适合快速迭代
   - 验收过程较长，适合中大型任务

3. **成本考虑**：
   - Codex 调用有 API 成本
   - 多次迭代会增加成本

## 安装与配置

### 1. 安装 codex-quiet 包装器

```bash
# 如果你使用 agent-skills-hook 仓库
cd ~/code/agent-skills-hook/codex
./setup.sh
```

### 2. 手动安装

```bash
# 复制脚本
cp codex/bin/codex-quiet ~/.local/bin/
chmod +x ~/.local/bin/codex-quiet

# 配置 codex profile
# 在 ~/.codex/config.toml 中添加：
[profiles.claude_quiet]
approval_policy = "never"
sandbox_mode = "danger-full-access"
model = "gpt-5.4"
model_reasoning_summary = "none"
model_verbosity = "low"
hide_agent_reasoning = true
```

### 3. 验证安装

```bash
which codex-quiet
# 应该输出: /home/<user>/.local/bin/codex-quiet

codex --version
# 应该显示 codex 版本信息
```

## 反馈与改进

如果你发现工作流有问题或有改进建议：
1. 修改 `~/.claude/skills/codex-orchestrator/skill.yaml`
2. 更新项目的 CLAUDE.md 中的配置
3. 测试并验证改进效果
