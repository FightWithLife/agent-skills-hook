---
name: writing-skills
description: 在创建、编辑或验证 skills，或重构 SKILL.md、参考文件和测试流程时使用
---

# 编写 Skills

## 概述

`writing-skills` 把 skill 创建、skill 编辑和 skill 测试收成一个工作流。目标是让 skill 更容易被发现、阅读、验证和长期维护。

当前仓库的默认示例优先围绕嵌入式 C / 纯 C，Rust 和 HTML 作为常见次级场景；TS / web 只保留必要对照，不作为默认重心。

## 适用场景

- 你要把一个重复技巧整理成 skill
- 你要修改现有 skill
- 你要验证 skill 是否真的能在压力下工作
- 你要把过大的 skill 拆薄

## 基本原则

- `SKILL.md` 只放入口、判断和导航
- 长流程、长示例、长表格都下沉到 `references/`
- `description` 只写触发条件，不写工作流
- 先写可复用内容，再写文档
- 先测失败，再写 skill，再回归验证

## 结构决策

### 放在 `SKILL.md`

- 何时使用
- 一个核心工作流
- 到哪儿找更详细的内容

### 放到 `references/`

- 创建/初始化流程
- 测试/压力场景
- 长示例、清单、表格
- 与当前任务无关但未来会复用的知识

### 放到 `scripts/`

- 需要确定性执行的检查、转换、验证

### 放到 `assets/`

- 模板、图示、输出资源

## 创建和更新

- 先从具体例子出发，确认触发词、失败模式、成功标准
- 需要复用的内容先做成 reference 或脚本
- 新 skill 只保留一个清晰职责
- 命名用 `lowercase-hyphen-case`
- frontmatter 只保留 `name` 和 `description`
- `description` 用第三人称，只写“何时用”
- 不要把流程总结写进 `description`
- 复杂内容参考 [skill-creation.md](references/skill-creation.md)

## 测试和验证

- 先跑没有 skill 的基线场景，再写最小 skill
- 纪律型 skill 用 3 个以上压力叠加的场景
- 记录 agent 的原话合理化，不只记结论
- 发现新漏洞就补规则，再复测
- 复杂测试参考 [skill-testing.md](references/skill-testing.md)
- 详细方法参考 [testing-skills-with-subagents.md](testing-skills-with-subagents.md)

## 写作和压缩

- 先看 [anthropic-best-practices.md](anthropic-best-practices.md)
- 只保留必要上下文
- 示例越少越好，但要足够具体
- 如果文件开始重复，就把重复内容下沉

## 快速判断

- 要新建或重写 skill：看 [skill-creation.md](references/skill-creation.md)
- 要设计压力测试：看 [skill-testing.md](references/skill-testing.md)
- 要写得更简洁：看 [anthropic-best-practices.md](anthropic-best-practices.md)
- 要补防合理化：看 [persuasion-principles.md](persuasion-principles.md)
- 要看完整测试方法：看 [testing-skills-with-subagents.md](testing-skills-with-subagents.md)
