// Stammdaten, Formatierung und das (vorerst simulierte) Ranking.

import { GEM_LIST } from './gems.js';

export const CURRENCY = '€';
export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 1_000_000;

// Ab diesem Betrag gibt es den echten Diamant Pin.
export const PIN_FROM = 1_000;

// Farbklassen nach Kontostand: färben Einzahlseite, Card-Seite und Leuchten. Je höher die Klasse,
// desto wertiger das Design (Strahlen, Rahmen, Glanz). Klasse 10 ab 1 Mio. € schimmert in Regenbogenfarben.
export const CLASSES = [
  { id: 'kiesel',    name: 'Kiesel',       from: 0,         color: '#a3a3ab' },
  { id: 'mint',      name: 'Mint',         from: 100,       color: '#5fe3c0' },
  { id: 'aquamarin', name: 'Aquamarin',    from: 500,       color: '#38c8f8' },
  { id: 'saphir',    name: 'Saphir',       from: 1_000,     color: '#3b6bff' },
  { id: 'amethyst',  name: 'Amethyst',     from: 5_000,     color: '#a855f7' },
  { id: 'rubellit',  name: 'Rubellit',     from: 10_000,    color: '#ec4899' },
  { id: 'rubin',     name: 'Rubin',        from: 50_000,    color: '#ef3a3a' },
  { id: 'feuer',     name: 'Feuer',        from: 100_000,   color: '#ff8a1f' },
  { id: 'gold',      name: 'Gold',         from: 500_000,   color: '#ffd23f' },
  { id: 'holo',      name: 'Diamant-Holo', from: 1_000_000, color: '#e9e4ff' },
];
export function classFor(amount) {
  let k = 0;
  while (k + 1 < CLASSES.length && amount >= CLASSES[k + 1].from) k++;
  return k;
}
// Effektstärke 0..4 (Sound, Funken, Spannung beim Aufdecken) aus der Farbklasse 0..9
export const fxLevel = (cls) => Math.round((cls * 4) / (CLASSES.length - 1));

// Alte Seltenheitsfarben: nur noch für die Intro-Seiten und das Ranking-Podest.
export const RARITIES = [
  { id: 'normal',    label: 'Normal',   item: 'Normaler Gegenstand',    color: '#b4b4b4' },
  { id: 'magic',     label: 'Magisch',  item: 'Magischer Gegenstand',   color: '#5b8cff' },
  { id: 'rare',      label: 'Selten',   item: 'Seltener Gegenstand',    color: '#ffd43b' },
  { id: 'mythic',    label: 'Mystisch', item: 'Mystischer Gegenstand',  color: '#b65cff' },
  { id: 'legendary', label: 'Legendär', item: 'Legendärer Gegenstand',  color: '#ff8a1f' },
];

// Edelstein-Stufen: Stufe 1 ab 1 €, danach kommt am Anfang alle 5 € ein neuer Stein
// (5, 10, 15 …). Sobald 5 € zu wenig werden, wachsen die Schritte gleichmäßig (Faktor q)
// bis zum Diamanten bei 250.000 €. Danach die Legenden von 300.000 € bis 1 Mio. €.
// Grenzen gut lesbar gerundet: unter 100 € auf 5 €, unter 1.000 € auf 10 €, sonst zwei Stellen.
export const TOP_AMOUNT = 250_000;
const LEGEND_FROM = 300_000;
const LEGEND_TO = 1_000_000;
const STEP = 5;
function twoDigits(v) {
  const p = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
}
const nice = (v) => (v < 100 ? Math.round(v / 5) * 5 : v < 1000 ? Math.round(v / 10) * 10 : twoDigits(v));
const BASE = GEM_LIST.filter((g) => !g.legend).length;
const LEGENDS = GEM_LIST.length - BASE;
const baseCurve = (q) => {
  const a = [1, STEP];
  for (let i = 2; i < BASE; i++) a.push(Math.max(a[i - 1] + STEP, a[i - 1] * q));
  return a;
};
// Wachstumsfaktor so wählen, dass der Diamant (letzter Basisstein) genau bei TOP_AMOUNT liegt
let qLo = 1, qHi = 2;
for (let k = 0; k < 50; k++) {
  const q = (qLo + qHi) / 2;
  if (baseCurve(q)[BASE - 1] > TOP_AMOUNT) qHi = q; else qLo = q;
}
const mins = baseCurve(qLo).map((v, i) => (i < 2 ? v : nice(v)));
for (let i = 0; i < LEGENDS; i++) {
  mins.push(twoDigits(LEGEND_FROM * (LEGEND_TO / LEGEND_FROM) ** (i / (LEGENDS - 1))));
}
// An jeder Klassengrenze (100 €, 500 €, 1.000 € …) beginnt genau ein Stein: Der nächstgelegene
// Stein wird auf die Grenze gesetzt, damit die Farbe exakt dort wechselt.
for (const { from } of CLASSES.slice(1)) {
  let best = 2;
  for (let i = 2; i < mins.length; i++) if (Math.abs(mins[i] - from) < Math.abs(mins[best] - from)) best = i;
  mins[best] = from;
}
for (let i = 2; i < mins.length; i++) mins[i] = Math.max(mins[i], mins[i - 1] + STEP);

