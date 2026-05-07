# 架构图文档示例

## 目的

这份示例展示的是：在真正开始实现前，这个 skill 需要产出什么样的文档。
图形细节、命名和渲染规则统一遵循 `diagram-workflow`。

## 文件对

- `examples/26-05-03_workflow-overview.puml`
- `examples/26-05-03_workflow-overview.md`
- 文件名示例：`26-05-03_workflow-overview.puml`、`26-05-03_workflow-overview.md`

## 文档结构

```markdown
# 功能名架构图

## 1. 架构总览
[来自 `26-05-03_workflow-overview.md` 的 ASCII 渲染结果]

## 2. 现有代码接入点
[编号接入点图]
[接入点小表]

## 3. 功能流程
[流程图]

## 4. 修改前后对照
[before 图]
[after 图]
[变化摘要表]
```

## 示例规则

- `.puml` 源文件要和 `.md` 渲染结果放在一起
- 只要 `.puml` 改了，就要重新渲染 `.md`
- 不要先写渲染结果，再倒着猜源文件
- 如果别人看不懂 ASCII，就先简化图，再重渲染
