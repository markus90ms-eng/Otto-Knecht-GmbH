"""Abgleich: Gibt es die Firmen aus dem Leadgenerator schon als Account in Salesforce, und darf man sie kontaktieren?

Für jede Firma wird die Salesforce-Suche geöffnet (wie ein Mensch) und die Account-Tabelle der Trefferseite gelesen:
Firmenstatus, Kundenkontaktsperre, Account-Sperre, VIS ID, Debitoren-Nr. Nur lesen, es wird nichts verändert.
"""
import base64
import json
import re
from datetime import date, datetime
from urllib.parse import quote

import sf

LEGAL = {
    "gmbh", "ag", "kg", "ohg", "ug", "ek", "mbh", "co", "und", "inh", "inhaber", "gbr", "se", "kgaa", "ltd",
    "eg", "ev", "stiftung", "haftungsbeschraenkt", "cokg", "gmbhcokg", "the", "der", "die", "das",
}

# Account-Tabelle der Trefferseite: Zellen nach Spaltenposition (die Tabelle hat keine data-label-Attribute)
ACCOUNTS_JS = "() => {" + sf.DEEP + """
  for (const t of deepAll("table[role='grid']")) {
    const heads = deepAll('thead th', t).map((h) => (h.getAttribute('title') || h.innerText || '').trim());
    if (!heads.some((h) => /^accountname$/i.test(h))) continue;
    return deepAll('tbody tr', t).map((tr) => {
      const cells = [...tr.children];
      const off = cells.length - heads.length;
      const o = {};
      heads.forEach((h, i) => { const c = cells[i + off]; if (c && h) o[h] = cellVal(c); });
      const a = deepAll("a[href*='/lightning/r/']", tr)[0];
      o.__href = a ? a.getAttribute('href') : '';
      o.__text = tr.innerText.trim();
      return o;
    });
  }
  return null;
}"""

DETAIL_JS = "() => {" + sf.DEEP + """
  const out = {};
  deepAll('records-record-layout-item, lightning-output-field').forEach((el) => {
    const l = deepAll('.test-id__field-label, .slds-form-element__label', el)[0];
    const v = deepAll('.test-id__field-value, .slds-form-element__control', el)[0];
    if (l && v) out[l.innerText.trim()] = v.innerText.trim();
  });
  deepAll('records-highlights-details-item').forEach((el) => {
    const parts = (el.innerText || '').split('\\n').map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1 && !(parts[0] in out)) out[parts[0]] = parts.slice(1).join(' ');
  });
  return out;
}"""

LINES_JS = """() => {
  const INLINE = /^(SPAN|A|B|I|EM|STRONG|ABBR|SMALL|LABEL|LIGHTNING-FORMATTED-TEXT|LIGHTNING-FORMATTED-DATE-TIME|LIGHTNING-BASE-FORMATTED-TEXT|LIGHTNING-RELATIVE-DATE-TIME|LIGHTNING-FORMATTED-URL)$/;
  const out = [];
  const walk = (n) => {
    if (n.nodeType === 3) { out.push(n.textContent); return; }
    if (n.nodeType === 11) { n.childNodes.forEach(walk); return; }
    if (n.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(n.tagName)) return;
    if (n.tagName === 'SLOT') { const a = n.assignedNodes({ flatten: true }); (a.length ? a : [...n.childNodes]).forEach(walk); return; }
    const block = !INLINE.test(n.tagName);
    if (block) out.push('\\n');
    if (n.shadowRoot) walk(n.shadowRoot); else n.childNodes.forEach(walk);
    if (block) out.push('\\n');
  };
  walk(document.body);
  return out.join('').split('\\n').map((x) => x.replace(/\\s+/g, ' ').trim()).filter(Boolean);
}"""

PAGE_TEXT_JS = """() => {
  const walk = (n) => {
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType === 1 && /^(SCRIPT|STYLE)$/.test(n.tagName)) return '';
    let t = n.shadowRoot ? walk(n.shadowRoot) : '';
    for (const c of n.childNodes) t += ' ' + walk(c);
    return t;
  };
  return walk(document.body);
}"""

APP_NAME = "LKM_AnwendungVertrieb"

