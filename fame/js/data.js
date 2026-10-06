// Stammdaten, Formatierung und das (vorerst simulierte) Ranking.

export const CURRENCY = '€';
export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 1_000_000;

// Ab diesem Betrag gibt es den echten Diamant Pin.
export const PIN_FROM = 1_000;

// Seltenheiten wie bei Diablo/WoW – sie färben Seite, Glow, Card und bestimmen den Sound.
export const RARITIES = [
  { id: 'normal',    label: 'Normal',   item: 'Normaler Gegenstand',    color: '#b4b4b4' },
  { id: 'magic',     label: 'Magisch',  item: 'Magischer Gegenstand',   color: '#5b8cff' },
  { id: 'rare',      label: 'Selten',   item: 'Seltener Gegenstand',    color: '#ffd43b' },
  { id: 'mythic',    label: 'Mystisch', item: 'Mystischer Gegenstand',  color: '#b65cff' },
  { id: 'legendary', label: 'Legendär', item: 'Legendärer Gegenstand',  color: '#ff8a1f' },
];

// Diamant-Stufen nach Reinheit. `level` steuert Schliff, Klarheit und Funkeln des 3D-Diamanten.
export const TIERS = [
  { id: 'chipped',  name: 'Lädierter Diamant',    min: 1,       level: 0, flavor: 'Jeder fängt mal klein an.' },
  { id: 'flawed',   name: 'Fehlerhafter Diamant', min: 100,     level: 1, flavor: 'Ein Kratzer hier, ein Funkeln da.' },
  { id: 'diamond',  name: 'Diamant',              min: 1_000,   level: 2, flavor: 'Jetzt schauen die Leute hin.' },
  { id: 'flawless', name: 'Makelloser Diamant',   min: 10_000,  level: 3, flavor: 'Kein Makel. Nur Fame.' },
  { id: 'perfect',  name: 'Perfekter Diamant',    min: 100_000, level: 4, flavor: 'Erst Fame, dann die anderen.' },
].map((t) => ({ ...t, rarity: RARITIES[t.level], css: RARITIES[t.level].color }));

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
