"""Salesforce per Browser steuern (Playwright). Aktuell nur lesend."""
import argparse
import csv
import os
import re
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


def skip_passkey_prompt(page, list_url, log):
    """Salesforce zeigt manchmal eine Passkey-Einrichtung statt der Seite. Wenn möglich überspringen."""
    if "passkey" not in page.url.lower() and "webauthn" not in page.url.lower():
        return
    log("  Salesforce fragt nach einem Passkey. Versuche zu überspringen ...")
    for label in ("Später", "Spaeter", "Überspringen", "Skip", "Not now", "Nicht jetzt", "Maybe later", "Remind me later"):
        pattern = re.compile(label, re.I)
        btn = page.get_by_role("button", name=pattern).or_(page.get_by_role("link", name=pattern))
        if btn.count():
            btn.first.click()
            page.wait_for_timeout(2500)
            break
    page.goto(list_url)
    page.wait_for_timeout(3000)


def read_all_rows(page):
    """Alle Zeilen der Listenansicht lesen (scrollt bis nichts mehr nachlädt)."""
    print("Warte auf die Tabelle ...", flush=True)
    page.wait_for_selector("table[role='grid'] tbody tr", timeout=60_000)
    rows = page.locator("table[role='grid'] tbody tr")
    last = rows.count()
    while True:
        print(f"  {last} Zeilen geladen ...", flush=True)
        rows.last.scroll_into_view_if_needed()
        for _ in range(20):  # bis zu 4 s auf neue Zeilen warten
            page.wait_for_timeout(200)
            if rows.count() > last:
                break
        else:
            break
        last = rows.count()
    # alle Zeilen in einem Rutsch aus dem Browser holen (viel schneller als einzeln)
    return page.evaluate("""() => [...document.querySelectorAll("table[role='grid'] tbody tr")].map((tr) => {
        const o = {};
        tr.querySelectorAll('[data-label]').forEach((c) => { o[c.getAttribute('data-label')] = c.innerText.trim(); });
        return o;
    })""")


def api_base():
    return os.environ.get("SF_API_URL") or sf_url().replace(".lightning.force.com", ".my.salesforce.com")


ACCOUNT_FIELDS_FULL = (
    "Id, Name, BillingPostalCode, BillingCity, BillingStreet, LastActivityDate, Owner.Name, "
    "Type, Industry, Phone, Website, AnnualRevenue, NumberOfEmployees"
)
ACCOUNT_FIELDS_CORE = "Id, Name, BillingPostalCode, BillingCity, LastActivityDate, Owner.Name"


def plz_like(prefix=""):
    return " OR ".join(f"{prefix}BillingPostalCode LIKE '{p}%'" for p in BW_PREFIXES)


def _sids(ctx):
    vals = [c["value"] for c in ctx.cookies() if c["name"] == "sid" and ("salesforce.com" in c["domain"] or "force.com" in c["domain"])]
    return list(dict.fromkeys(vals))


def _try_sids(ctx, base, sids):
    last_err = "keine Sitzungs-Kennung (sid) gefunden"
    for sid in sids:
        headers = {"Authorization": f"Bearer {sid}"}
        resp = ctx.request.get(f"{base}/services/data/{API_VERSION}/query", params={"q": "SELECT Id FROM Account LIMIT 1"}, headers=headers)
        if resp.ok:
            return headers
        last_err = f"HTTP {resp.status}: {resp.text()[:200]}"
    raise RuntimeError(last_err)


def api_login(ctx, log=print):
    """Probiert die Browser-Sitzung für die Salesforce-Abfrage. Wenn die Firma das sperrt, klappt es nicht
    (dann wird die Listenansicht gelesen)."""
    base = api_base()
    seen = sorted({f"{c['name']}@{c['domain']}" for c in ctx.cookies() if c["name"] == "sid"})
    log(f"  Cookies: {', '.join(seen) or 'keine'}")
    return base, _try_sids(ctx, base, _sids(ctx))


def api_query_all(ctx, base, headers, soql, log, label):
    resp = ctx.request.get(f"{base}/services/data/{API_VERSION}/query", params={"q": soql}, headers=headers)
    if not resp.ok:
        raise RuntimeError(f"HTTP {resp.status}: {resp.text()[:300]}")
    records, data = [], resp.json()
    while True:
        records += data["records"]
        log(f"  {label}: {len(records)} von {data['totalSize']} geladen ...")
        if data.get("done", True):
            return records
        resp = ctx.request.get(base + data["nextRecordsUrl"], headers=headers)
        if not resp.ok:
            raise RuntimeError(f"HTTP {resp.status}: {resp.text()[:300]}")
        data = resp.json()


def fetch_via_api(ctx, log):
    """Alle Firmen in BW plus bisherige Buchungen (gewonnene Verkaufschancen), per SOQL."""
    base, headers = api_login(ctx, log)
    try:
        accounts = api_query_all(ctx, base, headers,
                                 f"SELECT {ACCOUNT_FIELDS_FULL} FROM Account WHERE ({plz_like()})", log, "Firmen")
    except RuntimeError as e:
        log(f"  Einige Felder sind nicht lesbar ({str(e)[:120]}). Versuche Grundfelder ...")
        accounts = api_query_all(ctx, base, headers,
                                 f"SELECT {ACCOUNT_FIELDS_CORE} FROM Account WHERE ({plz_like()})", log, "Firmen")
    bookings = None
    try:
        opps = api_query_all(
            ctx, base, headers,
            "SELECT AccountId, Amount, CloseDate FROM Opportunity "
            f"WHERE IsWon = true AND AccountId != NULL AND ({plz_like('Account.')})", log, "Buchungen")
        bookings = {}
        for o in opps:
            b = bookings.setdefault(o["AccountId"], {"anzahl": 0, "umsatz": 0.0, "letzte": ""})
            b["anzahl"] += 1
            b["umsatz"] += o.get("Amount") or 0
            b["letzte"] = max(b["letzte"], o.get("CloseDate") or "")
    except RuntimeError as e:
        log(f"  Buchungsdaten nicht lesbar ({str(e)[:120]}). Weiter ohne Buchungen.")
    return accounts, bookings