DESCRIBE_JS = "() => {" + sf.DEEP + """
  const txt = (e) => (e.innerText || e.getAttribute('aria-label') || e.title || '').trim();
  const out = { url: location.href.split('#')[0], title: document.title };
  out.hinweise = deepAll('*').filter((e) => !e.children.length && !/^(SCRIPT|STYLE)$/.test(e.tagName) && /Ergebnis/i.test(e.innerText || '')).map((e) => e.innerText.trim()).slice(0, 5);
  out.tabellen = deepAll("table, [role='grid']").map((t) => ({
    tag: t.tagName.toLowerCase(), role: t.getAttribute('role'),
    kopf: deepAll('thead th', t).map((h) => (h.getAttribute('title') || h.innerText || '').trim()).filter(Boolean).slice(0, 25),
    zeilen: deepAll('tbody tr', t).length,
  }));
  out.ersteZeilen = deepAll("table[role='grid'] tbody tr").slice(0, 3).map((tr) =>
    deepAll('[data-label]', tr).map((c) => [c.getAttribute('data-label'), cellVal(c)]));
  out.filter = deepAll('select, input, textarea, button[role=combobox], lightning-combobox').map((e) => ({
    tag: e.tagName.toLowerCase(), typ: e.type || '',
    label: (e.labels && e.labels[0] ? e.labels[0].innerText : '') || e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.getAttribute('name') || '',
    wert: e.type === 'checkbox' ? !!e.checked : (e.value || ''),
    optionen: e.tagName === 'SELECT' ? [...e.options].map((o) => o.text) : undefined,
  })).slice(0, 40);
  out.knoepfe = deepAll('button, a').map(txt).filter((t) => /anwenden|standard|filter|alle anzeigen|zurücksetzen|accounts/i.test(t)).slice(0, 20);
  return out;
}"""


def search_url(term):
    """Adresse der Salesforce-Suche (Account-Trefferseite) für einen Suchbegriff."""
    payload = {
        "componentDef": "forceSearch:searchPageDesktop",
        "attributes": {
            "term": term, "scopeMap": {"type": "TOP_RESULTS"},
            "context": {"FILTERS": {}, "searchSource": "ASSISTANT_DIALOG", "disableIntentQuery": False,
                        "disableSpellCorrection": False,
                        "debugInfo": {"appName": APP_NAME, "appType": "Standard", "appNamespace": "c",
                                      "location": "force:objectHomeDesktop", "sobjectType": "Account"}},
            "groupId": "DEFAULT",
        },
        "state": {},
    }
    raw = base64.b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode()
    return f"{sf.sf_url()}/one/one.app#{quote(raw, safe='')}"


def diagnose_search(term, headed=False, log=print):
    """Öffnet die Suche und beschreibt die Seite (Tabelle, Spalten, Filter). Nur lesen, zur Fehlersuche."""
    if not sf.STATE.exists():
        raise sf.NeedLogin("Noch nicht eingeloggt.")
    with sf.sync_playwright() as p:
        browser, ctx = sf._session(p, headed)
        try:
            page = ctx.new_page()
            url = search_url(term)
            log(f"Öffne Suche nach „{term}“ ...")
            page.goto(url)
            page.wait_for_timeout(7000)
            sf.skip_passkey_prompt(page, url, log)
            try:
                page.wait_for_selector("table[role='grid'] tbody tr", timeout=15_000)
            except Exception:
                log("  Keine Tabelle gefunden (siehe Bericht).")
            sf.SHOTS.mkdir(exist_ok=True)
            shot = sf.SHOTS / "suche.png"
            page.screenshot(path=str(shot), full_page=True)
            report = page.evaluate(DESCRIBE_JS)
            report["screenshot"] = str(shot)
            return report
        finally:
            browser.close()


def tokens(name):
    s = (name or "").lower().replace("ß", "ss")
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue")):
        s = s.replace(a, b)
    return [t for t in re.findall(r"[a-z0-9]+", s) if t not in LEGAL and (len(t) > 1 or t.isdigit())]


def name_score(a, b):
    ta, tb = set(tokens(a)), set(tokens(b))
    inter = len(ta & tb)
    if not ta or not tb or not inter:
        return 0.0
    short = min(len(ta), len(tb))
    if short == 1:
        return 1.0 if ta == tb else 0.0
    if inter == short:
        return 0.9  # alle Wörter des kürzeren Namens stecken im längeren
    return inter / len(ta | tb)


