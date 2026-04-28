# Codex Orchestrator - 快速参考

## 🚀 快速开始

### 触发方式

```bash
# 方式 1: 自然语言触发
"使用 codex 实现图像压缩功能"
"让 codex 来优化这个函数"

# 方式 2: 显式调用
/codex-orchestrator 实现 JPEG 解码加速
```

## 📋 工作流程

```
用户需求 → Claude 规划 → Codex 执行 → Claude 验收 → 通过/迭代 → 提交
```

## ✅ 验收清单

- [ ] 代码审查（质量、安全、风格、注释）
- [ ] 构建测试（编译通过、无新增警告）
- [ ] 功能测试（.prn 测试通过、无回归）
- [ ] 性能检查（无明显退化）
- [ ] 架构合规（遵循模块边界、无并行实现）

## 🎯 适用场景

| 任务类型 | 代码行数 | 推荐方式 |
|---------|---------|---------|
| 简单修改 | <50行 | Claude 直接执行 |
| 中等功能 | 50-200行 | codex-orchestrator |
| 复杂重构 | >200行 | plan mode + codex-orchestrator |

## 🔧 Codex 命令模板

```bash
/home/xmg/.local/bin/codex-quiet "
实现需求：[具体描述]

要修改的文件：
- PCL6/src/xxx.c
- PCL6/include/xxx.h

架构约束：
- 遵循 PCL6/docs/architecture_zh/ 中的架构指南
- 复用现有模块边界
- 不创建并行实现

代码规范：
- 新增函数必须有 Doxygen 格式的中文注释
- 函数内代码改动添加必要的中文注释
- 保持与现有代码风格一致

验收标准：
- 编译通过，无新增警告
- 通过 test_cases/xxx.prn 测试
- 性能不退化
"
```

## 🔄 迭代处理

验收失败时的选项：
- **a)** Codex 自动修复
- **b)** 用户提供修复指导
- **c)** Claude 直接修复
- **d)** 中止并手动审查

最多迭代 3 次，超过则上报用户。

## 📁 配置文件位置

```
~/.claude/skills/codex-orchestrator/
├── skill.yaml          # Skill 配置
├── README.md           # 详细使用指南
├── verify.sh           # 配置验证脚本
└── QUICK_REF.md        # 本文件

/home/xmg/code/PCL/CLAUDE.md  # 项目配置（第 6 节）
```

## 🐛 故障排查

### Codex 执行失败
```bash
# 检查 codex 是否安装
which codex
codex --version

# 检查工作目录
ls -la /home/xmg/code/PCL/PCL6
```

### 验收一直失败
- 检查 prompt 是否足够详细
- 增加架构上下文和示例代码
- 考虑切换到手动模式

### Skill 未触发
```bash
# 验证配置
~/.claude/skills/codex-orchestrator/verify.sh

# 检查 CLAUDE.md
grep "Codex 协作模式" /home/xmg/code/PCL/CLAUDE.md
```

## 💡 最佳实践

1. **提供清晰的需求**
   - ❌ "优化一下性能"
   - ✅ "优化 ReadImage 函数，目标提升 20%，重点优化 JPEG 解码"

2. **明确验收标准**
   - 指定要通过的测试用例
   - 定义性能指标
   - 说明架构约束

3. **分阶段实现**
   - 复杂任务拆分为多个阶段
   - 每个阶段独立验收
   - 逐步迭代优化

## 🔗 相关 Skills

- `writing-plans`: 先规划再执行
- `git-master`: 自动提交代码
- `systematic-debugging`: 调试问题
- `requesting-code-review`: 代码审查

## 📞 获取帮助

```bash
# 查看详细文档
cat ~/.claude/skills/codex-orchestrator/README.md

# 运行验证脚本
~/.claude/skills/codex-orchestrator/verify.sh

# 查看项目配置
cat /home/xmg/code/PCL/CLAUDE.md
```

---

**版本**: 1.0.0
**最后更新**: 2026-03-20
