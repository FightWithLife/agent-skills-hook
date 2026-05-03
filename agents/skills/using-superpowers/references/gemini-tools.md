# Gemini CLI 工具映射

这份映射只面向执行阶段的 skills；只读研究模式在这里单独说明。

Skills 使用的是 Claude Code 的工具名。遇到这些工具名时，请使用你所在平台的等价工具：

| Skill references | Gemini CLI equivalent |
|-----------------|----------------------|
| `Read` (file reading) | `read_file` |
| `Write` (file creation) | `write_file` |
| `Edit` (file editing) | `replace` |
| `Bash` (run commands) | `run_shell_command` |
| `Grep` (search file content) | `grep_search` |
| `Glob` (search files by name) | `glob` |
| `TodoWrite` (task tracking) | `write_todos` |
| `Skill` tool (invoke a skill) | `activate_skill` |
| `WebSearch` | `google_web_search` |
| `WebFetch` | `web_fetch` |
| `Task` 工具（子代理派发） | 无对应工具，Gemini CLI 不支持子代理 |

## 不支持子代理

Gemini CLI 没有 Claude Code `Task` 工具的等价物。依赖子代理派发的 skills 会退化为单会话执行。

## Gemini CLI 的其他工具

下面这些工具在 Gemini CLI 里可用，但没有 Claude Code 对应工具：

| Tool | Purpose |
|------|---------|
| `list_directory` | List files and subdirectories |
| `save_memory` | Persist facts to GEMINI.md across sessions |
| `ask_user` | Request structured input from the user |
| `tracker_create_task` | Rich task management (create, update, list, visualize) |
| `enter_plan_mode` / `exit_plan_mode` | 进入/退出只读研究模式 |
