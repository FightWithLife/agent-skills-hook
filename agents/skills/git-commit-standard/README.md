# git-commit-standard

本目录提供 git commit / release 规范 skill。该 skill 已按通用仓库工作流重写：默认不写死具体项目路径，而是要求先读取当前仓库的 AGENTS、release 配置、版本文件、固件归档目录和历史提交。

## 文件

```text
git-commit-standard/
├── SKILL.md
└── README.md
```

## 作用

该 skill 用于约束执行 commit 前的版本、日期、修改者、提交说明、README/changelog 和固件产物归档，重点规则包括：

- 版本来源必须从当前仓库规则中发现，不能写死某个项目路径
- 时间格式固定为 `YYYY.MM.DD`
- 修改者来源于 `git config user.name`
- 每完成一个完整可发布闭环，按仓库规则递增 beta/build/release 字段；普通中间提交不强制递增
- 每次 commit 前，只要存在代码改动，就默认检查并同步最新固件产物和 README/changelog 总结；这是默认提交流程，不需要额外写进 commit message
- README/changelog 可能需要汇总多个 commit，而不是只记录当前 commit
- 固件产物需要按历史目录和命名规则归档；不同构建宏/变体可能对应不同目录
- 允许仓库维护 `.agents/release-config.md` 或等价文件记录版本源、构建变体、产物目录、changelog 路径和上次 release 边界

## 最小检查

执行 commit 前，应至少确认：

```text
标题：<摘要>
版本：<artifact-or-release-version>
时间：<YYYY.MM.DD>
修改者：<git config user.name>
更改点：
1）修改原因：
2）修改依据：
3）修改方法：
4）修改影响：
```

当 `AGENTS.md`、仓库配置或用户明确要求标准提交/版本/固件归档时，必须调用本 skill。
