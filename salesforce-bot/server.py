"""Lokaler Server: Die Leadgenerator-Seite drückt hier auf "Liste erstellen".

Läuft nur auf deinem Rechner (127.0.0.1). Die Salesforce-Daten verlassen den Rechner nicht,
sie gehen nur an deinen Browser. Nur die erlaubten Seiten dürfen zugreifen.
"""
import json
import os
import re
import sys
import threading
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import check
import scan
import sf

PORT = 8766
VERSION = "2026-10-14-30 (Suche über Trefferseite, Reiter Details und Aktivität)"
PAGE = f"http://127.0.0.1:{PORT}/"
LEADGEN_PAGE = "https://markus90ms-eng.github.io/Leadgenerator/#salesforce"
UI_DIR = sf.BASE / "ui"
CONTENT_TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8"}
ALLOWED_ORIGINS = {
    f"http://127.0.0.1:{PORT}",
    f"http://localhost:{PORT}",
    "https://markus90ms-eng.github.io",
    "http://127.0.0.1:8765",
    "http://localhost:8765",
}
LATEST = sf.OUT / "salesforce_latest.json"
CHECKS = sf.OUT / "checks.json"
checks = {}
diag = {}
stop_event = threading.Event()

job = {"state": "idle", "kind": "", "log": [], "message": "", "updated": ""}
result = {"rows": [], "source": "", "has_bookings": False, "updated": ""}
lock = threading.Lock()


def log(text):
    print(text, flush=True)
    job["log"].append(text)
    if len(job["log"]) > 300:  # lange Nachtläufe: Protokoll klein halten
        del job["log"][:100]


