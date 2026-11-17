"""Persistent, single-host queue for generating complete books."""
from __future__ import annotations

from contextlib import asynccontextmanager, closing
import json
import logging
import sqlite3
from threading import Event, Thread
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import Field, ValidationError

from . import generation, provider, studio
from .lesson import Lesson, sample_lesson
from .studio import Identifier, Node, Revision, now

router = APIRouter(prefix="/api/generation/books")
log = logging.getLogger(__name__)
SCHEMA = """
CREATE TABLE IF NOT EXISTS book_job (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    revision INTEGER NOT NULL,
    nodes TEXT NOT NULL,
    options TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE TABLE IF NOT EXISTS book_section (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES book_job(id),
    position INTEGER NOT NULL,
    node_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    result TEXT,
    error TEXT,
    UNIQUE(book_id, position)
);
"""


class BookRequest(generation.GenerationOptions):
    node_id: Identifier
    revision: int = Field(ge=0)
    mode: Literal["model", "template"]


def connect(*, write=False):
    return studio.connect(write=write, schema=SCHEMA)


def children(nodes: list[Node]):
    for node in nodes:
        yield node
        yield from children(node.children)


def leaves(node: Node):
    if node.type == "lesson" or not node.children:
        yield node
    else:
        for child in node.children:
            yield from leaves(child)


def load_tree(row, subject: str) -> list[Node]:
    if row and row["nodes"] is not None:
        return [Node.model_validate(node) for node in json.loads(row["nodes"])]
    seed = json.loads((studio.ROOT / "content" / "curricula" / "demo-syllabus.json").read_text(encoding="utf-8"))
    result = []
    for school in seed["nodes"]:
        selected = [item for item in school["children"] if item["subject"] == subject]
        if selected:
            result.append(Node.model_validate({**school, "children": selected}))
    return result