// Akzentfarbe der Card aus der Steinfarbe: zu dunkle Farben aufhellen, Weiß wird Platin.
// Dazu das Metall des Rahmens passend zur Farbe.
function cardLook(hex) {
  const c = parseInt(hex.slice(1), 16);
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const sat = max ? (max - min) / max : 0;
  let hue = 0;
  if (max !== min) {
    hue = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
    hue = (hue * 60 + 360) % 360;
  }
  let tone = hex;
  if (sat < 0.12 && lum > 0.6) tone = '#d6e0ea';                       // farblos -> Platin
  else if (lum < 0.22) {                                              // sehr dunkel -> aufhellen
    const k = 0.45;
    r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k);
    tone = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }
  const metal = sat < 0.12 ? 'platinum' : (hue >= 300 || hue < 20) && lum > 0.45 ? 'rose'
    : hue < 70 ? 'gold' : 'platinum';
  return { tone, metal };
}

// Jede Stufe: stage = 1..99 (welcher Stein), cls = Farbklasse 0..9, level = Effektstärke 0..4.
export const TIERS = GEM_LIST.map((g, i) => {
  const stage = i + 1;
  const cls = classFor(mins[i]);
  const look = cardLook(g.c);
  return {
    ...g,
    id: `gem-${stage}`,
    stage,
    cls,
    level: fxLevel(cls),
    min: mins[i],
    rarity: CLASSES[cls],
    css: CLASSES[cls].color,
    tone: g.legend ? (g.c === '#ffffff' ? '#e8eef6' : g.c) : look.tone,
    metal: g.legend ? 'legend' : look.metal,
  };
});
export const GEM_COUNT = TIERS.length;

export function tierFor(amount) {
  let tier = TIERS[0];
  for (const t of TIERS) if (amount >= t.min) tier = t;
  return tier;
}

export function nextTier(amount) {
  return TIERS.find((t) => t.min > amount) || null;
}

// Fortschritt (0..1) innerhalb der aktuellen Stufe, logarithmisch.
export function tierProgress(amount) {
  const cur = tierFor(amount);
  const next = nextTier(amount);
  if (!next) return 1;
  return (Math.log(amount) - Math.log(cur.min)) / (Math.log(next.min) - Math.log(cur.min));
}

const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
export const fmt = (n) => nf.format(n);
export const money = (n) => `${fmt(n)} ${CURRENCY}`;

// Slider-Position (0..1) <-> Betrag, logarithmisch und auf "schöne" Schritte gerundet.
export function amountFromPos(pos) {
  const raw = Math.exp(Math.log(MIN_AMOUNT) + pos * (Math.log(MAX_AMOUNT) - Math.log(MIN_AMOUNT)));
  return niceRound(raw);
}

export function posFromAmount(amount) {
  const a = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, amount));
  return (Math.log(a) - Math.log(MIN_AMOUNT)) / (Math.log(MAX_AMOUNT) - Math.log(MIN_AMOUNT));
}

export function niceRound(v) {
  const step = v < 100 ? 1 : v < 1_000 ? 10 : v < 10_000 ? 100 : v < 100_000 ? 1_000 : 10_000;
  return Math.max(MIN_AMOUNT, Math.round(v / step) * step);
}

// ---- Länder und Regionen ------------------------------------------------------

