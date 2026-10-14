"""Salesforce per Browser steuern (Playwright). Aktuell nur lesend."""
import argparse
import csv
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

BASE = Path(__file__).parent
STATE = BASE / ".auth" / "state.json"
SHOTS = BASE / "screenshots"
OUT = BASE / "output"


def load_env():
    env = BASE / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def sf_url():
    url = os.environ.get("SF_URL", "https://stroeer-eins.lightning.force.com").rstrip("/")
    if not url:
        sys.exit("SF_URL fehlt. Lege .env an (siehe .env.example).")
    return url


def do_login(log=print):
    """Browser öffnen, du loggst dich selbst ein (inkl. 2FA), Sitzung wird gespeichert."""
    STATE.parent.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(sf_url())
        log("Bitte im Browser einloggen. Warte bis Salesforce (Lightning) geladen ist ...")
        page.wait_for_url("**/lightning/**", timeout=300_000)
        page.wait_for_timeout(3000)
        ctx.storage_state(path=str(STATE))
        log(f"Sitzung gespeichert in {STATE}")
        browser.close()


def cmd_login(_args):
    do_login()


def _session(p, headed):
    if not STATE.exists():
        sys.exit("Keine Sitzung gefunden. Erst: python sf.py login")
    browser = p.chromium.launch(headless=not headed)
    return browser, browser.new_context(storage_state=str(STATE))


def cmd_accounts(args):
    """Kunden (Accounts) aus der Listenansicht 'Zuletzt angesehen' lesen, optional filtern."""
    with sync_playwright() as p:
        browser, ctx = _session(p, args.headed)
        page = ctx.new_page()
        try:
            page.goto(f"{sf_url()}/lightning/o/Account/list?filterName=Recent")
            if "login" in page.url:
                sys.exit("Sitzung abgelaufen. Bitte neu: python sf.py login")
            page.wait_for_selector("table[role='grid'] tbody tr", timeout=30_000)
            rows = page.locator("table[role='grid'] tbody tr")
            for i in range(rows.count()):
                cells = [c.inner_text().strip() for c in rows.nth(i).locator("th, td").all()]
                line = " | ".join(c for c in cells if c)
                if not args.suche or args.suche.lower() in line.lower():
                    print(line)
        except PWTimeout:
            SHOTS.mkdir(exist_ok=True)
            shot = SHOTS / "fehler.png"
            page.screenshot(path=str(shot), full_page=True)
            sys.exit(f"Timeout. Screenshot: {shot}")
        finally:
            browser.close()


# ---------- Auswertung: Baden-Württemberg + lange keine Aktivität ----------

BW_PREFIXES = ("7", "88", "89")
DATE_FORMATS = ("%d.%m.%Y", "%d.%m.%y", "%Y-%m-%d", "%m/%d/%Y", "%b %d, %Y", "%d %b %Y")


def parse_date(text):
    text = text.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def find_label(labels, wanted, avoid=()):
    """Erste Spaltenüberschrift, die eines der Stichwörter enthält."""
    for label in labels:
        low = label.lower()
        if any(w in low for w in wanted) and not any(a in low for a in avoid):
            return label
    return None


def filter_rows(rows, plz_label, act_label, cutoff, prefixes=BW_PREFIXES):
    """rows: Liste von {Spaltenname: Text}. Behält BW-Firmen ohne Aktivität seit cutoff."""
    result = []
    for r in rows:
        plz = r.get(plz_label, "").strip()
        if not (len(plz) == 5 and plz.isdigit() and plz.startswith(prefixes)):
            continue
        raw = r.get(act_label, "").strip()
        last = parse_date(raw) if raw else None
        if raw and last is None:
            continue  # unbekanntes Datumsformat: lieber nicht raten
        if last is None or last < cutoff:
            r = dict(r, _letzte_aktivitaet=last.isoformat() if last else "nie")
            result.append(r)
    return result