def get_book(db, book_id: str):
    row = db.execute("SELECT * FROM book_job WHERE id=?", (book_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "整册任务不存在")
    return row


@router.post("", status_code=202)
def submit(body: BookRequest):
    if body.mode == "model":
        provider.require_profile()
    book_id = str(uuid4())
    options = body.model_dump(exclude={"node_id", "revision", "mode"})
    with connect(write=True) as db:
        row = db.execute("SELECT revision,nodes FROM curriculum WHERE subject=?", (body.subject,)).fetchone()
        if body.revision != (row["revision"] if row else 0):
            raise HTTPException(409, "大纲或教材已更新，请重新打开工作区后提交")
        nodes = load_tree(row, body.subject)
        root = next((node for node in children(nodes) if node.id == body.node_id), None)
        if not root or not root.children:
            raise HTTPException(422, "请选择已保存且包含小节的课程节点")
        sections = []
        lesson_ids = set()
        for node in leaves(root):
            lesson_id = node.lessonId or f"{body.subject}-{node.id}"
            if lesson_id in lesson_ids:
                raise HTTPException(422, "多个小节关联了同一个教材，请调整大纲后提交")
            lesson_ids.add(lesson_id)
            try:
                generation.Generate(**options, lesson_id=lesson_id, chapter=node.title)
            except ValidationError as exc:
                raise HTTPException(422, f"小节「{node.title}」的标题或教材编号超出生成范围") from exc
            sections.append((str(uuid4()), book_id, len(sections), node.id, lesson_id, node.title, "queued"))
        db.execute("""
            INSERT INTO book_job(id,title,subject,revision,nodes,options,mode,status,created_at)
            VALUES (?,?,?,?,?,?,?,'queued',?)
        """, (book_id, root.title, body.subject, body.revision,
              json.dumps([node.model_dump(exclude_none=True) for node in nodes], ensure_ascii=False),
              json.dumps(options, ensure_ascii=False), body.mode, now()))
        db.executemany("""
            INSERT INTO book_section(id,book_id,position,node_id,lesson_id,title,status)
            VALUES (?,?,?,?,?,?,?)
        """, sections)
    return {"id": book_id}


@router.get("")
def list_books():
    with connect() as db:
        rows = db.execute("""
            SELECT b.id,b.title,b.subject,b.status,b.mode,b.error,b.created_at,b.finished_at,
                   COUNT(s.id) AS total,
                   SUM(CASE WHEN s.status='ready' THEN 1 ELSE 0 END) AS ready
            FROM book_job b JOIN book_section s ON s.book_id=b.id
            GROUP BY b.id ORDER BY b.created_at DESC
        """).fetchall()
    return {"jobs": [dict(row) for row in rows]}


@router.get("/{book_id}")
def detail(book_id: Identifier):
    with connect() as db:
        book = get_book(db, book_id)
        sections = db.execute("""
            SELECT id,node_id,lesson_id,title,status,error FROM book_section
            WHERE book_id=? ORDER BY position
        """, (book_id,)).fetchall()
    return {**{key: book[key] for key in ("id", "title", "subject", "status", "mode", "error")},
            "saved_revision": book["revision"] + 1 if book["status"] == "complete" else None,
            "sections": [dict(row) for row in sections]}


@router.get("/{book_id}/drafts")
def drafts(book_id: Identifier):
    with connect() as db:
        book = get_book(db, book_id)
        rows = db.execute("SELECT node_id,result FROM book_section WHERE book_id=? AND status='ready' ORDER BY position",
                          (book_id,)).fetchall()
    return {"title": book["title"], "lessons": [
        {"node_id": row["node_id"], "lesson": json.loads(row["result"])} for row in rows
    ]}


@router.post("/{book_id}/retry", status_code=202)
def retry(book_id: Identifier):
    with connect(write=True) as db:
        book = get_book(db, book_id)
        if book["status"] != "failed":
            raise HTTPException(409, "只有生成失败的任务可以重试")
        if book["mode"] == "model":
            provider.require_profile()
        checkpoints = db.execute("""
            SELECT g.id,g.state FROM generation_job g JOIN book_section s ON s.id=g.id
            WHERE s.book_id=? AND s.status<>'ready'
        """, (book_id,)).fetchall()
        for checkpoint in checkpoints:
            state = json.loads(checkpoint["state"])
            if state["status"] == "failed":
                state["status"] = "queued"
                db.execute("UPDATE generation_job SET state=? WHERE id=?",
                           (json.dumps(state, ensure_ascii=False), checkpoint["id"]))
        db.execute("UPDATE book_section SET status='queued',error=NULL WHERE book_id=? AND status<>'ready'", (book_id,))
        db.execute("UPDATE book_job SET status='queued',error=NULL,finished_at=NULL WHERE id=?", (book_id,))
    return {"id": book_id}


def build_section(book, section) -> Lesson:
    options = json.loads(book["options"])
    if book["mode"] == "template":
        sample = sample_lesson(book["subject"])
        sample.update(id=section["lesson_id"], title=section["title"], grade=options["grade"],
                      version="1.0.1-template-draft", generation_mode="template")
        return Lesson.model_validate(sample)

    with connect() as db:
        row = db.execute("SELECT state FROM generation_job WHERE id=?", (section["id"],)).fetchone()
    existing = json.loads(row["state"]) if row else None
    if existing and existing["status"] == "review":
        return Lesson.model_validate(existing["lesson"])
    if existing and existing["status"] == "failed" and section["status"] == "running":
        raise ValueError(existing["error"])
    body = generation.Generate(**options, lesson_id=section["lesson_id"], chapter=section["title"])
    generation.initialize_job(section["id"], body.lesson_id)
    generation.run(section["id"], body)
    result = generation.read_job(section["id"])
    if result["status"] != "review":
        raise ValueError(result["error"])
    return Lesson.model_validate(result["lesson"])


def fail(book_id: str, status: str, error: str, section_id: str | None = None):
    with connect(write=True) as db:
        if section_id:
            db.execute("UPDATE book_section SET status='failed',error=? WHERE id=?", (error, section_id))
        db.execute("UPDATE book_job SET status=?,error=?,finished_at=? WHERE id=?", (status, error, now(), book_id))


def finish(book):
    with connect(write=True) as db:
        rows = db.execute("SELECT node_id,lesson_id,result FROM book_section WHERE book_id=? ORDER BY position",
                          (book["id"],)).fetchall()
        links = {row["node_id"]: row["lesson_id"] for row in rows}
        nodes = [Node.model_validate(node) for node in json.loads(book["nodes"])]
        for node in children(nodes):
            if node.id in links:
                node.lessonId = links[node.id]
        revision = Revision(subject=book["subject"], revision=book["revision"], nodes=nodes,
                            lessons=[Lesson.model_validate_json(row["result"]) for row in rows])
        studio.apply_revision(db, revision)
        db.execute("UPDATE book_job SET status='complete',finished_at=? WHERE id=?", (now(), book["id"]))


def step() -> bool:
    with connect() as db:
        book = db.execute("""
            SELECT * FROM book_job WHERE status IN ('queued','running')
            ORDER BY created_at LIMIT 1
        """).fetchone()
        if book is None:
            return False
        section = db.execute("""
            SELECT * FROM book_section WHERE book_id=? AND status<>'ready' ORDER BY position LIMIT 1
        """, (book["id"],)).fetchone()
    try:
        if section:
            with connect(write=True) as db:
                db.execute("UPDATE book_job SET status='running' WHERE id=?", (book["id"],))
                db.execute("UPDATE book_section SET status='running' WHERE id=?", (section["id"],))
            result = build_section(book, section)
            with connect(write=True) as db:
                db.execute("UPDATE book_section SET status='ready',result=? WHERE id=?",
                           (result.model_dump_json(exclude_none=True), section["id"]))
        else:
            finish(book)
    except HTTPException as exc:
        fail(book["id"], "conflict" if exc.status_code == 409 else "failed", str(exc.detail),
             section["id"] if section else None)
    except ValueError as exc:
        fail(book["id"], "failed", str(exc).split("\n", 1)[0], section["id"] if section else None)
    return True


def worker(stop: Event):
    # A separate SQLite write lock elects one worker without blocking workspace writes.
    studio.DB.parent.mkdir(parents=True, exist_ok=True)
    lock = studio.DB.with_name(studio.DB.name + ".worker")
    with closing(sqlite3.connect(lock, timeout=0)) as db:
        while not stop.is_set():
            try:
                db.execute("BEGIN IMMEDIATE")
                break
            except sqlite3.OperationalError as exc:
                if exc.sqlite_errorcode != sqlite3.SQLITE_BUSY:
                    raise
                stop.wait(1)
        while not stop.is_set():
            try:
                if not step():
                    stop.wait(0.5)
            except sqlite3.OperationalError as exc:
                if exc.sqlite_errorcode != sqlite3.SQLITE_BUSY:
                    raise
                stop.wait(1)


@asynccontextmanager
async def lifespan(_app):
    stop = Event()
    thread = Thread(target=worker, args=(stop,), daemon=True, name="book-queue")
    thread.start()
    try:
        yield
    finally:
        stop.set()
        thread.join(timeout=1)
