"""Lesson DSL and the trusted subject engine registry."""
import json
import re
from pathlib import Path
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

CONTENT = Path(__file__).resolve().parents[1] / "content"
SCENES = json.loads((CONTENT / "schemas" / "scenes.json").read_text(encoding="utf-8"))

SUBJECT_ENGINES = {
    "math": "math.quadratic",
    "physics": "physics.projectile2d",
    "chemistry": "chemistry.molecule",
    "english": "english.dialogue",
    "chinese": "chinese.poetry",
    "history": "history.timeline",
    "politics": "politics.flow",
}
BLOCK_TYPES = {"objectives", "concept", "formula", "interactive", "example", "assessment", "summary", "diagram", "note"}


def sample_lesson(subject: str) -> dict:
    if subject not in SUBJECT_ENGINES:
        raise HTTPException(404, "教材不存在")
    return bundled_lesson(subject)


def bundled_lesson(lesson_id: str) -> dict:
    if not re.fullmatch(r"[a-z0-9-]+", lesson_id):
        raise HTTPException(404, "教材不存在")
    path = CONTENT / "lessons" / f"{lesson_id}.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise HTTPException(404, "教材不存在") from error


class FormulaSymbol(BaseModel):
    symbol: str = Field(min_length=1, max_length=100)
    meaning: str = Field(min_length=1, max_length=200)
    unit: str = Field(min_length=1, max_length=100)


class WorkedStep(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    body: str = Field(min_length=1, max_length=800)
    formula: str | None = None


class Block(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    id: str = Field(min_length=1, max_length=90)
    type: str
    title: str = Field(min_length=1, max_length=150)
    body: str | None = Field(default=None, max_length=5000)
    formula: str | None = None
    symbols: list[FormulaSymbol] | None = Field(default=None, max_length=18)
    steps: list[WorkedStep] | None = Field(default=None, max_length=10)
    engine: str | None = None
    template: str | None = None
    params: dict[str, float] | None = None
    question: str | None = None
    options: list[str] | None = None
    answer: int | None = None
    explanation: str | None = None
    knowledge_points: list[str] | None = Field(default=None, max_length=12)

    @model_validator(mode="after")
    def safe_block(self):
        if self.type not in BLOCK_TYPES:
            raise ValueError(f"非法教材块类型: {self.type}")
        if self.type == "interactive" and not self.engine:
            raise ValueError("互动块必须提供 engine")
        if self.type == "assessment":
            if not self.question or not self.options or self.answer is None:
                raise ValueError("选择题缺少题目、选项或答案")
            if not 0 <= self.answer < len(self.options):
                raise ValueError("正确答案超出选项范围")
        return self


class Lesson(BaseModel):
    id: str
    version: str = "1.0.0-draft"
    title: str = Field(min_length=1, max_length=150)
    number: str = "1.1"
    subject: str
    grade: str = "初中"
    chapter: str = ""
    theme: str = ""
    objectives: list[str] = Field(min_length=1, max_length=7)
    blocks: list[Block] = Field(min_length=3, max_length=25)
    generation_mode: Literal["template", "model"] | None = None
    generation_job: str | None = None

    @model_validator(mode="after")
    def check_engine_registration(self):
        if self.subject not in SUBJECT_ENGINES:
            raise ValueError("学科未注册")
        if len({block.id for block in self.blocks}) != len(self.blocks):
            raise ValueError("内容块编号重复")
        for block in self.blocks:
            if block.type != "interactive":
                continue
            if block.engine not in SCENES or not block.engine.startswith(self.subject + "."):
                raise ValueError("使用了未在该学科注册的交互引擎")
            scene = SCENES[block.engine]
            if block.template is not None and block.template != scene["template"]:
                raise ValueError("互动模板未在引擎注册")
            for name, value in (block.params or {}).items():
                parameter = scene["parameters"].get(name)
                if not parameter or not parameter["min"] <= value <= parameter["max"]:
                    raise ValueError("互动参数超出引擎约定")
        return self

