"""Abgleich: Gibt es die Firmen aus dem Leadgenerator schon als Account in Salesforce?

Für jede Firma wird in der Account-Liste gesucht (wie ein Mensch im Suchfeld). Bei einem Treffer wird die
Detailseite geöffnet und Inhaber und letzte Aktivität gelesen. Nur lesen, es wird nichts verändert.
"""
import re
from datetime import date, datetime, timedelta

import sf

LEGAL = {
    "gmbh", "ag", "kg", "ohg", "ug", "ek", "mbh", "co", "und", "inh", "inhaber", "gbr", "se", "kgaa", "ltd",
    "eg", "ev", "stiftung", "haftungsbeschraenkt", "cokg", "gmbhcokg", "the", "der", "die", "das",
}
SEARCH_PLACEHOLDER = re.compile(r"durchsuchen|search this list", re.I)

ROWS_JS = """() => [...document.querySelectorAll("table[role='grid'] tbody tr")].map((tr) => {
  const o = {};
  tr.querySelectorAll('[data-label]').forEach((c) => { o[c.getAttribute('data-label')] = c.innerText.trim(); });
  const a = tr.querySelector("a[href*='/lightning/r/']");
  o.__href = a ? a.getAttribute('href') : '';
  o.__text = tr.innerText.trim();
  return o;
})"""

DETAIL_JS = """() => {
  const out = {};
  document.querySelectorAll('records-record-layout-item, lightning-output-field').forEach((el) => {
    const l = el.querySelector('.test-id__field-label, .slds-form-element__label');
    const v = el.querySelector('.test-id__field-value, .slds-form-element__control');
    if (l && v) out[l.innerText.trim()] = v.innerText.trim();
  });
  return out;
}"""


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
    return [t for t in dict.fromkeys(terms) if t]


def pick_matches(lead, rows):
    """Passende Zeilen aus den Suchergebnissen, beste zuerst."""
    found = []
    for r in rows:
        keys = [k for k in r if not k.startswith("__")]
        name_key = next((k for k in keys if re.search(r"name", k, re.I)), keys[0] if keys else None)
        if not name_key:
            continue
        tel = next((r[k] for k in keys if re.search(r"telefon|phone", k, re.I)), "")
        score = name_score(lead.get("name", ""), r[name_key])
        phone = phone_match(lead.get("phone", ""), tel)
        plz = bool(lead.get("plz")) and lead["plz"] in r.get("__text", "")
        if score >= 0.6 or (phone and score >= 0.3):
            found.append((score + (0.5 if phone else 0) + (0.2 if plz else 0), r, name_key, tel))
    found.sort(key=lambda x: -x[0])
    return found


def parse_iso(text):
    d = sf.parse_date(text or "")
    return d.isoformat() if d else ""


def classify(matches, months=3):
    """frei = nicht in Salesforce | ruhend = Account, aber lange nicht betreut | vergeben = Account, aktiv | unklar"""
    if not matches:
        return "frei", "Nicht in Salesforce gefunden."
    best = matches[0]
    last = best.get("last_activity", "")
    owner = best.get("owner", "")
    who = f" Inhaber: {owner}." if owner else ""
    if last == "nie":
        return "ruhend", f"Account vorhanden, noch nie Aktivität.{who}"
    if last:
        cutoff = (date.today() - timedelta(days=30 * months)).isoformat()
        if last < cutoff:
            return "ruhend", f"Account vorhanden, letzte Aktivität {last}.{who}"
        return "vergeben", f"Account vorhanden, letzte Aktivität {last}.{who}"
    return "unklar", f"Account vorhanden, Details nicht lesbar.{who}"


def read_detail(ctx, url, log):
    page = ctx.new_page()
    try:
        page.goto(url)
        try:
            page.wait_for_selector("records-record-layout-item", timeout=15_000)
        except Exception:
            pass
        page.wait_for_timeout(1000)
        fields = page.evaluate(DETAIL_JS)
    finally:
        page.close()
    pick = lambda rx: next((v for k, v in fields.items() if re.search(rx, k, re.I) and v), "")
    act = pick(r"letzte aktivit|last activity")
    return {
        "owner": pick(r"kontoinhaber|account owner|accountinhaber|inhaber|owner"),
        "last_activity": parse_iso(act) if act else "nie" if fields else "",
        "adresse": pick(r"rechnungsadresse|billing address"),
        "felder": len(fields),
    }


def check_one(page, ctx, box, lead, log, months):
    rows = []
    matches = []
    for term in search_terms(lead.get("name", "")):
        box.fill(term)
        box.press("Enter")
        page.wait_for_timeout(1800)
        prev = -1
        for _ in range(8):  # warten, bis sich die Trefferliste beruhigt hat
            n = page.locator("table[role='grid'] tbody tr").count()
            if n == prev:
                break
            prev = n
            page.wait_for_timeout(400)
        rows = page.evaluate(ROWS_JS)
        matches = pick_matches(lead, rows)
        if matches:
            break
    out = []
    for i, (score, r, name_key, tel) in enumerate(matches[:3]):
        href = r.get("__href", "")
        item = {"name": r[name_key], "telefon": tel, "url": (sf.sf_url() + href) if href.startswith("/") else href,
                "score": round(score, 2), "owner": "", "last_activity": ""}
        if i == 0 and item["url"]:
            try:
                item.update({k: v for k, v in read_detail(ctx, item["url"], log).items() if k in ("owner", "last_activity", "adresse")})
            except Exception as e:
                log(f"  Detailseite nicht lesbar: {str(e).splitlines()[0][:100]}")
        out.append(item)
    status, note = classify(out, months)
    return {"status": status, "note": note, "matches": out, "checked": datetime.now().isoformat(timespec="seconds")}


def check_leads(leads, liste="AllAccounts", headed=False, log=print, on_result=lambda i, r: None, months=3):
    """leads: [{id, name, phone, plz}]. Ruft on_result(id, ergebnis) nach jeder Firma auf."""
    if not sf.STATE.exists():
        raise sf.NeedLogin("Noch nicht eingeloggt.")
    with sf.sync_playwright() as p:
        browser, ctx = sf._session(p, headed)
        try:
            page = ctx.new_page()
            url = f"{sf.sf_url()}/lightning/o/Account/list?filterName={liste}"
            log("Öffne Account-Liste ...")
            page.goto(url)
            page.wait_for_timeout(3000)
            sf.skip_passkey_prompt(page, url, log)
            if "login" in page.url:
                raise sf.NeedLogin("Sitzung abgelaufen.")
            box = page.get_by_placeholder(SEARCH_PLACEHOLDER)
            try:
                box.first.wait_for(timeout=60_000)
            except Exception:
                sf.SHOTS.mkdir(exist_ok=True)
                shot = sf.SHOTS / "fehler.png"
                page.screenshot(path=str(shot), full_page=True)
                raise RuntimeError(f"Suchfeld der Account-Liste nicht gefunden (Seite: {page.url.split('?')[0]}). Screenshot: {shot}")
            box = box.first
            for n, lead in enumerate(leads, 1):
                log(f"  Prüfe {n}/{len(leads)}: {lead.get('name', '')}")
                try:
                    result = check_one(page, ctx, box, lead, log, months)
                except Exception as e:
                    result = {"status": "fehler", "note": str(e).splitlines()[0][:160], "matches": [], "checked": ""}
                on_result(lead["id"], result)
        finally:
            browser.close()
