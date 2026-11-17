"""Run from root: python -m unittest discover -s tests -v"""
import json
import math
import os
import shutil
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

from fastapi import HTTPException
from fastapi import BackgroundTasks

from api.main import Lesson, curricula, get_lesson, parse_outline
from api import book_queue, generation, provider, studio, tutor
from api.outline_import import extract_outline

ROOT = Path(__file__).resolve().parent.parent
TEST_PROVIDER = provider.Profile("http://127.0.0.1:8033/v1", "test-model", use_api_key=False)


class LessonTests(unittest.TestCase):
    def test_all_demo_lessons_have_valid_dsl(self):
        for path in (ROOT / "content" / "lessons").glob("*.json"):
            if path.stem.startswith("physics-bj-"):
                continue
            with self.subTest(path=path.name):
                lesson = Lesson.model_validate(json.loads(path.read_text(encoding="utf-8")))
                self.assertGreaterEqual(len(lesson.blocks), 3)

    def test_beijing_physics_outline_resolves_to_complete_lessons(self):
        middle = next(node for node in curricula()["nodes"] if node["id"] == "school-middle")
        physics = next(node for node in middle["children"] if node["subject"] == "physics")
        chapters = physics["children"][0]["children"]
        self.assertEqual([len(chapter["children"]) for chapter in chapters], [6, 2, 2, 2, 2, 2, 2, 1])
        ids = set()
        for chapter in chapters:
            for node in chapter["children"]:
                with self.subTest(lesson_id=node["lessonId"]):
                    lesson = Lesson.model_validate(get_lesson(node["lessonId"]))
                    self.assertNotIn(lesson.id, ids)
                    ids.add(lesson.id)
                    self.assertEqual((lesson.subject, lesson.chapter), ("physics", chapter["title"]))
                    self.assertEqual(node["title"], f"{lesson.number} {lesson.title}")
                    points = {point["id"] for point in node["knowledgePoints"]}
                    quizzes = [block for block in lesson.blocks if block.type == "assessment"]
                    experiments = [block for block in lesson.blocks if block.type == "interactive"]
                    self.assertEqual(len(experiments), 2 if lesson.number == "8.1" else 1)
                    self.assertTrue(all(block.body for block in experiments))
                    self.assertEqual(len(quizzes), 3)
                    formula = next(block for block in lesson.blocks if block.type == "formula")
                    example = next(block for block in lesson.blocks if block.id == "example")
                    self.assertTrue(formula.formula and formula.symbols and formula.body and formula.explanation)
                    self.assertGreaterEqual(len(example.steps), 2)
                    for quiz in quizzes:
                        self.assertTrue(quiz.explanation and quiz.knowledge_points)
                        self.assertLessEqual(set(quiz.knowledge_points), points)
                    self.assertLessEqual({"example", "investigate", "open", "review"}, {block.id for block in lesson.blocks})

    def test_high_school_formula_blocks_and_steps_round_trip(self):
        lesson = Lesson.model_validate(get_lesson("physics"))
        formulas = [block for block in lesson.blocks if block.type == "formula"]
        examples = [block for block in lesson.blocks if block.type == "example"]
        self.assertEqual([block.id for block in formulas], ["law", "law-oblique", "law-harmonic"])
        self.assertEqual(len(examples), 3)
        self.assertTrue(all(block.symbols and block.explanation for block in formulas))
        self.assertTrue(all(len(block.steps) == 3 for block in examples))
        data = lesson.model_dump(mode="json", exclude_none=True)
        self.assertEqual(Lesson.model_validate(data), lesson)
        next(block for block in data["blocks"] if block["id"] == "law")["symbols"][0]["unit"] = ""
        with self.assertRaises(ValueError):
            Lesson.model_validate(data)

    def test_bundled_lesson_lookup_rejects_non_lesson_paths(self):
        for lesson_id in ("../curricula/demo-syllabus", "physics-bj-8-2"):
            with self.subTest(lesson_id=lesson_id), self.assertRaises(HTTPException) as error:
                get_lesson(lesson_id)
            self.assertEqual(error.exception.status_code, 404)

    def test_malicious_engine_rejected(self):
        sample = json.loads((ROOT / "content" / "lessons" / "physics.json").read_text(encoding="utf-8"))
        for b in sample["blocks"]:
            if b["type"] == "interactive":
                b["engine"] = "eval.javascript"
        with self.assertRaises(ValueError):
            Lesson.model_validate(sample)

    def test_outline_parser_keeps_numbering(self):
        nodes = parse_outline("# 第3章 抛体运动\n## 3.2 平抛运动\n### 3.2.1 位移规律")
        self.assertEqual(nodes[0]["children"][0]["title"], "3.2 平抛运动")
        self.assertEqual(nodes[0]["children"][0]["children"][0]["title"], "3.2.1 位移规律")

    def test_projectile_physics_reference_values(self):
        v0, h, g = 8.0, 2.0, 9.8
        t = math.sqrt(2 * h / g)
        self.assertAlmostEqual(t, 0.6388765, places=5)
        self.assertAlmostEqual(v0 * t, 5.111012, places=5)
        self.assertAlmostEqual(math.hypot(v0, g * t), 10.15874, places=4)

    def test_quadratic_vertex(self):
        a, b, c = 1, -2, -3
        vx = -b / (2 * a)
        vy = a * vx ** 2 + b * vx + c
        self.assertEqual((vx, vy), (1.0, -4.0))