def read_all_rows(page):
    """Alle Zeilen der Listenansicht lesen (scrollt bis nichts mehr nachlädt)."""
    print("Warte auf die Tabelle ...", flush=True)
    page.wait_for_selector("table[role='grid'] tbody tr", timeout=60_000)
    rows = page.locator("table[role='grid'] tbody tr")
    last = -1
    while rows.count() != last:
        last = rows.count()
        print(f"  {last} Zeilen geladen ...", flush=True)
        rows.last.scroll_into_view_if_needed()
        page.wait_for_timeout(1500)
    data = []
    for i in range(rows.count()):
        row = {}
        for cell in rows.nth(i).locator("[data-label]").all():
            row[cell.get_attribute("data-label")] = cell.inner_text().strip()
        data.append(row)
    return data


# ---------- Daten sammeln: erst Salesforce-Abfrage (alle Treffer), sonst Listenansicht ----------

API_VERSION = "v59.0"


class NeedLogin(Exception):
    pass


def api_base():
    return os.environ.get("SF_API_URL") or sf_url().replace(".lightning.force.com", ".my.salesforce.com")


def soql_for(cutoff):
    like = " OR ".join(f"BillingPostalCode LIKE '{p}%'" for p in BW_PREFIXES)
    return (
        "SELECT Id, Name, BillingPostalCode, BillingCity, LastActivityDate, Owner.Name "
        f"FROM Account WHERE ({like}) "
        f"AND (LastActivityDate = NULL OR LastActivityDate < {cutoff.isoformat()}) "
        "ORDER BY Name"
    )


def fetch_via_api(ctx, cutoff, log):
    """Fragt Salesforce direkt per SOQL ab (mit der Browser-Sitzung). Keine 2000er-Grenze."""
    base = api_base()
    sids = [c["value"] for c in ctx.cookies() if c["name"] == "sid" and "salesforce.com" in c["domain"]]
    sids += [c["value"] for c in ctx.cookies() if c["name"] == "sid" and "force.com" in c["domain"]]
    if not sids:
        raise RuntimeError("keine Sitzungs-Kennung (sid) gefunden")
    last_err = "unbekannt"
    for sid in dict.fromkeys(sids):
        headers = {"Authorization": f"Bearer {sid}"}
        resp = ctx.request.get(f"{base}/services/data/{API_VERSION}/query", params={"q": soql_for(cutoff)}, headers=headers)
        if not resp.ok:
            last_err = f"HTTP {resp.status}: {resp.text()[:300]}"
            continue
        records, data = [], resp.json()
        while True:
            records += data["records"]
            log(f"  {len(records)} von {data['totalSize']} Treffern geladen ...")
            if data.get("done", True):
                return records
            data = ctx.request.get(base + data["nextRecordsUrl"], headers=headers).json()
    raise RuntimeError(last_err)


def normalize_api(records):
    out = []
    for r in records:
        plz = (r.get("BillingPostalCode") or "").strip()
        if not (len(plz) == 5 and plz.isdigit() and plz.startswith(BW_PREFIXES)):
            continue
        out.append({
            "id": r["Id"], "name": r["Name"], "plz": plz, "ort": r.get("BillingCity") or "",
            "letzte_aktivitaet": r.get("LastActivityDate") or "nie",
            "betreuer": (r.get("Owner") or {}).get("Name") or "",
            "url": f"{sf_url()}/lightning/r/Account/{r['Id']}/view",
        })
    return out


