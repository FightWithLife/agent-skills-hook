# Claude Agents 路由与门禁速查（精简版）

适用角色：`orchestrator / builder / validator / risk / triage`

## 1) 默认主流程

```text
orchestrator -> builder -> validator -> orchestrator决策
```

- 默认不走 `risk`、`triage`
- `orchestrator` 默认委派，不直接改代码

---

## 2) 角色触发条件（什么时候派谁）

| 场景 | 路由 | 说明 |
|---|---|---|
| 常规功能开发 / 修复 | `builder` | 最小改动 + 产出验证证据 |
| 功能验证 / 回归验证 / 代码评审 | `validator` | 输出 `verdict` 与检查证据 |
| 涉及鉴权、外部输入、敏感数据、跨模块改动 | `risk` | 输出风险等级、影响范围、缓解建议 |
| 连续排查失败、证据冲突、根因不明 | `triage`（manual-only） | 人工升级，禁止自动触发 |

---

## 3) 门禁（Gates）

## Gate A：实现完成（Builder Done）
必须具备：
- `changed_files`
- `evidence.commands[]`（至少一条，含 `cmd` + `result_summary`）

## Gate B：验证完成（Validator Done）
必须具备：
- `verdict: pass | fail | blocked`
- `evidence.checks[]`（至少一条，含 `name/result/summary`）

## Gate C：风险复核（条件触发）
当命中风险条件时，必须具备：
- `risk_level`
- `impact_scope`
- `mitigations`
- `release_blockers`（若有）

---

## 4) 决策规则（Orchestrator）

- 仅 `Gate A + Gate B` 满足时，才可给出“可完成/可合并”结论
- 若命中风险条件，需额外满足 `Gate C`
- 任一关键证据缺失：返回 `need-info` 或 `blocked`

---

## 5) 状态语义（统一）

- `done`：证据齐全，可进入下一门禁或结束
- `need-info`：信息缺失，可补齐后继续
- `blocked`：当前无法推进，需外部解除阻塞

---

## 6) 反模式（避免）

- `orchestrator` 直接替代 `validator/risk` 给结论
- 没有证据就宣称“完成”
- 未触发条件却常驻调用 `risk/triage`
- 将纯工具型小任务全部代理化（徒增复杂度）
