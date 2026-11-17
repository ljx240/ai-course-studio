"""Contextual tutoring with an explicit allowlist of lesson and scene actions."""
from __future__ import annotations

import json
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, TypeAdapter

from . import provider
from .lesson import Lesson, SCENES, SUBJECT_ENGINES, bundled_lesson
from .studio import Identifier, connect

router = APIRouter(prefix="/api/studio")
BlockID = Annotated[str, Field(min_length=1, max_length=90)]
Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
Answer = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
MAX_ACTIONS = 4


class SceneState(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")
    parameters: dict[str, float] = Field(default_factory=dict, max_length=12)
    time: float = Field(default=0, ge=0, le=300)
    playing: bool = False


class TutorTurn(BaseModel):
    question: Question
    answer: Answer


class TutorRequest(BaseModel):
    subject: str
    lesson_id: Identifier
    block_id: BlockID | None = None
    scene_id: BlockID | None = None
    scene_state: SceneState = Field(default_factory=SceneState)
    question: Question
    history: list[TutorTurn] = Field(default_factory=list, max_length=3)


class SceneAction(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    scene_id: BlockID
    engine: str


class ParameterAction(SceneAction):
    type: Literal["setParameters"]
    parameters: dict[str, float] = Field(min_length=1, max_length=8)


class PlaybackAction(SceneAction):
    type: Literal["play", "pause", "reset", "compareRuns"]


class SeekAction(SceneAction):
    type: Literal["seek"]
    time: float = Field(ge=0, le=300)


class BlockAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["highlight", "showFormula"]
    block_id: BlockID


class QuestionAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["askQuestion"]
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=450)]


Action = Annotated[ParameterAction | PlaybackAction | SeekAction | BlockAction | QuestionAction, Field(discriminator="type")]


class TutorAnswer(BaseModel):
    answer: Answer
    actions: list[Action] = Field(default_factory=list, max_length=MAX_ACTIONS)


answer_text = TypeAdapter(Answer)
proposed_action = TypeAdapter(Action)


def active_lesson(lesson_id: str, subject: str) -> Lesson:
    if subject not in SUBJECT_ENGINES:
        raise HTTPException(404, "教材不存在")
    with connect() as db:
        row = db.execute("""
            SELECT v.content
            FROM lesson_version v JOIN lesson l ON l.id=v.lesson_id
            LEFT JOIN publication p ON p.version_id=v.id
            WHERE v.lesson_id=? AND l.subject=?
            ORDER BY (p.version_id IS NOT NULL) DESC, v.id DESC LIMIT 1
        """, (lesson_id, subject)).fetchone()
    if row:
        return Lesson.model_validate_json(row["content"])
    lesson = bundled_lesson(lesson_id)
    if lesson["subject"] != subject:
        raise HTTPException(404, "教材不存在")
    return Lesson.model_validate(lesson)


@router.post("/tutor")
def tutor(body: TutorRequest):
    profile = provider.require_profile()
    lesson = active_lesson(body.lesson_id, body.subject)
    blocks = {block.id: block for block in lesson.blocks}
    active = blocks.get(body.block_id or "")
    scene = blocks.get(body.scene_id or "")
    if body.block_id and active is None:
        raise HTTPException(422, "教材块已变化，请刷新教材")
    if body.scene_id and (scene is None or scene.type != "interactive"):
        raise HTTPException(422, "实验已变化，请刷新教材")
    contract = SCENES[scene.engine] if scene else {}
    parameters = contract["parameters"] if scene else {}
    playback = contract.get("playback", False)
    if any(key not in parameters or not parameters[key]["min"] <= value <= parameters[key]["max"]
           for key, value in body.scene_state.parameters.items()):
        raise HTTPException(422, "实验参数超出配置范围")
    task = {
        "lesson": {"title": lesson.title, "chapter": lesson.chapter, "objectives": lesson.objectives},
        "block": active.model_dump(exclude_none=True) if active else None,
        "block_index": [
            {"id": block.id, "title": block.title, "type": block.type,
             "excerpt": (block.body or block.question or "")[:360], "formula": (block.formula or "")[:280]}
            for block in lesson.blocks
        ],
        "scene": {"id": scene.id, "engine": scene.engine, "state": body.scene_state.model_dump(),
                  "parameters": parameters, "playback": playback} if scene else None,
        "question": body.question,
        "history": [{"question": turn.question, "answer": turn.answer[:1500]} for turn in body.history],
        "action_schema": TutorAnswer.model_json_schema(),
    }
    prompt = (
        "你是中文教材学伴。依据当前教材和场景回答问题，涉及公式时说明单位和模型假设。"
        "总结本节时，结合教学目标和所有教材块的提要；追问可参考最近对话，以当前教材为依据。"
        "返回 JSON 对象，包含 answer（纯文本，用短段落或分点）与 actions。"
        "总结、解释和一般追问应返回空动作列表；只有需要操作当前实验或定位教材时才提议动作。"
        "场景动作只能指向当前 scene。play、pause、seek 需要场景支持播放，compareRuns 仅用于物理场景。"
        "禁止输出脚本、HTML、未经核对的事实或虚构学习记录。"
    )
    response = provider.model_call([{"role": "system", "content": prompt},
                                    {"role": "user", "content": json.dumps(task, ensure_ascii=False)}],
                                   max_tokens=1500, profile=profile)
    try:
        result = provider.json_object(response)
        answer = answer_text.validate_python(result.get("answer"))
    except ValueError as error:
        raise HTTPException(502, "模型未返回有效的文字回复，请重试") from error

    raw_actions = result.get("actions", [])
    if isinstance(raw_actions, list):
        actions_omitted = len(raw_actions) > MAX_ACTIONS
    else:
        raw_actions = []
        actions_omitted = True
    actions = []
    for item in raw_actions[:MAX_ACTIONS]:
        try:
            action = proposed_action.validate_python(item)
            if isinstance(action, SceneAction):
                if scene is None or (action.scene_id, action.engine) != (scene.id, scene.engine):
                    raise ValueError("场景引用无效")
                if action.type in {"play", "pause", "seek"} and not playback:
                    raise ValueError("此实验不支持播放")
                if action.type == "compareRuns" and not action.engine.startswith("physics."):
                    raise ValueError("此实验不支持比较")
                if isinstance(action, ParameterAction) and any(
                    name not in parameters or not parameters[name]["min"] <= value <= parameters[name]["max"]
                    for name, value in action.parameters.items()
                ):
                    raise ValueError("动作参数超出范围")
            elif isinstance(action, BlockAction):
                block = blocks.get(action.block_id)
                if block is None or (action.type == "showFormula" and not block.formula):
                    raise ValueError("教材块引用无效")
        except ValueError:
            actions_omitted = True
        else:
            actions.append(action.model_dump())
    return {"mode": "model", "answer": answer, "actions": actions, "actions_omitted": actions_omitted}