def phone_match(a, b):
    da, db = re.sub(r"\D", "", a or ""), re.sub(r"\D", "", b or "")
    return len(da) >= 6 and len(db) >= 6 and da[-7:] == db[-7:]


def search_terms(name):
    # Suchbegriff mit der Originalschreibweise (Umlaute), damit Salesforce ihn findet
    toks = [t for t in re.findall(r"[a-zäöüß0-9]+", (name or "").lower()) if t not in LEGAL and (len(t) > 1 or t.isdigit())]
    terms = [" ".join(toks[:4])]
    if len(toks) > 2:
        terms.append(" ".join(toks[:2]))
    if toks and len(toks[0]) >= 4:
        terms.append(toks[0])  # zuletzt nur das erste Wort (meist die Marke), die Namensprüfung filtert danach
    return [t for t in dict.fromkeys(terms) if t]


def pick_matches(lead, rows):
    """Passende Zeilen aus den Suchergebnissen, beste zuerst. Gibt (score, zeile) zurück."""
    found = []
    for r in rows:
        score = name_score(lead.get("name", ""), r.get("Accountname", ""))
        plz_same = bool(lead.get("plz")) and r.get("PLZ (Rechnungsanschrift)", "").strip() == lead["plz"]
        if score >= 0.6:
            found.append((score + (0.3 if plz_same else 0), r, "gleich"))
        elif plz_same and score >= 0.3:
            found.append((score, r, "aehnlich"))  # gleiche PLZ, ähnlicher Name: könnte derselbe Betrieb sein
    found.sort(key=lambda x: -x[0])
    return found


def truthy(v):
    return str(v or "").strip().lower() in ("ja", "true", "wahr", "x", "1", "yes")


def interpret(row):
    """Account-Zeile -> (Status, Hinweistext).
    vergeben = gesperrt (Kundenkontaktsperre oder Account-Sperre-Status) | kunde = Firmenstatus Kunde
    ruhend = Ex-Kunde/inaktiv | potenzial = Potenzial, nicht gesperrt | unklar.
    Die Debitoren-Nr. ist NUR eine Information, keine Sperre."""
    firmenstatus = (row.get("Firmenstatus") or "").strip()
    sperre = truthy(row.get("Kunden Kontaktsperre"))
    acc_sperre = (row.get("Account Sperre Status") or "").strip()
    debitor = (row.get("Debitoren-Nr.") or "").strip()
    vis = (row.get("VIS ID") or "").strip()
    facts = (f"Firmenstatus: {firmenstatus or '–'} · Kontaktsperre: {'JA' if sperre else 'nein'}"
             f" · Sperre-Status: {acc_sperre or '–'} · Debitor: {debitor or '–'} · VIS: {vis or '–'}")
    unlocked = re.fullmatch(r"(keine( sperre)?|nicht gesperrt|-+|ok|aktiv|frei|nein|entsperrt)", acc_sperre.lower())
    locked = sperre or (acc_sperre and not unlocked)  # unbekannte Sperre-Werte lieber als gesperrt behandeln
    if locked:
        return "vergeben", "GESPERRT, nicht kontaktieren. " + facts
    if re.search(r"\bex\b|ex-|inaktiv|ehemal", firmenstatus, re.I) and not re.search(r"^kunde", firmenstatus, re.I):
        return "ruhend", "Ehemaliger oder inaktiver Kunde, nicht gesperrt. " + facts
    if re.search(r"kunde|aktiv", firmenstatus, re.I):
        return "kunde", "Bestandskunde, nicht gesperrt. " + facts
    if re.search(r"potenzial|interessent|lead|neu", firmenstatus, re.I):
        return "potenzial", "Account vorhanden (Potenzial), nicht gesperrt. " + facts
    return "unklar", "Status nicht eindeutig. " + facts


MONTHS = {"januar": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4, "mai": 5, "juni": 6, "juli": 7, "august": 8,
          "september": 9, "oktober": 10, "november": 11, "dezember": 12}
