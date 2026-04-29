---
name: git-commit-standard
description: Use when AGENTS.md, repository policy, or the user explicitly requires standardized git commits, version metadata, firmware artifacts, or release/changelog records before committing.
---

# git-commit-standard

## Overview

用于执行仓库约定的提交、版本、固件产物归档和 changelog/release record 同步。核心原则：**提交前先确认仓库规则，再默认检查并同步版本元数据、README/changelog、固件产物和发布记录，最后 commit**。

**默认行为（重点）：每次 commit 前，只要存在代码改动，就必须默认检查并同步最新固件产物和 README/changelog 总结。** 这不是额外功能、不是可选增强、也不是需要写进 commit message 的“变更点”；它是本 skill 的默认提交卫生流程。只有仓库规则、用户明确要求或历史证据明确证明本次没有对应固件/README/changelog 记录项时，才可跳过，并在执行记录中说明依据。禁止把“未递进版本”“只是 amend”“只是 fix/中间提交”作为跳过固件或履历同步的理由。

该 skill 设计为通用技能：不要写死某个仓库的版本头、固件目录、构建宏、产物命名或 README 路径；这些信息必须从当前仓库的配置、AGENTS.md、历史提交和实际文件结构中推导或维护。

## When to Use

必须使用：

- 用户要求 `git commit`，且仓库/AGENTS.md 要求标准提交或版本记录。
- 用户要求更新版本号、beta/release 标记、固件产物、README/changelog/release note。
- 用户要求把构建出来的 firmware/bin/hex/dfu 等产物按版本名归档。
- AGENTS.md 明确要求使用本 skill 或等价 release/commit 流程。

不要使用：

- 只做代码调研、diff 查看、问题分析，不准备提交。
- 用户明确要求跳过仓库 release 流程，只生成普通临时 commit。
- 仓库没有固件/版本/发布记录规则，且用户没有要求补齐这些内容。

## Repository Rule Discovery

每个仓库先按下面顺序找规则，不要凭经验写死路径：

1. 读取当前目录和上层 `AGENTS.md` / `README` / release 文档。
2. 查找仓库内 release 配置文件，优先级建议：
   - `.agents/release-config.md`
   - `.agents/git-commit-standard.md`
   - `.release-config.md`
   - 项目自定义说明文件。
3. 搜索版本来源：`FIRMWARE_VERSION`、`VERSION_BETA`、`VERSION`、`APP_VERSION`、`BUILD_VERSION`、`RELEASE_VERSION` 等。
4. 搜索产物归档目录：`firmware_record/`、`release/`、`releases/`、`dist/`、`out/`、`bin/` 等。
5. 搜索 changelog/release record：`README.txt`、`ReadMe.txt`、`CHANGELOG.md`、`RELEASE.md`、`docs/release/` 等。
6. 查看历史提交：找最近一次版本递增、固件归档、README/changelog 更新的提交，确认真实格式。

如果规则不明确，先向用户确认；不要默认 fallback 到某个仓库的规则。

## Repository Config / State File

允许在仓库中维护一个小型配置/状态文件，用来记录跨 commit 的 release 信息。推荐路径：`.agents/release-config.md`。如果仓库已有等价文件，沿用已有文件。

该文件可记录：

```markdown
# Release Config

## Version Sources
- default: `path/to/version.h`, macros: `FIRMWARE_VERSION`, `VERSION_BETA`
- variant-a: `path/to/version.h`, compile macro/env: `<VARIANT_MACRO>`, artifact prefix: `<product-variant>`

## Build Variants
| variant | build command | compile macro/env | output artifact | archive dir | archive name pattern |
|---|---|---|---|---|---|
| default | `<repo build command>` | none | `<out artifact path>` | `<archive dir>` | `<artifact-prefix>_v<version>_<beta>.bin` |

## Changelog
- file: `path/to/ReadMe.txt`
- insert: top
- block separator: `================================================================`
- fields: version, date, author, change points

## Release State
- last_version_bump_commit: `<commit>`
- last_released_version: `<version>`
- last_archived_artifacts:
  - `<path>`
```

用途：当“多个 commit 才递进一次版本”时，用 `last_version_bump_commit` 或上一个版本记录位置作为汇总边界，不要只拿当前 commit 写 changelog。

## Version Bump Rules

