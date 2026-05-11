# 图形方法示例

## 目的

这份示例展示的是：一个图文档应该怎么组织，才适合后续反复维护。

## 文件对

- `examples/26-05-03_diagram-workflow-overview.puml`
- `examples/26-05-03_diagram-workflow-overview.md`

## 文档结构

```markdown
# 图文档标题

## 1. 说明
[一句话说明这张图回答什么问题]

Source: examples/26-05-03_diagram-workflow-overview.puml

## 2. ASCII 图
[最终展示 ASCII 图；复杂图可为手工维护版本]

## 3. 备注
[必要时补少量说明或表格]
```

## 示例规则

- `.puml` 源文件要和 `.md` 展示文档放在一起，便于同步维护
- 复杂图默认手工维护 ASCII，不把 PlantUML ASCII 自动输出直接作为最终展示
- 只要 `.puml` 改了，就要回看 `.md` 中的 ASCII 图是否仍然准确
- 不要先写展示图，再倒着猜源文件
- 如果别人看不懂 ASCII，先判断是不是该改成手工 ASCII，而不是默认继续重渲染