MONTH_RX = re.compile(r"^(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*[•·\-–]\s*(\d{4})", re.I)
ITEM_RX = re.compile(r"^(?:\d{1,2}:\d{2}\s*\|\s*)?(\d{1,2})\.(\d{1,2})\.?$")


def parse_timeline(lines):
    """Aktivitätsverlauf (Zeilen) -> (neuestes vergangenes Datum als ISO oder '', Anzahl erkannter Einträge).
    Überschriften wie 'September • 2026' liefern das Jahr, die Einträge 'dd.mm'. 'Ausstehend und überfällig' wird übersprungen."""
    year = None
    found = []
    for ln in lines:
        m = MONTH_RX.match(ln)
        if m:
            year = int(m.group(2))
            continue
        if re.match(r"^(Ausstehend|Anstehend|Nächste|Upcoming|Overdue)", ln, re.I):
            year = None
            continue
        d = ITEM_RX.match(ln)
        if d and year:
            try:
                found.append(date(year, int(d.group(2)), int(d.group(1))))
            except ValueError:
                pass
    return (max(found).isoformat() if found else ""), len(found)


DATE_RX = re.compile(r"(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})")


def find_date(text):
    m = DATE_RX.search(text or "")
    d = sf.parse_date(m.group(1)) if m else None
    return d.isoformat() if d else ""


def read_detail(ctx, url, log):
    """Öffnet die Account-Seite und liest Inhaber, letzte Aktivität und 'Zuletzt geändert'. Best effort."""
    page = ctx.new_page()
    fields = {}
    timeline = {}

    def grab():
        try:
            page.wait_for_selector("records-record-layout-item, records-highlights-details-item", timeout=10_000)
        except Exception:
            pass
        page.wait_for_timeout(1200)
        fields.update(page.evaluate(DETAIL_JS))

    try:
        page.goto(url)
        grab()
        try:  # Reiter 'Details' öffnen: dort stehen 'Zuletzt geändert' und Co.
            page.get_by_role("tab", name=re.compile(r"^Details$", re.I)).first.click(timeout=4000)
            grab()
        except Exception:
            pass
        try:  # nach unten scrollen, falls Abschnitte erst beim Scrollen geladen werden
            page.keyboard.press("End")
            grab()
        except Exception:
            pass
        try:  # Reiter 'Aktivität': Verlauf mit Datum der vergangenen Aufgaben, Anrufe und Termine
            page.get_by_role("tab", name=re.compile(r"^Aktivit(ä|ae)t$", re.I)).first.click(timeout=4000)
            page.wait_for_timeout(3500)
            lines = page.evaluate(LINES_JS)
            timeline["datum"], timeline["anzahl"] = parse_timeline(lines)
            if not timeline["datum"]:
                timeline["zeilen"] = lines[:25]
        except Exception as e:
            timeline["fehler"] = str(e).splitlines()[0][:100]
    finally:
        page.close()
    pick = lambda rx: next((v for k, v in fields.items() if re.search(rx, k, re.I) and v), "")
    act_raw, mod_raw = pick(r"letzte aktivit|aktivitätsdatum|last activity"), pick(r"zuletzt ge(ä|ae)ndert|last modified")
    act_field = find_date(act_raw) if act_raw else ""
    act = max(act_field, timeline.get("datum", ""))  # Feld oder Verlauf: das jüngere Datum gewinnt
    return {
        "owner": pick(r"inhaber|owner"),
        "last_activity": act,
        "aktivitaetsverlauf": {k: v for k, v in timeline.items()},
        "last_activity_raw": act_raw[:60],
        "last_modified": find_date(mod_raw),
        "last_modified_raw": mod_raw.replace("\n", " ")[:80],
        "felder": sorted(fields)[:60],
    }


