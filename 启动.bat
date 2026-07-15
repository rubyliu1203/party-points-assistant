@echo off
chcp 65001 >nul

:: 党员党务积分助手 - 双击启动
:: Windows: 双击 启动.bat

:: 获取当前目录
cd /d "%~dp0"

echo ===========================================
echo   党员党务积分助手 - 启动脚本
echo ===========================================

:: ========== 步骤1: 安装根目录依赖 ==========
echo.
echo 📦 [1/4] 检查并安装根目录依赖...
if not exist "node_modules" (
    call npm install
) else (
    echo    ✓ 根目录依赖已存在
)

:: ========== 步骤2: 安装后端依赖 ==========
echo.
echo 📦 [2/4] 检查并安装后端依赖...
cd apps\server
if not exist "node_modules" (
    call npm install
) else (
    echo    ✓ 后端依赖已存在
)

:: ========== 步骤3: 安装前端依赖 ==========
echo.
echo 📦 [3/4] 检查并安装前端依赖...
cd ..\web
if not exist "node_modules" (
    call npm install
) else (
    echo    ✓ 前端依赖已存在
)
cd ..\..

:: ========== 步骤4: 初始化数据库 ==========
echo.
echo 🗄️  [4/4] 初始化数据库...
cd apps\server

:: 检查数据库文件是否存在
:: 注意：从 apps\server 出发，..\..\ 指向项目根目录
set "DB_FILE=..\..\data\database.sqlite"
if not exist "%DB_FILE%" (
    echo    🌱 首次启动，正在创建数据库...
    call npx prisma db push --skip-generate
    call npx prisma generate
    call npx tsx src\seed.ts
) else (
    echo    ✓ 数据库已存在
    :: 确保 Prisma Client 已生成
    if not exist "node_modules\.prisma" (
        call npx prisma generate
    )
)

cd ..\..

:: ========== 启动服务 ==========
echo.
echo ===========================================
echo 🚀 正在启动党员党务积分助手...
echo.
echo 📝 后端服务: http://localhost:3001
echo 🌐 前端界面: http://localhost:3000
echo.
echo ⚠️  按 Ctrl+C 停止所有服务
echo ===========================================
echo.

:: 启动前后端
call npx concurrently ^
    --kill-others ^
    --prefix-colors cyan,magenta ^
    --names "后端,前端" ^
    "cd apps\server && npx tsx src\app.ts" ^
    "cd apps\web && npm run dev"

pause
