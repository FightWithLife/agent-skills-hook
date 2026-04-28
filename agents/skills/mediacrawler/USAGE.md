# MediaCrawler 使用指南

## 🚀 快速开始

### 1. 使用交互式脚本（推荐）
```bash
cd /home/yang/.qoder/skills/mediacrawler
./quick_start.sh
```

### 2. 直接命令行使用

#### 小红书爬取
```bash
# 清除代理环境变量后执行
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
cd /home/yang/.qoder/skills/mediacrawler
python3 scripts/run_crawl.py --platform xhs --keywords "美食,旅行" --login-type qrcode --max-notes 20
```

#### 抖音爬取
```bash
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
cd /home/yang/.qoder/skills/mediacrawler
python3 scripts/run_crawl.py --platform dy --keywords "搞笑,音乐" --login-type qrcode --max-notes 15
```

#### B站爬取
```bash
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
cd /home/yang/.qoder/skills/mediacrawler
python3 scripts/run_crawl.py --platform bili --keywords "游戏,科技" --login-type qrcode --max-notes 10
```

## 🔐 登录方式说明

### 二维码登录（推荐）
- 无需手动输入账号密码
- 自动弹出浏览器窗口显示二维码
- 使用手机APP扫描二维码即可登录
- 登录状态会自动保存，下次使用更便捷

### Cookie登录
```bash
python3 scripts/run_crawl.py --platform xhs --keywords "测试" --login-type cookie --cookies "your_cookie_string"
```

## 📊 数据存储

爬取的数据默认保存在 `data` 目录下，按平台分类：

```
data/
├── xhs/           # 小红书数据
│   └── json/
│       ├── search_contents_2026-01-24.json    # 内容数据
│       └── search_comments_2026-01-24.json    # 评论数据
├── douyin/        # 抖音数据
│   └── json/
└── bilibili/      # B站数据
    └── json/
```

## ⚙️ 常用参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `--platform` | 目标平台 | xhs, dy, ks, bili, wb |
| `--keywords` | 搜索关键词 | "美食,旅行,摄影" |
| `--login-type` | 登录方式 | qrcode, cookie |
| `--max-notes` | 最大爬取数量 | 20 |
| `--headless` | 无头模式 | 添加此参数不显示浏览器 |

## 🛠️ 配置文件

主要配置文件位于 `config/base_config.py`：

```python
# 基础配置
PLATFORM = "xhs"           # 默认平台
KEYWORDS = "测试"          # 默认关键词
LOGIN_TYPE = "qrcode"      # 默认登录方式
HEADLESS = False           # 是否无头模式
ENABLE_IP_PROXY = False    # 是否使用代理
SAVE_DATA_OPTION = "json"  # 数据保存格式
```

## ⚠️ 注意事项

1. **代理问题**：如果遇到 `socks://` 协议错误，请先清除代理环境变量
2. **浏览器要求**：确保系统已安装Chrome或Edge浏览器
3. **网络环境**：建议在稳定的网络环境下使用
4. **使用限制**：请遵守各平台的使用条款，合理控制爬取频率
5. **数据安全**：爬取的数据仅限学习研究使用，不得用于商业用途

## 📞 故障排除

### 常见错误及解决方案

1. **代理协议错误**
   ```bash
   # 解决方案：清除代理环境变量
   unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
   ```

2. **浏览器启动失败**
   ```bash
   # 安装Playwright浏览器
   playwright install chromium
   ```

3. **登录失败**
   - 确保使用最新版本的浏览器
   - 尝试手动在浏览器中登录目标平台
   - 检查网络连接是否正常

## 📈 数据格式示例

### 小红书内容数据结构
```json
{
  "note_id": "692569a1000000001e0050a4",
  "type": "video",
  "title": "核心",
  "desc": "想知道你的核心够不够稳吗？就用这套动作测试！",
  "video_url": "http://...",
  "time": 1764059553000,
  "user_id": "5d63ebac0000000001018fa1",
  "nickname": "Baike",
  "liked_count": "10万+",
  "collected_count": "9.6万",
  "comment_count": "2243",
  "share_count": "2.9万",
  "tag_list": "核心力量,瑜伽,测试,自律"
}
```

## 🔄 更新日志

- 2026-01-24: 添加快速启动脚本和使用文档
- 支持小红书、抖音二维码登录
- 优化代理配置处理
- 完善错误处理机制