def normalize_api(accounts, bookings):
    out = []
    for r in accounts:
        plz = (r.get("BillingPostalCode") or "").strip()
        if not (len(plz) == 5 and plz.isdigit() and plz.startswith(BW_PREFIXES)):
            continue
        b = (bookings or {}).get(r["Id"])
        out.append({
            "id": r["Id"], "name": r["Name"], "plz": plz, "ort": r.get("BillingCity") or "",
            "strasse": r.get("BillingStreet") or "",
            "letzte_aktivitaet": r.get("LastActivityDate") or "nie",
            "betreuer": (r.get("Owner") or {}).get("Name") or "",
            "typ": r.get("Type") or "", "branche": r.get("Industry") or "",
            "telefon": r.get("Phone") or "", "website": r.get("Website") or "",
            "jahresumsatz": r.get("AnnualRevenue"), "mitarbeiter": r.get("NumberOfEmployees"),
            "gebucht_anzahl": b["anzahl"] if b else 0,
            "gebucht_umsatz": round(b["umsatz"]) if b else 0,
            "letzte_buchung": b["letzte"] if b else "",
            "url": f"{sf_url()}/lightning/r/Account/{r['Id']}/view",
        })
    return out


def collect(headed=False, liste="AllAccounts", log=print):
    """Liefert (alle BW-Firmen, Quelle, hat_buchungsdaten). Filtern passiert danach (Webseite/CLI)."""
    if not STATE.exists():
        raise NeedLogin("Noch nicht eingeloggt.")
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
                accounts, bookings = fetch_via_api(ctx, log)
                src = "Salesforce-Abfrage (vollständig)" + ("" if bookings is not None else ", ohne Buchungsdaten")
                return normalize_api(accounts, bookings), src, bookings is not None
            except Exception as e:  # API gesperrt o. ä. -> Rückfall auf Listenansicht
                log(f"Direkte Abfrage nicht möglich ({e}). Lese stattdessen die Listenansicht ...")
            list_url = f"{sf_url()}/lightning/o/Account/list?filterName={liste}"
            page.goto(list_url)
            page.wait_for_timeout(3000)
            skip_passkey_prompt(page, list_url, log)
            log(f"  Seite: {page.url.split('?')[0]} | Titel: {page.title()}")
            if "login" in page.url:
                raise NeedLogin("Sitzung abgelaufen.")
            try:
                rows = read_all_rows(page)
            except Exception as e:
                SHOTS.mkdir(exist_ok=True)
                shot = SHOTS / "fehler.png"
                page.screenshot(path=str(shot), full_page=True)
                raise RuntimeError(f"Listenansicht nicht lesbar ({str(e).splitlines()[0]}). Seite: {page.url.split('?')[0]}. Screenshot: {shot}")
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
    for r in filter_rows(rows, plz, act, date.today() + timedelta(days=1)):  # alle BW-Firmen behalten
        out.append({
            "id": "", "name": r.get(labels[0], ""), "plz": r.get(plz, ""), "ort": "", "strasse": "",
            "letzte_aktivitaet": r["_letzte_aktivitaet"], "betreuer": "", "typ": "", "branche": "",
            "telefon": "", "website": "", "jahresumsatz": None, "mitarbeiter": None,
            "gebucht_anzahl": 0, "gebucht_umsatz": 0, "letzte_buchung": "", "url": "",
        })
    note = "Listenansicht, ohne Buchungsdaten"
    if len(rows) >= 2000:
        note += " – UNVOLLSTÄNDIG (Salesforce zeigt max. 2000 Einträge)"
    return out, note, False


def cmd_bw(args):
    """Firmen in Baden-Württemberg (PLZ 7*, 88*, 89*) ohne Aktivität seit N Tagen."""
    try:
        rows, source, _ = collect(args.headed, args.liste)
    except NeedLogin as e:
        sys.exit(f"{e} Bitte zuerst: python sf.py login")
    except Exception as e:
        sys.exit(f"Fehler: {type(e).__name__}: {e}")
    cutoff = (date.today() - timedelta(days=args.tage)).isoformat()
    hits = [r for r in rows if r["letzte_aktivitaet"] == "nie" or r["letzte_aktivitaet"] < cutoff]
    print(f"{len(hits)} von {len(rows)} Firmen in BW ohne Aktivität seit {args.tage} Tagen. Quelle: {source}")
    for r in hits:
        print(f"{r['plz']} | {r['name']} | letzte Aktivität: {r['letzte_aktivitaet']}")
    OUT.mkdir(exist_ok=True)
    path = OUT / f"bw_ohne_aktivitaet_{date.today().isoformat()}.csv"
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(hits[0].keys()) if hits else ["name"], delimiter=";", extrasaction="ignore")
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
