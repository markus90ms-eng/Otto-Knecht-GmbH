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
  board = Array.from({ length: BOARD_SIZE }, () => {
    const amount = niceRound(Math.min(2_500_000, Math.exp(4.6 + 2.3 * gauss())));
    const handle = FIRST[Math.floor(rnd() * FIRST.length)] + SUFFIX[Math.floor(rnd() * SUFFIX.length)];
    return { handle, amount };
  }).sort((a, b) => b.amount - a.amount);
  return board;
}

// Platz, den man mit diesem Betrag erreichen würde, und Gesamtzahl inkl. einem selbst.
export function rankFor(amount) {
  const list = leaderboard();
  let lo = 0, hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].amount > amount) lo = mid + 1; else hi = mid;
  }
  return { rank: lo + 1, total: list.length + 1 };
}
