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
    url = os.environ.get("SF_URL", "").rstrip("/")
    if not url:
        sys.exit("SF_URL fehlt. Lege .env an (siehe .env.example).")
    return url


def cmd_login(_args):
    """Browser öffnen, du loggst dich selbst ein (inkl. 2FA), Sitzung wird gespeichert."""
    STATE.parent.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(sf_url())
        print("Bitte im Browser einloggen. Warte bis Salesforce (Lightning) geladen ist ...")
        page.wait_for_url("**/lightning/**", timeout=300_000)
        ctx.storage_state(path=str(STATE))
        print(f"Sitzung gespeichert in {STATE}")
        browser.close()


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
    page.wait_for_selector("table[role='grid'] tbody tr", timeout=30_000)
    rows = page.locator("table[role='grid'] tbody tr")
    last = -1
    while rows.count() != last:
        last = rows.count()
        rows.last.scroll_into_view_if_needed()
        page.wait_for_timeout(1500)
    data = []
    for i in range(rows.count()):
        row = {}
        for cell in rows.nth(i).locator("[data-label]").all():
            row[cell.get_attribute("data-label")] = cell.inner_text().strip()
        data.append(row)
    return data


def cmd_bw(args):
    """Firmen in Baden-Württemberg (PLZ 7*, 88*, 89*) ohne Aktivität seit N Tagen."""
    cutoff = date.today() - timedelta(days=args.tage)
    with sync_playwright() as p:
        browser, ctx = _session(p, args.headed)
        page = ctx.new_page()
        try:
            page.goto(f"{sf_url()}/lightning/o/Account/list?filterName={args.liste}")
            if "login" in page.url:
                sys.exit("Sitzung abgelaufen. Bitte neu: python sf.py login")
            rows = read_all_rows(page)
        except PWTimeout:
            SHOTS.mkdir(exist_ok=True)
            shot = SHOTS / "fehler.png"
            page.screenshot(path=str(shot), full_page=True)
            sys.exit(f"Timeout. Screenshot: {shot}")
        finally:
            browser.close()

    if not rows:
        sys.exit("Keine Zeilen gefunden.")
    labels = list(rows[0].keys())
    plz = find_label(labels, ("postal", "zip", "postleitzahl", "plz"), avoid=("shipping", "liefer"))
    act = find_label(labels, ("last activity", "letzte aktivit"))
    if not plz or not act:
        sys.exit(
            "In der Listenansicht fehlen Spalten.\n"
            f"Gefunden: {labels}\n"
            "Bitte in Salesforce in der Listenansicht die Spalten 'Rechnungsadresse PLZ' "
            "und 'Letzte Aktivität' einblenden (Zahnrad > Angezeigte Felder auswählen)."
        )
    hits = filter_rows(rows, plz, act, cutoff)
    name_col = labels[0]
    print(f"{len(rows)} Firmen gelesen, {len(hits)} in BW ohne Aktivität seit {cutoff}.")
    for r in hits:
        print(f"{r.get(plz, '')} | {r.get(name_col, '')} | letzte Aktivität: {r['_letzte_aktivitaet']}")
    OUT.mkdir(exist_ok=True)
    path = OUT / f"bw_ohne_aktivitaet_{date.today().isoformat()}.csv"
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=labels + ["_letzte_aktivitaet"], delimiter=";")
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
