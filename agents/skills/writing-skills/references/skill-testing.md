# Skill Testing

## 概述

这是 `writing-skills` 的测试入口摘要。完整方法仍然在 [testing-skills-with-subagents.md](../testing-skills-with-subagents.md)。

## 核心思路

把 skill 测试成一个 TDD 循环：

1. 先跑没有 skill 的基线场景
2. 记录 agent 的失败和合理化说法
3. 写最小 skill 去覆盖真实失败
4. 再用压力场景验证它真的会遵守
5. 发现新漏洞就继续补

## 什么时候要用压力场景

尤其适合这些 skill：

- 规则/纪律型 skill
- 有明显合规成本的 skill
- 容易被“这次就算了”绕过的 skill
- 和速度、便利性冲突的 skill

## 好场景长什么样

- 有明确 A/B/C 选项
- 有真实时间、成本或后果
- 有真实路径或 artifact
- 会逼 agent 做出具体决定，而不是空谈原则

## 记录什么

- 选择了什么
- 原话怎么说
- 哪个压力触发了违规
- 哪些合理化需要写进规则

## 补洞顺序

1. 把具体借口逐字写进规则
2. 加红旗列表
3. 更新 description 里的触发症状
4. 重测同一组场景

## 何时回到详细文档

需要完整压力场景、合理化表和 REFACTOR 方法时，直接看：

- [testing-skills-with-subagents.md](../testing-skills-with-subagents.md)
- [persuasion-principles.md](../persuasion-principles.md)
