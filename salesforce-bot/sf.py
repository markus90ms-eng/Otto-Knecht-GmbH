"""Salesforce per Browser steuern (Playwright). Aktuell nur lesend."""
import argparse
import os
import sys
from pathlib import Path

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

BASE = Path(__file__).parent
STATE = BASE / ".auth" / "state.json"
SHOTS = BASE / "screenshots"


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


def main():
    load_env()
    ap = argparse.ArgumentParser(description="Salesforce-Browser-Bot (nur lesen)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("login").set_defaults(fn=cmd_login)
    a = sub.add_parser("accounts", help="Kunden auflisten")
    a.add_argument("suche", nargs="?", help="Filtertext")
    a.add_argument("--headed", action="store_true", help="Browser sichtbar")
    a.set_defaults(fn=cmd_accounts)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