export const COUNTRIES = [
  { id: 'DE', name: 'Deutschland', flag: '🇩🇪', weight: 52, regions: ['Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'] },
  { id: 'AT', name: 'Österreich', flag: '🇦🇹', weight: 10, regions: ['Burgenland', 'Kärnten', 'Niederösterreich', 'Oberösterreich', 'Salzburg', 'Steiermark', 'Tirol', 'Vorarlberg', 'Wien'] },
  { id: 'CH', name: 'Schweiz', flag: '🇨🇭', weight: 10, regions: ['Aargau', 'Basel', 'Bern', 'Genf', 'Graubünden', 'Luzern', 'St. Gallen', 'Tessin', 'Waadt', 'Wallis', 'Zug', 'Zürich'] },
  { id: 'AE', name: 'VAE', flag: '🇦🇪', weight: 5, regions: ['Abu Dhabi', 'Dubai', 'Sharjah'] },
  { id: 'US', name: 'USA', flag: '🇺🇸', weight: 5, regions: ['California', 'Florida', 'New York', 'Texas'] },
  { id: 'GB', name: 'Großbritannien', flag: '🇬🇧', weight: 4, regions: ['England', 'Schottland', 'Wales'] },
  { id: 'FR', name: 'Frankreich', flag: '🇫🇷', weight: 3, regions: ['Île-de-France', 'Provence', 'Rhône-Alpes'] },
  { id: 'IT', name: 'Italien', flag: '🇮🇹', weight: 3, regions: ['Latium', 'Lombardei', 'Toskana'] },
  { id: 'ES', name: 'Spanien', flag: '🇪🇸', weight: 3, regions: ['Balearen', 'Katalonien', 'Madrid'] },
  { id: 'NL', name: 'Niederlande', flag: '🇳🇱', weight: 2, regions: ['Nordholland', 'Südholland', 'Utrecht'] },
  { id: 'TR', name: 'Türkei', flag: '🇹🇷', weight: 2, regions: ['Ankara', 'Antalya', 'Istanbul'] },
  { id: 'PL', name: 'Polen', flag: '🇵🇱', weight: 1, regions: ['Masowien', 'Kleinpolen', 'Schlesien'] },
];
export const countryById = (id) => COUNTRIES.find((c) => c.id === id) || COUNTRIES[0];

// ---- Simuliertes Ranking (bis ein Backend existiert) -------------------------

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['lena', 'max', 'mia', 'leon', 'emma', 'paul', 'sofia', 'noah', 'hanna', 'elias',
  'lina', 'ben', 'ella', 'finn', 'clara', 'luis', 'ida', 'jonas', 'mila', 'felix', 'nora', 'theo'];
const SUFFIX = ['.k', '_official', '.rich', 'xo', '.diamond', '_fame', '.vip', '99', '.bln', '.muc', '_ice', ''];

let board;
export const BOARD_SIZE = 5_000;

export function leaderboard() {
  if (board) return board;
  const rnd = mulberry32(20261003);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const totalWeight = COUNTRIES.reduce((s, c) => s + c.weight, 0);
  const pickCountry = () => {
    let r = rnd() * totalWeight;
    for (const c of COUNTRIES) { if ((r -= c.weight) < 0) return c; }
    return COUNTRIES[0];
  };
  board = Array.from({ length: BOARD_SIZE }, () => {
    const amount = niceRound(Math.min(2_500_000, Math.exp(4.6 + 2.3 * gauss())));
    const handle = FIRST[Math.floor(rnd() * FIRST.length)] + SUFFIX[Math.floor(rnd() * SUFFIX.length)];
    const c = pickCountry();
    return { handle, amount, country: c.id, region: c.regions[Math.floor(rnd() * c.regions.length)] };
  }).sort((a, b) => b.amount - a.amount);
  // Jede Ranking-Card bekommt eine feste Seriennummer (für die Code-Prüfung im Prototyp)
  board.forEach((r, i) => { r.serial = makeSerial(`board|${r.handle}|${i}`); r.at = Date.UTC(2026, 0, 1) + i * 37_000_000; });
  return board;
}

// Rangliste gefiltert (z. B. nur ein Bundesland), mit dem eigenen Konto einsortiert.
export function standings({ country = null, region = null, me = null } = {}) {
  let list = leaderboard().filter((r) => (!country || r.country === country) && (!region || r.region === region));
  if (me && me.amount > 0 && (!country || me.country === country) && (!region || me.region === region)) {
    list = [...list, { ...me, me: true }].sort((a, b) => b.amount - a.amount || (a.me ? -1 : 1));
  }
  return list.map((r, i) => ({ ...r, rank: i + 1 }));
}

// Summen je Land bzw. je Region eines Landes – für das Duell der Länder/Bundesländer.
export function groupTotals(key, { country = null, me = null } = {}) {
  const sums = new Map();
  const add = (r) => {
    if (country && r.country !== country) return;
    const k = r[key];
    const cur = sums.get(k) || { id: k, amount: 0, players: 0 };
    cur.amount += r.amount;
    cur.players += 1;
    sums.set(k, cur);
  };
  leaderboard().forEach(add);
  if (me && me.amount > 0) add(me);
  return [...sums.values()].sort((a, b) => b.amount - a.amount).map((g, i) => ({ ...g, rank: i + 1 }));
}

// Platz, den man mit diesem Betrag weltweit erreichen würde, und Gesamtzahl inkl. einem selbst.
export function rankFor(amount) {
  const list = leaderboard();
  let lo = 0, hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].amount > amount) lo = mid + 1; else hi = mid;
  }
  return { rank: lo + 1, total: list.length + 1 };
}

