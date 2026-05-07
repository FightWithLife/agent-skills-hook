---
name: diagram-workflow
description: 用户需要统一绘制架构图、流程图、数据流图、对比图，或把图源渲染成 ASCII 文档时使用。
---

# 画图方法

## 作用

这是所有图文档共用的画图方法。业务 skill 只负责说“画什么”，这里负责说“怎么画、怎么存、怎么刷新”。

如果上游来自 `implementation-architecture-workflow`，默认就是把已经写出来的实现架构文档细化成图，而不是重新讨论架构本身。

如果上游来自 `writing-plans`，默认就是把已经确认的计划相关内容画成支持执行的图，不要反过来改计划目标。

## 基本规则

- 文件名使用 `YY-MM-DD_name.puml` 和 `YY-MM-DD_name.md`
- `.puml` 是源文件，`.md` 是渲染结果
- 只要 `.puml` 变了，就必须从源文件重新整张渲染 `.md`
- 不要手改 ASCII 的局部字符去修对齐
- ASCII 是默认输出，SVG 只在确实有帮助时作为补充

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
3. ASCII 图，放在代码块里
4. 需要的话再补一小段说明或表格

## 参考文件

- [图型分类](references/diagram-taxonomy.md)
- [渲染规则](references/render-rules.md)
- [模板](references/diagram-templates.md)
- [示例](references/example-diagram-doc.md)
