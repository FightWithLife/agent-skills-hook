# Claude 全局指令（agent-skills-hook）

这些说明会被 Claude Code 全局加载。

## SessionStart（每个会话一次）
- 在每个新会话的首条回复中输出一个简短区块：
  - `SessionStart` 标题
  - 当前生效的指令层（全局 `~/.claude/CLAUDE.md`、仓库内 `CLAUDE.md`，如果存在；只有在当前工作区实际使用了 `AGENTS.md` 时才包含它）
  - 技能来源（`~/.claude/skills`、`./.claude/skills`、`~/.agents/skills`、`./.agents/skills`）
  - 可选指令文件（`~/.claude/settings.json`、`./.claude/settings.json`），如果存在

## 强制技能评估（每次用户请求）
- 在开始任何工作前，都要先运行 `Skill(skill-forced-eval)` 并遵循它的步骤。

## 复核输出语言
- 当用户要求 `review` 时，最终回复使用中文，同时保持规定的 review 结构和格式规则不变。

## 工具安全
- 遵守工具权限规则。除非用户明确要求且这样做是安全的，否则不要绕过安全检查。

## Codex 集成（基于插件）

使用 Codex 插件技能进行委派：
- `Skill(skill: "codex:rescue")` - 将调查、修复请求或救援工作委派给 Codex
- 插件会自动处理运行时管理、认证和结果格式化
- 将 Codex 作为嵌入式开发的升级路径，而不是每个中等任务的默认执行者

## Codex 协作模式（嵌入式 C，轻量优先）

处理开发请求时，Claude 是前端控制器：
- Claude 应直接解决小型、低风险任务
- 当任务跨越架构、构建、硬件、并发或多文件风险边界时，Claude 应升级给 Codex
- Claude 仍然负责路由、验收标准、验证以及面向用户的最终总结

### 何时升级给 Codex

当出现以下一种或多种情况时，使用 `Skill(skill: "codex:rescue")` 升级：
- 预计会改动多个源文件/头文件/构建文件
- 预期需要构建、测试或调试循环
- 任务包含 `Make`/`CMake` 或链接器行为
- 涉及中断、共享状态或 `volatile` 语义
- 会碰到寄存器级或外设侧代码
- 可能改变启动顺序、板级初始化或传输时序
- 需要重新设计模块边界或分层
- 任务包含可移植性、板型复用或长期结构
- 需要架构、构建失败或固件安全复核

不要仅仅因为任务“看起来中等”就升级。只要风险和范围都很小，就保留简单路径。

### Claude 直接处理（不升级）

以下情况直接处理，不需要 Codex：
- 单文件编辑
- 注释或命名清理
- 低风险逻辑微调
- 配置文本更新
- 不会改变构建图、启动顺序、中断行为、架构边界或硬件交互的变更

### 验证标准

在 Codex 完成工作后，Claude 必须用当前证据进行验证：

1. **Build validation** - run the real project build command (`make`, `cmake --build`, etc.)
2. **Functional validation** - run available unit tests, integration tests, or smoke tests
3. **Firmware risk validation** - check ISR/shared-state/register/init-sequence assumptions for relevant tasks
4. **Architecture validation** - verify implementation follows intended boundaries

### 完成流程

验证完成后：
1. 报告改了什么
2. 报告准确的验证状态
3. 说明仍需在目标设备上验证的残余嵌入式系统风险
4. 如果架构发生变化，总结所选边界或权衡

## 结束（任务完成时）
- 结束时附上一个简短的 `Stop` 区块：
  - 变更了什么
  - 测试/验证情况（或 `Not run`）
  - 建议的下一步（如有）
