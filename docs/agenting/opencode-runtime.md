# OpenCode 运行时细则

本文档承接 OpenCode 入口文件之外的团队协作细则，包括路由、门禁、状态机与任务协议。

## 目标

- 保持 `opencode/AGENTS.md` 轻量，只保留运行时入口和高层行为
- 为 `orchestrator` 与各子代理提供一致的分发和收口规则
- 保留严格的证据门禁，避免主代理伪造落地或越权裁决

## 代理角色

- 主代理：
  - `orchestrator`：负责任务拆解、依赖编排、验证收口与清场
  - `triage`：疑难问题的手动升级入口，不允许自动触发
- 子代理：
  - native：`explore`
  - local：`dev`、`qa`、`review`、`debug`、`scoper`、`impact`、`security`

## 默认值

- `max_parallel_workers`: `4`
- `max_handoff_depth`: `3`
- `max_retries_per_stage`: `2`
- `triage_done_confidence_threshold`: `0.75`
- `orchestrator_self_execute_line_threshold`: `20`
- `max_state_loops`: `8`

## 路由原则

- `orchestrator` 默认 dispatch-first；只有在低风险、单文件、改动不超过 20 行、且无需跨角色验证时才可亲自执行
- 未知上下文或范围不清时先派发 `explore`
- 范围和任务包不清时派发 `scoper`
- 根因不明但需要快速排障时派发 `debug`
- 涉及回归面、依赖链或跨模块影响时派发 `impact`
- 涉及敏感路径、安全边界、输入处理或权限问题时派发 `security`
- 明确开发任务派发 `dev`
- 测试、验收或回归请求派发 `qa`
- 评审请求派发 `review`
- `triage` 只允许人工决定是否升级，禁止自动调用

## 门禁与阶段

- Gate-0（Scope Ready）
  - 执行型子代理前必须满足：
    - `task_contract.version == v1`
    - `task_contract.intent` 可解析
    - `gate0_evidence.scope_ready == true`
  - Gate-0 未通过时，仅允许回流 `scoper` 或返回 `need-info/blocked`

- Gate-1（Plan Ready）
  - 任务拆分、目标范围、验收标准、风险齐全后，才允许 opt-in 的 `plan-review`

- Gate-2（Code Review Ready）
  - 仅在 `task_contract.intent == dev-feature` 时启用严格 `code-review` 流程
  - 触发条件：
    - `dev.status == done`
    - `dev.evidence.commands` 至少 1 条，且每条含 `cmd` 与 `result_summary`
    - `qa.status == done`
    - `qa.verdict == pass`
    - `qa.evidence.checks` 至少 1 条，且每条含 `result` 与 `summary`
  - 任一缺失时，禁止触发 `code-review`

- Gate-3（QA 回流）
  - `qa.verdict == fail`：回流 `dev`，必要时追加 `debug`
  - `qa.verdict == blocked`：进入 `need-info` 或 `blocked`

## 任务意图与强制委派

- `review-only`
  - 用户请求包含 review 语义，且未明确要求 `dev-feature` 时默认推断
  - `orchestrator` 不得亲自给出实质性评审结论，必须派发 `review`
  - 最小补齐字段：
    - 被评审对象/范围
    - `review_mode`
    - 关注点
    - 风险与验收口径

- `qa-only`
  - 用户请求包含测试、验收、回归、复现等语义，且未明确要求 `dev-feature` 时默认推断
  - `orchestrator` 不得亲自给出 QA verdict，必须派发 `qa`
  - 最小补齐字段：
    - 被测对象/范围
    - 验证口径
    - 可执行验证入口

- `security`
  - 用户请求包含安全审查、敏感路径、鉴权、输入风险等语义时默认推断
  - `orchestrator` 不得亲自给出安全风险裁决，必须派发 `security`
  - 最小补齐字段：
    - 审查范围与敏感路径
    - 风险模型或关注维度
    - 证据入口

- `impact`
  - 用户请求包含影响面、回归路径、波及范围、依赖风险等语义时默认推断
  - `orchestrator` 不得亲自给出影响面裁决，必须派发 `impact`
  - 最小补齐字段：
    - 变更范围与候选影响模块
    - 回归路径
    - 影响判定口径

- `debug-only`
  - 需要明确可复现症状、日志或最小上下文
  - 可直达 `debug`

- `dev-feature`
  - 默认阶段顺序：`explore/scoper/impact/security (optional) -> dev -> qa -> review`

## 并行、重试与状态

- 最大并行子代理数为 `4`
- 同文件或强依赖任务必须串行
- 每阶段最多重试 `2` 次；超过后升级为 `need-info`、`blocked`，或建议人工触发 `triage`
- 允许状态：
  - `todo -> in_progress -> done`
- 异常状态：
  - `need-info`
  - `blocked`
  - `cancelled`

## 协议

派发输入（primary -> subagent）：

```text
task_id:
goal:
context:
constraints:
inputs:
expected_outputs:
acceptance_criteria:
risks:
deadline:

task_contract:
  version: v1
  intent: review-only | qa-only | debug-only | dev-feature | impact | security
  out_of_scope:
  target_files:

gate0_evidence:
  scope_ready: true | false
  source: scoper | orchestrator
  summary:
  refs:
```

结果输出（subagent -> primary）：

```text
task_id:
status: todo | in_progress | done | need-info | blocked | cancelled
findings:
evidence:
confidence:
next_actions:
open_questions:
```

## 约束边界

- 本文档描述 OpenCode 专属的团队编排规则，不替代仓库根 `AGENTS.md`
- 具体代理能力和工具权限以 `opencode/agents/*.md` 为准
- 若代理实现与本文件不一致，应先以代理配置和仓库当前事实为准，再回头修正文档
