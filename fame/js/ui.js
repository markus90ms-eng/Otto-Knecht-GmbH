// Wiederverwendbare UI-Bausteine (HTML-Snippets) im Fame-Look.

export const APP_NAME = 'Fame';
// Im Logo wird das "e" als Euro-Zeichen gezeigt.
export const LOGO_TEXT = 'Fam€';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Logo-Diamant: Brillant mit Sternfacetten in der Krone und langen Facetten zur Spitze.
// Koordinaten im 220er-Raster der Vorlage, umgerechnet auf die 48x40-Box der Icons.
const DIA_SRC = {
  crown: [[58, 2], [162, 2], [219, 44], [1, 44]],
  outline: [[58, 2], [162, 2], [219, 44], [110, 164], [1, 44]],
  facets: [
    [[58, 2], [30, 23], [80, 22]], [[58, 2], [80, 22], [110, 2]], [[110, 2], [140, 22], [110, 44], [80, 22]],
    [[110, 2], [140, 22], [162, 2]], [[162, 2], [190, 22], [140, 22]],
    [[30, 23], [1, 44], [35, 44]], [[30, 23], [35, 44], [80, 22]], [[80, 22], [35, 44], [110, 44]],
    [[140, 22], [110, 44], [185, 44]], [[140, 22], [185, 44], [190, 22]], [[190, 22], [185, 44], [219, 44]],
    [[1, 44], [35, 44], [98, 138], [110, 164]], [[35, 44], [110, 44], [98, 138]], [[110, 44], [122, 138], [98, 138]],
    [[110, 44], [185, 44], [122, 138]], [[185, 44], [219, 44], [110, 164], [122, 138]], [[98, 138], [122, 138], [110, 164]],
  ],
};
const K = 42 / 220;
const toBox = (poly) => poly.map(([x, y]) => [+(3 + x * K).toFixed(2), +(4 + y * K).toFixed(2)]);
export const DIA = { crown: toBox(DIA_SRC.crown), outline: toBox(DIA_SRC.outline), facets: DIA_SRC.facets.map(toBox) };
const pathOf = (poly) => `M${poly.map((p) => p.join(' ')).join('L')}Z`;
const DIA_OUTLINE = DIA.facets.map(pathOf).join(' ');
const DIA_SHAPE = pathOf(DIA.outline);
const DIA_CROWN = pathOf(DIA.crown);

// Diamant-Icon als Outline (currentColor). Mit `filled` bekommt die Krone eine Füllung.
export function diamondSvg({ filled = false, cls = '' } = {}) {
  return `<svg class="dia ${cls}" viewBox="0 0 48 40" aria-hidden="true">
    ${filled ? `<path class="dia-fill" d="${DIA_CROWN}"/>` : ''}
    <path class="dia-line" d="${DIA_OUTLINE}"/>
  </svg>`;
}

// Diamant mit grünem Versatz – für Aufzählungen und kleine Icons.
export function diamondShadowed(cls = '') {
  return `<span class="dia-stack ${cls}">${diamondSvg({ cls: 'dia-shadow' })}${diamondSvg({ filled: true, cls: 'dia-main' })}</span>`;
}

// Gläserner Diamant: halbtransparente Facetten, Lichtreflexe, wandernder Glanz und Funkeln.
let glassId = 0;
export function glassDiamond(cls = '') {
  const id = `g${++glassId}`;
  // Glas-Look: jede Facette mit eigenem Verlauf und eigener Deckkraft
  const look = [['a', 0.55], ['b', 0.9], ['a', 0.4], ['b', 0.8], ['a', 0.5], ['c', 0.45], ['a', 0.6], ['b', 0.7],
    ['b', 0.75], ['a', 0.45], ['c', 0.5], ['c', 0.35], ['b', 0.7], ['a', 0.5], ['c', 0.6], ['c', 0.3], ['b', 0.85]];
  const facets = DIA.facets.map((f, i) => [f.map((p) => p.join(',')).join(' '), look[i][1], look[i][0]]);
  const sheen = toBox([[64, 8], [76, 8], [50, 32], [38, 32]]).map((p) => p.join(',')).join(' ');
  return `<svg class="glass-dia ${cls}" viewBox="0 0 48 40" aria-hidden="true">
    <defs>
      <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9ff7c0"/></linearGradient>
      <linearGradient id="${id}b" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#d9fbff"/><stop offset="1" stop-color="#3dfa74"/></linearGradient>
      <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3dfa74"/><stop offset="1" stop-color="#c9f9ff"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}k"><path d="${DIA_SHAPE}"/></clipPath>
    </defs>
    <path class="glass-shadow" d="${DIA_SHAPE}" transform="translate(3 3)"/>
    <g clip-path="url(#${id}k)">
      ${facets.map(([pts, o, g]) => `<polygon points="${pts}" fill="url(#${id}${g})" fill-opacity="${o}"/>`).join('')}
      <polygon points="${sheen}" fill="#fff" fill-opacity=".85"/>
      <rect class="glass-shine" x="-30" y="-5" width="16" height="50" fill="url(#${id}s)" transform="skewX(-20)"/>
    </g>
    <path class="glass-line" d="${DIA_OUTLINE}"/>
    <path class="glass-spark" d="M40 0l1.4 3.6L45 5l-3.6 1.4L40 10l-1.4-3.6L35 5l3.6-1.4z"/>
    <path class="glass-spark glass-spark--2" d="M6 9.5l.9 2.1L9 12.5l-2.1.9L6 15.5l-.9-2.1L3 12.5l2.1-.9z"/>
  </svg>`;
}

