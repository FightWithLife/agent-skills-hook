---
name: mediacrawler
description: Multi-platform social media data crawling tool (Xiaohongshu, Douyin, Kuaishou, Bilibili, Weibo). Use when you need to search for posts, extract details, or scrape comments from supported platforms. Supports managing authentication (Cookies, QR codes) and saving data in JSON, CSV, or Excel formats.
---

# MediaCrawler - 多平台媒体数据爬虫

这是一个内置完整功能的媒体爬虫工具，包含完整的MediaCrawler代码库，可独立运行。

## 快速开始

### 1. 安装依赖
```bash
cd /home/yang/.qoder/skills/mediacrawler
uv sync
uv run playwright install
```

或使用传统pip：
```bash
pip install -r requirements.txt
playwright install
```

### 2. 执行搜索爬取
```bash
# 使用uv运行
cd /home/yang/.qoder/skills/mediacrawler
uv run python scripts/run_crawl.py --platform xhs --keywords "手机评测" --login-type cookie --cookies "your_cookies"

# 或直接运行
python3 scripts/run_crawl.py --platform xhs --keywords "手机评测" --login-type cookie --cookies "your_cookies"
```

## 支持的平台

- ✅ **小红书 (xhs)**: 笔记搜索、详情抓取、评论获取
- ✅ **抖音 (dy)**: 视频搜索、详情抓取、评论获取
- ✅ **快手 (ks)**: 视频搜索、详情抓取
- ✅ **B站 (bili)**: 视频搜索、详情抓取、评论获取
- ✅ **微博 (wb)**: 微博搜索、详情抓取

## 使用示例

### 小红书搜索
```bash
# 基本搜索（使用cookie登录）
python3 scripts/run_crawl.py --platform xhs --keywords "美食探店" --login-type cookie --cookies "your_cookies"

# 多关键词搜索
python3 scripts/run_crawl.py --platform xhs --keywords "美食,旅行,摄影" --login-type cookie --cookies "your_cookies"

# 二维码登录（需要有图形界面）
python3 scripts/run_crawl.py --platform xhs --keywords "数码产品" --login-type qrcode

# 无头模式运行（服务器环境）
python3 scripts/run_crawl.py --platform xhs --keywords "摄影技巧" --login-type cookie --cookies "your_cookies" --headless
```

### 抖音搜索
```bash
python3 scripts/run_crawl.py --platform dy --keywords "美食教程" --login-type cookie --cookies "your_cookies"
```

### B站搜索
```bash
python3 scripts/run_crawl.py --platform bili --keywords "编程教程" --login-type cookie --cookies "your_cookies"
```

### 微博搜索
```bash
python3 scripts/run_crawl.py --platform wb --keywords "科技新闻" --login-type cookie --cookies "your_cookies"
```

## 参数说明

| 参数 | 说明 | 可选值 |
|------|------|--------|
| `--platform` | 目标平台 | xhs, dy, ks, bili, wb |
| `--keywords` | 搜索关键词 | 多个用逗号分隔 |
| `--login-type` | 登录方式 | qrcode, cookie, phone |
| `--cookies` | Cookie字符串 | 用于cookie登录 |
| `--headless` | 无头模式 | 添加此参数启用 |
| `--max-notes` | 最大爬取数量 | 默认20 |

## 获取Cookie

### 小红书Cookie获取方法
1. 浏览器打开 https://www.xiaohongshu.com
2. 登录你的账号
3. 按F12打开开发者工具
4. 切换到"Network"标签
5. 刷新页面
6. 找到任意请求，在Headers中找到Cookie
7. 复制完整的Cookie字符串

### Cookie格式示例
```
gid=xxx; xsecappid=xxx; a1=xxx; webId=xxx; web_session=xxx; ...
```

## 数据保存

爬取的数据会自动保存在 `data` 目录下，支持多种格式：
- JSON格式（默认）
- CSV格式
- Excel格式
- 数据库存储（SQLite/MySQL/PostgreSQL）

可在 `config/base_config.py` 中配置保存选项。

## 高级配置

如需更详细的配置（如代理、并发数、CDP模式等），请编辑：
```
/home/yang/.qoder/skills/mediacrawler/config/base_config.py
```

## 注意事项

⚠️ **重要提醒**：
- 本工具仅供学习研究使用
- 请遵守各平台的使用条款和robots.txt规则
- 合理控制请求频率，避免对平台造成负担
- 不得用于任何商业用途
- 使用Cookie登录时请保护好个人隐私信息

## 许可证

本项目遵循 NON-COMMERCIAL LEARNING LICENSE 1.1 许可协议。