def collect(days=90, headed=False, liste="AllAccounts", log=print):
    """Liefert (Liste von Firmen, Quelle). Wirft NeedLogin, wenn die Sitzung fehlt/abgelaufen ist."""
    if not STATE.exists():
        raise NeedLogin("Noch nicht eingeloggt.")
    cutoff = date.today() - timedelta(days=days)
    with sync_playwright() as p:
        browser, ctx = _session(p, headed)
        try:
            page = ctx.new_page()
            log("Öffne Salesforce ...")
            page.goto(f"{sf_url()}/lightning/page/home")
            page.wait_for_timeout(2500)
            if "login" in page.url:
                raise NeedLogin("Sitzung abgelaufen.")
            try:
                log("Frage Salesforce direkt ab ...")
                return normalize_api(fetch_via_api(ctx, cutoff, log)), "Salesforce-Abfrage (vollständig)"
            except Exception as e:  # API gesperrt o. ä. -> Rückfall auf Listenansicht
                log(f"Direkte Abfrage nicht möglich ({e}). Lese stattdessen die Listenansicht ...")
            page.goto(f"{sf_url()}/lightning/o/Account/list?filterName={liste}")
            if "login" in page.url:
                raise NeedLogin("Sitzung abgelaufen.")
            rows = read_all_rows(page)
        finally:
            browser.close()
    if not rows:
        raise RuntimeError("Keine Zeilen in der Listenansicht gefunden.")
    labels = list(rows[0].keys())
    plz = find_label(labels, ("postal", "zip", "postleitzahl", "plz"), avoid=("shipping", "liefer"))
    act = find_label(labels, ("last activity", "letzte aktivit"))
    if not plz or not act:
        raise RuntimeError(f"In der Listenansicht fehlen die Spalten PLZ und Letzte Aktivität. Gefunden: {labels}")
    out = []
    for r in filter_rows(rows, plz, act, cutoff):
        out.append({
            "id": "", "name": r.get(labels[0], ""), "plz": r.get(plz, ""), "ort": "",
            "letzte_aktivitaet": r["_letzte_aktivitaet"], "betreuer": "", "url": "",
        })
    note = "Listenansicht"
    if len(rows) >= 2000:
        note += " – UNVOLLSTÄNDIG (Salesforce zeigt max. 2000 Einträge)"
    return out, note


def cmd_bw(args):
    """Firmen in Baden-Württemberg (PLZ 7*, 88*, 89*) ohne Aktivität seit N Tagen."""
    try:
        hits, source = collect(args.tage, args.headed, args.liste)
    except NeedLogin as e:
        sys.exit(f"{e} Bitte zuerst: python sf.py login")
    except Exception as e:
        sys.exit(f"Fehler: {type(e).__name__}: {e}")
    print(f"{len(hits)} Firmen in BW ohne Aktivität seit {args.tage} Tagen. Quelle: {source}")
    for r in hits:
        print(f"{r['plz']} | {r['name']} | letzte Aktivität: {r['letzte_aktivitaet']}")
    OUT.mkdir(exist_ok=True)
    path = OUT / f"bw_ohne_aktivitaet_{date.today().isoformat()}.csv"
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["name", "plz", "ort", "letzte_aktivitaet", "betreuer", "url"], delimiter=";", extrasaction="ignore")
        w.writeheader()
        w.writerows(hits)
    print(f"CSV gespeichert: {path}")


def main():
    load_env()
    ap = argparse.ArgumentParser(description="Salesforce-Browser-Bot (nur lesen)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("login").set_defaults(fn=cmd_login)
    a = sub.add_parser("accounts", help="Kunden auflisten")
    a.add_argument("suche", nargs="?", help="Filtertext")
    a.add_argument("--headed", action="store_true", help="Browser sichtbar")
    a.set_defaults(fn=cmd_accounts)
    b = sub.add_parser("bw", help="BW-Firmen (PLZ 7/88/89) ohne Aktivität seit N Tagen")
    b.add_argument("--tage", type=int, default=90, help="Tage ohne Aktivität (Standard 90)")
    b.add_argument("--liste", default="AllAccounts", help="Name der Listenansicht (Standard AllAccounts)")
    b.add_argument("--headed", action="store_true", help="Browser sichtbar")
    b.set_defaults(fn=cmd_bw)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
