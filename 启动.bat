@echo off
chcp 65001 >nul

:: 党员党务积分助手 - 双击启动
:: Windows: 双击 启动.bat

:: 获取当前目录
cd /d "%~dp0"

echo ===========================================
echo   党员党务积分助手 - 启动脚本
echo ===========================================

:: ========== 步骤0: 创建 .env 文件（全新环境首次启动） ==========
echo.
echo ⚙️  [0/5] 检查环境配置...
if not exist "apps\server\.env" (
    if exist "apps\server\.env.example" (
        copy "apps\server\.env.example" "apps\server\.env" >nul
        echo    ✦ 已从 .env.example 创建 .env 配置文件
    ) else (
        echo    ⚠️  apps\server\.env.example 不存在，请手动创建 .env 文件
    )
) else (
    echo    ✓ 环境配置文件已存在
)

:: ========== 步骤1: 安装根目录依赖 ==========
echo.
echo 📦 [1/5] 检查并安装根目录依赖...
if not exist "node_modules" (
    call npm install
) else (
    echo    ✓ 根目录依赖已存在
)

:: ========== 步骤2: 安装后端依赖 ==========
echo.
echo 📦 [2/5] 检查并安装后端依赖...
cd apps\server
if not exist "node_modules" (
    call npm install
) else (
    echo    ✓ 后端依赖已存在
)

:: ========== 步骤3: 安装前端依赖 ==========
echo.
echo 📦 [3/5] 检查并安装前端依赖...
cd ..\web
if not exist "node_modules" (
    call npm install
) else (
    echo    ✓ 前端依赖已存在
)

:: 检查 rolldown native binding（npm optional dependencies bug 修复）
:: Vite 8 内置 rolldown，npm 安装时可能不会自动下载平台对应的 native binding
if not exist "node_modules\@rolldown\binding-win32-x64-msvc" (
    if not exist "node_modules\@rolldown\binding-win32-arm64-msvc" (
        echo    ⚠️  rolldown native binding 缺失，正在修复...
        if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
            call npm install @rolldown/binding-win32-arm64-msvc --no-save
            echo    ✦ 已安装 @rolldown/binding-win32-arm64-msvc
        ) else (
            call npm install @rolldown/binding-win32-x64-msvc --no-save
            echo    ✦ 已安装 @rolldown/binding-win32-x64-msvc
        )
    )
)
cd ..\..

:: ========== 步骤4: 初始化数据库 ==========
echo.
echo 🗄️  [4/5] 初始化数据库...
cd apps\server

:: 检查数据库文件是否存在
:: 注意：从 apps\server 出发，..\..\ 指向项目根目录
set "DB_FILE=..\..\data\database.sqlite"
if not exist "%DB_FILE%" (
    echo    🌱 首次启动，正在创建数据库...
    if not exist "..\..\data" mkdir "..\..\data"
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
echo 🚀 [5/5] 正在启动党员党务积分助手...
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
