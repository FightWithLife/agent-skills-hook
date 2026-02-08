#!/usr/bin/env python3
"""
MediaCrawler Skill 包装脚本
使用skill内置的完整MediaCrawler代码库
"""

import sys
import os
import asyncio
from pathlib import Path

# 添加skill根目录到Python路径
skill_root = Path(__file__).parent.parent
sys.path.insert(0, str(skill_root))

# 导入配置和爬虫
import config
from media_platform.xhs import XiaoHongShuCrawler
from media_platform.douyin import DouYinCrawler
from media_platform.kuaishou import KuaishouCrawler
from media_platform.bilibili import BilibiliCrawler
from media_platform.weibo import WeiboCrawler


async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='MediaCrawler Skill - 多平台媒体爬虫')
    parser.add_argument('--platform', type=str, required=True, 
                       choices=['xhs', 'dy', 'ks', 'bili', 'wb'], 
                       help='目标平台 (xhs=小红书, dy=抖音, ks=快手, bili=B站, wb=微博)')
    parser.add_argument('--keywords', type=str, required=True,
                       help='搜索关键词，多个用逗号分隔')
    parser.add_argument('--login-type', type=str, default='qrcode',
                       choices=['qrcode', 'cookie', 'phone'],
                       help='登录方式')
    parser.add_argument('--cookies', type=str, default='',
                       help='Cookie字符串 (用于cookie登录)')
    parser.add_argument('--headless', action='store_true',
                       help='无头模式运行')
    parser.add_argument('--max-notes', type=int, default=20,
                       help='最大爬取笔记/视频数量')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🤖 MediaCrawler Skill - 多平台媒体数据爬虫")
    print("=" * 60)
    print(f"📍 平台: {args.platform.upper()}")
    print(f"🔍 关键词: {args.keywords}")
    print(f"🔐 登录方式: {args.login_type}")
    print(f"🖥️  浏览器模式: {'无头' if args.headless else '有头'}")
    print(f"📊 最大爬取数: {args.max_notes}")
    print("=" * 60)
    
    # 动态更新配置
    config.PLATFORM = args.platform
    config.KEYWORDS = args.keywords
    config.LOGIN_TYPE = args.login_type
    if args.cookies:
        config.COOKIES = args.cookies
    config.HEADLESS = args.headless
    config.CRAWLER_MAX_NOTES_COUNT = args.max_notes
    
    # 创建爬虫实例
    crawler_map = {
        'xhs': XiaoHongShuCrawler,
        'dy': DouYinCrawler,
        'ks': KuaishouCrawler,
        'bili': BilibiliCrawler,
        'wb': WeiboCrawler
    }
    
    crawler_class = crawler_map.get(args.platform)
    if not crawler_class:
        print(f"❌ 不支持的平台: {args.platform}")
        return 1
    
    try:
        crawler = crawler_class()
        print(f"\n🚀 开始爬取 {args.platform.upper()} 平台内容...")
        await crawler.start()
        print("\n✅ 爬取任务完成！")
        return 0
    except KeyboardInterrupt:
        print("\n\n⚠️ 用户中断操作")
        return 130
    except Exception as e:
        print(f"\n❌ 爬取过程中出现错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
