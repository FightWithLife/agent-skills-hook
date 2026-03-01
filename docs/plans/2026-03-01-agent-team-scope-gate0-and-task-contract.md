# Agent Team Gate-0（合同就绪）与 task_contract v1 落地计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在编排与子代理规范中新增 Gate-0（合同就绪门禁）与统一 `task_contract`，并为 `dev/qa/review/debug/impact/security` 增加执行前置断言与自拒绝规则；同时明确 Gate-0 通过后支持“全能编排/自由分流”，且仅当 orchestrator 启动 `dev feature`（`task_contract.intent == dev-feature`）时强制进入 `dev -> qa -> review` 回归链条。

**Architecture:** 先在全局编排规则（`opencode/AGENTS.md`）定义 Gate-0 与 `task_contract v1`（含 `intent`），再在 `orchestrator` 明确“意图驱动分流 + 前置校验”的路由规则，最后在各执行型子代理添加 precondition（缺失即 `need-info/blocked`），形成“编排入口 + 执行入口”双层防线。保持 Gate-2 code-review 既有门禁不变，仅补前置并强化“`dev-feature` 场景的回归链条”。

**Tech Stack:** Markdown 文档规范、OpenCode agent 协议（`task_id/goal/context/...`）、YAML schema 片段。

---

## 1) Goals

1. 强制引入 **Gate-0: Scope Ready**，在进入任意执行型子代理（`dev/qa/review/debug/impact/security`）之前确保任务包完整且由 `scoper` 先行或等价完成。
2. 定义可复制复用的 **`task_contract v1` schema**，作为 primary->subagent 统一输入契约。
3. 在 `dev/qa/impact/security/debug` 中加入 **precondition 自拒绝**：合同字段缺失或未满足 Gate-0 证据时不得执行。
4. 明确 Gate-0 是“合同就绪门禁”而非“固定开发流水线门禁”：Gate-0 通过后 orchestrator 可按用户意图自由分流。
5. 与现有 Gate-2（code-review）兼容，不改变其通过条件与顺序；仅当 `task_contract.intent == dev-feature`（即 orchestrator 启动 dev 开发实现任务）时强制进入 `dev -> qa -> review` 回归链条。

## 2) Non-goals

1. 不调整 `review` 的 Gate-2 严格门禁语义。
2. 不引入新子代理或新状态机状态。
3. 不在本次计划中实现自动 policy-lint（仅列为 Optional）。
4. 不改动业务代码，仅改 agent 规范文档。

## 3) 现状证据（问题与正例）

### 3.1 顺序仅描述性（缺 Gate-0）
- `opencode/AGENTS.md:54-59`
  - 仅定义 `explore/scoper/impact/security (optional) -> dev -> qa -> review`，但未要求 “未完成 scope 不得进入实现”。
- `opencode/agents/orchestrator.md:31-55`
  - 已有 phase_order 与 route hints，但缺少“task_contract 不完整时必须拦截并回流 scoper”的硬断言。

### 3.2 Gate-2 正例（可参考）
- `opencode/agents/review.md:30-33`
  - 对 code-review 前置条件缺失时返回 `blocked` 的规则明确，是本次 Gate-0 设计的风格参考。

### 3.3 子代理缺少实现前置约束（问题证据）
- `opencode/agents/dev.md:13-30`
- `opencode/agents/qa.md:13-32`
- `opencode/agents/debug.md:13-22`
- `opencode/agents/impact.md:16-33`
- `opencode/agents/security.md:16-33`

以上文件均有职责/证据要求，但未定义“输入合同缺失时必须拒绝执行”的统一 precondition。

## 4) 设计

### 4.1 Gate-0 定义（新增）

**定位声明（新增）：**
- Gate-0 是“任务合同完整性”门禁，不是“必须先 dev 再 qa 再 review”的固定流程门禁。
- Gate-0 通过后，orchestrator 可基于用户意图自由分流到 `dev/qa/review/debug/impact/security` 任一执行型子代理。
- 仅当任务意图为 `dev-feature`（由 orchestrator 启动 dev 开发实现任务）时，才触发强制回归链条（见 4.5）。

**Gate-0（Scope Ready）判定条件：**
1. `task_contract.version == v1`。
2. 合同必填字段完整（见 4.2）。
3. `acceptance_criteria` 至少 1 条、可验证。
4. `target_files` 非空（允许“待创建”标记）。
5. `risks` 与 `out_of_scope` 非空（可写 `none`，但必须显式声明）。
6. 至少满足其一：
   - `scoper.status == done` 且有 scope 结论证据；
   - orchestrator 明确提供“等价 scope 证据”（例如已列明边界/文件/验收）。

