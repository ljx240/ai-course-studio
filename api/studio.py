"""Transactional workspace for the single-user Studio deployment."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
from typing import Annotated

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, model_validator

from .lesson import Lesson, SUBJECT_ENGINES
from .outline_import import extract_outline

router = APIRouter(prefix="/api/studio")
ROOT = Path(__file__).resolve().parents[1]
DB = Path(os.getenv("ZJ_STUDIO_DB", str(ROOT / "data" / "studio.sqlite3")))
Identifier = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9-]+$")]

SCHEMA = """
CREATE TABLE IF NOT EXISTS curriculum (
    subject TEXT PRIMARY KEY,
    nodes TEXT,
    revision INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson_version (
    id INTEGER PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES lesson(id),
    created_at TEXT NOT NULL,
    content TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS versions_by_lesson ON lesson_version(lesson_id, id DESC);
CREATE TABLE IF NOT EXISTS publication (
    version_id INTEGER PRIMARY KEY REFERENCES lesson_version(id),
    reviewer TEXT NOT NULL,
    published_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS standard_requirement (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS knowledge_point (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS standard_mapping (
    requirement_id TEXT REFERENCES standard_requirement(id),
    point_id TEXT REFERENCES knowledge_point(id),
    PRIMARY KEY (requirement_id, point_id)
);
CREATE TABLE IF NOT EXISTS generation_job (
    id TEXT PRIMARY KEY,
    state TEXT NOT NULL
);
"""


class KnowledgePoint(BaseModel):
    id: Identifier
    title: str = Field(min_length=1, max_length=250)


class Node(BaseModel):
    id: Identifier
    title: str = Field(min_length=1, max_length=250)
    type: str | None = None
    subject: str | None = None
    lessonId: Identifier | None = None
    knowledgePoints: list[KnowledgePoint] | None = None
    children: list[Node] = Field(default_factory=list)


class Revision(BaseModel):
    subject: str
    revision: int = Field(ge=0)
    nodes: list[Node] | None = None
    lesson: Lesson | None = None
    lessons: list[Lesson] = Field(default_factory=list, max_length=3000)

    @model_validator(mode="after")
    def check_workspace(self):
        if self.subject not in SUBJECT_ENGINES:
            raise ValueError("学科未注册")
        drafts = ([self.lesson] if self.lesson else []) + self.lessons
        if self.nodes is None and not drafts:
            raise ValueError("没有待保存的变更")
        if any(lesson.subject != self.subject for lesson in drafts):
            raise ValueError("教材与大纲学科不同")
        if len({lesson.id for lesson in drafts}) != len(drafts):
            raise ValueError("同一次修订不能包含重复教材编号")
        ids: set[str] = set()

        def check(nodes: list[Node], depth: int) -> None:
            if nodes and depth > 6:
                raise ValueError("大纲最多六级")
            for node in nodes:
                if node.id in ids or len(ids) >= 3000:
                    raise ValueError("节点重复或大纲超过 3000 个节点")
                ids.add(node.id)
                if node.subject is not None and node.subject != self.subject:
                    raise ValueError("节点学科与大纲不同")
                check(node.children, depth + 1)

        if self.nodes is not None:
            check(self.nodes, 1)
        return self


class Review(BaseModel):
    reviewer: str = Field(min_length=1, max_length=80, pattern=r"\S")
    confirmed: bool


class Standard(BaseModel):
    id: Identifier
    title: str = Field(min_length=1, max_length=250)
    source: str = Field(min_length=1, max_length=1000)


class Mapping(BaseModel):
    point: KnowledgePoint
    requirement: Standard


@contextmanager
def connect(*, write=False, schema=""):
    DB.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    try:
        db.execute("PRAGMA foreign_keys = ON")
        db.executescript(SCHEMA + schema)
        if write:
            db.execute("BEGIN IMMEDIATE")
        with db:
            yield db
    finally:
        db.close()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/workspace")
def workspace():
    with connect() as db:
        db.execute("BEGIN")
        curricula = db.execute("SELECT subject, nodes, revision FROM curriculum").fetchall()
        rows = db.execute("""
            SELECT l.id, v.id AS version_id, v.content
            FROM lesson l JOIN lesson_version v ON v.id = (
                SELECT MAX(id) FROM lesson_version WHERE lesson_id = l.id
            )
        """).fetchall()
        published = db.execute("""
            SELECT v.lesson_id, v.content
            FROM lesson_version v JOIN publication p ON p.version_id = v.id
            WHERE p.version_id = (
                SELECT MAX(p2.version_id) FROM publication p2 JOIN lesson_version v2 ON v2.id = p2.version_id
                WHERE v2.lesson_id = v.lesson_id
            )
        """).fetchall()
    return {
        "outlines": {row["subject"]: json.loads(row["nodes"]) for row in curricula if row["nodes"] is not None},
        "revisions": {row["subject"]: row["revision"] for row in curricula},
        "drafts": {row["id"]: json.loads(row["content"]) for row in rows},
        "versions": {row["id"]: row["version_id"] for row in rows},
        "published": {row["lesson_id"]: json.loads(row["content"]) for row in published},
    }


@router.post("/revision")
def revise(body: Revision):
    with connect(write=True) as db:
        return apply_revision(db, body)


def apply_revision(db, body: Revision):
    row = db.execute("SELECT revision, nodes FROM curriculum WHERE subject = ?", (body.subject,)).fetchone()
    current = row["revision"] if row else 0
    if body.revision != current:
        raise HTTPException(409, "大纲或教材已在其他窗口更新，请刷新后重新编辑")
    nodes = (
        json.dumps([node.model_dump(exclude_none=True) for node in body.nodes], ensure_ascii=False)
        if body.nodes is not None else (row["nodes"] if row else None)
    )
    db.execute(
        """INSERT INTO curriculum VALUES (?, ?, ?) ON CONFLICT(subject)
           DO UPDATE SET nodes=excluded.nodes, revision=excluded.revision""",
        (body.subject, nodes, current + 1),
    )
    saved = {}
    for lesson in ([body.lesson] if body.lesson else []) + body.lessons:
        if not (1 <= len(lesson.id) <= 100 and lesson.id.isascii() and lesson.id.replace("-", "").isalnum()):
            raise HTTPException(422, "教材编号无效")
        db.execute("INSERT OR IGNORE INTO lesson VALUES (?, ?)", (lesson.id, body.subject))
        stored = db.execute("SELECT subject FROM lesson WHERE id = ?", (lesson.id,)).fetchone()
        if stored["subject"] != body.subject:
            raise HTTPException(409, "教材编号已被其他学科使用")
        saved[lesson.id] = db.execute(
            "INSERT INTO lesson_version(lesson_id, created_at, content) VALUES (?, ?, ?)",
            (lesson.id, now(), lesson.model_dump_json(exclude_none=True)),
        ).lastrowid
    return {
        "revision": current + 1,
        "version": saved[body.lesson.id] if body.lesson else None,
        "versions": saved,
    }


@router.get("/lessons/{lesson_id}/versions")
def versions(lesson_id: Identifier):
    with connect() as db:
        rows = db.execute("""
            SELECT v.id, v.created_at, p.reviewer, p.published_at
            FROM lesson_version v LEFT JOIN publication p ON p.version_id = v.id
            WHERE v.lesson_id = ? ORDER BY v.id DESC
        """, (lesson_id,)).fetchall()
    return {"versions": [dict(row) for row in rows]}


@router.get("/lessons/{lesson_id}/versions/{version}")
def version_content(lesson_id: Identifier, version: int):
    with connect() as db:
        row = db.execute(
            "SELECT content FROM lesson_version WHERE lesson_id=? AND id=?", (lesson_id, version)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "教材版本不存在")
    return {"lesson": json.loads(row["content"])}


@router.post("/lessons/{lesson_id}/versions/{version}/publish")
def publish(lesson_id: Identifier, version: int, body: Review):
    if not body.confirmed:
        raise HTTPException(422, "请先确认已审核教材内容")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        latest = db.execute("SELECT MAX(id) FROM lesson_version WHERE lesson_id=?", (lesson_id,)).fetchone()[0]
        if latest != version:
            raise HTTPException(409, "请选择最新草稿审核发布")
        existing = db.execute("SELECT * FROM publication WHERE version_id=?", (version,)).fetchone()
        if existing:
            return dict(existing)
        timestamp = now()
        db.execute("INSERT INTO publication VALUES (?, ?, ?)", (version, body.reviewer.strip(), timestamp))
        row = db.execute("SELECT content FROM lesson_version WHERE id=?", (version,)).fetchone()
        job_id = json.loads(row["content"]).get("generation_job")
        if job_id:
            job = db.execute("SELECT state FROM generation_job WHERE id=?", (job_id,)).fetchone()
            if job:
                state = json.loads(job["state"])
                if state["lesson_id"] == lesson_id and state["status"] == "review":
                    state["stages"][-1].update(status="complete", ended_at=timestamp)
                    state["published_version"] = version
                    db.execute("UPDATE generation_job SET state=? WHERE id=?", (json.dumps(state, ensure_ascii=False), job_id))
    return {"version_id": version, "reviewer": body.reviewer.strip(), "published_at": timestamp}


@router.post("/standard-mappings")
def save_mapping(body: Mapping):
    with connect() as db:
        db.execute(
            "INSERT INTO knowledge_point VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title",
            (body.point.id, body.point.title),
        )
        db.execute(
            """INSERT INTO standard_requirement VALUES (?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET title=excluded.title, source=excluded.source""",
            (body.requirement.id, body.requirement.title, body.requirement.source),
        )
        db.execute("INSERT OR IGNORE INTO standard_mapping VALUES (?, ?)", (body.requirement.id, body.point.id))
    return {"mapped": True}


@router.get("/knowledge-points/{point_id}/standards")
def standards(point_id: Identifier):
    with connect() as db:
        rows = db.execute("""
            SELECT r.id, r.title, r.source FROM standard_requirement r
            JOIN standard_mapping m ON m.requirement_id = r.id WHERE m.point_id=? ORDER BY r.title
        """, (point_id,)).fetchall()
    return {"standards": [dict(row) for row in rows]}


@router.post("/extract-outline")
async def import_document(request: Request, filename: str):
    from starlette.concurrency import run_in_threadpool

    content = bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content) > 8_000_000:
            raise HTTPException(413, "大纲文件不得超过 8 MB")
    try:
        text = await run_in_threadpool(extract_outline, filename, bytes(content))
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    return {"text": text}
