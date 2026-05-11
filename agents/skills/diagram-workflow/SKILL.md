---
name: diagram-workflow
description: 用户需要统一绘制架构图、流程图、数据流图、对比图，或维护 ASCII 图与对应图源时使用。
---

# 画图方法

## 作用

这是所有图文档共用的画图方法。业务 skill 只负责说“画什么”，这里负责说“怎么画、怎么存、怎么刷新”。

如果上游来自 `implementation-architecture-workflow`，默认就是把已经写出来的实现架构文档细化成图，而不是重新讨论架构本身。

如果上游来自 `writing-plans`，默认就是把已经确认的计划相关内容画成支持执行的图，不要反过来改计划目标。

## 基本规则

- 文件名使用 `YY-MM-DD_name.puml` 和 `YY-MM-DD_name.md`
- `.puml` 是结构化源图，`.md` 是最终展示文档
- 复杂图默认使用**手写 ASCII** 作为最终展示，不把 PlantUML ASCII 自动渲染结果直接贴进文档
- `.puml` 改了之后，必须同步检查并更新 `.md` 中的 ASCII 图和相关说明，但不要求自动整张重渲染
- 在 ASCII 图附近标注图源位置，例如 `Source: diagrams/01_architecture_overview.puml`
- ASCII 是默认输出，SVG 只在确实有帮助时作为补充

## 复杂图默认策略

以下场景默认判定为复杂图，**不要**把 PlantUML `-txt/-utxt` 输出当作最终展示图：

- 项目总览图、系统边界图、模块全景图
- 一个主链带多个侧挂节点、旁路节点或跨层连接
- 多 package / 多嵌套 / 多注释 / 长标签布局
- 自动渲染后出现连线丢失、布局塌陷、语义关系看不清

这类图的标准做法是：

1. 保留 `.puml` 作为源图
2. 在 `.md` 中手工维护可读的 ASCII 图
3. 在 ASCII 图附近标注源文件路径
4. 如有必要，在图后补一小段“这张图强调什么，不强调什么”

## 图型选择

- 架构 / 边界图：看模块边界、职责分工和主要连接关系
- 接入点图：看现有代码从哪里接入
- 流程图：看主路径、关键分支和异常出口
- 前后对照图：看修改前后行为变化
- 依赖拓扑图：看模块依赖和布局关系

在架构阶段，优先把“架构规划 + 接入点 + 主流程 + 前后对比”这四类图补齐。

## 文档布局

图文档建议按这个顺序写：

1. 标题
2. 一句话说明用途
3. 图源标注，例如 `Source: diagrams/xx.puml`
4. ASCII 图，放在代码块里
5. 需要的话再补一小段说明或表格

## 参考文件

- [图型分类](references/diagram-taxonomy.md)
- [渲染规则](references/render-rules.md)
- [模板](references/diagram-templates.md)
- [示例](references/example-diagram-doc.md)
