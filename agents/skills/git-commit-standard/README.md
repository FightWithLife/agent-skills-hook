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
- 版本递进和固件产物同步是两个独立门禁；未递进版本、只是 amend、只是 fix 都不能作为跳过固件产物的理由
- 每次 commit 前，只要存在代码改动，就默认检查并同步最新固件产物和 README/changelog 总结；这是默认提交流程，不需要额外写进 commit message
- README/changelog 可能需要汇总多个 commit，而不是只记录当前 commit；若仓库要求一版本一条，同版本改动必须合并到同一版本块，并用二级分点表达独立事项
- 版本履历和 commit message 只写业务结果、行为变化、兼容性和影响，不写“不递进版本”“不归档固件”“后续需要更新”等流程话术
- 固件产物需要按历史目录和命名规则归档；不同构建宏/变体可能对应不同目录；当前版本既有产物可在用户或仓库流程要求下用最新构建覆盖并记录验证证据
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