// ---- Seriennummer der Fame-Card ------------------------------------------------
// Format FM-XXXX-XXXX-P: 8 Zeichen aus Konto, Betrag und Zeitpunkt, dazu eine Prüfziffer.
// Im Livebetrieb vergibt und signiert der Server die Nummer, damit sie nicht gefälscht werden kann.

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function makeSerial(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let body = '';
  for (let i = 0; i < 8; i++) { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); body += B32[(h >>> 0) % 32]; }
  return `FM-${body.slice(0, 4)}-${body.slice(4)}-${checkChar(body)}`;
}

function checkChar(body) {
  let sum = 0;
  [...body].forEach((ch, i) => { sum += B32.indexOf(ch) * (i % 2 ? 3 : 1); });
  return B32[sum % 32];
}

export function isValidSerial(serial) {
  const m = /^FM-([0-9A-Z]{4})-([0-9A-Z]{4})-([0-9A-Z])$/.exec(serial || '');
  return !!m && checkChar(m[1] + m[2]) === m[3];
}

// ---- Code-Prüfung ------------------------------------------------------------------------
// Bringt eine Eingabe in die Form FM-XXXX-XXXX-X (Groß, ohne Leerzeichen, Bindestriche gesetzt).
export function normalizeSerial(input) {
  const raw = String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^FM/, '');
  if (raw.length !== 9) return String(input || '').trim().toUpperCase();
  return `FM-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

// Sucht den Code im Verzeichnis. Im Prototyp gibt es noch keinen Server: Bekannt sind die Cards
// auf diesem Gerät und die Cards der Ranking-Spieler. Mit Backend fragt diese Funktion den Server.
// Ergebnis: { status: 'invalid' | 'unknown' | 'valid', serial, owner?, tier?, amount?, at?, own? }
export function lookupSerial(input, { account = null, user = null } = {}) {
  const serial = normalizeSerial(input);
  if (!isValidSerial(serial)) return { status: 'invalid', serial };
  const mine = account?.cards?.find((c) => c.serial === serial);
  if (mine) {
    return {
      status: 'valid', serial, own: true, amount: mine.total, at: mine.at,
      tier: TIERS.find((t) => t.id === mine.tier) || tierFor(mine.total),
      owner: { handle: user?.insta || user?.name || 'du', verified: !!user?.verified?.[user?.main], country: user?.country || 'DE', region: user?.region || '' },
      revealed: mine.revealed !== false,
    };
  }
  const r = leaderboard().find((e) => e.serial === serial);
  if (r) {
    return { status: 'valid', serial, own: false, amount: r.amount, at: r.at, tier: tierFor(r.amount), owner: { handle: r.handle, country: r.country, region: r.region }, revealed: true };
  }
  return { status: 'unknown', serial };
}

// Ein Beispiel-Code zum Ausprobieren (eine Card aus dem Ranking)
export const sampleSerial = () => leaderboard()[3].serial;

// ---- Social-Accounts ------------------------------------------------------------------------
// Jeder wählt selbst, welche Plattformen er nutzt. Ein Account ist der Haupt-Account:
// sein Name steht auf der Card, im Ranking und bei der Code-Prüfung.
export const PLATFORMS = [
  { id: 'ig', name: 'Instagram' },
  { id: 'tt', name: 'TikTok' },
  { id: 'sc', name: 'Snapchat' },
];

// Alte Profile hatten nur ein Instagram-Feld: in die neue Form übernehmen.
// onCard: welche Accounts auf der Card stehen (einer oder mehrere); der erste davon ist der
// Haupt-Account für Ranking und Code-Prüfung.
export function normalizeUser(u) {
  if (!u) return u;
  const accounts = { ...(u.accounts || {}) };
  if (!u.accounts && u.insta) accounts.ig = u.insta;
  let onCard = (u.onCard || (u.main ? [u.main] : [])).filter((id) => accounts[id]);
  if (!onCard.length) { const first = PLATFORMS.find((p) => accounts[p.id]); if (first) onCard = [first.id]; }
  const main = onCard[0] || '';
  return { ...u, accounts, onCard, main, insta: accounts[main] || '' };
}

// Ein Account { id, name, handle } (ohne id: der Haupt-Account) oder null
export function mainAccount(u, id = u?.main) {
  const handle = u?.accounts?.[id];
  const p = PLATFORMS.find((x) => x.id === id);
  return handle && p ? { ...p, handle } : null;
}

// Alle Accounts, die auf der Card stehen sollen
export const cardAccounts = (u) => (u?.onCard || []).map((id) => mainAccount(u, id)).filter(Boolean);
