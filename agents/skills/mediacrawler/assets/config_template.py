# base_config.py template for MediaCrawler

# Platform settings
PLATFORM = "xhs" # xhs, dy, ks, bili, wb, tieba, zhihu
KEYWORDS = "富士相机"
LOGIN_TYPE = "qrcode" # qrcode, phone, cookie
COOKIES = ""

# Browser settings
HEADLESS = True
SAVE_LOGIN_STATE = True
USER_DATA_DIR = "./browser_data"

# Crawler settings
CRAWLER_MAX_NOTES_COUNT = 10
MAX_CONCURRENCY_NUM = 5

# Storage settings
SAVE_DATA_OPTION = "json" # json, csv, db, sqlite, excel