**Gate-0 失败行为：**
- orchestrator 不得分发到任意执行型子代理（`dev/qa/review/debug/impact/security`）；必须回流 `scoper` 或返回 `need-info`。
- 子代理在执行入口发现缺失时，必须 `need-info`（信息缺失）或 `blocked`（前置不满足）。

### 4.2 `task_contract v1`（可直接复制）

```yaml
task_contract:
  version: v1
  intent: review-only | qa-only | debug-only | dev-feature | impact | security
  task_id: string
  goal: string
  context: string
  constraints:
    - string
  inputs:
    - string
  expected_outputs:
    - string
  acceptance_criteria:
    - string
  risks:
    - string
  out_of_scope:
    - string
  target_files:
    - path: string
      intent: create | modify | delete
  dependencies:
    - string
  deadline: string | none

gate0_evidence:
  scope_ready: true | false
  source: scoper | orchestrator
  summary: string
  refs:
    - string  # file:line-range 或任务证据 ID
```

### 4.3 子代理 precondition 规范（模板）

```yaml
preconditions:
  - task_contract.version == v1
  - required fields present
  - gate0_evidence.scope_ready == true
on_precondition_fail:
  status: need-info | blocked
  findings: "missing/invalid preconditions"
  open_questions:
    - "明确缺失字段或 Gate-0 证据"
```

> 说明：`need-info` 用于可补齐信息；`blocked` 用于前置策略禁止继续。

### 4.4 分流规则 / 路由矩阵（新增）

> 目标：Gate-0 通过后支持“全能编排/自由分流”，但每类路径有明确前置条件。

| 用户意图（`task_contract.intent`） | 首选 agent | 前置条件（preconditions） | 输出要求 |
|---|---|---|---|
| review-only（仅评审，无新增实现） | `review` | Gate-0 通过；提供被评审对象（commit/diff/文件范围）与评审口径 | `review` 结构化结论；若触发 code-review 仍需满足 Gate-2 |
| qa-only（仅测试/回归/复现） | `qa` | Gate-0 通过；明确被测对象、测试范围、判定口径（通过/失败标准） | `qa.verdict` + `evidence.checks` |
| debug-only（仅定位问题，未授权改码） | `debug` | Gate-0 通过；有可复现症状/日志/最小上下文 | 定位结论、根因假设、建议下一步；默认不改码 |
| dev-feature（需求实现/代码改动） | `dev` | Gate-0 通过；目标文件、验收标准、风险边界明确 | 代码变更 + `dev.evidence.commands`，并触发 4.5 回归链条 |

补充：当用户直接指向 `impact/security` 时，同样属于执行型分流，前置条件至少包含 Gate-0 与该任务所需最小上下文。

补充（debug-only 例外）：若用户**明确授权** debug 做插桩/诊断性改动，允许最小可回滚改动（如开关控制或临时 patch），需附复现证据与撤销说明；该路径不默认升级为完整 `dev -> qa -> review` 链条，除非 orchestrator 将任务意图切换为 `dev-feature`。

### 4.5 `dev-feature` 触发的强制回归链条（新增）

**触发条件：**
- `task_contract.intent == dev-feature`（即 orchestrator 启动 dev 开发实现任务）。
- 非 `dev-feature` 路径（如 debug-only）即使发生诊断性改动，也按“最小验证 + 可回滚”处理，不强制进入完整回归链条。

**强制链条：**
1. `dev` 提供变更证据：`evidence.commands` 至少 1 条验证命令及结果摘要。
2. `qa` 执行“变更验证 QA”，输出 `status == done`、`verdict == pass`，并附 `evidence.checks`。
3. `review` 执行 code-review，严格沿用 Gate-2：
   - `dev.status == done`
   - `dev.evidence.commands` 完整
   - `qa.status == done && qa.verdict == pass`
   - `qa.evidence.checks` 完整

**结论：**
- Gate-0 允许“先 review / 先 qa / 先 debug / 先 dev”的自由启动。
- 但仅当 intent 为 `dev-feature` 时，必须执行 `dev -> qa -> review` 的放行顺序，不得跳过 Gate-2。

## 5) 任务拆解（实施任务）

### Task 1: 更新全局规则，新增 Gate-0 与 task_contract 入口
**Files:**
- Modify: `opencode/AGENTS.md`

**Acceptance:**
- Completion Gates 增加 Gate-0（不与 Gate-2 冲突）。
- Task Protocol 增补 `task_contract v1` 与 `gate0_evidence` 最小字段。

### Task 2: 更新 orchestrator，硬化 Gate-0 分发拦截
**Files:**
- Modify: `opencode/agents/orchestrator.md`

**Acceptance:**
- phase gating 增加 Gate-0 检查。
- 明确：Gate-0 未满足时禁止派发任意执行型子代理（`dev/qa/review/debug/impact/security`），回流 `scoper` 或 `need-info`。
- 明确：Gate-0 满足后允许按 intent 自由分流（不强制固定开发流水线）。

