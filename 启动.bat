@echo off
chcp 65001 >nul

:: 党员党务积分助手 - 一键启动 (Windows)
:: 双击此文件即可启动前后端服务

:: 获取当前目录
cd /d "%~dp0"

:: 检查依赖
if not exist "node_modules" (
    echo 📦 首次启动，正在安装依赖...
    npm install
)

echo.
echo 🚀 启动党员党务积分助手...
echo.
echo 📝 后端服务: http://localhost:3001
echo 🌐 前端界面: http://localhost:3000
echo.
echo ⚠️  按 Ctrl+C 停止所有服务
echo ===========================================
echo.

:: 启动前后端
npx concurrently ^
    --kill-others ^
    --prefix-colors cyan,magenta ^
    --names "后端,前端" ^
    "cd apps/server && npx tsx src/app.ts" ^
    "cd apps/web && npm run dev"

pause