def top_accounts(page, term, log):
    """Öffnet die Salesforce-Suche und liest die Account-Tabelle. Gibt die Zeilen zurück ([] = keine Treffer)."""
    page.goto("about:blank")  # jedes Mal neu laden, damit die Trefferseite sicher neu aufgebaut wird
    page.goto(search_url(term))
    rows = None
    stable = 0
    last = -1
    for _ in range(50):  # bis zu ~25 s warten
        page.wait_for_timeout(500)
        if "login" in page.url:
            raise sf.NeedLogin("Sitzung abgelaufen.")
        rows = page.evaluate(ACCOUNTS_JS)
        if rows is not None:
            stable = stable + 1 if len(rows) == last else 0
            last = len(rows)
            if stable >= 2 and (rows or page.title()):
                return rows
        elif re.search(r"Keine Ergebnisse|keine Treffer|No results", page.evaluate(PAGE_TEXT_JS), re.I):
            return []
    if rows is not None:
        return rows
    raise RuntimeError(f"Suchergebnisse nicht lesbar (Seite: {page.url.split('#')[0]}, Titel: {page.title()})")


def check_one(page, lead, log):
    rows, matches = [], []
    for term in search_terms(lead.get("name", "")):
        rows = top_accounts(page, term, log)
        matches = pick_matches(lead, rows)
        if matches:
            break
    out = []
    for score, r, art in matches[:3]:
        href = r.get("__href", "")
        status, note = interpret(r)
        out.append({
            "name": r.get("Accountname", ""), "plz": r.get("PLZ (Rechnungsanschrift)", ""), "ort": r.get("Stadt (Rechnungsanschrift)", ""),
            "firmenstatus": r.get("Firmenstatus", ""), "kontaktsperre": truthy(r.get("Kunden Kontaktsperre")),
            "debitor": r.get("Debitoren-Nr.", ""), "vis": r.get("VIS ID", ""),
            "url": (sf.sf_url() + href) if href.startswith("/") else href, "art": art,
            "status": status, "note": note, "score": round(score, 2),
        })
    if not out:
        return {"status": "frei", "note": "Nicht in Salesforce gefunden.", "matches": [], "checked": datetime.now().isoformat(timespec="seconds")}
    best = out[0]
    if best["url"]:
        try:
            best.update(read_detail(page.context, best["url"], log))
        except Exception as e:
            log(f"  Detailseite nicht lesbar: {str(e).splitlines()[0][:100]}")
    status, note = best["status"], best["note"]
    # Letzter Kontakt = jüngeres Datum aus 'Letzte Aktivität' und 'Zuletzt geändert' (bei euch zählt beides als Kontakt)
    dates = [(d, q) for d, q in ((best.get("last_activity"), "Aktivität"), (best.get("last_modified"), "Änderung")) if d]
    if dates:
        kontakt, quelle = max(dates)
        tage = (datetime.now().date() - datetime.fromisoformat(kontakt).date()).days
        best.update(letzter_kontakt=kontakt, kontakt_quelle=quelle, tage_seit_kontakt=tage)
        note += f" · Letzter Kontakt: {kontakt} ({quelle}, vor {tage} Tagen)"
    for label, key in (("Letzte Aktivität", "last_activity"), ("Zuletzt geändert", "last_modified")):
        if best.get(key):
            note += f" · {label}: {best[key]}"
    if best["art"] == "aehnlich":
        status, note = "unklar", f"Ähnlicher Account „{best['name']}“ mit gleicher PLZ. Prüfen! " + best["note"]
    elif len(out) > 1 and any(m["status"] == "vergeben" for m in out[1:]) and status != "vergeben":
        note += " Achtung: weiterer ähnlicher Account ist gesperrt/Kunde."
    return {"status": status, "note": note, "matches": out, "checked": datetime.now().isoformat(timespec="seconds")}


def check_leads(leads, liste="", headed=False, log=print, on_result=lambda i, r: None, months=3):
    """leads: [{id, name, phone, plz}]. Ruft on_result(id, ergebnis) nach jeder Firma auf."""
    if not sf.STATE.exists():
        raise sf.NeedLogin("Noch nicht eingeloggt.")
    with sf.sync_playwright() as p:
        browser, ctx = sf._session(p, headed)
        try:
            page = ctx.new_page()
            for n, lead in enumerate(leads, 1):
                log(f"  Prüfe {n}/{len(leads)}: {lead.get('name', '')}")
                try:
                    result = check_one(page, lead, log)
                except sf.NeedLogin:
                    raise
                except Exception as e:
                    result = {"status": "fehler", "note": str(e).splitlines()[0][:200], "matches": [], "checked": ""}
                on_result(lead["id"], result)
        finally:
            browser.close()
