# Skill 编写最佳实践

> 这份文档讲的是：怎样把 Skill 写得更容易被 Claude 找到、读懂、并且真的用起来。

优秀的 Skill 应该简洁、结构清晰，而且经过真实场景验证。这份指南给出的是一套实用写法，帮助你写出更容易被发现、也更容易被执行的 Skill。

如果你想了解 Skills 的概念背景，可以参考 [Skills 概览](/en/docs/agents-and-tools/agent-skills/overview)。

## 核心原则

### 简洁最重要

`context window` 是有限资源。Skill 会和系统提示、对话历史、其他 Skill 元数据，以及用户当前请求一起竞争上下文。

不是每个 token 都立刻有成本，但只要 Claude 读取了 `SKILL.md`，里面的每个 token 都会和其它上下文抢位置。所以要尽量只写 Claude 真的需要知道的内容。

默认前提是：Claude 已经很聪明了。

只补充它还不知道、但确实需要知道的信息。写之前先问自己：

- Claude 真的需要这段解释吗？
- 能不能默认它已经知道？
- 这段话值不值得占上下文？

**好例子：简洁**

````markdown
## 提取 PDF 文本

用 `pdfplumber` 提取文本：

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
````

**坏例子：啰嗦**

```markdown
## 提取 PDF 文本

PDF（Portable Document Format）是一种常见文件格式，里面可以包含文本、图片和其他内容。要从 PDF 里提取文本，你需要使用一个库……
```

简洁版默认 Claude 知道 PDF 是什么，也知道“使用库”是什么意思。

### 设定合适的自由度

根据任务的脆弱性和变化性，决定你给 Claude 多大自由度。

**高自由度**：适合文本式指导

适用情况：

- 多种做法都可以
- 具体做法依赖上下文
- 主要靠经验判断

示例：

```markdown
## 代码审查流程

1. 分析代码结构和组织方式
2. 检查潜在 bug 和边界情况
3. 提出可读性和可维护性方面的改进建议
4. 检查是否符合项目约定
```

**中自由度**：适合伪代码或带参数的脚本

适用情况：

- 有推荐做法
- 允许少量变化
- 配置会影响行为

**低自由度**：适合具体脚本、顺序要求严格的操作

适用情况：

- 操作脆弱，容易出错
- 一致性很重要
- 必须严格按顺序执行

示例：

```markdown
## 数据库迁移

严格执行这个脚本：

```bash
python scripts/migrate.py --verify --backup
```

不要改命令，也不要额外加参数。
```

可以把 Claude 想成在路上走的机器人：

- 狭窄悬崖桥：只能走唯一安全路径，要给明确护栏
- 开阔平地：有很多成功路径，给大方向即可

### 用你计划使用的所有模型测试

Skill 是给模型加能力的，所以效果会受底层模型影响。你打算在哪些模型上使用，就要在哪些模型上测试。

测试时要考虑：

- **Claude Haiku**：指令够不够清楚？
- **Claude Sonnet**：是否清晰又高效？
- **Claude Opus**：有没有写得太啰嗦？

对 Opus 有效的写法，未必对 Haiku 也足够。跨模型使用时，尽量写成所有目标模型都能稳妥理解的版本。

## Skill 结构

