# base_config.py for camera price crawling

# Platform settings
PLATFORM = "xhs"  # 小红书平台
KEYWORDS = "万元以下相机推荐 5000元相机 8000元相机 相机性价比"
LOGIN_TYPE = "qrcode"  # 使用二维码登录
COOKIES = ""

# Browser settings
HEADLESS = False  # 显示浏览器界面以便扫码
SAVE_LOGIN_STATE = True
USER_DATA_DIR = "./browser_data"

# Crawler settings
CRAWLER_MAX_NOTES_COUNT = 50  # 增加爬取数量以获取更多数据
MAX_CONCURRENCY_NUM = 3

# Storage settings
SAVE_DATA_OPTION = "json"  # 保存为JSON格式便于后续处理

# Price range filter
PRICE_RANGE = {
    "min": 0,
    "max": 10000  # 万元以下
}

# Camera brands to focus on
CAMERA_BRANDS = ["索尼", "佳能", "尼康", "富士", "松下", "奥林巴斯"]