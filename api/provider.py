"""OpenAI-compatible transport and local provider settings."""
from __future__ import annotations

from contextlib import closing
from dataclasses import dataclass, field
import json
import os
from pathlib import Path
import re
import sqlite3
from typing import Annotated
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import APIRouter, Depends, HTTPException, Request as APIRequest, Response
from pydantic import BaseModel, Field, SecretStr, StringConstraints

from . import studio

LOOPBACK = {"localhost", "127.0.0.1", "::1"}
SETTINGS_ROUTE = "/api/settings/ai-provider"


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip().startswith("ZJ_LLM_"):
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(Path(__file__).resolve().parent / ".env")


@dataclass(frozen=True)
class Profile:
    base_url: str = ""
    model: str = ""
    timeout: int = 90
    use_api_key: bool = True
    api_key: str = field(default="", repr=False)
    source: str = "unset"

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.model and (self.api_key or not self.use_api_key))

    def public(self) -> dict:
        return {
            "base_url": self.base_url, "model": self.model, "timeout": self.timeout,
            "use_api_key": self.use_api_key, "has_api_key": bool(self.api_key),
            "configured": self.configured, "source": self.source,
        }


class Settings(BaseModel):
    base_url: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2048)]
    model: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    timeout: int = Field(default=90, ge=1, le=600)
    use_api_key: bool = True
    api_key: SecretStr | None = None


def environment_profile() -> Profile:
    base_url = os.getenv("ZJ_LLM_BASE_URL", "").strip().rstrip("/")
    model = os.getenv("ZJ_LLM_MODEL", "").strip()
    key = os.getenv("ZJ_LLM_API_KEY", "").strip()
    if not (base_url or model or key):
        return Profile()
    return Profile(base_url, model, int(os.getenv("ZJ_LLM_TIMEOUT", "90")), True, key, "environment")


def settings_db() -> Path:
    return studio.DB.with_suffix(".ai-provider.sqlite3")


def create_table(db: sqlite3.Connection):
    db.execute("""
        CREATE TABLE IF NOT EXISTS provider (
            id INTEGER PRIMARY KEY CHECK(id=1),
            base_url TEXT NOT NULL,
            model TEXT NOT NULL,
            timeout INTEGER NOT NULL,
            use_api_key INTEGER NOT NULL,
            api_key TEXT NOT NULL
        )
    """)


def read_saved(db: sqlite3.Connection):
    db.row_factory = sqlite3.Row
    return db.execute("SELECT * FROM provider WHERE id=1").fetchone()


def resolve_saved(row) -> Profile:
    if row is None:
        return environment_profile()
    key = row["api_key"]
    if row["use_api_key"] and not key:
        environment = environment_profile()
        if row["base_url"] == environment.base_url:
            key = environment.api_key
    return Profile(row["base_url"], row["model"], row["timeout"], bool(row["use_api_key"]), key, "settings")


def current() -> Profile:
    path = settings_db()
    if not path.is_file():
        return environment_profile()
    with closing(sqlite3.connect(path)) as db:
        create_table(db)
        return resolve_saved(read_saved(db))


def configured() -> bool:
    return current().configured


def require_profile() -> Profile:
    profile = current()
    if not profile.configured:
        raise HTTPException(503, "请先在 AI 服务设置中配置模型")
    return profile


def validate_base_url(value: str) -> str:
    address = value.rstrip("/")
    try:
        endpoint = urlsplit(address)
        port = endpoint.port
        if (not endpoint.hostname or endpoint.username is not None or endpoint.password is not None
                or "?" in address or "#" in address or "\\" in address
                or any(char.isspace() or ord(char) < 32 for char in address)
                or port == 0
                or (endpoint.scheme != "https" and not (endpoint.scheme == "http" and endpoint.hostname in LOOPBACK))):
            raise ValueError
    except ValueError:
        raise HTTPException(422, "服务地址须为 HTTPS 或本机 HTTP，地址中不能包含账号、密码或查询参数") from None
    return address