def save_check(lead_id, res):
    checks[lead_id] = res
    try:
        sf.OUT.mkdir(exist_ok=True)
        CHECKS.write_text(json.dumps(checks, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass


def keep_awake(on):
    """Windows: Standby verhindern, solange ein Lauf aktiv ist (ohne Admin-Rechte)."""
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.kernel32.SetThreadExecutionState(0x80000001 if on else 0x80000000)
        except Exception:
            pass


def run_job(kind, days, headed, liste, leads=None):
    keep_awake(True)
    try:
        if kind == "scan_list":
            n = scan.list_accounts(leads["prefixes"], log, stop_event, leads.get("term") or "{p}*", leads.get("city", ""), leads.get("status_mode", "alle"))
            job.update(state="done", message=f"{n} Accounts aufgelistet." + (" (angehalten)" if stop_event.is_set() else ""))
        elif kind == "scan_details":
            n = scan.read_details(leads["max"], leads["status"], log, stop_event)
            job.update(state="done", message=f"Kontaktdaten für {n} Accounts gelesen." + (" (angehalten)" if stop_event.is_set() else ""))
        elif kind == "diagnose":
            diag.clear()
            diag.update(check.diagnose_search(leads[0]["name"], headed, log))
            job.update(state="done", message="Seitenanalyse fertig.")
        elif kind == "check":
            check.check_leads(leads, liste, headed, log, save_check)
            job.update(state="done", message=f"{len(leads)} Firmen mit Salesforce abgeglichen.")
        elif kind == "login":
            sf.do_login(log)
            job.update(state="done", message="Eingeloggt.")
        else:
            rows, source, has_bookings = sf.collect(headed, liste=liste, log=log)
            result.update(rows=rows, source=source, has_bookings=has_bookings,
                          updated=datetime.now().isoformat(timespec="seconds"))
            sf.OUT.mkdir(exist_ok=True)
            LATEST.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
            job.update(state="done", message=f"{len(rows)} Firmen gefunden ({source}).")
    except sf.NeedLogin as e:
        job.update(state="need_login", message=str(e))
    except Exception as e:
        job.update(state="error", message=f"{type(e).__name__}: {e}")
        log(job["message"])
    finally:
        keep_awake(False)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Jede Anfrage zeigen, damit man sieht, ob die Seite den Server erreicht
        print(f"[Anfrage] {self.command} {self.path}  (von {self.headers.get('Origin') or 'direkt'})", flush=True)

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
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Pragma")
            self.send_header("Vary", "Origin")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send(204 if self._origin_ok() else 403)

    def _send_file(self, name):
        target = UI_DIR / name
        if target.suffix not in CONTENT_TYPES or not target.is_file() or target.parent != UI_DIR:
            return self._send(404, {"error": "unbekannt"})
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES[target.suffix])
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self._origin_ok():
            return self._send(403, {"error": "Origin nicht erlaubt"})
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            return self._send_file("index.html")
        if path.lstrip("/") in ("salesforce.js", "shim.js", "style.css", "sfcheck.js", "abgleich.html", "scan.html"):
            return self._send_file(path.lstrip("/"))
        if path == "/status":
            return self._send(200, {
                **job, "logged_in": sf.STATE.exists(),
                "count": len(result["rows"]), "result_updated": result["updated"], "version": VERSION,
            })
        if path == "/result":
            return self._send(200, result)
        if path == "/checks":
            return self._send(200, checks)
        if path == "/diag":
            return self._send(200, diag)
        if path == "/scan":
            return self._send(200, scan.snapshot())
        self._send(404, {"error": "unbekannt"})

    def do_POST(self):
        if not self._origin_ok():
            return self._send(403, {"error": "Origin nicht erlaubt"})
        url = urlparse(self.path)
        if url.path not in ("/run", "/login", "/check", "/diagnose", "/scan/list", "/scan/details", "/stop"):
            return self._send(404, {"error": "unbekannt"})
        leads = None
        if url.path == "/stop":
            stop_event.set()
            return self._send(200, {"stop": True})
        if url.path in ("/scan/list", "/scan/details"):
            try:
                length = min(int(self.headers.get("Content-Length", 0)), 100_000)
                body = json.loads(self.rfile.read(length) or b"{}")
                if url.path == "/scan/list":
                    prefixes = [str(x).strip() for x in body.get("prefixes", []) if re.fullmatch(r"\d{1,5}", str(x).strip())][:500]
                    if not prefixes:
                        return self._send(400, {"error": "keine gültigen PLZ-Anfänge"})
                    term = str(body.get("term") or "{p}*")[:40]
                    city = str(body.get("city") or "").strip()[:60]
                    if not re.fullmatch(r"[\w .\-/()äöüÄÖÜß]*", city):
                        return self._send(400, {"error": "ungültiger Stadtname"})
                    leads = {"prefixes": prefixes, "term": term if "{p}" in term else "{p}*", "city": city, "status_mode": "vorgabe" if body.get("status_mode") == "vorgabe" else "alle"}
                else:
                    status = str(body.get("status") or "")[:80]
                    re.compile(status or ".")
                    leads = {"max": max(1, min(int(body.get("max", 500)), 50_000)), "status": status}
            except (ValueError, TypeError, re.error):
                return self._send(400, {"error": "ungültige Eingabe"})
        if url.path == "/check":
            try:
                length = min(int(self.headers.get("Content-Length", 0)), 1_000_000)
                body = json.loads(self.rfile.read(length) or b"{}")
                leads = [
                    {"id": str(x["id"])[:200], "name": str(x.get("name", ""))[:200], "phone": str(x.get("phone", ""))[:40], "plz": str(x.get("plz", ""))[:10]}
                    for x in body.get("leads", [])[:300] if x.get("id") and x.get("name")
                ]
            except (ValueError, KeyError, TypeError):
                return self._send(400, {"error": "ungültige Daten"})
            if not leads:
                return self._send(400, {"error": "keine Firmen übergeben"})
        q = parse_qs(url.query)
        if url.path == "/diagnose":
            term = q.get("term", [""])[0].strip()[:100]
            if not term:
                return self._send(400, {"error": "kein Suchbegriff"})
            leads = [{"id": "diag", "name": term}]
        with lock:
            if job["state"] == "running":
                return self._send(409, {"error": "läuft bereits"})
            kind = {"/login": "login", "/check": "check", "/diagnose": "diagnose", "/scan/list": "scan_list", "/scan/details": "scan_details"}.get(url.path, "liste")
            days = max(1, min(int(q.get("days", ["90"])[0]), 3650))
            headed = q.get("headed", ["0"])[0] == "1"
            liste = q.get("liste", [""])[0].strip()
            if not re.fullmatch(r"[A-Za-z0-9_]{1,40}", liste):
                liste = "AllAccounts"
            stop_event.clear()
            job.update(state="running", kind=kind, log=[], message="")
        threading.Thread(target=run_job, args=(kind, days, headed, liste, leads), daemon=True).start()
        self._send(202, {"started": kind})


def main():
    sf.load_env()
    if CHECKS.exists():
        try:
            checks.update(json.loads(CHECKS.read_text(encoding="utf-8")))
        except Exception:
            pass
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
    print(f"Programmversion: {VERSION}")
    print(f"Die Seite öffnet sich automatisch. Falls nicht: {PAGE} im Browser öffnen.")
    print("Dieses Fenster offen lassen, solange du die Liste nutzt. Zum Beenden: Fenster schließen.")
    if "--no-browser" not in sys.argv:
        webbrowser.open(PAGE)
    server.serve_forever()


if __name__ == "__main__":
    main()
