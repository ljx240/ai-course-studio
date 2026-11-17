@echo off
chcp 65001 >nul
cd /d "%~dp0"
where uv >nul 2>&1
if errorlevel 1 (
  echo 请先按 README 安装 uv，并将它加入 PATH。
  exit /b 1
)
call npm run build
if errorlevel 1 (
  echo 构建失败。请确认已安装 Node.js 并执行 npm ci。
  exit /b 1
)
echo 在浏览器打开 http://127.0.0.1:8000/studio/
uv run --locked python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
