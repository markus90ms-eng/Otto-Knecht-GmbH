"""Bestands-Scan über Nacht (nur lesen).

Phase 1: Accounts je PLZ-Anfang auflisten (Salesforce-Suche, Account-Trefferseite mit PLZ-Filter).
         Ist die Liste so lang, dass Salesforce sie abschneiden könnte, wird der PLZ-Anfang automatisch verfeinert.
Phase 2: Für die gewünschten Accounts (Standard: Firmenstatus Potenzial, nicht gesperrt) die Account-Seite öffnen
         und den letzten Kontakt lesen (Aktivitätsverlauf, 'Zuletzt geändert').
Alles wird laufend in output/ gespeichert; ein Abbruch kostet nichts, ein neuer Start macht weiter.
"""
import json
import re
from datetime import datetime

import check
import sf

ACC_FILE = sf.OUT / "scan_accounts.json"
DET_FILE = sf.OUT / "scan_details.json"
CAP = 50  # Die Trefferseite zeigt (nach bisherigen Tests) höchstens 50 Zeilen: ab dort PLZ-Anfang verfeinern
RESTART_EVERY = 150  # Browser regelmäßig neu starten (lange Läufe)


def load(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save(path, data):
    sf.OUT.mkdir(exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def account_id(href):
    m = re.search(r"/r/(?:Account/)?([A-Za-z0-9]{15,18})", href or "")
    return m.group(1) if m else ""


SCROLL_JS = "() => {" + sf.DEEP + """
  const t = deepAll("table[role='grid']")[0];
  if (!t) return false;
  const scrollable = (e) => { const st = getComputedStyle(e); return /(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 5; };
  const parentOf = (e) => e.parentElement || (e.getRootNode && e.getRootNode().host) || null;
  let el = t;
  while (el && !scrollable(el)) el = parentOf(el);
  if (!el) { const y = window.scrollY; window.scrollBy(0, window.innerHeight * 0.7); return window.scrollY !== y; }
  const before = el.scrollTop;
  el.scrollTop += Math.max(150, el.clientHeight * 0.6);
  return el.scrollTop !== before;
}"""


def read_rows(page):
    """Alle Zeilen der Account-Tabelle lesen. Salesforce lädt beim Scrollen nach und hält nur einen Ausschnitt im Browser:
    deshalb in kleinen Schritten scrollen und die Zeilen nach jedem Schritt sammeln (nicht nur am Ende lesen)."""
    seen, last_n, stable = {}, -1, 0
    for _ in range(3000):
        for r in page.evaluate(check.ACCOUNTS_JS) or []:
            seen[r.get("__href") or r.get("__text")] = r
        moved = False
        try:
            moved = page.evaluate(SCROLL_JS)
        except Exception:
            pass
        if not moved:  # Rückfall: letzte Zeile in den Sichtbereich holen (löst bei vielen Seiten das Nachladen aus)
            try:
                page.locator("table[role='grid'] tbody tr").last.scroll_into_view_if_needed(timeout=3000)
            except Exception:
                pass
        page.wait_for_timeout(700)
        if len(seen) == last_n:
            try:  # manche Listen laden erst über einen Knopf nach
                btn = page.get_by_role("button", name=re.compile(r"^(Mehr|Weitere|Load more|Show more)", re.I)).first
                if btn.is_visible(timeout=300):
                    btn.click(timeout=2000)
                    page.wait_for_timeout(1500)
            except Exception:
                pass
        stable = stable + 1 if len(seen) == last_n else 0
        last_n = len(seen)
        if stable >= 6:
            break
    return list(seen.values())


def parse_row(r, prefix):
    plz = (r.get("PLZ (Rechnungsanschrift)") or "").strip()
    if not re.fullmatch(r"\d{5}", plz) or not plz.startswith(prefix):
        return None  # nur deutsche 5-stellige PLZ im gewünschten Bereich (4-stellige wie 7040 Zypern fallen raus)
    href = r.get("__href", "")
    return {
        "id": account_id(href), "name": r.get("Accountname", ""), "plz": plz,
        "ort": r.get("Stadt (Rechnungsanschrift)", ""), "strasse": r.get("Straße (Rechnungsanschrift)", ""),
        "status": r.get("Firmenstatus", ""), "sperre": check.truthy(r.get("Kunden Kontaktsperre")),
        "sperre_status": r.get("Account Sperre Status", ""), "vis": r.get("VIS ID", ""), "debitor": r.get("Debitoren-Nr.", ""),
        "url": (sf.sf_url() + href) if href.startswith("/") else href,
    }


def open_scoped(page, prefix, term_tpl, log, city="", status=None):
    """Suche öffnen, zur Account-Trefferseite wechseln, PLZ-Filter setzen. Gibt 'ok' oder 'leer' zurück."""
    term = term_tpl.format(p=prefix)
    url = check.search_url(term)
    page.goto("about:blank")
    page.goto(url)
    page.wait_for_timeout(6000)
    sf.skip_passkey_prompt(page, url, log)
    if "login" in page.url:
        raise sf.NeedLogin("Sitzung abgelaufen.")
    try:
        page.get_by_role("link", name=re.compile(r"Mehr anzeigen.*Accounts", re.I | re.S)).first.click(timeout=8000)
    except Exception:
        if re.search(r"Keine Ergebnisse|keine Treffer|No results", page.evaluate(check.PAGE_TEXT_JS), re.I) or check_no_accounts(page):
            return "leer"
        raise RuntimeError("Wechsel zur Account-Trefferseite nicht möglich (Seite: %s)" % page.url.split("#")[0])
    page.wait_for_timeout(6000)
    set_filter(page, r"^PLZ", prefix)
    if city:
        set_filter(page, r"^Stadt", city)
    if status:
        choose_status(page, status)
    apply_filters(page, 6000)
    return "ok"


def combobox_button(page, label):
    btn = page.get_by_role("combobox", name=re.compile(label, re.I)).first
    if btn.count() == 0:
        btn = page.locator("button").filter(has_text=re.compile(label, re.I)).first
    return btn


def choose_status(page, text):
    """Firmenstatus-Auswahlfeld öffnen und die Option mit genau diesem Text wählen."""
    combobox_button(page, "Firmenstatus").click(timeout=6000)
    page.wait_for_timeout(1000)
    page.get_by_role("option", name=re.compile(r"^\s*" + re.escape(text) + r"\s*$", re.I)).first.click(timeout=6000)
    page.wait_for_timeout(800)


def set_filter(page, label_rx, value):
    page.get_by_label(re.compile(label_rx, re.I)).first.fill(value, timeout=8000)


def apply_filters(page, wait_ms=4500):
    page.get_by_role("button", name=re.compile(r"Anwenden", re.I)).first.click(timeout=8000)
    page.wait_for_timeout(wait_ms)


def result_label(page):
    try:
        return next((l for l in page.evaluate(check.LINES_JS) if re.match(r"^[\d.]+\+?\s+Ergebnis", l)), "")
    except Exception:
        return ""


def fetch_prefix(page, prefix, term_tpl, log, city="", status=None):
    """Gibt (Zeilen, 'ok'|'capped'|'leer') zurück."""
    if open_scoped(page, prefix, term_tpl, log, city, status) == "leer":
        return [], "leer"
    rows = read_rows(page)
    label = result_label(page)
    log(f"    PLZ {prefix}: {len(rows)} Zeilen gelesen (Salesforce meldet: {label or 'k. A.'})")
    out = [x for x in (parse_row(r, prefix) for r in rows) if x]
    return out, ("capped" if label.rstrip().endswith("+") else "ok")


NAME_CHARS = list("abcdefghijklmnopqrstuvwxyzäöü0123456789") + list("-_(\"'&.+#/@")
NEXT_CHARS = list("abcdefghijklmnopqrstuvwxyzäöüß0123456789 -.&")
MAX_DEPTH = 4
SATURATION = 45  # 'enthält'-Aufteilung: so viele Teilabfragen ohne neuen Account = fertig


def split_capped(page, plz, term_tpl, field_rx, chars, nexts, log, stop, city="", status=None):
    """Eine PLZ mit mehr Accounts als sichtbar: zusätzlich nach einem Textfeld (Anfang) aufteilen.
    Gibt (Zeilen, vollständig) zurück oder (None, False), wenn das Feld nicht nach 'beginnt mit' filtert."""
    if open_scoped(page, plz, term_tpl, log, city, status) == "leer":
        return [], True
    found, complete, semantics = {}, True, None
    queue = list(chars)
    tried = set()
    asked = since_new = 0
    while queue and not stop.is_set():
        pre = queue.pop(0)
        if pre in tried:
            continue
        tried.add(pre)
        set_filter(page, field_rx, pre)
        apply_filters(page)
        rows = [x for x in (parse_row(r, plz) for r in read_rows(page)) if x]
        asked += 1
        key_of = (lambda r: r["name"]) if "Accountname" in field_rx else (lambda r: r["vis"])
        if semantics is None and rows:  # erste Abfrage mit Treffern: filtert das Feld wirklich nach dem Anfang?
            ok = sum(1 for r in rows if key_of(r).lower().startswith(pre.lower()))
            semantics = "prefix" if ok >= max(1, int(0.8 * len(rows))) else "contains"
            if semantics == "contains":
                log(f"    {plz}: Feld {field_rx} filtert nach 'enthält' ({ok}/{len(rows)}), teile nach Buchstabenfolgen auf.")
        before = len(found)
        for r in rows:
            found[r["id"] or r["url"] or r["name"] + r["plz"]] = r
        since_new = 0 if len(found) > before else since_new + 1
        if semantics == "contains" and since_new >= SATURATION and asked > len(chars):
            log(f"    {plz}: {SATURATION} Teilabfragen ohne neuen Account, Aufteilen gilt als gesättigt ({len(found)} Accounts).")
            return list(found.values()), True
        if len(rows) >= CAP:
            if len(pre) < MAX_DEPTH:
                if semantics == "contains":  # 'enthält': Folge dahinter und davor abfragen, Doppelte fallen über found weg
                    ext = [pre + c for c in nexts] + [c + pre for c in nexts]
                    queue = [e for e in ext if e not in tried] + queue
                else:
                    queue = [pre + c for c in nexts] + queue
            else:
                complete = False
        if asked % 10 == 0:
            log(f"    {plz}: {asked} Teilabfragen, {len(found)} Accounts bisher, noch {len(queue)} offen")
    return list(found.values()), complete and not stop.is_set()


def check_no_accounts(page):
    """True, wenn die Trefferseite gar keine Account-Tabelle hat (dann gibt es für den Begriff keine Accounts)."""
    try:
        return page.evaluate(check.ACCOUNTS_JS) is None
    except Exception:
        return False


def status_values(page, prefix, term_tpl, log, city, mode):
    """Welche Firmenstatus-Werte sollen durchsucht werden? [None] = Voreinstellung der Seite (nur 'Potenzial').
    Bei mode 'alle': Auswahlfeld öffnen; gibt es eine 'Alle'-Option, wird sie benutzt, sonst werden alle Optionen einzeln durchsucht."""
    if mode != "alle":
        return [None]
    if open_scoped(page, prefix, term_tpl, log, city) == "leer":
        raise RuntimeError("Der erste PLZ-Anfang %s liefert keine Treffer: Firmenstatus-Optionen lassen sich so nicht lesen. Bitte einen PLZ-Anfang mit Accounts wählen." % prefix)
    info = check.combobox_info(page, "Firmenstatus")
    opts = [o["text"] for o in info.get("optionen", []) if o.get("text")]
    log(f"Firmenstatus-Auswahl: aktuell „{info.get('aktuell', '?')}“, Optionen: {opts or 'nicht lesbar'}")
    if not opts:
        raise RuntimeError("Firmenstatus-Optionen nicht lesbar (%s). Bitte die Analyse ausführen und den Abschnitt 4_auswahlfelder weitergeben." % (info.get("fehler") or "keine Optionen"))
    all_like = [o for o in opts if re.fullmatch(r"(?i)\s*(alle|all|--.*--|-+|keine auswahl|none)\s*", o)]
    return [all_like[0]] if all_like else opts


def list_accounts(prefixes, log, stop, term_tpl="{p}*", city="", status_mode="alle"):
    """Phase 1. prefixes: z. B. ['704', '705']. Speichert nach jedem PLZ-Anfang. Macht nach Abbruch dort weiter.
    status_mode 'alle': jeden Firmenstatus (Potenzial, Debitor, Non-Debitor, Lead ...) durchsuchen, 'vorgabe': nur Voreinstellung."""
    data = load(ACC_FILE, {"accounts": {}, "done": [], "refined": [], "failed": []})
    accounts, done, refined = data["accounts"], set(data["done"]), set(data.get("refined", []))
    ok_count = fail_count = 0
    last_error = None
    with sf.sync_playwright() as p:
        browser, ctx = sf._session(p, False)
        try:
            page = ctx.new_page()
            statuses = status_values(page, prefixes[0], term_tpl, log, city, status_mode)
            log(f"Durchsucht werden Firmenstatus: {statuses if statuses != [None] else 'Voreinstellung der Seite'}")
            for st in statuses:
                kk = lambda pf, st=st: "|".join([x for x in (city.lower(), (st or "").lower()) if x] + [pf])  # Stadt/Status gehören zum Schlüssel
                queue = list(prefixes)
                empty_run = 0
                while queue and not stop.is_set():
                    prefix = queue.pop(0)
                    if kk(prefix) in done and kk(prefix) not in data.get("capped", []):  # Grenzfälle werden erneut aufgeteilt
                        continue
                    if kk(prefix) in refined:  # früher schon verfeinert: direkt die Unterbereiche abarbeiten
                        queue = [prefix + str(d) for d in range(10)] + queue
                        continue
                    rows = None
                    state = "ok"
                    for attempt in range(3):
                        try:
                            rows, state = fetch_prefix(page, prefix, term_tpl, log, city, st)
                            break
                        except sf.NeedLogin:
                            raise
                        except Exception as e:
                            last_error = e
                            log(f"  PLZ {prefix}: Versuch {attempt + 1} fehlgeschlagen ({str(e).strip().splitlines()[0][:100] if str(e).strip() else type(e).__name__})")
                            try:
                                page.close()
                            except Exception:
                                pass
                            page = ctx.new_page()
                    if rows is None:
                        fail_count += 1
                        data["failed"] = sorted(set(data.get("failed", [])) | {kk(prefix)})
                        save(ACC_FILE, data)
                        if ok_count == 0 and fail_count >= 3:  # gleich am Anfang nichts geht: nicht die ganze Nacht weiterlaufen
                            raise RuntimeError("Die ersten PLZ-Anfänge ließen sich nicht lesen: " + (str(last_error).strip().splitlines()[0][:200] if last_error else "unbekannt"))
                        continue
                    ok_count += 1
                    at_limit = len(rows) >= CAP or state == "capped"
                    if at_limit and len(prefix) == 5:
                        log(f"  PLZ {prefix}: {len(rows)} Zeilen (Grenze), teile nach Accountnamen auf ...")
                        more, complete = None, False
                        for field_rx, chars, nexts in ((r"^Accountname$", NAME_CHARS, NEXT_CHARS),):
                            try:
                                more, complete = split_capped(page, prefix, term_tpl, field_rx, chars, nexts, log, stop, city, st)
                            except sf.NeedLogin:
                                raise
                            except Exception as e:
                                log(f"    Aufteilen fehlgeschlagen: {str(e).strip().splitlines()[0][:120] if str(e).strip() else type(e).__name__}")
                                more, complete = None, False
                            if more is not None:
                                break
                        if more is not None:
                            by_key = {(r["id"] or r["url"] or r["name"] + r["plz"]): r for r in rows}
                            for r in more:
                                by_key[r["id"] or r["url"] or r["name"] + r["plz"]] = r
                            rows = list(by_key.values())
                            log(f"  PLZ {prefix}: nach Aufteilen {len(rows)} Accounts" + ("" if complete else " (evtl. unvollständig)"))
                        if more is not None and complete:
                            data["capped"] = sorted(set(data.get("capped", [])) - {kk(prefix)})
                        if more is None or not complete:
                            data["capped"] = sorted(set(data.get("capped", [])) | {kk(prefix)})
                            log(f"  ACHTUNG PLZ {prefix}: evtl. gibt es mehr Accounts als gelesen (Grenze der Trefferseite).")
                        at_limit = False
                    if at_limit and len(prefix) < 5:
                        log(f"  {prefix}: {len(rows)} Zeilen (Grenze erreicht), verfeinere ...")
                        refined.add(kk(prefix))
                        data["refined"] = sorted(refined)
                        queue = [prefix + str(d) for d in range(10)] + queue
                        continue
                    for r in rows:
                        accounts[r["id"] or r["url"] or r["name"] + r["plz"]] = r
                    done.add(kk(prefix))
                    data["done"] = sorted(done)
                    data["failed"] = sorted(set(data.get("failed", [])) - {kk(prefix)})
                    save(ACC_FILE, data)
                    empty_run = 0 if rows else empty_run + 1
                    log(f"  [{st or 'Vorgabe'}] PLZ {prefix}: {len(rows)} Accounts (gesamt {len(accounts)}, noch {len(queue)} PLZ-Anfänge)")
                    if not accounts and empty_run >= 8:
                        raise RuntimeError("Die ersten 8 PLZ-Anfänge ergaben keine Accounts. Der Suchbegriff „%s“ findet vermutlich nichts. "
                                           "Bitte die Analyse (Abgleich, Fehlersuche) mit „stuttgart; 704“ ausführen und das Ergebnis weitergeben." % term_tpl)
                    if ok_count % 40 == 0:
                        browser.close()
                        browser, ctx = sf._session(p, False)
                        page = ctx.new_page()
        finally:
            browser.close()
    return len(accounts)


def contact_info(det):
    """Detail-Ergebnis -> letzter Kontakt (jüngeres Datum aus Aktivität und Änderung)."""
    dates = [(d, q) for d, q in ((det.get("last_activity"), "Aktivität"), (det.get("last_modified"), "Änderung")) if d]
    if not dates:
        return {"letzter_kontakt": "", "quelle": ""}
    d, q = max(dates)
    return {"letzter_kontakt": d, "quelle": q}


def read_details(max_n, status_rx, log, stop):
    """Phase 2. Öffnet die Account-Seiten der noch nicht gelesenen Accounts mit passendem Firmenstatus (nicht gesperrt)."""
    acc = load(ACC_FILE, {"accounts": {}})["accounts"]
    det = load(DET_FILE, {})
    rx = re.compile(status_rx, re.I) if status_rx else None
    todo = [a for k, a in acc.items() if a.get("url") and not a.get("sperre") and not (a.get("sperre_status") or "").strip()
            and (rx is None or rx.search(a.get("status", ""))) and (k not in det or det[k].get("fehler"))]
    todo = todo[:max_n]
    log(f"{len(todo)} Accounts werden gelesen (schon fertig: {len(det)}).")
    with sf.sync_playwright() as p:
        browser, ctx = sf._session(p, False)
        try:
            for i, a in enumerate(todo, 1):
                if stop.is_set():
                    break
                key = a["id"] or a["url"]
                try:
                    d = check.read_detail(ctx, a["url"], lambda m: None, skip_foreign=True)
                    res = {**contact_info(d), "owner": d.get("owner", ""), "land_de": d.get("land_de"), "gelesen": datetime.now().isoformat(timespec="seconds")}
                    av = d.get("aktivitaetsverlauf", {})
                    if d.get("land_de") is False:
                        res["hinweis"] = "Ausland: " + (d.get("adresse") or "")[:80]
                    elif not res["letzter_kontakt"]:
                        res["hinweis"] = av.get("liste") or av.get("fehler") or "kein Datum gefunden"
                except sf.NeedLogin:
                    raise
                except Exception as e:
                    res = {"fehler": (str(e).strip().splitlines()[0][:160] if str(e).strip() else type(e).__name__)}
                det[key] = res
                if i % 5 == 0 or i == len(todo):
                    save(DET_FILE, det)
                if i % 10 == 0:
                    log(f"  {i}/{len(todo)} gelesen: {a['name'][:40]}")
                if i % RESTART_EVERY == 0:
                    browser.close()
                    browser, ctx = sf._session(p, False)
        finally:
            save(DET_FILE, det)
            browser.close()
    return len(det)


def snapshot():
    """Für die Seite: Accounts mit Kontaktdaten (kompakt)."""
    data = load(ACC_FILE, {"accounts": {}, "done": []})
    det = load(DET_FILE, {})
    rows = []
    for k, a in data["accounts"].items():
        d = det.get(k, {})
        rows.append({**a, "letzter_kontakt": d.get("letzter_kontakt", ""), "quelle": d.get("quelle", ""), "gelesen": bool(d), "land_de": d.get("land_de"),
                     "fehler": d.get("fehler", "") or d.get("hinweis", "") if not d.get("letzter_kontakt") else "", "owner": d.get("owner", "")})
    return {"rows": rows, "geprueft_plz": data.get("done", []), "anzahl": len(rows), "gelesen": len(det), "capped": data.get("capped", []), "failed": data.get("failed", [])}