1. 先判断本次是否是一个完整可发布/可归档的功能闭环。
2. 若不是完整闭环，可不递增版本；但版本递进和固件产物同步是两个独立门禁。只要代码会进入固件运行镜像，仍要按仓库规则构建并更新当前版本对应的固件归档，除非用户或仓库规则明确要求跳过。
3. 若是完整闭环：
   - 按仓库规则递增 beta/build/release 字段。
   - 通常只递增 beta/build，不随意递增主版本；除非用户或 release 规则明确要求。
   - 多个变体有不同宏/版本时，分别确认目标变体，不要只改默认分支。
4. **默认要求：不管是否递增版本，只要本次 commit 有代码改动，就要同步检查并更新固件产物、README/changelog 总结和相关发布记录。** 这是每次标准提交的默认行为，不需要用户额外提醒；只有仓库规则或历史证据明确证明本次没有对应记录项时，才可跳过。
5. 如果同一发布版本由多个 commit 组成，changelog/README 要汇总从上次版本记录到当前提交范围内的所有变更，而不是只写当前 commit。
6. amend 也必须重新评估版本、固件产物、README/changelog 和提交正文一致性；amend 不降低任何 release/artifact 义务。

## Changelog / README Rules

写 changelog 前必须确认：

- 文件路径和格式来自仓库历史，不要新造格式。
- 插入位置是顶部、底部还是按版本排序。
- 版本字段是否带产物后缀，如 `.bin`。
- 作者字段来自 `git config user.name`，除非仓库规则另有要求。
- 日期格式沿用仓库历史；若仓库没有固定格式，使用 `YYYY.MM.DD`。

生成 changelog 内容时：

1. 找到汇总边界：
   - 优先使用 `.agents/release-config.md` 中的 `last_version_bump_commit`。
   - 否则用上一个 README/changelog 版本记录对应的 commit。
   - 再否则询问用户。
2. 汇总边界之后的所有相关 commit。
3. 合并成发布视角的“修改原因 / 修改依据 / 修改方法 / 修改影响”或仓库既有字段。
4. 不要把每个 commit 原文机械粘贴；要按功能归并。
5. 若仓库历史或用户要求“一版本一条”，README/changelog 必须以版本为主键；同一版本内多次修正、回归、补充说明都合并到同一个版本块内，不要拆成多条相同版本记录。
6. README/changelog 总结允许在既有模板条目下继续分点或缩进分层；当同一字段内包含多个独立事项、影响面或风险点时，使用二级分点，不要用长句和分号串联多个主题。
7. 版本履历只写业务结果、行为变化、兼容性、风险和测试维护有意义的信息；不要写流程性负面或后续安排，例如“本次不递进版本号”“不修改版本宏”“不归档固件产物”“后续需要覆盖固件”“已按流程检查”。这些内容只能放在任务汇报或内部执行记录中。
8. 如果本次是非递进版本但有代码改动，也要先检查 README/changelog 是否需要补记录，再判断是否能跳过；不要默认“不升版本=不用同步”。

## Firmware Artifact Rules

当仓库要求归档固件产物时：

1. 先确认目标变体和构建宏：default / factory / esc / 300dpi / bootloader / product tool 等。
2. 运行仓库真实构建命令生成新产物。
3. 根据版本宏、构建宏和历史命名规则计算归档文件名。
4. 将构建产物复制到对应历史目录。
5. 若同一版本需要多个变体，逐个构建、逐个命名、逐个归档。
6. 归档前确认目标文件是否已存在。若目标文件是当前版本既有归档，且用户或仓库流程要求“更新当前版本产物”，可用最新构建产物覆盖并记录验证证据；若版本/变体/目标文件不明确，或覆盖跨版本、跨变体、历史冻结产物，必须先询问用户。
7. 归档产物应进入 commit，除非仓库规则明确忽略产物。
8. 即使本次不递增版本，只要存在会进入固件镜像的代码或构建输入改动，默认也要构建并更新当前版本对应的固件产物。只有仓库规则、用户明确要求或历史证据明确证明本次没有固件记录要求时，才可不归档；跳过时必须说明证据。禁止用“未递进版本”“只是 amend”“只是 fix”作为跳过理由。

不要假设所有仓库都把产物放在同一个目录；必须从历史文件和 git log 中确认。

## Commit Message Rules

默认提交正文模板如下；若仓库已有模板，按仓库模板：

```text
版本：<artifact-or-release-version>
时间：<date>
修改者：<git config user.name>
更改点：
1）修改原因：<why>
2）修改依据：<basis / issue / requirement>
3）修改方法：<how>
4）修改影响：<impact / affected modules>
```

要求：

