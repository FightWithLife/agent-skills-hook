#!/bin/bash
# 小红书Cookie配置助手
# 用于帮助用户快速配置小红书Cookie

echo "=== 小红书Cookie配置助手 ==="
echo "请按照以下步骤获取你的Cookie："
echo
echo "1. 打开浏览器，访问 https://www.xiaohongshu.com"
echo "2. 登录你的小红书账户"
echo "3. 按F12打开开发者工具"
echo "4. 点击'Network'(网络)标签"
echo "5. 刷新页面"
echo "6. 任意点击一个请求，找到Headers中的'cookie'字段"
echo "7. 复制'cookie:'后面的全部内容"
echo
read -p "请输入你的Cookie值: " cookie_value

# 更新.env文件
env_file="$HOME/.qoder/skills/Auto-Redbook-Skills/.env"
if [ -f "$env_file" ]; then
    # 替换现有的Cookie值
    sed -i "s|^XHS_COOKIE=.*|XHS_COOKIE=$cookie_value|" "$env_file"
    echo "✓ Cookie已成功更新到配置文件中"
else
    echo "XHS_COOKIE=$cookie_value" > "$env_file"
    echo "✓ Cookie已创建并保存到配置文件中"
fi

echo
echo "✓ 配置完成！你现在可以使用Auto-Redbook-Skills的所有功能了"