@echo off
chcp 65001 >nul
echo ========================================
echo    会员管理系统 - Vercel 自动部署
echo ========================================
echo.

echo [步骤 1/5] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Node.js
    echo.
    echo 请先安装 Node.js:
    echo 1. 访问 https://nodejs.org
    echo 2. 下载并安装 LTS 版本
    echo 3. 重新运行此脚本
    echo.
    pause
    exit /b 1
)
echo ✅ Node.js 已安装
echo.

echo [步骤 2/5] 检查文件...
if not exist "package.json" (
    echo ❌ 错误: 找不到 package.json
    echo.
    echo 请确保:
    echo 1. 已解压 member-system-deploy.tar.gz
    echo 2. 本脚本在 member-system 文件夹内
    echo.
    pause
    exit /b 1
)
echo ✅ 文件检查通过
echo.

echo [步骤 3/5] 安装 Vercel CLI...
echo 这可能需要几分钟，请耐心等待...
call npm install -g vercel
if errorlevel 1 (
    echo ❌ Vercel CLI 安装失败
    pause
    exit /b 1
)
echo ✅ Vercel CLI 安装完成
echo.

echo [步骤 4/5] 登录 Vercel...
echo 浏览器会自动打开，请完成登录...
echo.
call vercel login
if errorlevel 1 (
    echo ❌ 登录失败
    pause
    exit /b 1
)
echo ✅ 登录成功
echo.

echo [步骤 5/5] 开始部署...
echo 请按照提示操作（通常直接按回车即可）
echo.
call vercel --prod
if errorlevel 1 (
    echo ❌ 部署失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo    ✅ 部署成功！
echo ========================================
echo.
echo 请查看上方输出的网址，例如:
echo https://member-system-xxxxx.vercel.app
echo.
echo 按任意键退出...
pause >nul