export function logo(size = 'lg') {
  return `<div class="logo logo--${size}" role="img" aria-label="${APP_NAME} – then the others">
    <div class="logo-row"><span class="logo-word" data-text="${LOGO_TEXT}">${LOGO_TEXT}</span>${glassDiamond('logo-dia')}</div>
    <div class="logo-tag">then the others</div>
  </div>`;
}

// Inline-Logo im Fließtext ("Bei Fam€💎 bestimmst du …").
export function logoInline() {
  return `<span class="logo-inline" aria-label="${APP_NAME}">${LOGO_TEXT}${diamondSvg({ filled: true, cls: 'dia-inline' })}</span>`;
}

// Text mit schwarzem Marker-Balken und grüner Schrift.
export const hl = (text) => `<mark class="hl">${text}</mark>`;

export function dots(active, count = 3) {
  return `<div class="dots" role="progressbar" aria-valuemin="1" aria-valuemax="${count}" aria-valuenow="${active + 1}">
    ${Array.from({ length: count }, (_, i) => `<span class="dot${i === active ? ' is-active' : ''}"></span>`).join('')}
  </div>`;
}

export function backButton(cls = '') {
  return `<button class="back ${cls}" type="button" data-back aria-label="Zurück">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8"/></svg>
  </button>`;
}

// Kopfbereich mit geschwungener Unterkante und grünem Versatz-Bogen.
export function hero(inner, { dark = true, cls = '', back = true } = {}) {
  return `<header class="hero ${dark ? 'hero--dark' : ''} ${cls}">
    <div class="hero-shape">${inner}</div>
    ${back ? backButton() : ''}
  </header>`;
}

export function button(label, attrs = '') {
  return `<button class="btn" type="button" ${attrs}><span>${label}</span></button>`;
}

// Gegenstands-Tooltip wie bei Diablo/WoW: Name in Seltenheitsfarbe, Typ, Werte, Flavor-Text.
export function itemTooltip({ name, rarity, type, stats = [], flavor = '', img = '', cls = '' }) {
  return `<article class="tooltip tooltip--${rarity.id} ${cls}" style="--rar:${rarity.color}">
    ${img ? `<div class="tooltip-img"><img src="${img}" alt="" draggable="false"></div>` : ''}
    <h3 class="tooltip-name">${name}</h3>
    <div class="tooltip-type">${type || rarity.item}</div>
    ${stats.length ? `<ul class="tooltip-stats">${stats.map((s) => `<li class="${s.cls || ''}">${s.text}</li>`).join('')}</ul>` : ''}
    ${flavor ? `<p class="tooltip-flavor">${flavor}</p>` : ''}
  </article>`;
}

export const icons = {
  user: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.2"/><path d="M6.2 18.6c1.3-2.3 3.4-3.6 5.8-3.6s4.5 1.3 5.8 3.6"/></svg>`,
  trophy: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 13v4 M8 20h8 M9 17h6v3H9z"/></svg>`,
  insta: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/></svg>`,
  rotate: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 4 0 0 0 16 0 M20 12a8 4 0 0 0-11-3.7 M9 6l-1 2.4 2.6.6"/></svg>`,
  crown: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 4 7l4.5 5L12 5l3.5 7L20 7l1 11z"/></svg>`,
  cash: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="1.5"/><circle cx="12" cy="12" r="3"/><path d="M5.5 9v6 M18.5 9v6"/></svg>`,
  pin: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10l4 5-9 11L3 9z M3 9h18 M10 4l-1.5 5L12 20l3.5-11L14 4"/></svg>`,
  heart: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 15.4 12 20 12 20z"/></svg>`,
  tiktok: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5 M14 3c.4 2.6 2.2 4.4 5 4.6"/></svg>`,
  share: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3 M7.5 7.5 12 3l4.5 4.5 M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>`,
  download: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12 M7.5 10.5 12 15l4.5-4.5 M5 19h14"/></svg>`,
  snap: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c-3 0-5 2.2-5 5v2.3l-1.8.6c-.5.2-.5.8 0 1l1.6.6c-.5 1.6-1.7 2.8-3.3 3.4.4.8 1.6 1 2.6 1.2.2.6.4 1.1.9 1.1.7 0 1.5-.5 2.6-.2 1 .3 1.6 1.4 2.4 1.4s1.4-1.1 2.4-1.4c1.1-.3 1.9.2 2.6.2.5 0 .7-.5.9-1.1 1-.2 2.2-.4 2.6-1.2-1.6-.6-2.8-1.8-3.3-3.4l1.6-.6c.5-.2.5-.8 0-1l-1.8-.6V8.5c0-2.8-2-5-5-5z"/></svg>`,
  whatsapp: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4A8.5 8.5 0 1 1 8.3 19z M9 8.5c0 3 3 6.5 6.5 6.5l1-1.5-2-1-1 1c-1.2-.5-2.5-1.8-3-3l1-1-1-2z"/></svg>`,
  home: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.5 12 4l8.5 7.5 M6 10v9.5h4.5V15h3v4.5H18V10"/></svg>`,
  bottle: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2h4v4l1.5 3v12a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V9L10 6z M8.5 13h7"/></svg>`,
};

// Symbol je Plattform (Instagram, TikTok, Snapchat)
export const platformIcon = (id) => ({ ig: icons.insta, tt: icons.tiktok, sc: icons.snap }[id] || icons.user);
