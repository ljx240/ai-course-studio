"""Auditable generation of lesson drafts and revisions to individual blocks."""
from __future__ import annotations

import json
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field, model_validator

from . import provider
from .lesson import Lesson, SCENES, SUBJECT_ENGINES, sample_lesson
from .studio import Identifier, connect, now

router = APIRouter(prefix="/api/generation")
STAGES = [
    ("parse", "解析大纲"),
    ("plan", "教学规划"),
    ("draft", "生成内容"),
    ("templates", "匹配互动模板"),
    ("validate", "校验教材"),
    ("review", "待教师审核"),
]


class GenerationOptions(BaseModel):
    subject: str
    grade: str = Field(min_length=1, max_length=60)
    objectives: list[str] = Field(default_factory=list, max_length=7)
    minutes: int = Field(default=40, ge=10, le=120)
    difficulty: Literal["foundation", "standard", "advanced"] = "standard"
    style: Literal["explore", "classic", "story"] = "explore"
    detail: Literal["brief", "standard", "detailed"] = "standard"
    interactive: bool = True
    engine: str | None = None
    practice: bool = True
    tutor: bool = True
    requirements: str = Field(default="", max_length=2000)
    @model_validator(mode="after")
    def check_engine(self):
        if self.subject not in SUBJECT_ENGINES:
            raise ValueError("学科未注册")
        if self.engine is not None and (self.engine not in SCENES or not self.engine.startswith(self.subject + ".")):
            raise ValueError("请选择当前学科的注册引擎")
        return self


class Generate(GenerationOptions):
    lesson_id: Identifier
    chapter: str = Field(min_length=1, max_length=150)
    current: Lesson | None = None
    block_id: str | None = Field(default=None, min_length=1, max_length=90)

    @model_validator(mode="after")
    def check_selection(self):
        if self.block_id and (
            self.current is None or self.current.subject != self.subject or self.current.id != self.lesson_id
            or not any(block.id == self.block_id for block in self.current.blocks)
        ):
            raise ValueError("请选择当前教材中的有效内容块")
        return self


class Plan(BaseModel):
    objectives: list[str] = Field(min_length=1, max_length=7)
    sequence: list[str] = Field(min_length=3, max_length=25)


class OutlineRequest(BaseModel):
    subject: str
    text: str = Field(min_length=1, max_length=10_000)


class OutlineSuggestion(BaseModel):
    markdown: str = Field(min_length=1, max_length=100_000)


def ask(instructions: str, payload: dict, max_tokens: int, *, profile: provider.Profile | None = None) -> dict:
    return provider.json_object(provider.model_call([
        {"role": "system", "content": instructions},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ], max_tokens=max_tokens, profile=profile))


