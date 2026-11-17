"""Run the built Studio in isolated loopback servers with temporary databases."""
from contextlib import ExitStack, contextmanager
from http.server import ThreadingHTTPServer
import os
from pathlib import Path
import socket
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import Thread
import time
from urllib.error import URLError
from urllib.request import urlopen

from model_fixture import ModelFixture


ROOT = Path(__file__).resolve().parents[1]


@contextmanager
def api_server(db):
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    env = {
        **os.environ, "ZJ_STUDIO_DB": str(db),
        "ZJ_LLM_BASE_URL": "", "ZJ_LLM_MODEL": "", "ZJ_LLM_API_KEY": "",
    }
    root = f"http://127.0.0.1:{port}"
    with subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", str(port),
         "--log-level", "error"],
        cwd=ROOT, env=env,
    ) as process:
        try:
            deadline = time.monotonic() + 10
            while process.poll() is None and time.monotonic() < deadline:
                try:
                    with urlopen(root + "/api/health", timeout=0.25):
                        break
                except URLError:
                    time.sleep(0.05)
            else:
                raise RuntimeError("Studio test API failed to start")
            yield root + "/studio/"
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)


def main():
    if not (ROOT / "apps/studio/dist/index.html").exists():
        raise SystemExit("Run npm run build first")
    with ExitStack() as stack:
        tmp = Path(stack.enter_context(TemporaryDirectory(prefix="zj-studio-acceptance-")))
        fixture = stack.enter_context(ThreadingHTTPServer(("127.0.0.1", 0), ModelFixture))
        worker = Thread(target=fixture.serve_forever, daemon=True)
        worker.start()
        stack.callback(fixture.shutdown)
        normal = stack.enter_context(api_server(tmp / "workspace.sqlite3"))
        model = stack.enter_context(api_server(tmp / "model.sqlite3"))
        subprocess.run(
            [sys.executable, str(ROOT / "tests/test_studio_browser.py"), *sys.argv[1:]],
            cwd=ROOT,
            env={
                **os.environ, "ZJ_STUDIO_URL": normal, "ZJ_MODEL_STUDIO_URL": model,
                "ZJ_MODEL_FIXTURE_URL": f"http://127.0.0.1:{fixture.server_port}/v1",
            },
            check=True,
        )


if __name__ == "__main__":
    main()
