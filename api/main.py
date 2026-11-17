"""知境单机教材服务。"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError

from .book_queue import lifespan, router as book_router
from .generation import router as generation_router
from .lesson import Lesson, SUBJECT_ENGINES, bundled_lesson, sample_lesson
from . import provider
from .studio import router as studio_router
from .tutor import router as tutor_router

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
STUDIO = ROOT / "apps" / "studio" / "dist"


class GenerateRequest(BaseModel):
    subject: str
    lesson_id: str
    chapter: str = Field(min_length=1, max_length=250)
    grade: str = "初中"
    style: Literal["explore", "classic", "story"] = "explore"
    requirements: str = Field(default="内容严谨，公式准确", max_length=2000)


class ChatRequest(BaseModel):
    subject: str
    lesson_id: str
    question: str = Field(min_length=1, max_length=2000)
    scene_state: dict[str, float] = Field(default_factory=dict)
    current: Lesson | None = None


class ParseRequest(BaseModel):
    content: str = Field(min_length=1, max_length=100_000)


app = FastAPI(title="知境 AI 教材接口", version="0.2.0", docs_url="/api/docs", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validate_request(request: Request, exc: RequestValidationError):
    if request.url.path in {provider.SETTINGS_ROUTE, provider.SETTINGS_ROUTE + "/test"}:
        return JSONResponse(status_code=422, content={"detail": "请检查服务地址、模型 ID 和请求超时"})
    return await request_validation_exception_handler(request, exc)


def parse_outline(text: str) -> list[dict[str, Any]]:
    roots: list[dict[str, Any]] = []
    stack: list[dict[str, Any]] = []
    for index, raw in enumerate(text.splitlines()):
        if not raw.strip():
            continue
        match = re.match(r"^(#{1,6})\s+(.+)", raw)
        level = len(match.group(1)) if match else min(6, (len(raw) - len(raw.lstrip())) // 2 + 1)
        title = (match.group(2) if match else raw.strip()).strip()
        if not title:
            continue
        node: dict[str, Any] = {"id": f"node-{index}", "title": title, "level": level, "children": []}
        while stack and stack[-1]["level"] >= level:
            stack.pop()
        if stack:
            stack[-1]["children"].append(node)
        else:
            roots.append(node)
        stack.append(node)
    return roots


@app.get("/api/health")
def health():
    configured = provider.configured()
    return {"ok": True, "version": "0.2.0", "model_configured": configured, "mode": "model" if configured else "demo"}


@app.get("/api/curricula")
def curricula():
    path = ROOT / "content" / "curricula" / "demo-syllabus.json"
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/lessons/{lesson_id}")
def get_lesson(lesson_id: str):
    return bundled_lesson(lesson_id)


@app.post("/api/outline/parse")
def parse_outline_api(body: ParseRequest):
    return {"nodes": parse_outline(body.content)}


@app.post("/api/generate")
def generate(body: GenerateRequest):
    if body.subject not in SUBJECT_ENGINES:
        raise HTTPException(400, "未知学科")
    base = sample_lesson(body.subject)
    allowed_engine = SUBJECT_ENGINES[body.subject]
    prompt = (
        "你是一位审慎、经验丰富的中文教材编写者。请根据教学主题创建符合结构化 DSL 的数字教材草稿。"
        "只允许JSON对象，不要Markdown围栏，不要JS/HTML代码、外部URL或脚本。"
        "必须具有title/number/id/subject/grade/chapter/objectives/blocks等字段。"
        "仅允许block.type：objectives,concept,formula,interactive,example,assessment,summary,diagram,note。"
        f"互动模块的 engine 必须为 {allowed_engine}，并沿用给定示例中的 template 与 params。"
        "至少3个块，包含概念、互动块和练习。选择题必须包含question/options/answer(零基索引)/explanation。"
        "数学/科学公式应正确；不得编造教材来源、历史证据或法规事实。教学大纲未提供的事实应标记需教师核对。"
    )
    task = {"subject": body.subject, "lesson_id": body.lesson_id, "topic": body.chapter, "grade": body.grade, "style": body.style, "requirements": body.requirements, "example_structure": base}
    raw = provider.model_call([{"role": "system", "content": prompt}, {"role": "user", "content": json.dumps(task, ensure_ascii=False)}], max_tokens=4000)
    try:
        result = provider.json_object(raw)
        result["subject"] = body.subject
        result["id"] = body.subject
        result["version"] = "1.0.1-ai-draft"
        result["generation_mode"] = "model"
        result["theme"] = base.get("theme", "")
        item = Lesson.model_validate(result)
    except (ValueError, json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(422, f"模型返回教材未通过结构校验：{str(exc)[:500]}") from exc
    return {"mode": "model", "lesson": item.model_dump(exclude_none=True), "review_required": True}


@app.post("/api/chat")
def chat(body: ChatRequest):
    if body.subject not in SUBJECT_ENGINES:
        raise HTTPException(400, "未知学科")
    if body.current and (body.current.id != body.lesson_id or body.current.subject != body.subject):
        raise HTTPException(422, "提问与当前教材不匹配")
    material = body.current.model_dump(exclude_none=True) if body.current else sample_lesson(body.subject)
    # 不传任何学员身份或隐私信息给模型；这里只传当前课程和必要的互动状态。
    prompt = (
        "你是耐心且专业的学科辅导教师。严格依据已知课程与可靠学科知识回答。"
        "先引导思考，再给出解释。对于公式和单位保证正确。"
        "若问题超出教材或无法确定，请明确表达不确定性。"
        "不得输出脚本代码给浏览器执行；你只能提供文字解释。"
    )
    task = {"lesson": {k: material[k] for k in ("title", "subject", "objectives", "blocks")}, "question": body.question, "scene_state": body.scene_state}
    answer = provider.model_call([{"role": "system", "content": prompt}, {"role": "user", "content": json.dumps(task, ensure_ascii=False)}], max_tokens=1100)
    return {"mode": "model", "answer": answer}


app.include_router(studio_router)
app.include_router(provider.router)
app.include_router(generation_router)
app.include_router(book_router)
app.include_router(tutor_router)

# 优先匹配 React 入口，根路径保留可离线打开的 V0.2 界面。
if STUDIO.is_dir():
    app.mount("/studio", StaticFiles(directory=STUDIO, html=True), name="studio")

# /api/* 必须先注册，才不会被根路径静态路由遮盖。
app.mount("/", StaticFiles(directory=WEB, html=True), name="frontend")
