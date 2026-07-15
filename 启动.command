#!/bin/bash

# 党员党务积分助手 - 双击启动
# Mac: 双击 启动.command

# 获取当前目录
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
cd "$SCRIPT_DIR"

echo "==========================================="
echo "  党员党务积分助手 - 启动脚本"
echo "==========================================="

# ========== 步骤1: 安装根目录依赖 ==========
echo ""
echo "📦 [1/4] 检查并安装根目录依赖..."
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "   ✓ 根目录依赖已存在"
fi

# ========== 步骤2: 安装后端依赖 ==========
echo ""
echo "📦 [2/4] 检查并安装后端依赖..."
cd apps/server
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "   ✓ 后端依赖已存在"
fi

# ========== 步骤3: 安装前端依赖 ==========
echo ""
echo "📦 [3/4] 检查并安装前端依赖..."
cd ../web
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "   ✓ 前端依赖已存在"
fi
cd ../..

# ========== 步骤4: 初始化数据库 ==========
echo ""
echo "🗄️  [4/4] 初始化数据库..."
cd apps/server

# 检查数据库文件是否存在
# 注意：从 apps/server 出发，../../ 指向项目根目录
DB_FILE="../../data/database.sqlite"
if [ ! -f "$DB_FILE" ]; then
    echo "   🌱 首次启动，正在创建数据库..."
    npx prisma db push --skip-generate
    npx prisma generate
    npx tsx src/seed.ts
else
    echo "   ✓ 数据库已存在"
    # 确保 Prisma Client 已生成
    if [ ! -d "node_modules/.prisma" ]; then
        npx prisma generate
    fi
fi

cd ../..

# ========== 启动服务 ==========
echo ""
echo "==========================================="
echo "🚀 正在启动党员党务积分助手..."
echo ""
echo "📝 后端服务: http://localhost:3001"
echo "🌐 前端界面: http://localhost:3000"
echo ""
echo "⚠️  按 Ctrl+C 停止所有服务"
echo "==========================================="
echo ""

# 启动前后端
npx concurrently \
    --kill-others \
    --prefix-colors cyan,magenta \
    --names "后端,前端" \
    "cd apps/server && npx tsx src/app.ts" \
    "cd apps/web && npm run dev"
