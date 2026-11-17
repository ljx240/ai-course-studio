@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 知境可选 AI 后端 - 仅绑定到本机 127.0.0.1
python -c "import fastapi,uvicorn,pydantic" >nul 2>&1
if errorlevel 1 (
  echo 缺少后端依赖。请先用内网 PyPI 或离线 wheel 安装：
  echo python -m pip install -r api\requirements.txt
  echo.
  pause
  exit /b 1
)
echo 如需启用模型，请按 README 设置 ZJ_LLM_* 环境变量。
start "" "http://127.0.0.1:8000/"
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
pause
