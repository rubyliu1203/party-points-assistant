#!/bin/bash

# 党员党务积分助手 - 一键启动脚本
# 使用方式: ./start.sh

echo "🚀 正在启动党员党务积分助手..."
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查并安装 concurrently（如果未安装）
if ! npm list concurrently >/dev/null 2>&1; then
    echo "📦 首次启动，正在安装依赖..."
    npm install
    echo ""
fi

# 启动前后端
echo "📝 后端服务: http://localhost:3001"
echo "🌐 前端界面: http://localhost:3000"
echo ""
echo "⚠️  提示: 按 Ctrl+C 可停止所有服务"
echo "========================================"
echo ""

npx concurrently \
    --kill-others \
    --prefix-colors cyan,magenta \
    --names "后端,前端" \
    "cd apps/server && npx tsx src/app.ts" \
    "cd apps/web && npm run dev"

echo ""
echo "👋 党员党务积分助手已停止"
