@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo 知境 AI 教材与互动教学平台 - 离线原型
echo ========================================
echo.
echo 即将通过默认浏览器打开前端演示页面。
echo 无需 npm 安装、无需联网、无需 API Key。
echo 如需真实 AI，请参阅 README.md 的后端配置说明。
echo.
start "" "%~dp0web\index.html"