def resolve_input(body: Settings, previous: Profile) -> Profile:
    base_url = validate_base_url(body.base_url)
    key = body.api_key.get_secret_value().strip() if body.api_key else ""
    if body.use_api_key and not key and previous.base_url == base_url:
        key = previous.api_key
    if not body.use_api_key:
        key = ""
    elif not key:
        raise HTTPException(422, "请输入此服务地址的 API 密钥，或选择无认证")
    if len(key) > 4096 or any(not 33 <= ord(char) <= 126 for char in key):
        raise HTTPException(422, "API 密钥格式无效")
    return Profile(base_url, body.model, body.timeout, body.use_api_key, key, "settings")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def model_call(messages: list[dict[str, str]], max_tokens: int = 3200, *, profile: Profile | None = None) -> str:
    profile = profile or require_profile()
    base_url = validate_base_url(profile.base_url)
    url = base_url if base_url.endswith("/chat/completions") else base_url + "/chat/completions"
    limit = "max_completion_tokens" if urlsplit(base_url).hostname == "api.openai.com" else "max_tokens"
    body = {"model": profile.model, "stream": False, limit: max_tokens, "messages": messages}
    headers = {"Content-Type": "application/json"}
    if profile.api_key:
        headers["Authorization"] = f"Bearer {profile.api_key}"
    request = Request(url, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), headers=headers, method="POST")
    try:
        with build_opener(NoRedirect()).open(request, timeout=profile.timeout) as response:
            raw = response.read(3_000_001)
        if len(raw) > 3_000_000:
            raise ValueError("响应超出大小限制")
        content = json.loads(raw)["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            raise ValueError("响应缺少 message.content")
        return content
    except HTTPError as error:
        raise HTTPException(502, f"模型服务返回 HTTP {error.code}") from error
    except OSError as error:
        raise HTTPException(502, "模型服务连接失败或超时") from error
    except (ValueError, TypeError, KeyError, IndexError) as error:
        raise HTTPException(502, "模型服务响应格式无效") from error


def local_settings(request: APIRequest, response: Response):
    origin = request.headers.get("origin")
    if (not request.client or request.client.host not in LOOPBACK or request.url.hostname not in LOOPBACK
            or (origin and origin != str(request.base_url).rstrip("/"))):
        raise HTTPException(403, "请从本机知境页面打开 AI 服务设置")
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix=SETTINGS_ROUTE, dependencies=[Depends(local_settings)])


@router.get("")
def get_settings():
    return current().public()


@router.post("")
def save_settings(body: Settings):
    path = settings_db()
    path.parent.mkdir(parents=True, exist_ok=True)
    os.close(os.open(path, os.O_CREAT | os.O_WRONLY, 0o600))
    with closing(sqlite3.connect(path)) as db, db:
        create_table(db)
        db.execute("BEGIN IMMEDIATE")
        saved = read_saved(db)
        previous = resolve_saved(saved)
        profile = resolve_input(body, previous)
        # Preserve an inherited environment credential in its original location.
        supplied = bool(body.api_key and body.api_key.get_secret_value().strip())
        if not profile.use_api_key:
            key = ""
        elif supplied:
            key = profile.api_key
        elif saved and saved["base_url"] == profile.base_url:
            key = saved["api_key"]
        else:
            key = ""
        db.execute("""
            INSERT INTO provider VALUES (1, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET base_url=excluded.base_url, model=excluded.model,
            timeout=excluded.timeout, use_api_key=excluded.use_api_key, api_key=excluded.api_key
        """, (profile.base_url, profile.model, profile.timeout, int(profile.use_api_key), key))
    return profile.public()


@router.post("/test")
def test_settings(body: Settings):
    profile = resolve_input(body, current())
    model_call([{"role": "user", "content": "Reply with OK."}], max_tokens=128, profile=profile)
    return {"ok": True, "model": profile.model}


def json_object(content: str) -> dict:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    result = json.loads(cleaned)
    if not isinstance(result, dict):
        raise ValueError("模型应返回 JSON 对象")
    return result
