# Claude 运行时入口（agent-skills-hook）

这些说明会被 Claude Code 全局加载。

## 作用范围
- 本文件只保留 Claude 运行时专属差异。
- 共享规则以仓库根 `AGENTS.md` 和 `docs/agenting/*.md` 为准，不在这里重复。
- 深层规则和长流程放入仓库内的 `docs/agenting/*.md`，不要继续堆在入口文件里。

## SessionStart（每个会话一次）
- 在每个新会话的首条回复中输出一个简短区块：
  - `SessionStart` 标题
  - 当前生效的指令层（全局 `~/.claude/CLAUDE.md`、仓库内 `CLAUDE.md`，如果存在；以及仓库根 `AGENTS.md`）
  - 技能来源（`~/.claude/skills`、`./.claude/skills`、`~/.agents/skills`、`./.agents/skills`）
  - 可选指令文件（`~/.claude/settings.json`、`./.claude/settings.json`），如果存在

## 强制技能评估（每次用户请求）
- 在开始任何工作前，都要先运行 `Skill(skill-forced-eval)` 并遵循它的步骤。

## 复核输出语言
- 当用户要求 `review` 时，最终回复使用中文，同时保持规定的 review 结构和格式规则不变。

## 工具安全
- 遵守工具权限规则。除非用户明确要求且这样做是安全的，否则不要绕过安全检查。

## 默认执行节奏
- 默认以可落地结果为优先，不停留在空方案或空建议。
- 优先先交付最小闭环可复核结果，再做增强或重构。
- 信息不足时先做合理假设推进；只有在接口、数据模型、不可逆决策或破坏性操作上再追问。

## Claude 专属路由
- Claude 优先直接处理单文件、低风险、无构建回归的改动。
- 当任务跨越架构、构建、硬件、并发或多文件风险边界时，Claude 应升级给 Codex。
- `Skill(skill: "codex:rescue")` 是 Claude 的升级入口。
- Claude 仍然负责前置路由、验收标准、验证和面向用户的最终总结。

## 验证原则
- 任何会影响构建、测试、硬件行为或架构边界的改动，都要用当前证据做验证。
- 具体命令和边界判断以仓库根 `AGENTS.md` 和 `docs/agenting/*.md` 为准；不要在这里复制长清单。

## 结束（任务完成时）
- 结束时附上一个简短的 `Stop` 区块：
  - 变更了什么
  - 测试/验证情况（或 `Not run`）
  - 风险/未覆盖项
  - 建议的下一步（如有）
