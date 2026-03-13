<p align="center">
  <img src="assets/logo/logo.png" alt="CodexManager Logo" width="220" />
</p>

<h1 align="center">CodexManager</h1>

<p align="center">本地桌面端 + 服务进程的 Codex 账号池管理器</p>

<p align="center">
  <a href="README.en.md">English</a>
</p>

本地桌面端 + 服务进程的 Codex 账号池管理器，用于统一管理账号、用量与平台 Key，并提供本地网关能力。

## 首页导览
| 你要做什么 | 直接进入 |
| --- | --- |
| 首次启动、部署、Docker、macOS 放行 | [运行与部署指南](docs/report/20260310122606850_运行与部署指南.md) |
| 配置端口、代理、数据库、Web 密码、环境变量 | [环境变量与运行配置](docs/report/20260309195355187_环境变量与运行配置说明.md) |
| 排查账号不命中、导入失败、挑战拦截、请求异常 | [FAQ 与账号命中规则](docs/report/20260310122606852_FAQ与账号命中规则.md) |
| 本地构建、打包、发版、脚本调用 | [构建发布与脚本说明](docs/release/20260310122606851_构建发布与脚本说明.md) |

## 最近变更
- 当前最新版本：`v0.1.8`（2026-03-13）
- 本次发版已收敛最近一轮协议兼容、登录链路、网关错误响应、桌面交互、Web 安全和长期维护治理；完整历史请看 [CHANGELOG.md](CHANGELOG.md)。
- 仪表盘继续补齐账号池视角：新增“账号池总剩余”卡片，5 小时 / 7 天剩余比例已下沉到后端聚合，并接入启动快照与自动刷新链路，账号规模上来后也能持续刷新。
- Codex 登录账号链路继续对齐：ChatGPT 登录账号主请求已统一改为直接使用 `access_token`，不再混入 `api_key_access_token` 语义；默认 `https://api.openai.com/v1` fallback 已移除，challenge / 403 不再被本地硬改成额外的 fallback 错误。
- 401 恢复链路已补齐：当 ChatGPT 登录账号请求命中 `401` 时，会使用本地 `refresh_token` 刷新 `access_token`，并对当前请求执行一次单次重试；不再继续沿用旧的 401 stateless retry。
- 网关运行与诊断增强：gateway 自合成失败响应已改成结构化 OpenAI 风格 `error.message / error.type / error.code`，同时保留错误码与 trace 响应头；长输出场景的 SSE 空闲断流重连更稳定；设置页新增上游流式超时和 SSE keepalive 配置并支持热生效。
- 桌面体验继续修正：启动后会优先恢复仪表盘 / 账号 / 请求日志快照；登录成功后账号表格会自动刷新；平台密钥创建与上游代理保存流程也做了收口。
- Web 安全链路已补齐：`codexmanager-web` 的访问密码仍会持久化，但登录会话会绑定当前 Web 进程；关闭并重新打开后，旧 Cookie 不再继续生效，必须重新验证密码。
- 项目内部也在持续做长期维护向重构：前端主入口、设置页、请求日志、Tauri 命令层、service 生命周期、gateway protocol adapter、HTTP bridge 和 upstream 流程都已继续拆分，目录边界和模块职责更清晰。
- 发布体系继续收敛到单一入口：`release-all.yml` 统一负责 Windows / macOS / Linux 一键发布；当 `run_verify=false` 时会自动回退到本地前端构建，不再强依赖预构建工件。

## 功能概览
- 账号池管理：分组、标签、排序、备注
- 批量导入 / 导出：支持多文件导入、桌面端文件夹递归导入 JSON、按账号导出单文件
- 用量展示：兼容 5 小时 + 7 日双窗口，以及仅返回 7 日单窗口的账号
- 授权登录：浏览器授权 + 手动回调解析
- 平台 Key：生成、禁用、删除、模型绑定
- 本地服务：自动拉起、可自定义端口
- 本地网关：为 CLI 和第三方工具提供统一 OpenAI 兼容入口

