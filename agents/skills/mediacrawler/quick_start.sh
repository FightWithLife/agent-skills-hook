#!/bin/bash

# MediaCrawler 快速启动脚本
# 用于便捷地进行各平台二维码登录和数据爬取

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 清除代理环境变量
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy

show_menu() {
    echo "=========================================="
    echo "🤖 MediaCrawler 多平台数据爬虫工具"
    echo "=========================================="
    echo "请选择操作:"
    echo "1) 小红书 - 二维码登录并爬取数据"
    echo "2) 抖音 - 二维码登录并爬取数据"  
    echo "3) 快手 - 二维码登录并爬取数据"
    echo "4) B站 - 二维码登录并爬取数据"
    echo "5) 微博 - 二维码登录并爬取数据"
    echo "6) 查看已爬取数据"
    echo "7) 退出"
    echo "=========================================="
}

get_keywords() {
    read -p "请输入搜索关键词(多个关键词用逗号分隔): " keywords
    if [ -z "$keywords" ]; then
        keywords="测试"
    fi
    echo "$keywords"
}

get_max_notes() {
    read -p "请输入最大爬取数量(默认10): " max_notes
    if [ -z "$max_notes" ]; then
        max_notes=10
    fi
    echo "$max_notes"
}

crawl_xhs() {
    echo "📱 开始小红书爬取..."
    keywords=$(get_keywords)
    max_notes=$(get_max_notes)
    python3 scripts/run_crawl.py --platform xhs --keywords "$keywords" --login-type qrcode --max-notes "$max_notes"
}

crawl_dy() {
    echo "🎵 开始抖音爬取..."
    keywords=$(get_keywords)
    max_notes=$(get_max_notes)
    python3 scripts/run_crawl.py --platform dy --keywords "$keywords" --login-type qrcode --max-notes "$max_notes"
}

crawl_ks() {
    echo "快手爬取功能待实现..."
    echo "暂未完全支持快手平台的二维码登录"
}

crawl_bili() {
    echo "📺 开始B站爬取..."
    keywords=$(get_keywords)
    max_notes=$(get_max_notes)
    python3 scripts/run_crawl.py --platform bili --keywords "$keywords" --login-type qrcode --max-notes "$max_notes"
}

crawl_wb() {
    echo ".weibo爬取功能待实现..."
    echo "暂未完全支持微博平台的二维码登录"
}

view_data() {
    echo "📂 已爬取数据概览:"
    echo "----------------------------------------"
    
    if [ -d "data/xhs/json" ]; then
        echo "小红书数据:"
        ls -lh data/xhs/json/*.json 2>/dev/null || echo "  无数据文件"
        echo ""
    fi
    
    if [ -d "data/douyin/json" ]; then
        echo "抖音数据:"
        ls -lh data/douyin/json/*.json 2>/dev/null || echo "  无数据文件"
        echo ""
    fi
    
    if [ -d "data" ]; then
        echo "所有数据文件统计:"
        find data -name "*.json" -exec wc -l {} \; | sort -n
    fi
}

# 主循环
while true; do
    show_menu
    read -p "请输入选项编号: " choice
    
    case $choice in
        1)
            crawl_xhs
            ;;
        2)
            crawl_dy
            ;;
        3)
            crawl_ks
            ;;
        4)
            crawl_bili
            ;;
        5)
            crawl_wb
            ;;
        6)
            view_data
            ;;
        7)
            echo "👋 再见！"
            exit 0
            ;;
        *)
            echo "❌ 无效选项，请重新选择"
            ;;
    esac
    
    echo ""
    read -p "按回车键继续..."
done