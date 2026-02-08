# 📕 Auto-Redbook-Skills

> 一个自动撰写笔记、生成图片、自动发布小红书的 Skills

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ 功能特性

- 📝 **撰写笔记** - 根据既定主题，撰写小红书笔记（提示词自己调整，在 `SKILL.md`里）
- 🎨 **生成卡片** - 根据内容自动渲染生成图片，包含 cover 和内容详情，支持 Markdown 渲染
- 🐍 **双语言脚本** - 提供 Python 和 Node.js 两种渲染方案
- 📤 **一键发布** - 支持直接发布到小红书（需配置 Cookie）


## 🚀 快速开始

### Clone 项目

Clone 项目到本地

```bash

git clone https://github.com/comeonzhj/Auto-Redbook-Skills.git                    

```

移动到支持 Skills 的客户端对应文件夹里：

- For Claude ： `~/.claude/skills/`
- For Alma： `~/.config/Alma/skills/`
- For TRAE： `/your-path/.trae/skills/`

### 安装依赖

**Python 版本：**

```bash
pip install markdown pyyaml playwright python-dotenv xhs
playwright install chromium
```

**Node.js 版本：**

```bash
cd Auto-Redbook-Skills
npm install
npx playwright install chromium
```

## 📤 发布到小红书

### 1. 配置 Cookie

复制 `env.example.txt` 为 `.env`，填入小红书 Cookie：

```bash
cp env.example.txt .env
```

编辑 `.env` 文件：

```
XHS_COOKIE=your_cookie_string_here
```

**获取 Cookie 方法：**

1. 在浏览器中登录 [小红书](https://www.xiaohongshu.com)
2. 打开开发者工具（F12）
3. 在 Network 标签中查看任意请求的 Cookie 头
4. 复制完整的 cookie 字符串

### 2. 发布笔记

Skills 会自动发布，也可以手动执行：

```bash
python scripts/publish_xhs.py \
  --title "笔记标题" \
  --desc "笔记描述内容" \
  --images cover.png card_1.png card_2.png
```

**可选参数：**

| 参数 | 说明 |
|------|------|
| `--private` | 设为私密笔记 |
| `--post-time "2024-01-01 12:00:00"` | 定时发布 |
| `--dry-run` | 仅验证，不实际发布 |

## 🎨 自定义样式

### 修改背景渐变

编辑 `assets/card.html` 中的 `.card-container`：

```css
.card-container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

**预设渐变色：**

| 名称 | 渐变值 |
|------|--------|
| 紫蓝 | `#667eea → #764ba2` |
| 粉红 | `#f093fb → #f5576c` |
| 青蓝 | `#4facfe → #00f2fe` |
| 绿色 | `#43e97b → #38f9d7` |
| 橙黄 | `#fa709a → #fee140` |

### 修改封面样式

编辑 `assets/cover.html` 中的样式。

## 📁 项目结构

```
md2Redbook/
├── SKILL.md              # 技能描述（AI Agent 使用）
├── README.md             # 项目文档
├── requirements.txt      # Python 依赖
├── package.json          # Node.js 依赖
├── env.example.txt       # Cookie 配置示例
├── assets/
│   ├── cover.html        # 封面 HTML 模板
│   ├── card.html         # 正文卡片 HTML 模板
│   ├── styles.css        # 共用样式表
│   └── example.md        # 示例 Markdown
└── scripts/
    ├── render_xhs.py     # Python 渲染脚本
    ├── render_xhs.js     # Node.js 渲染脚本
    └── publish_xhs.py    # 小红书发布脚本
```


## ⚠️ 注意事项

1. **Cookie 安全** - Cookie 包含登录凭证，请勿泄露或提交到版本控制
2. **Cookie 有效期** - 小红书 Cookie 会过期，需定期更新
3. **发布频率** - 避免频繁发布，以免触发平台限制
4. **图片尺寸** - 渲染的图片为 1080×1440px，符合小红书推荐比例

## 🙏 致谢

- [Playwright](https://playwright.dev/) - 浏览器自动化渲染
- [Marked](https://marked.js.org/) - Markdown 解析
- [Madopic](https://github.com/xiaolinbaba/Madopic) - Markdown 渲染  
- [xhs](https://github.com/ReaJason/xhs) - 小红书 API 客户端

## 📄 License

MIT License © 2026
