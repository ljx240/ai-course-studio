"""Loopback-only protocol fixture for the OpenAI-compatible browser acceptance test."""
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


LESSON = Path(__file__).resolve().parents[1] / "content" / "lessons" / "physics.json"


class ModelFixture(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/v1/chat/completions" or self.headers.get("Authorization") != "Bearer local-fixture":
            self.send_error(401)
            return
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        assert payload["stream"] is False
        assert payload["model"] == "protocol-fixture"
        messages = payload["messages"]
        if messages == [{"role": "user", "content": "Reply with OK."}]:
            self.reply("OK")
            return
        prompt = messages[0]["content"]
        task = json.loads(messages[1]["content"])
        if "教材学伴" in prompt:
            scene = task["scene"]
            question = task["question"]
            if question.startswith("总结"):
                assert any(block["id"] == "law" and block["formula"] for block in task["block_index"])
                result = {
                    "answer": "平抛运动可以分解为水平方向的匀速运动和竖直方向的自由落体。\n\n"
                              "同一高度下，飞行时间由重力加速度决定，水平初速度影响水平射程。",
                    "actions": [{"type": "executeScript"}],
                }
            elif question.startswith("继续说明"):
                assert task["history"][-1]["question"].startswith("总结")
                assert "飞行时间" in task["history"][-1]["answer"]
                result = {"answer": "飞行时间由竖直运动决定。", "actions": []}
            elif question == "触发上游错误":
                self.send_error(503)
                return
            elif question.startswith("把初速度改为"):
                result = {"answer": "可以通过下面的操作调整初速度。", "actions": [
                    {"type": "setParameters", "scene_id": scene["id"], "engine": scene["engine"],
                     "parameters": {"speed": 10}},
                ]}
            else:
                result = {"answer": "本机协议夹具验证当前教材上下文。", "actions": []}
        elif "教材编辑" in prompt:
            result = {"markdown": "# 第9章 运动复习\n## 9.1 速度分解\n## 9.2 轨迹比较"}
        elif "教材策划" in prompt:
            result = {"objectives": ["理解运动分解"], "sequence": ["目标", "概念", "练习"]}
        elif "只返回指定教材块" in prompt:
            result = {**task["block"], "body": "本机协议夹具返回的修订内容。"}
        elif "学科辅导教师" in prompt:
            self.reply("本机协议夹具验证 V0.2 问答：" + task["lesson"]["title"])
            return
        else:
            result = json.loads(LESSON.read_text(encoding="utf-8"))
            result["blocks"] = [block for block in result["blocks"]
                                if block["type"] != "interactive" or block["engine"] == task["scene"]["engine"]]
            result["title"] = task["options"]["chapter"]
            if "后台验收" in result["title"]:
                time.sleep(0.6)
            if "拒绝测试" in result["title"]:
                next(block for block in result["blocks"] if block["type"] == "interactive")["engine"] = "eval.javascript"
        self.reply(json.dumps(result, ensure_ascii=False))

    def reply(self, content):
        output = json.dumps({"choices": [{"message": {"content": content}}]}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(output)))
        self.end_headers()
        self.wfile.write(output)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8033), ModelFixture).serve_forever()
