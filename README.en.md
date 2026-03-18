<p align="center">
  <img src="assets/logo/logo.png" alt="CodexManager Logo" width="220" />
</p>

<h1 align="center">CodexManager</h1>

<p align="center">A local desktop + service toolkit for Codex-compatible account and gateway management.</p>

<p align="center">
  <a href="README.md">中文</a>
</p>

A local desktop + service toolkit for managing Codex-compatible accounts, usage, platform keys, and a built-in local gateway.

## Disclaimer

- This project is for learning and development purposes only.

- Users must comply with the terms of service of all relevant platforms (e.g., OpenAI, Anthropic).

- The author does not provide or distribute any accounts, API keys, or proxy services, and is not responsible for how this software is used.

- Do not use this project to bypass rate limits or service restrictions

## Landing Guide
| What you want to do | Go here |
| --- | --- |
| First launch, deployment, Docker, macOS allowlist | [Runtime and deployment guide](docs/report/20260310122606850_运行与部署指南.md) |
| Configure port, proxy, database, Web password, environment variables | [Environment variables and runtime config](docs/report/20260309195355187_环境变量与运行配置说明.md) |
| Troubleshoot account selection, import failures, challenge blocks, request issues | [FAQ and account-hit rules](docs/report/20260310122606852_FAQ与账号命中规则.md) |
| Build locally, package, publish, run scripts | [Build, release, and script guide](docs/release/20260310122606851_构建发布与脚本说明.md) |

## Recent Changes
- Current latest version: `v0.1.10` (2026-03-18)
- `v0.1.10` is a hotfix release on top of `v0.1.9`, mainly fixing Web / Docker false desktop-only prompts, account enable / disable argument errors, disabled accounts still being polled, inconsistent `refresh token 401` account states, and lingering child processes after closing the local Windows Web launcher.
- The previous major update is still the full UI refresh and consolidation under the new `apps` frontend: the old frontend was removed, while Accounts, Platform Keys, Request Logs, Settings, the top status bar, and the sidebar were all rebuilt into a denser desktop-first layout with cleaner filtering, dialogs, and summary cards.
- The request path was further aligned to actual Codex behavior, but only where it affects real request delivery: login / callback / workspace validation, refresh semantics, `/v1/responses` and `/v1/responses/compact` rewrites, thread anchors, `session_id` / `x-client-request-id` / `x-codex-turn-state`, request compression, and fallback diagnostics were all tightened.
- Account routing and usability also improved: free / weekly-single-window accounts now consistently use the configured model override; preferred-account routing, failover behavior, inflight limits, and refresh-token false inactivation were all corrected, and request logs now expose both the initial account and the attempted chain.
- Observability is much stronger: request logs now use backend pagination and backend summaries, while compact false-success bodies, HTML/challenge pages, `401 refresh` reasons, and `503 no available account` failures all produce clearer diagnostics instead of ambiguous generic errors.
- Desktop stability and startup behavior were cleaned up as well: service startup false negatives, `/rpc` empty responses, stale usage-dialog data, first-switch lag, hydration mismatches, and misleading dev render indicators were all addressed, and the Web password setting now stays in sync between desktop and Web.
- The release path was also normalized: the product version is now `0.1.10`, the Tauri Rust side and workflow Tauri CLI / pnpm versions are aligned again, and `release-all.yml` remains the single release entry for Windows / macOS / Linux. See [CHANGELOG.md](CHANGELOG.md) for the full history.

## Features
- Account pool management: groups, tags, sorting, notes
- Bulk import / export: multi-file import, recursive desktop folder import for JSON, one-file-per-account export
- Usage dashboard: 5-hour + 7-day windows, plus accounts that only expose a 7-day window
- OAuth login: browser flow + manual callback parsing
- Platform keys: create, disable, delete, model binding
- Local service with configurable port
- Local OpenAI-compatible gateway for CLI and third-party tools

