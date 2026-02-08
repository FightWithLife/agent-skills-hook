# Auto-Redbook-Skills 使用指南

## Cookie 配置

如果你需要重新配置小红书 Cookie，可以使用以下便捷脚本：

```bash
~/.qoder/skills/Auto-Redbook-Skills/configure_cookie.sh
```

## 创建小红书笔记

### 1. 编写 Markdown 文件

创建一个包含 YAML 头部的 Markdown 文件，例如：

```markdown
---
emoji: "💡"
title: "笔记标题"
subtitle: "笔记副标题"
---

# 第一部分内容

这里是笔记的第一部分内容。

---

# 第二部分内容

这里是笔记的第二部分内容。

#标签1 #标签2 #标签3
```

### 2. 生成图片卡片

```bash
cd ~/.qoder/skills/Auto-Redbook-Skills
python scripts/render_xhs.py your_note.md --output-dir ./output
```

### 3. 发布到小红书

```bash
python scripts/publish_xhs.py --title "标题" --desc "描述" --images output/cover.png output/card_1.png
```

## 注意事项

- 确保 Cookie 有效，过期后需要重新获取
- 图片尺寸为 1080×1440px，保持 3:4 比例
- 标题不超过 20 字
- 使用 `---` 分隔符将内容分成多张卡片