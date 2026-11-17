#!/usr/bin/env bash
set -eu

cd -- "$(dirname -- "$0")"

if ! command -v uv >/dev/null 2>&1; then
  printf '%s\n' '请先按 README 安装 uv，并将它加入 PATH。' >&2
  exit 1
fi

if ! npm run build; then
  printf '%s\n' '前端构建失败。请确认 Node.js 版本符合要求，并按 README 安装前端依赖。' >&2
  exit 1
fi

printf '%s\n' '在浏览器打开 http://127.0.0.1:8000/studio/'
exec uv run --locked python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