### Task 3: 更新 scoper，产出标准化 scope_ready 证据
**Files:**
- Modify: `opencode/agents/scoper.md`

**Acceptance:**
- scoper 输出模板含 `task_contract` 补全建议与 `gate0_evidence`。
- 缺关键信息时返回 `need-info` 并列缺失项。

### Task 4: 更新 dev，加入 precondition 自拒绝
**Files:**
- Modify: `opencode/agents/dev.md`

**Acceptance:**
- 明确执行前校验 `task_contract + gate0_evidence`。
- 缺失时不得编码，返回 `need-info/blocked`，并保留 `evidence.commands` 规范。

### Task 5: 更新 qa，加入 precondition 自拒绝
**Files:**
- Modify: `opencode/agents/qa.md`

**Acceptance:**
- Gate-0 缺失时不执行测试并返回 `blocked/need-info`。
- 明确 QA 双模式并与现有 `verdict` 结构兼容：
  1. 通用 QA（仅测试/回归/复现验证）：不强依赖 `dev.status==done`，但必须有被测对象与判定口径。
  2. 变更验证 QA（针对 `dev-feature` 代码变更）：必须 `dev.status==done` 且具备 `dev evidence`。

### Task 6: 更新 impact/security，加入 precondition 自拒绝
**Files:**
- Modify: `opencode/agents/impact.md`
- Modify: `opencode/agents/security.md`

**Acceptance:**
- 两者均声明最小输入合同要求。
- 缺失时输出结构化缺口（`open_questions` + `next_actions`）。

### Task 7: 更新 debug，加入 precondition 自拒绝与回流建议
**Files:**
- Modify: `opencode/agents/debug.md`

**Acceptance:**
- 若任务边界不清或 Gate-0 缺失，不得盲修。
- 返回 `need-info/blocked` 并建议回流 `scoper` 或 orchestrator 补合同。

### Task 8（Optional）: 新增 policy-lint（静态校验）
**Files:**
- Create: `scripts/policy-lint.*`（语言待定）
- Modify: `README` 或 `opencode/AGENTS.md`（接入说明）

**Acceptance:**
- 可自动检查 agent 文档是否包含 `preconditions` 与 `on_precondition_fail`。
- 仅作为增强，不阻断本轮 MVP 落地。

## 6) 总体验收标准（Definition of Done）

1. Gate-0 在全局规则与 orchestrator 中均有硬约束描述。
2. 明确 Gate-0 属于“合同就绪门禁”，Gate-0 通过后可按 intent 自由分流到执行型子代理。
2. `task_contract v1` schema 落地且可复制。
3. 文档包含至少覆盖 `review-only / qa-only / debug-only / dev feature` 的路由矩阵与 preconditions。
4. `dev/qa/impact/security/debug/scoper` 全部声明 precondition 与失败返回策略。
5. 文档不改变 Gate-2 语义：`dev done + qa pass + 双证据` 仍为 code-review 唯一入口。
6. 文档明确“仅当 `task_contract.intent == dev-feature` 时，强制进入 dev -> qa -> review 回归链条；debug-only 诊断性改动走最小验证与可回滚策略”。
7. 至少提供 1 条样例任务包（含 `task_contract + gate0_evidence`）用于人工验收。

## 7) 风险与应对

1. **规则过严导致吞吐下降**：通过 `need-info` 模板化缺失项，减少往返成本。
2. **与既有 Gate-2 语义冲突**：显式声明 Gate-0 仅是前置完整性门禁，不替代 Gate-2。
3. **子代理执行风格不一致**：统一 `on_precondition_fail` 模板与状态机。

## 8) Rollout / Rollback

### Rollout（渐进）
1. 先改 `AGENTS.md` + `orchestrator.md`（编排入口）。
2. 再改 `scoper`（补齐 scope 证据出口）。
3. 最后改 `dev/qa/impact/security/debug`（执行入口）。
4. 观察 1~2 个迭代周期内 `need-info/blocked` 比例与返工率。

### Rollback（回退）
1. 如出现大面积阻塞，先临时降级为“告警不阻断”（仅 orchestrator 提示缺失）。
2. 保留 `task_contract` 字段定义，不回退 schema，仅放宽 Gate-0 强制性。
3. 待补充 scoper 自动化能力后再恢复强制。

## 9) 附：最小派发样例

```text
task_id: example-gate0
goal: 新增 X 能力
context: ...
constraints:
  - ...
inputs:
  - ...
expected_outputs:
  - ...
acceptance_criteria:
  - ...
risks:
  - ...
deadline: none

task_contract:
  version: v1
  ...

gate0_evidence:
  scope_ready: true
  source: scoper
  summary: 已确认边界/目标文件/验收条件
  refs:
    - opencode/agents/scoper.md:1-120
```