def read_job(job_id: str) -> dict:
    with connect() as db:
        row = db.execute("SELECT state FROM generation_job WHERE id=?", (job_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "生成任务不存在")
    return json.loads(row["state"])


def save_job(state: dict) -> None:
    with connect() as db:
        db.execute(
            "INSERT INTO generation_job VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET state=excluded.state",
            (state["id"], json.dumps(state, ensure_ascii=False)),
        )


def run(job_id: str, body: Generate) -> None:
    state = read_job(job_id)
    state["status"] = "running"

    def stage(key: str):
        for entry in state["stages"]:
            if entry["status"] == "running":
                entry.update(status="complete", ended_at=now())
            if entry["key"] == key:
                entry.update(status="running", started_at=now())
        save_job(state)

    base = sample_lesson(body.subject)
    options = body.model_dump(exclude={"current", "block_id"})
    try:
        stage("parse")
        profile = provider.require_profile()
        state["model"] = profile.model
        original = next((block for block in body.current.blocks if block.id == body.block_id), None) if body.current else None
        engine = (original.engine if original else body.engine) or SUBJECT_ENGINES[body.subject]
        scene = SCENES[engine]
        contract = {"engine": engine, "template": scene["template"], "parameters": scene["parameters"]}
        base["blocks"] = [block for block in base["blocks"]
                          if block["type"] != "interactive" or (body.interactive and block["engine"] == engine)]
        stage("plan")
        if original:
            plan = {"objectives": body.current.objectives, "sequence": [original.title]}
        else:
            plan = Plan.model_validate(ask(
                "你是中文教材策划。按教学主题、学段与时长规划一节课，返回 JSON 对象，"
                "含 objectives（目标列表）与 sequence（依次安排的至少三个内容块）。",
                options, 1200, profile=profile,
            )).model_dump()
        stage("draft")
        guide = (
            "根据课程规划撰写中文教材。返回 JSON 对象，正文仅使用纯文本与公式字符。"
            "只使用给定的互动引擎、模板及参数范围；不要编造引用、教学结论或学习数据。"
        )
        if original:
            block = ask(guide + "只返回指定教材块，同一块类型，保留原编号。",
                        {"plan": plan, "block": original.model_dump(exclude_none=True),
                         "topic": body.chapter, "options": options, "scene": contract}, 2400, profile=profile)
            block.update(id=original.id, type=original.type)
            current = body.current.model_dump(exclude_none=True)
            current["blocks"] = [block if item["id"] == original.id else item for item in current["blocks"]]
            draft = current
        else:
            draft = ask(
                guide + "按示例 Lesson 结构返回教材。以教学目标开篇，包含概念、例题、小结。"
                "按配置选择练习和互动；练习答案是零基索引，需提供解析。",
                {"plan": plan, "options": options, "scene": contract, "example": base}, 4800, profile=profile,
            )
        stage("templates")
        if not isinstance(draft.get("blocks"), list):
            raise ValueError("缺少教材块")
        for block in draft["blocks"]:
            if not isinstance(block, dict):
                raise ValueError("内容块应为对象")
            if block.get("type") == "interactive":
                registered = block.get("engine")
                if not isinstance(registered, str) or registered not in SCENES or not registered.startswith(body.subject + "."):
                    raise ValueError("使用了未注册的学科引擎或模板")
                if (not original or block["id"] == original.id) and registered != engine:
                    raise ValueError("模型使用了与配置不一致的互动引擎")
                template = SCENES[registered]["template"]
                if block.get("template", template) != template:
                    raise ValueError("使用了未注册的互动模板")
                block["template"] = template
        stage("validate")
        draft.update(id=body.lesson_id, subject=body.subject,
                     grade=body.current.grade if original else body.grade,
                     theme=body.current.theme if original else base["theme"], version="1.0.1-ai-draft",
                     generation_mode="model", generation_job=job_id)
        lesson = Lesson.model_validate(draft)
        kinds = {block.type for block in lesson.blocks}
        if not original and (body.interactive != ("interactive" in kinds) or body.practice != ("assessment" in kinds)):
            raise ValueError("教材互动或练习未符合生成配置")
        if not original and not {"objectives", "concept", "example", "summary"} <= kinds:
            raise ValueError("教材缺少目标、概念、例题或小结")
        if any(block.type == "assessment" and not block.explanation for block in lesson.blocks):
            raise ValueError("练习需要答案解析")
        stage("review")
        state.update(
            status="review",
            lesson=lesson.model_dump(exclude_none=True),
            report={
                "passed": ["Lesson DSL", "学科注册表与参数范围", "练习答案索引"],
                "review": ["核对公式和例题推导", "核对知识事实及引用来源", "确认目标和难度"],
            },
        )
        state["stages"][-1]["status"] = "pending"
        save_job(state)
    except (HTTPException, ValueError) as error:
        active = next(entry for entry in state["stages"] if entry["status"] == "running")
        active.update(status="failed", ended_at=now())
        message = error.detail if isinstance(error, HTTPException) else str(error).split("\n", 1)[0]
        state.update(status="failed", error=message)
        save_job(state)


def initialize_job(job_id: str, lesson_id: str):
    save_job({
        "id": job_id, "mode": "model", "status": "queued", "lesson_id": lesson_id,
        "stages": [{"key": key, "label": label, "status": "waiting"} for key, label in STAGES],
    })


@router.post("/jobs", status_code=202)
def generate(body: Generate, tasks: BackgroundTasks):
    provider.require_profile()
    job_id = str(uuid4())
    initialize_job(job_id, body.lesson_id)
    tasks.add_task(run, job_id, body)
    return {"id": job_id}


@router.get("/jobs/{job_id}")
def job(job_id: Identifier):
    return read_job(job_id)


@router.post("/outline")
def suggest_outline(body: OutlineRequest):
    if body.subject not in SUBJECT_ENGINES:
        raise HTTPException(422, "请选择有效学科")
    try:
        result = ask(
            "你是教材编辑。依据教师给出的主题或草稿整理中文教学大纲，保留已有章节编号。"
            "采用最多六级的 Markdown 标题，每行一个标题。返回 JSON 对象，字段为 markdown。",
            body.model_dump(), 3000,
        )
        return OutlineSuggestion.model_validate(result)
    except ValueError as error:
        raise HTTPException(422, "模型未返回可编辑的大纲文本") from error