## Screenshots
![Dashboard](assets/images/dashboard.png)
![Accounts](assets/images/accounts.png)
![Platform Key](assets/images/platform-key.png)
![Logs](assets/images/log.png)
![Settings](assets/images/themes.png)

## Quick Start
1. Launch the desktop app and click `Start Service`.
2. Go to Accounts, add an account, and complete authorization.
3. If callback parsing fails, paste the callback URL manually.
4. Refresh usage and confirm the account status.

## Page Overview
### Desktop
- Accounts: bulk import/export, refresh accounts and usage
- Platform Keys: bind keys by model and inspect request logs
- Settings: manage ports, proxy, theme, auto-update, and background behavior

### Service Edition
- `codexmanager-service`: local OpenAI-compatible gateway
- `codexmanager-web`: browser-based management UI
- `codexmanager-start`: one command to launch service + web

## Core Docs
- Version history: [CHANGELOG.md](CHANGELOG.md)
- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Testing baseline: [TESTING.md](TESTING.md)
- Security: [SECURITY.md](SECURITY.md)
- Docs index: [docs/README.md](docs/README.md)

## Topic Pages
| Page | Content |
| --- | --- |
| [Runtime and deployment guide](docs/report/20260310122606850_运行与部署指南.md) | First launch, Docker, Service edition, macOS allowlist |
| [Environment variables and runtime config](docs/report/20260309195355187_环境变量与运行配置说明.md) | App config, proxy, listen address, database, Web security |
| [FAQ and account-hit rules](docs/report/20260310122606852_FAQ与账号命中规则.md) | Account hit logic, challenge blocks, import/export, common issues |
| [Minimal troubleshooting guide](docs/report/20260307234235414_最小排障手册.md) | Fast path for service startup, forwarding, and model refresh issues |
| [Build, release, and script guide](docs/release/20260310122606851_构建发布与脚本说明.md) | Local build, Tauri packaging, Release workflow, script flags |
| [Release assets guide](docs/release/20260309195355216_发布与产物说明.md) | Platform artifacts, naming, release vs pre-release |
| [Script and release responsibility matrix](docs/report/20260309195735631_脚本与发布职责对照.md) | Which script owns which step |
| [Protocol regression checklist](docs/report/20260309195735632_协议兼容回归清单.md) | `/v1/chat/completions`, `/v1/responses`, tools regression items |
| [CHANGELOG.md](CHANGELOG.md) | Latest release notes, unreleased changes, and full version history |

## Project Structure
```text
.
├─ apps/                # Frontend and Tauri desktop app
│  ├─ src/
│  ├─ src-tauri/
│  └─ dist/
├─ crates/              # Rust core/service crates
│  ├─ core
│  ├─ service
│  ├─ start              # Service starter (launches service + web)
│  └─ web                # Service Web UI (optional embedded assets + /api/rpc proxy)
├─ docs/                # Formal project documentation
├─ scripts/             # Build and release scripts
└─ README.en.md
```

## Acknowledgements And References

- Codex (OpenAI): this project references its implementation and source layout for request-path behavior, login semantics, and upstream compatibility <https://github.com/openai/codex>
- CPA (CLIProxyAPI): this project references its protocol adaptation, request forwarding, and compatibility design <https://github.com/router-for-me/CLIProxyAPI>

## Recognized Community
<p align="center">
  <a href="https://linux.do/t/topic/1688401" title="LINUX DO">
    <img
      src="https://cdn3.linux.do/original/4X/d/1/4/d146c68151340881c884d95e0da4acdf369258c6.png?style=for-the-badge&logo=discourse&logoColor=white"
      alt="LINUX DO"
      width="100"
      hight="100"
    />
  </a>
</p>

## Contact Information
- Official Account: 七线牛马
- WeChat: ProsperGao
- Community Group:

  <img src="assets/images/qq_group.jpg" alt="Community Group QR Code" width="280" />
