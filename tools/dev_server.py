"""
Local test server for the website + FLL Attachment Lab API.

    python tools/dev_server.py            # then open http://localhost:8000/game.html#fll

Uses a JSON file (tools/.dev-store.json) instead of Redis and a test coach login
(coach / coach-test-pass) unless ADMIN_USERNAME / ADMIN_PASSWORD are already set.
Not deployed (see .vercelignore).
"""

import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api"))

os.environ.setdefault("FLL_DEV_STORE", os.path.join(ROOT, "tools", ".dev-store.json"))
os.environ.setdefault("FLL_DEV_INSECURE_COOKIE", "1")
os.environ.setdefault("SESSION_SECRET", "dev-only-secret")
os.environ.setdefault("ADMIN_USERNAME", "coach")
os.environ.setdefault("ADMIN_PASSWORD", "coach-test-pass")

from fll import handler as ApiHandler  # noqa: E402


class DevHandler(ApiHandler, SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/fll"):
            return ApiHandler.do_GET(self)
        return SimpleHTTPRequestHandler.do_GET(self)

    def end_headers(self):
        if not self.path.startswith("/api/fll"):
            self.send_header("Cache-Control", "no-store")  # always serve fresh files while testing
        SimpleHTTPRequestHandler.end_headers(self)

    def do_POST(self):
        if self.path.startswith("/api/fll"):
            return ApiHandler.do_POST(self)
        self.send_error(405)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(DevHandler, directory=ROOT))
    print(f"Serving {ROOT} on http://localhost:{port}/game.html#fll")
    server.serve_forever()
