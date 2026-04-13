# Claude Agents 调度模板（可直接复制）

适用角色：`orchestrator / builder / validator / risk / triage`

> 约定：所有子代理返回统一字段，便于门禁判断与自动汇总。

---

## 1) 通用派发输入模板（orchestrator -> subagent）

```yaml
task_id: "T-20260302-001"
intent: "build | validate | risk | triage"
goal: "一句话目标"
context:
  repo: "agent-skills-hook"
  branch: "main"
  background: "必要背景"
constraints:
  - "最小改动"
  - "不得改动范围外文件"
inputs:
  target_files:
    - "path/to/fileA"
    - "path/to/fileB"
  references:
    - "相关 issue/commit/日志"
expected_outputs:
  - "结构化结果"
  - "可复核证据"
acceptance_criteria:
  - "通过标准1"
  - "通过标准2"
risks:
  - "已知风险或假设"
deadline: "optional"
```

---

## 2) Builder 派发模板

```yaml
task_id: "T-20260302-002"
intent: "build"
goal: "完成功能/修复并给出验证证据"
inputs:
  target_files: ["src/a.ts", "src/b.ts"]
  change_scope: "仅修复 X，不做重构"
  required_checks:
    - "npm test -- a.spec.ts"
    - "npm run lint"
acceptance_criteria:
  - "行为符合需求"
  - "关键测试通过"
```

### Builder 返回模板

```yaml
task_id: "T-20260302-002"
status: "done | need-info | blocked"
changed_files:
  - "src/a.ts"
  - "src/b.ts"
evidence:
  commands:
    - cmd: "npm test -- a.spec.ts"
      result_summary: "pass, 12 passed"
    - cmd: "npm run lint"
      result_summary: "pass"
findings:
  - "关键实现说明"
known_risks:
  - "边界条件Y未覆盖"
next_actions:
  - "建议交给 validator 回归验证"
open_questions: []
confidence: 0.86
```

---

## 3) Validator 派发模板

```yaml
task_id: "T-20260302-003"
intent: "validate"
goal: "验证功能与代码质量并给出 verdict"
inputs:
  target_files: ["src/a.ts", "src/b.ts"]
  test_plan:
    - "单测"
    - "回归路径"
  review_focus:
    - "correctness"
    - "maintainability"
    - "regression"
acceptance_criteria:
  - "verdict 可执行"
  - "失败项可复现"
```

### Validator 返回模板

```yaml
task_id: "T-20260302-003"
status: "done | need-info | blocked"
verdict: "pass | fail | blocked"
evidence:
  checks:
    - name: "unit-tests"
      result: "pass"
      summary: "关键路径测试通过"
    - name: "regression-path-A"
      result: "fail"
      summary: "步骤3出现空指针"
findings:
  critical: []
  major:
    - "异常处理缺失"
  minor:
    - "命名可读性一般"
next_actions:
  - "回流 builder 修复 major 问题"
open_questions: []
confidence: 0.81
```

---

## 4) Risk 派发模板（条件触发）

```yaml
task_id: "T-20260302-004"
intent: "risk"
goal: "评估安全与影响面风险"
inputs:
  target_files: ["src/auth.ts", "src/api/input.ts"]
  sensitive_paths:
    - "auth"
    - "input-validation"
  dependency_boundary:
    - "module-A -> module-B"
acceptance_criteria:
  - "输出风险等级与缓解动作"
  - "明确是否 release blocker"
```

### Risk 返回模板

```yaml
task_id: "T-20260302-004"
status: "done | need-info | blocked"
risk_level: "low | medium | high"
impact_scope:
  - "login flow"
  - "token refresh"
evidence_refs:
  - "src/auth.ts:120"
  - "src/api/input.ts:45"
mitigations:
  - "补充输入长度校验"
  - "增加权限边界测试"
release_blockers:
  - "高风险注入点未修复"
next_actions:
  - "阻断发布，回流 builder"
open_questions: []
confidence: 0.79
```

---

## 5) Triage 派发模板（manual-only）

```yaml
task_id: "T-20260302-005"
intent: "triage"
goal: "高不确定问题的深度诊断"
inputs:
  symptom: "线上偶现 500"
  repro_attempts:
    - "尝试A失败"
    - "尝试B结果冲突"
  logs:
    - "关键日志片段"
acceptance_criteria:
  - "给出可执行下一步"
  - "若无法收敛，明确缺失信息"
```

### Triage 返回模板

```yaml
task_id: "T-20260302-005"
status: "done | need-info | blocked"
hypothesis_loop:
  - hypothesis: "连接池耗尽"
    test: "压测 + 池监控"
    verdict: "部分成立"
    confidence: 0.62
  - hypothesis: "缓存穿透导致抖动"
    test: "关闭缓存对照"
    verdict: "不成立"
    confidence: 0.35
findings:
  - "更可能是连接池参数配置问题"
next_actions:
  - "调整池参数并回归"
open_questions:
  - "缺少生产峰值时段指标"
confidence: 0.72
```

---

## 6) Orchestrator 汇总决策模板

```yaml
task_id: "T-20260302-001"
final_status: "done | need-info | blocked"
gate_summary:
  gate_build: "pass | fail"
  gate_validate: "pass | fail"
  gate_risk: "pass | fail | n/a"
final_decision: "ready_to_merge | rework_required | blocked"
rationale:
  - "基于 builder/validator/risk 的证据"
required_actions:
  - "若 fail，明确回流给谁以及修什么"
```

---

## 7) 最小落地规则（建议）

1. 无证据不通过：缺 `commands/checks` 直接 `need-info`。
2. `triage` 不自动：只能人工升级触发。
3. 风险条件命中必须跑 `risk`：否则不给“可合并”结论。
4. 子代理只做本职输出：最终裁决只由 `orchestrator` 给。
