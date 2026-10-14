"""Lokaler Server: Die Leadgenerator-Seite drückt hier auf "Liste erstellen".

Läuft nur auf deinem Rechner (127.0.0.1). Die Salesforce-Daten verlassen den Rechner nicht,
sie gehen nur an deinen Browser. Nur die erlaubten Seiten dürfen zugreifen.
"""
import json
import sys
import threading
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import sf

PORT = 8766
PAGE = "https://markus90ms-eng.github.io/Leadgenerator/#salesforce"
ALLOWED_ORIGINS = {
    "https://markus90ms-eng.github.io",
    "http://127.0.0.1:8765",
    "http://localhost:8765",
}
LATEST = sf.OUT / "salesforce_latest.json"

job = {"state": "idle", "kind": "", "log": [], "message": "", "updated": ""}
result = {"rows": [], "source": "", "days": 90, "updated": ""}
lock = threading.Lock()


def log(text):
    print(text, flush=True)
    job["log"].append(text)


def run_job(kind, days, headed):
    try:
        if kind == "login":
            sf.do_login(log)
            job.update(state="done", message="Eingeloggt.")
        else:
            rows, source = sf.collect(days, headed, log=log)
            result.update(rows=rows, source=source, days=days, updated=datetime.now().isoformat(timespec="seconds"))
            sf.OUT.mkdir(exist_ok=True)
            LATEST.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
            job.update(state="done", message=f"{len(rows)} Firmen gefunden ({source}).")
    except sf.NeedLogin as e:
        job.update(state="need_login", message=str(e))
    except Exception as e:
        job.update(state="error", message=f"{type(e).__name__}: {e}")
        log(job["message"])


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _origin_ok(self):
        origin = self.headers.get("Origin")
        return origin is None or origin in ALLOWED_ORIGINS

    def _send(self, code, body=None):
        data = json.dumps(body, ensure_ascii=False).encode() if body is not None else b""
        self.send_response(code)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Vary", "Origin")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send(204 if self._origin_ok() else 403)

    def do_GET(self):
        if not self._origin_ok():
            return self._send(403, {"error": "Origin nicht erlaubt"})
        path = urlparse(self.path).path
        if path == "/status":
            return self._send(200, {
                **job, "logged_in": sf.STATE.exists(),
                "count": len(result["rows"]), "result_updated": result["updated"],
            })
        if path == "/result":
            return self._send(200, result)
        self._send(404, {"error": "unbekannt"})

    def do_POST(self):
        if not self._origin_ok():
            return self._send(403, {"error": "Origin nicht erlaubt"})
        url = urlparse(self.path)
        if url.path not in ("/run", "/login"):
            return self._send(404, {"error": "unbekannt"})
        q = parse_qs(url.query)
        with lock:
            if job["state"] == "running":
                return self._send(409, {"error": "läuft bereits"})
            kind = "login" if url.path == "/login" else "liste"
            days = max(1, min(int(q.get("days", ["90"])[0]), 3650))
            headed = q.get("headed", ["0"])[0] == "1"
            job.update(state="running", kind=kind, log=[], message="")
        threading.Thread(target=run_job, args=(kind, days, headed), daemon=True).start()
        self._send(202, {"started": kind})


def main():
    sf.load_env()
    if LATEST.exists():
        try:
            result.update(json.loads(LATEST.read_text(encoding="utf-8")))
        except Exception:
            pass
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        sys.exit(f"Port {PORT} ist schon belegt. Läuft der Server evtl. schon in einem anderen Fenster?")
    print(f"Salesforce-Server läuft auf http://127.0.0.1:{PORT}")
    print("Dieses Fenster offen lassen, solange du die Liste nutzt. Zum Beenden: Fenster schließen.")
    if "--no-browser" not in sys.argv:
        webbrowser.open(PAGE)
    server.serve_forever()


if __name__ == "__main__":
    main()