## 截图
![仪表盘](assets/images/dashboard.png)
![账号管理](assets/images/accounts.png)
![平台 Key](assets/images/platform-key.png)
![日志视图](assets/images/log.png)
![设置页](assets/images/themes.png)

## 快速开始
1. 启动桌面端，点击“启动服务”。
2. 进入“账号管理”，添加账号并完成授权。
3. 如回调失败，粘贴回调链接手动完成解析。
4. 刷新用量并确认账号状态。

## 页面展示
### 桌面端
- 账号管理：集中导入、导出、刷新账号与用量
- 平台 Key：按模型绑定平台 Key，并查看调用日志
- 设置页：统一管理端口、代理、主题、自动更新、后台行为

### Service 版
- `codexmanager-service`：提供本地 OpenAI 兼容网关
- `codexmanager-web`：提供浏览器管理页面
- `codexmanager-start`：一键拉起 service + web

## 常用文档
- 版本历史：[CHANGELOG.md](CHANGELOG.md)
- 协作约定：[CONTRIBUTING.md](CONTRIBUTING.md)
- 架构说明：[ARCHITECTURE.md](ARCHITECTURE.md)
- 测试基线：[TESTING.md](TESTING.md)
- 安全说明：[SECURITY.md](SECURITY.md)
- 文档索引：[docs/README.md](docs/README.md)

## 专题页面
| 页面 | 内容 |
| --- | --- |
| [运行与部署指南](docs/report/20260310122606850_运行与部署指南.md) | 首次启动、Docker、Service 版、macOS 放行 |
| [环境变量与运行配置](docs/report/20260309195355187_环境变量与运行配置说明.md) | 应用配置、代理、监听地址、数据库、Web 安全 |
| [FAQ 与账号命中规则](docs/report/20260310122606852_FAQ与账号命中规则.md) | 账号命中、挑战拦截、导入导出、常见异常 |
| [最小排障手册](docs/report/20260307234235414_最小排障手册.md) | 快速定位服务启动、请求转发、模型刷新异常 |
| [构建发布与脚本说明](docs/release/20260310122606851_构建发布与脚本说明.md) | 本地构建、Tauri 打包、Release workflow、脚本参数 |
| [发布与产物说明](docs/release/20260309195355216_发布与产物说明.md) | 各平台发版产物、命名、是否 pre-release |
| [脚本与发布职责对照](docs/report/20260309195735631_脚本与发布职责对照.md) | 各脚本负责什么、什么场景该用哪个 |
| [协议兼容回归清单](docs/report/20260309195735632_协议兼容回归清单.md) | `/v1/chat/completions`、`/v1/responses`、tools 回归项 |
| [CHANGELOG.md](CHANGELOG.md) | 最新发版内容、未发版更新与完整版本历史 |

## 目录结构
```text
.
├─ apps/                # 前端与 Tauri 桌面端
│  ├─ src/
│  ├─ src-tauri/
│  └─ dist/
├─ crates/              # Rust core/service
│  ├─ core
│  ├─ service
│  ├─ start              # Service 版本一键启动器（拉起 service + web）
│  └─ web                # Service 版本 Web UI（可内嵌静态资源 + /api/rpc 代理）
├─ docs/                # 正式文档目录
├─ scripts/             # 构建与发布脚本
└─ README.md
```

## 鸣谢与参考项目

- CPA（CLIProxyAPI）：本项目在协议适配、请求转发与兼容行为上参考了该项目的实现思路 <https://github.com/router-for-me/CLIProxyAPI>
- 重点参考区域：
- `crates/service/src/gateway/protocol_adapter/request_mapping.rs`
- `crates/service/src/gateway/protocol_adapter/response_conversion/`
- `crates/service/src/gateway/upstream/`


## 联系方式

<p align="center">
  <img src="assets/images/group.jpg" alt="交流群二维码" width="280" />
  <img src="assets/images/qq_group.jpg" alt="QQ 交流群二维码" width="280" />
</p>

- Telegram 交流群：<https://t.me/+8o2Eu7GPMIFjNDM1>
- QQ 交流群：扫码加入
- 微信公众号：七线牛马
