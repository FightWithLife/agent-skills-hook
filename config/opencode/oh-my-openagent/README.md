## oh-my-openagent 移植配置

这里存放从 `oh-my-opencode` 裁切并移植过来的 OpenCode 插件侧配置。

目标：

- 保留当前 `opencode.json` 里的原生 `build` / `plan` / `explore`
- 让 `oh-my-openagent` 只额外挂载一个轻量版 `sisyphus`
- 保留与 `sisyphus` 直接相关、仍然可用的内建命令
- 不再默认注册 `hephaestus`、`prometheus`、`atlas`、`sisyphus-junior`

部署后目标文件：

- `~/.config/opencode/oh-my-openagent.json`
- `~/.config/opencode/oh-my-openagent/`

其中 `oh-my-openagent.json` 会引用本目录下的 prompt 补丁文件。
