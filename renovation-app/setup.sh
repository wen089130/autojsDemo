#!/usr/bin/env bash
# AI 装修效果图 - 傻瓜配置向导
# 用法：在 renovation-app 目录下运行  bash setup.sh
# 它会一步步问你，答完自动写好配置并重启，无需手动改文件。

cd "$(dirname "$0")" || exit 1

echo "========================================"
echo "   AI 装修效果图 · 配置向导"
echo "========================================"
echo ""
echo "第一步：选择出图服务商"
echo "  1) 腾讯云（混元/AI绘画，密钥是 AKID 开头）"
echo "  2) OpenAI 或某个中转/便宜API网站（密钥是 sk- 开头）"
echo ""
read -rp "请输入 1 或 2 然后回车: " CHOICE
echo ""

if [ "$CHOICE" = "2" ]; then
  PROVIDER=openai
  read -rp "粘贴你的 API Key（sk- 开头）后回车: " OPENAI_API_KEY
  read -rp "粘贴接口地址 base url（如 https://xxx.com/v1，不确定就问发你key的网站）后回车: " OPENAI_BASE_URL
  read -rp "图像模型名（不知道就直接回车，默认 gpt-image-1）: " OPENAI_IMAGE_MODEL
  OPENAI_IMAGE_MODEL=${OPENAI_IMAGE_MODEL:-gpt-image-1}
else
  PROVIDER=tencent
  read -rp "粘贴腾讯云 SecretId（AKID 开头）后回车: " TENCENT_SECRET_ID
  read -rp "粘贴腾讯云 SecretKey 后回车: " TENCENT_SECRET_KEY
  read -rp "地域（不知道就直接回车，默认 ap-guangzhou）: " TENCENT_REGION
  TENCENT_REGION=${TENCENT_REGION:-ap-guangzhou}
fi

echo ""
echo "第二步：品牌信息（直接回车用默认，以后可再改）"
read -rp "你的品牌名（如 长沙悦家装修）: " BRAND_NAME
BRAND_NAME=${BRAND_NAME:-AI装修效果图}
read -rp "你的微信号: " WX

# 自动生成一个安全的查看口令
ADMIN_TOKEN=$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 20)

# 写入 .env
{
  echo "PROVIDER=$PROVIDER"
  if [ "$PROVIDER" = "openai" ]; then
    echo "OPENAI_API_KEY=$OPENAI_API_KEY"
    echo "OPENAI_BASE_URL=$OPENAI_BASE_URL"
    echo "OPENAI_IMAGE_MODEL=$OPENAI_IMAGE_MODEL"
  else
    echo "TENCENT_SECRET_ID=$TENCENT_SECRET_ID"
    echo "TENCENT_SECRET_KEY=$TENCENT_SECRET_KEY"
    echo "TENCENT_REGION=$TENCENT_REGION"
  fi
  echo "BRAND_NAME=$BRAND_NAME"
  echo "BRAND_CONTACT=加微信 ${WX:-（请填微信号）} 获取免费装修方案报价"
  echo "ADMIN_TOKEN=$ADMIN_TOKEN"
  echo "PORT=3000"
} > .env

echo ""
echo "✅ 配置已保存"
echo ""

# 重启服务
pkill -f "node server.js" 2>/dev/null
sleep 1
nohup node server.js > app.log 2>&1 &
sleep 2

echo "========================================"
echo "服务启动日志："
echo "----------------------------------------"
cat app.log
echo "----------------------------------------"
echo ""
echo "📋 查看客户线索的网址（请收藏，口令已自动生成）："
echo "   https://aipms.site/api/leads?token=$ADMIN_TOKEN"
echo ""
if grep -q "演示模式" app.log; then
  echo "⚠️  仍是【演示模式】= 密钥没配对，生成的图不会变。"
  echo "    请确认密钥正确、对应服务已开通，然后重新运行：bash setup.sh"
else
  echo "🎉 已进入【真出图模式】！去 https://aipms.site 上传一张室内照片试试。"
fi
echo ""
