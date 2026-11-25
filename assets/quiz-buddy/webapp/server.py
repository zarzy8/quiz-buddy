# -*- coding: utf-8 -*-
"""本地刷题服务：单文件 stdlib HTTP 服务，浏览器窗口答题，答案回写到 answers.jsonl。"""
import json, os, sys, threading, http.server, socketserver

BASE = os.path.dirname(os.path.abspath(__file__))
# Usage: server.py [port] [bank.json] [answers.jsonl]
# Defaults keep everything next to this file; pass paths to keep data outside the bundle.
BANK_PATH = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE, "questions.json")
ANS_PATH = sys.argv[3] if len(sys.argv) > 3 else os.path.join(BASE, "answers.jsonl")
LOCK = threading.Lock()

BANK = json.load(open(BANK_PATH, encoding="utf-8"))
ANSWER = {q["id"]: q["answer"] for q in BANK}
PUBLIC = [{k: v for k, v in q.items() if k != "answer"} for q in BANK]


def judge(qid, given):
    right = ANSWER.get(qid)
    if right is None:
        return None, None
    given = str(given).strip().upper()
    if len(right) > 1:
        ok = "".join(sorted(set(given))) == "".join(sorted(set(right)))
    else:
        ok = given == right
    return ok, right


def record(item):
    with LOCK:
        with open(ANS_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "ReviewQuiz/1.0"

    def log_message(self, *args):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            with open(os.path.join(BASE, "index.html"), "rb") as f:
                self._send(200, f.read(), "text/html; charset=utf-8")
        elif path == "/api/questions":
            self._send(200, json.dumps(PUBLIC, ensure_ascii=False))
        elif path == "/api/state":
            stats = {"total": len(BANK), "answered": 0, "wrong": 0}
            if os.path.exists(ANS_PATH):
                for line in open(ANS_PATH, encoding="utf-8"):
                    line = line.strip()
                    if not line:
                        continue
                    stats["answered"] += 1
                    if not json.loads(line).get("correct"):
                        stats["wrong"] += 1
            self._send(200, json.dumps(stats, ensure_ascii=False))
        else:
            self._send(404, json.dumps({"error": "not found"}))

    def do_POST(self):
        if self.path != "/api/answer":
            self._send(404, json.dumps({"error": "not found"}))
            return
        length = int(self.headers.get("Content-Length", 0) or 0)
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            self._send(400, json.dumps({"error": "bad json"}))
            return
        qid = str(payload.get("id", ""))
        given = payload.get("answer", "")
        ok, right = judge(qid, given)
        if ok is None:
            self._send(400, json.dumps({"error": "unknown id"}))
            return
        record({"id": qid, "my": given, "answer": right, "correct": ok,
                "at": __import__("datetime").datetime.now().isoformat(timespec="seconds")})
        self._send(200, json.dumps({"correct": ok, "answer": right}, ensure_ascii=False))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", port), Handler) as httpd:
        print(f"serving http://127.0.0.1:{port}/", flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
