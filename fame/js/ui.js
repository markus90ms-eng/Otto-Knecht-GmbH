// Wiederverwendbare UI-Bausteine (HTML-Snippets) im Fame-Look.

export const APP_NAME = 'Fame';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Diamant-Icon als Outline (currentColor). Mit `filled` bekommt die Krone eine Füllung.
export function diamondSvg({ filled = false, cls = '' } = {}) {
  return `<svg class="dia ${cls}" viewBox="0 0 48 40" aria-hidden="true">
    ${filled ? '<path class="dia-fill" d="M12 4h24l8 10H4z"/>' : ''}
    <path class="dia-line" d="M12 4h24l8 10-20 23L4 14z M4 14h40 M12 4l6 10 6-10 6 10 6-10 M18 14l6 23 6-23"/>
  </svg>`;
}

// Diamant mit grünem Versatz – wie im Logo und bei aktiven Aufzählungspunkten.
export function diamondShadowed(cls = '') {
  return `<span class="dia-stack ${cls}">${diamondSvg({ cls: 'dia-shadow' })}${diamondSvg({ filled: true, cls: 'dia-main' })}</span>`;
}

export function logo(size = 'lg') {
  return `<div class="logo logo--${size}" role="img" aria-label="${APP_NAME} – then the others">
    <div class="logo-row"><span class="logo-word">${APP_NAME}</span>${diamondShadowed('logo-dia')}</div>
    <div class="logo-tag">then the others</div>
  </div>`;
}

// Inline-Logo im Fließtext ("Bei Fame💎 bestimmst du …").
export function logoInline() {
  return `<span class="logo-inline">${APP_NAME}${diamondSvg({ filled: true, cls: 'dia-inline' })}</span>`;
}

// Text mit schwarzem Marker-Balken und grüner Schrift.
export const hl = (text) => `<mark class="hl">${text}</mark>`;

export function dots(active, count = 3) {
  return `<div class="dots" role="progressbar" aria-valuemin="1" aria-valuemax="${count}" aria-valuenow="${active + 1}">
    ${Array.from({ length: count }, (_, i) => `<span class="dot${i === active ? ' is-active' : ''}"></span>`).join('')}
  </div>`;
}

export function backButton() {
  return `<button class="back" type="button" data-back aria-label="Zurück">
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

export const icons = {
  trophy: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 13v4 M8 20h8 M9 17h6v3H9z"/></svg>`,
  insta: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/></svg>`,
  rotate: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 4 0 0 0 16 0 M20 12a8 4 0 0 0-11-3.7 M9 6l-1 2.4 2.6.6"/></svg>`,
  crown: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 4 7l4.5 5L12 5l3.5 7L20 7l1 11z"/></svg>`,
};