- 标题聚焦本次提交目的，不把长版本信息塞进标题，除非历史就是这样。
- 正文必须和版本头、README/changelog、归档产物一致。
- 正文只描述本次真实业务、代码、文档、兼容性和影响变化；不要写提交流程、是否递进版本、是否归档固件、后续应该做什么等流程话术。
- 不要把“已按默认流程检查/同步固件和 README/changelog”写成 commit message 的变更点或原因；默认流程是否执行，记录在任务汇报或内部检查中即可。

## Operating Pattern

执行 commit 前按顺序处理：

1. 确认用户确实要求提交。
2. 读取仓库规则：AGENTS、release 配置、历史提交、版本文件、changelog 文件、产物目录。
3. 默认检查本次代码改动是否需要同步 README/changelog、固件产物和发布记录；这是每次 commit 的固定步骤，不要等用户额外要求。
4. 分别确认本次是否触发版本递增、README/changelog 汇总和固件归档；版本递增不是固件归档的前置条件。
5. 若触发版本递增：
    - 更新版本源文件。
    - 构建目标变体。
    - 按历史命名复制/归档产物。
    - 汇总当前版本范围内多个 commit 的 changelog 并更新 README/changelog。
    - 更新 `.agents/release-config.md` 的 release state（如果仓库采用该文件）。
6. 若未触发版本递增但存在代码改动：
    - 仍要检查 README/changelog 和固件产物是否需要同步。
    - 若代码会进入固件运行镜像，默认构建并更新当前版本对应固件产物。
    - 若仓库规则或用户明确不需要记录，才可跳过，并记录证据。
7. 运行验证：diff check、必要的 LSP/构建/测试、产物存在性和文件名检查。
8. 暂存源码、版本文件、changelog、归档产物、release 配置文件。
9. 使用仓库模板创建 commit；commit message 只写实际变更，不写“执行了默认固件/README 同步检查”“不递进版本”“不归档固件”等流程话术。
10. 提交后验证工作区状态、最新 commit message、Change-Id（若 Gerrit hook 存在）。

## Common Mistakes

- 把“每个 commit”都当成“每次版本递增”。
- 代码有改动却因为没递增版本，就漏掉固件和 README/changelog 同步检查。
- 把“未递进版本”“只是 amend”“只是 fix/中间提交”当作跳过固件产物的理由。
- 把固件和 README/changelog 同步检查当成“可选项”，等用户提醒才做；正确做法是每次 commit 默认执行。
- 在 commit message 里写“按默认流程检查/同步固件和 README”，造成提交说明噪音；默认流程不要写入提交说明。
- 在 commit message 或版本履历里写“不修改版本宏”“不归档固件产物”“后续需要更新固件”等流程说明。
- changelog 只写当前 commit，漏掉同一版本从上次 release 后累计的多个 commit。
- 同一个版本拆成多条 README/changelog 记录，而用户或仓库规则要求一版本一条。
- 多个独立影响面挤在一条长句里，导致兼容性、密钥策略、payload/session 行为和诊断能力混在一起。
- README 只写当前提交摘要，没有覆盖整个版本范围内的提交内容。
- 只改版本头，不更新 README/changelog。
- 只构建不归档，或归档文件名仍是临时 `out/` 名称。
- 不看历史目录，把 ESC/300DPI/工厂/boot 产物放到默认固件目录。
- 覆盖已有固件产物而不确认。
- 把某个仓库的路径写死到通用 skill。
- 忘记把 release 配置/状态文件纳入 commit，导致下次无法知道汇总边界。

## Minimal Checklist

提交前至少确认：

- [ ] 已确认用户要求提交。
- [ ] 已加载并遵循本 skill。
- [ ] 已读取仓库 release/commit 规则，而不是套用其它仓库路径。
- [ ] 已分别判断本次是否递增版本、是否更新 README/changelog、是否更新固件产物；未把“不递进版本”作为跳过依据。
- [ ] 若有会进入固件镜像的代码/构建输入改动，已构建并更新当前版本固件产物；若跳过，已有用户/规则/历史证据。
- [ ] 若递增版本，已更新版本源、README/changelog、固件归档产物和 release state。
- [ ] README/changelog 汇总范围正确，覆盖同一版本内多个 commit；若要求一版本一条，已合并到同一版本块，并用二级分点表达独立事项。
- [ ] README/changelog 和 commit message 未包含“不递进版本”“不修改版本宏”“不归档固件产物”“后续应该”等流程话术。
- [ ] 固件产物文件名、目录和构建宏与历史规则一致。
- [ ] 已运行必要验证并记录结果。
- [ ] commit message 与版本/README/产物一致。
- [ ] 提交后工作区状态和 Change-Id（如适用）已验证。