class StudioTests(unittest.TestCase):
    def setUp(self):
        directory = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(patch.object(studio, "DB", Path(directory) / "studio.sqlite3"))

    def test_provider_settings_keep_keys_at_the_configured_address(self):
        fields = {"base_url": TEST_PROVIDER.base_url, "model": TEST_PROVIDER.model}
        first = provider.save_settings(provider.Settings(**fields, api_key="test-secret"))
        self.assertEqual(first, provider.get_settings())
        self.assertTrue(first["has_api_key"])
        self.assertNotIn("test-secret", json.dumps(first))
        if os.name == "posix":
            self.assertEqual(provider.settings_db().stat().st_mode & 0o777, 0o600)
        provider.save_settings(provider.Settings(**(fields | {"model": "second-model"})))
        self.assertEqual(provider.current().api_key, "test-secret")
        fields["base_url"] = "https://example.com/v1"
        with self.assertRaises(HTTPException) as missing:
            provider.save_settings(provider.Settings(**fields))
        self.assertEqual(missing.exception.status_code, 422)
        self.assertEqual(provider.current().model, "second-model")
        unauthenticated = provider.save_settings(provider.Settings(**fields, use_api_key=False))
        self.assertTrue(unauthenticated["configured"])
        self.assertFalse(unauthenticated["has_api_key"])

    def test_provider_settings_reuse_environment_credential_without_copying_it(self):
        with patch.dict(os.environ, {
            "ZJ_LLM_BASE_URL": TEST_PROVIDER.base_url, "ZJ_LLM_MODEL": TEST_PROVIDER.model,
            "ZJ_LLM_API_KEY": "test-environment-secret", "ZJ_LLM_TIMEOUT": "90",
        }):
            self.assertEqual(provider.get_settings()["source"], "environment")
            provider.save_settings(provider.Settings(base_url=TEST_PROVIDER.base_url + "/", model="updated"))
            self.assertEqual(provider.current().api_key, "test-environment-secret")
            with patch.dict(os.environ, {"ZJ_LLM_API_KEY": ""}):
                self.assertFalse(provider.configured())

    def submit_book(self, mode="template"):
        root = studio.Node(id="book-1", title="运动专题", type="textbook", children=[
            studio.Node(id="chapter-1", title="第一章", children=[
                studio.Node(id="lesson-1", title="1.1 运动分解"),
                studio.Node(id="lesson-2", title="1.2 平抛运动"),
            ]),
        ])
        studio.revise(studio.Revision(subject="physics", revision=0, nodes=[root]))
        return book_queue.submit(book_queue.BookRequest(
            subject="physics", node_id=root.id, grade="高中", revision=1, mode=mode,
        ))["id"]

    def test_book_resumes_persisted_model_result_and_retries_only_failed_section(self):
        with patch.object(provider, "current", return_value=TEST_PROVIDER):
            book_id = self.submit_book("model")
            first, second = book_queue.detail(book_id)["sections"]
            lesson = studio.Lesson.model_validate_json((ROOT / "content/lessons/physics.json").read_text(encoding="utf-8"))
            cached = lesson.model_copy(update={"id": first["lesson_id"], "title": first["title"]})
            generation.save_job({"id": first["id"], "status": "review", "lesson": cached.model_dump(exclude_none=True)})
            with book_queue.connect(write=True) as db:
                db.execute("UPDATE book_job SET status='running' WHERE id=?", (book_id,))
                db.execute("UPDATE book_section SET status='running' WHERE id=?", (first["id"],))

            plan = {"objectives": ["理解运动分解"], "sequence": ["目标", "概念", "练习"]}
            raw = lesson.model_dump(exclude_none=True)
            raw["blocks"] = [block for block in raw["blocks"]
                             if block["type"] != "interactive" or block["engine"] == "physics.projectile2d"]
            raw["title"] = second["title"]
            with patch.object(generation, "ask", side_effect=HTTPException(502, "上游暂不可用")) as ask:
                self.assertTrue(book_queue.step())
                ask.assert_not_called()
                self.assertTrue(book_queue.step())
            self.assertEqual(book_queue.detail(book_id)["status"], "failed")
            self.assertEqual(len(book_queue.drafts(book_id)["lessons"]), 1)
            self.assertEqual(studio.workspace()["drafts"], {})

            book_queue.retry(book_id)
            with patch.object(generation, "ask", side_effect=[plan, raw]) as ask:
                self.assertTrue(book_queue.step())
                self.assertEqual(ask.call_count, 2)
            self.assertTrue(book_queue.step())
            self.assertEqual(book_queue.detail(book_id)["status"], "complete")
            workspace = studio.workspace()
            self.assertEqual(set(workspace["drafts"]), {first["lesson_id"], second["lesson_id"]})
            self.assertEqual(workspace["outlines"]["physics"][0]["children"][0]["children"][1]["lessonId"], second["lesson_id"])
            self.assertEqual(workspace["published"], {})

    def test_book_conflict_preserves_generated_content_and_keeps_workspace_unchanged(self):
        book_id = self.submit_book()
        self.assertTrue(book_queue.step())
        self.assertTrue(book_queue.step())
        studio.revise(studio.Revision(subject="physics", revision=1, nodes=[
            studio.Node(id="new-outline", title="改过的大纲"),
        ]))
        self.assertTrue(book_queue.step())
        self.assertEqual(book_queue.detail(book_id)["status"], "conflict")
        self.assertEqual(studio.workspace()["outlines"]["physics"][0]["id"], "new-outline")
        self.assertEqual(studio.workspace()["drafts"], {})
        self.assertEqual(len(book_queue.drafts(book_id)["lessons"]), 2)

    def test_revisions_and_publication_snapshot(self):
        lesson = Lesson.model_validate_json((ROOT / "content/lessons/physics.json").read_text(encoding="utf-8"))
        child = studio.Node(id="lesson-physics", title="3.2 平抛运动", lessonId="physics")
        root = studio.Node(id="chapter-3", title="第3章 抛体运动", children=[child])
        first = studio.revise(studio.Revision(subject="physics", revision=0, nodes=[root], lesson=lesson))
        with self.assertRaises(HTTPException) as conflict:
            studio.revise(studio.Revision(subject="physics", revision=0, lesson=lesson))
        self.assertEqual(conflict.exception.status_code, 409)
        studio.publish("physics", first["version"], studio.Review(reviewer="教研员", confirmed=True))
        updated = lesson.model_copy(update={"title": "修订稿"})
        second = studio.revise(studio.Revision(subject="physics", revision=1, lesson=updated))
        self.assertNotEqual(first["version"], second["version"])
        result = studio.workspace()
        self.assertEqual(result["outlines"]["physics"][0]["children"][0]["title"], "3.2 平抛运动")
        self.assertEqual(result["drafts"]["physics"]["title"], "修订稿")
        self.assertEqual(result["published"]["physics"]["title"], "平抛运动")
        with self.assertRaises(HTTPException) as stale:
            studio.publish("physics", first["version"], studio.Review(reviewer="教研员", confirmed=True))
        self.assertEqual(stale.exception.status_code, 409)

    def test_duplicate_outline_node_rejected(self):
        node = studio.Node(id="repeated", title="测试")
        with self.assertRaises(ValueError):
            studio.Revision(subject="physics", revision=0, nodes=[node, node])

    def test_standards_are_mapped_to_knowledge_points(self):
        point = studio.KnowledgePoint(id="kp-1", title="运动分解")
        rule = studio.Standard(id="standard-1", title="测试课标", source="测试来源")
        studio.save_mapping(studio.Mapping(point=point, requirement=rule))
        self.assertEqual(studio.standards(point.id)["standards"], [rule.model_dump()])

    def test_generation_job_records_success_and_rejects_unregistered_scene(self):
        draft = json.loads((ROOT / "content/lessons/physics.json").read_text(encoding="utf-8"))
        draft["blocks"] = [block for block in draft["blocks"]
                           if block["type"] != "interactive" or block["engine"] == "physics.projectile2d"]
        plan = {"objectives": ["理解平抛运动"], "sequence": ["目标", "概念", "练习"]}
        body = generation.Generate(subject="physics", lesson_id="physics", chapter="平抛运动", grade="高中")
        with patch.object(provider, "current", return_value=TEST_PROVIDER):
            with patch.object(generation, "ask", side_effect=[plan, draft]):
                job_id = generation.generate(body, BackgroundTasks())["id"]
                generation.run(job_id, body)
                state = generation.job(job_id)
                self.assertEqual(state["status"], "review")
                self.assertEqual(state["stages"][-2]["status"], "complete")
                self.assertEqual(state["lesson"]["generation_job"], job_id)
            next(block for block in draft["blocks"] if block["type"] == "interactive")["engine"] = "eval.javascript"
            with patch.object(generation, "ask", side_effect=[plan, draft]):
                job_id = generation.generate(body, BackgroundTasks())["id"]
                generation.run(job_id, body)
                self.assertEqual(generation.job(job_id)["status"], "failed")
                self.assertNotIn("lesson", generation.job(job_id))

    def test_tutor_uses_current_scene_and_rejects_unsafe_actions(self):
        previous_answer = "一" * 1499 + "📘重点"
        body = tutor.TutorRequest(
            subject="physics", lesson_id="physics", block_id="law", scene_id="lab",
            scene_state=tutor.SceneState(parameters={"speed": 8}), question="调整初速度",
            history=[tutor.TutorTurn(question="总结本节", answer=previous_answer)],
        )
        result = {"answer": "观察速度变化", "actions": [
            {"type": "executeScript"},
            {"type": "setParameters", "scene_id": "lab", "engine": "physics.projectile2d", "parameters": {"speed": 1000}},
            {"type": "setParameters", "scene_id": "lab", "engine": "physics.projectile2d", "parameters": {"speed": 10}},
        ]}
        with patch.object(provider, "current", return_value=TEST_PROVIDER):
            with patch.object(provider, "model_call", return_value=json.dumps(result)) as model:
                answer = tutor.tutor(body)
                self.assertEqual(answer["answer"], "观察速度变化")
                self.assertEqual(answer["actions"], result["actions"][2:])
                self.assertTrue(answer["actions_omitted"])
                task = json.loads(model.call_args.args[0][1]["content"])
                self.assertEqual(task["block"]["id"], "law")
                self.assertTrue(next(block for block in task["block_index"] if block["id"] == "concept")["excerpt"])
                self.assertEqual(task["history"], [{"question": "总结本节", "answer": previous_answer[:1500]}])
            result["answer"] = "  "
            with patch.object(provider, "model_call", return_value=json.dumps(result)):
                with self.assertRaises(HTTPException) as invalid:
                    tutor.tutor(body)
                self.assertEqual(invalid.exception.status_code, 502)

    def test_word_import_preserves_headings(self):
        word = BytesIO()
        with ZipFile(word, "w") as archive:
            archive.writestr("word/document.xml", """
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body>
                <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>第3章 抛体运动</w:t></w:r></w:p>
                <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>3.2 平抛运动</w:t></w:r></w:p>
                <w:p><w:r><w:t>这是一段正文</w:t></w:r></w:p>
              </w:body>
            </w:document>""")
        nodes = parse_outline(extract_outline("syllabus.docx", word.getvalue()))
        self.assertEqual(nodes[0]["children"][0]["title"], "3.2 平抛运动")
        self.assertEqual(len(nodes[0]["children"]), 1)

    @unittest.skipUnless(shutil.which("pdftotext"), "Poppler pdftotext unavailable")
    def test_pdf_import_preserves_numbered_hierarchy(self):
        stream = b"BT /F1 12 Tf 50 740 Td (3 Motion) Tj 0 -20 Td (3.2 Projectile) Tj ET"
        objects = [
            b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream),
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        ]
        pdf = bytearray(b"%PDF-1.4\n")
        offsets = []
        for index, obj in enumerate(objects, 1):
            offsets.append(len(pdf))
            pdf.extend(b"%d 0 obj\n%s\nendobj\n" % (index, obj))
        xref = len(pdf)
        pdf.extend(b"xref\n0 6\n0000000000 65535 f \n")
        for offset in offsets:
            pdf.extend(b"%010d 00000 n \n" % offset)
        pdf.extend(b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % xref)
        nodes = parse_outline(extract_outline("syllabus.pdf", bytes(pdf)))
        self.assertEqual(nodes[0]["children"][0]["title"], "3.2 Projectile")


if __name__ == "__main__":
    unittest.main()