<Note>
  **YAML Frontmatter** 只支持两个字段：

  - `name`：Skill 名称
  - `description`：一句话说明“什么时候用它”

  更多结构细节可以参考 [Skills 概览](/en/docs/agents-and-tools/agent-skills/overview#skill-structure)。
</Note>

### 命名约定

建议统一用**动名词形式**命名，这样一眼就能看出它在做什么。

**推荐示例：**

- `Processing PDFs`
- `Analyzing spreadsheets`
- `Managing databases`
- `Testing code`
- `Writing documentation`

**也可以接受：**

- 名词短语：`PDF Processing`、`Spreadsheet Analysis`
- 动作型：`Process PDFs`、`Analyze Spreadsheets`

**避免：**

- 过于模糊的名字：`Helper`、`Utils`、`Tools`
- 过于泛泛：`Documents`、`Data`、`Files`
- 同一套 skill 里命名风格不统一

统一命名的好处是：

- 更容易在文档和对话里引用
- 一眼能看懂用途
- 方便搜索和组织
- 看起来更专业、更一致

### 编写有效描述

`description` 决定了 skill 能不能被正确发现。它既要说清“做什么”，也要说清“什么时候用”。

<Warning>
  **必须使用第三人称。** 这个描述会被注入 system prompt，第一人称或第二人称都可能影响检索和理解。

  - **好：** “分析 Excel 文件并生成报表”
  - **不要：** “我可以帮你处理 Excel 文件”
  - **不要：** “你可以用它来处理 Excel 文件”
</Warning>

描述里要尽量包含关键字和触发场景。Claude 是靠它在一堆 skill 里做选择的，所以它必须足够具体。

**有效示例：**

```yaml
description: 提取 PDF 中的文本和表格，填写表单，合并文档。用于处理 PDF、表单或文档抽取任务。
```

```yaml
description: 分析 Excel 表格，创建数据透视表，生成图表。用于分析 Excel 文件、电子表格、表格数据或 .xlsx 文件。
```

```yaml
description: 根据 git diff 生成更准确的提交信息。用于用户需要写 commit message 或审查暂存区改动时。
```

**避免这种写法：**

```yaml
description: 帮助处理文档
```

```yaml
description: 处理数据
```

```yaml
description: 做一些文件相关的事情
```

### 渐进式披露模式

`SKILL.md` 本质上是一页总览，负责告诉 Claude 该去哪里找更详细的内容。就像新员工入职手册一样，先给导航，再按需展开。

**实践建议：**

- `SKILL.md` 主体尽量控制在 500 行以内
- 接近这个上限时，把内容拆到独立文件
- 用下面这些模式组织说明、代码和资源

#### 从简单到复杂的视觉示意

一个基础 Skill 只需要一个 `SKILL.md`：

```text
pdf/
├── SKILL.md
```

随着 Skill 变复杂，可以把更多内容拆成按需加载的文件：

```text
pdf/
├── SKILL.md
├── FORMS.md
├── reference.md
├── examples.md
└── scripts/
    ├── analyze_form.py
    ├── fill_form.py
    └── validate.py
```

#### 模式 1：总览 + 参考文件

```markdown
# PDF Processing

## 快速开始

用 `pdfplumber` 提取文本：

```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## 高级功能

**表单填写**：见 [FORMS.md](FORMS.md)
**API 参考**：见 [REFERENCE.md](REFERENCE.md)
**更多示例**：见 [EXAMPLES.md](EXAMPLES.md)
```

Claude 只会在需要时才读取那些参考文件。

#### 模式 2：按领域组织

如果一个 Skill 覆盖多个领域，就按领域拆开，避免加载无关内容。

```text
bigquery-skill/
├── SKILL.md
└── reference/
    ├── finance.md
    ├── sales.md
    ├── product.md
    └── marketing.md
```

```markdown
# BigQuery Data Analysis

## 可用数据集

**Finance**：收入、ARR、账单 -> 见 [reference/finance.md](reference/finance.md)
**Sales**：机会、漏斗、客户 -> 见 [reference/sales.md](reference/sales.md)
**Product**：API 使用、功能、采用率 -> 见 [reference/product.md](reference/product.md)
**Marketing**：活动、归因、邮件 -> 见 [reference/marketing.md](reference/marketing.md)
```

#### 模式 3：条件式细化

先给基础内容，再把高级内容链接出去。

```markdown
# DOCX Processing

## 创建文档

新文档直接用 `docx-js`。见 [DOCX-JS.md](DOCX-JS.md)。

## 编辑文档

简单编辑可以直接改 XML。

**需要保留修订痕迹**：见 [REDLINING.md](REDLINING.md)
**需要 OOXML 细节**：见 [OOXML.md](OOXML.md)
```

### 避免过深的嵌套引用

Claude 会按引用链逐层读文件。引用层级太深时，容易只读到片段，看不全上下文。

**建议：** 让所有参考文件都直接从 `SKILL.md` 链接出去，尽量保持“一层深”。

**坏例子：**

```markdown
# SKILL.md
See [advanced.md](advanced.md)...

# advanced.md
See [details.md](details.md)...

# details.md
这里才是实际内容...
```

**好例子：**

```markdown
# SKILL.md
**基础用法**：写在 `SKILL.md` 里
**高级功能**：见 [advanced.md](advanced.md)
**API 参考**：见 [reference.md](reference.md)
**示例**：见 [examples.md](examples.md)
```

### 长参考文件要加目录

如果参考文件超过 100 行，建议在顶部放一个目录，帮助 Claude 快速看到全貌。

```markdown
# API Reference

## 目录
- 认证和初始化
- 核心方法（增删改查）
- 高级功能（批处理、webhook）
- 错误处理模式
- 代码示例
```

## 工作流和反馈回路

### 复杂任务要用工作流

复杂操作要拆成清晰的顺序步骤。特别复杂的流程，最好给一个可以复制到回复里的 checklist。

**示例 1：研究归纳工作流**

```markdown
研究进度：
- [ ] 第 1 步：阅读所有源文件
- [ ] 第 2 步：提炼关键主题
- [ ] 第 3 步：交叉核对论点
- [ ] 第 4 步：形成结构化总结
- [ ] 第 5 步：核实引用
```

**第 1 步：阅读所有源文件**

先把 `sources/` 目录下的文档都看完，记下主要论点和证据。

**第 2 步：提炼关键主题**

看不同来源之间有哪些重复出现的主题，哪些地方一致，哪些地方有冲突。

**第 3 步：交叉核对论点**

每个主要论点都去源材料里核实一遍，标清楚它是由哪个来源支撑的。

**第 4 步：形成结构化总结**

按主题组织结果，包含：

- 主要论点
- 来自来源的证据
- 冲突观点（如果有）

**第 5 步：核实引用**

检查每个结论是否对应了正确的来源。如果引用不完整，就回到第 3 步。

**示例 2：PDF 表单填写工作流**

```markdown
任务进度：
- [ ] 第 1 步：分析表单（运行 `analyze_form.py`）
- [ ] 第 2 步：创建字段映射（编辑 `fields.json`）
- [ ] 第 3 步：验证映射（运行 `validate_fields.py`）
- [ ] 第 4 步：填写表单（运行 `fill_form.py`）
- [ ] 第 5 步：检查输出（运行 `verify_output.py`）
```

### 用反馈回路不断修正

复杂任务里，Claude 也会犯错。给它一个“先计划、再验证、再执行”的回路，可以更早发现问题。

适合用反馈回路的场景：

- 批量操作
- 有破坏性的修改
- 复杂验证规则
- 高风险任务

一个实用做法是先让 Claude 生成计划文件，再用脚本验证计划，确认没问题后再执行。这样做的好处是：

- 错误能更早暴露
- 验证是机器可检查的
- 计划可以反复迭代，不会直接碰原始文件
- 出错时更容易定位

### 内容审核工作流

```markdown
1. 收集内容
2. 按标准检查
3. 标记问题
4. 修正并复核
```

### 文档编辑工作流

```markdown
1. 定位要改的段落
2. 只改相关内容
3. 检查术语和链接
4. 确认没有引入新冲突
```

## 内容规范

### 避免时间敏感信息

不要把容易过期的内容写成核心规则。比如版本号、最新模型、临时政策，都会变。

如果必须写，尽量放在“当前方法”或“旧模式”这种明确标注的区域里。

### 术语保持一致

同一个概念在文档里要一直用同一个词。不要一会儿叫一种说法，一会儿又换另外一种说法。

术语一致的好处是：更容易搜索，也更容易让 Claude 建立稳定的概念映射。

## 常见模式

### 模板模式

如果很多 Skill 都会产生相似文档，就给一个固定模板。

```markdown
# [分析标题]

## 执行摘要
...

## 关键发现
...

## 建议
...
```

### 示例模式

示例要具体，最好是真实可用的。一个高质量示例，通常比很多一般示例更有价值。

### 条件工作流模式

```markdown
## 文档修改工作流

如果只是小改动，直接改正文即可。
如果涉及结构调整，先更新提纲。
如果涉及高级引用，查看 [reference.md](reference.md)。
```

## 评估与迭代

### 先做评估，再改 Skill

Skill 不要只靠感觉写。先设计评估，再用它验证内容是否真的有效。

### 迭代开发 Skill

最有效的方法，是让 Claude 自己参与 Skill 的编写和测试：

1. 先不带 Skill 完成一次真实任务，观察你自己反复补了哪些上下文
2. 抽象出可复用模式
3. 让 Claude 帮你把这些模式写成 Skill
4. 检查有没有多余解释
5. 重新组织信息结构
6. 用新 Skill 做相似任务测试
7. 根据失败点继续调整

### 观察 Claude 如何使用 Skill

迭代时要关注 Claude 的真实行为：

- 它会不会按你预期的顺序读文件
- 它会不会漏掉重要引用
- 它是不是总盯着某一部分不放
- 某些内容是不是根本没被访问

这些观察，比你的假设更重要。特别是 `name` 和 `description`，它们决定了 Skill 会不会在正确的场景里被触发。

## 反模式

### 不要用 Windows 风格路径

路径统一用 `/`，不要用 `\`。

- 好：`scripts/helper.py`
- 不好：`scripts\\helper.py`

### 不要一次给太多选择

默认给一个推荐方案，再留一个必要的例外说明就够了。不要把所有工具都摊开让 Claude 自己选。

## 高级：带可执行代码的 Skill

### 解决问题，不要甩锅

写脚本时要把错误处理做完整，不要把问题丢回给 Claude。

**好例子：**

```python
def process_file(path):
    """处理文件；如果文件不存在，就创建一个默认文件。"""
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        print(f"文件 {path} 不存在，创建默认内容")
        with open(path, "w") as f:
            f.write("")
        return ""
    except PermissionError:
        print(f"无法访问 {path}，使用默认值")
        return ""
```

**坏例子：**

```python
def process_file(path):
    return open(path).read()
```

配置参数也要写清楚原因，避免“神秘常量”。

```python
# HTTP 请求通常 30 秒内完成
REQUEST_TIMEOUT = 30

# 3 次重试在可靠性和速度之间比较平衡
MAX_RETRIES = 3
```

### 提供实用脚本

即使 Claude 能自己写脚本，预先提供工具脚本通常更可靠，也更省 token。

```markdown
**analyze_form.py**：提取 PDF 的所有表单字段

```bash
python scripts/analyze_form.py input.pdf > fields.json
```
```

把“运行脚本”和“阅读脚本”分清楚：

- `Run analyze_form.py to extract fields` -> 执行脚本
- `See analyze_form.py for the algorithm` -> 把它当参考

### 使用视觉分析

如果输入可以渲染成图片，就让 Claude 直接看图分析。

### 创建可验证的中间产物

复杂任务里，先生成一个可检查的中间文件，再验证它，最后执行，比直接改原始内容更安全。

适合场景：

- 批处理
- 破坏性修改
- 高风险操作

验证脚本最好给出明确错误信息，方便 Claude 修正。

### 依赖包

Skill 运行在代码执行环境里，不同平台的可用性不同：

- `claude.ai`：通常可以安装常见依赖包，也能拉 GitHub 仓库
- `Anthropic API`：没有网络访问，也不能在运行时随便安装包

所以，依赖要在文档里写清楚，也要确认执行环境真的支持。

### 运行环境

Skill 运行在带文件系统访问、bash 命令和代码执行能力的环境里。

这会影响你的写法：

1. 启动时会预加载所有 Skill 的元数据
2. 需要时才读取 `SKILL.md` 和其他文件
3. 脚本可以直接执行，不必把源码全塞进上下文
4. 参考文件不会立刻消耗上下文，只有真正读取才会占用 token

还要注意：

- 路径用 `/`
- 文件命名要能看出内容
- 目录最好按领域或功能划分
- 决定性操作尽量写成脚本而不是靠模型临时生成
- 执行意图要写明确：是“运行脚本”，还是“阅读脚本”

### MCP 工具引用

如果 Skill 用到 MCP 工具，要写全限定名，避免工具找不到：

```markdown
Use the BigQuery:bigquery_schema tool to retrieve table schemas.
Use the GitHub:create_issue tool to create issues.
```

### 不要假设工具一定安装好了

不要默认环境里已经有某个包。最好直接写安装方式和使用方式。

## 技术说明

### YAML frontmatter 要求

`SKILL.md` 的 frontmatter 只需要两个字段：

- `name`
- `description`

完整结构仍然以 Skills 概览为准。

### Token 预算

尽量把 `SKILL.md` 控制在 500 行以内。超过后就拆分到独立文件，并用渐进式披露来组织。

## 有效 Skill 检查清单

在发布前检查这些项目：

### 核心质量

- [ ] 描述足够具体，包含关键字
- [ ] 描述同时说明“做什么”和“什么时候用”
- [ ] `SKILL.md` 正文少于 500 行
- [ ] 额外细节放在独立文件里
- [ ] 没有过时信息，或者已明确标成旧模式
- [ ] 术语前后一致
- [ ] 示例具体，不抽象
- [ ] 文件引用保持一层深
- [ ] 渐进式披露用得合适
- [ ] 工作流有清晰步骤

### 代码和脚本

- [ ] 脚本是解决问题，不是甩给 Claude
- [ ] 错误处理明确且有帮助
- [ ] 没有“神秘常量”
- [ ] 依赖写清楚，并确认可用
- [ ] 脚本有清楚说明
- [ ] 路径不用 Windows 风格
- [ ] 关键操作有验证步骤
- [ ] 高质量任务有反馈回路

### 测试

- [ ] 至少创建 3 个评估
- [ ] 用 Haiku、Sonnet、Opus 都测过
- [ ] 用真实场景测试过
- [ ] 如果有团队反馈，已经纳入

## 下一步

<CardGroup cols={2}>
  <Card title="开始使用 Agent Skills" icon="rocket" href="/en/docs/agents-and-tools/agent-skills/quickstart">
    创建你的第一个 Skill
  </Card>

  <Card title="在 Claude Code 中使用 Skills" icon="terminal" href="/en/docs/claude-code/skills">
    在 Claude Code 里创建和管理 Skills
  </Card>

  <Card title="通过 API 使用 Skills" icon="code" href="/en/api/skills-guide">
    以程序方式上传和使用 Skills
  </Card>
</CardGroup>
