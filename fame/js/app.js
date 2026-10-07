// Fame – App-Shell, Router und Screens.

import {
  TIERS, RARITIES, PIN_FROM, COUNTRIES, countryById, tierFor, nextTier, fmt, money,
  amountFromPos, posFromAmount, rankFor, standings, groupTotals, makeSerial,
  MAX_AMOUNT, MIN_AMOUNT,
} from './data.js';
import {
  APP_NAME, LOGO_TEXT, esc, logo, logoInline, hl, dots, hero, button, backButton, diamondSvg,
  diamondShadowed, icons,
} from './ui.js';
import { tick, plink, rarityDrop, buzz, unlockAudio, buildup, reveal } from './fx.js';
import { createDiamond } from './diamond3d.js';
import { particles } from './particles.js';
import {
  renderStory, renderSticker, shareToInstagramStory, shareToTikTok, shareElsewhere, saveImage,
} from './share.js';

// ---- Zustand (lokal gespeichert, bis ein Backend existiert) -----------------

const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem('fame.' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem('fame.' + key, JSON.stringify(value)); } catch { /* privat/blockiert */ }
  },
};

// Konto: Summe aller Einzahlungen. Jede Einzahlung stellt eine neue Fame-Card mit Seriennummer aus.
function loadAccount() {
  const acc = store.get('account');
  if (acc && Array.isArray(acc.deposits)) return acc;
  const old = store.get('donation'); // Stand aus der ersten Version übernehmen
  return old?.amount
    ? { total: old.amount, deposits: [{ amount: old.amount, at: old.at || Date.now() }], cards: [] }
    : { total: 0, deposits: [], cards: [] };
}

const state = {
  user: store.get('user'),            // { name, insta, country, region } wenn registriert
  amount: store.get('amount', 100),   // gewählter Einzahlungsbetrag
  accepted: false,
  account: loadAccount(),
  after: null,                        // Ziel nach dem Login (z. B. zurück zum Einzahlen)
  rankView: {},                       // gewähltes Land/Bundesland im Ranking
};

const saveAccount = () => store.set('account', state.account);

// ---- Router -----------------------------------------------------------------

const app = document.getElementById('app');
let cleanup = null;

const routes = {
  '': splash,
  'intro/1': intro1,
  'intro/2': intro2,
  'intro/3': intro3,
  login: login,
  donate: donate,
  card: card,
  ranking: () => rankingPage(state.user?.region ? 'region' : 'country'),
  'ranking/region': () => rankingPage('region'),
  'ranking/country': () => rankingPage('country'),
};

export const go = (path) => { location.hash = '#/' + path; };

function render() {
  const path = location.hash.replace(/^#\/?/, '');
  const screen = routes[path] || splash;
  cleanup?.();
  cleanup = null;
  const { html, mount } = screen();
  app.innerHTML = html;
  const el = app.firstElementChild;
  el.classList.add('is-entering');
  requestAnimationFrame(() => el.classList.remove('is-entering'));
  app.scrollTop = 0;
  cleanup = mount?.(el) || null;
}

app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go],[data-back]');
  if (!t) return;
  if (t.hasAttribute('data-back')) {
    if (history.length > 1) history.back(); else go('');
  } else {
    go(t.getAttribute('data-go'));
  }
});

window.addEventListener('hashchange', render);
unlockAudio();

// ---- Kleine Helfer ----------------------------------------------------------

function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 400);
  }, 2600);
}

const firstName = (name) => (name || '').trim().split(/\s+/)[0];
const cleanHandle = (h) => (h || '').trim().replace(/^@+/, '').replace(/\s+/g, '');
const shortMoney = (n) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €`
  : n >= 10_000 ? `${fmt(Math.round(n / 1000))} Tsd. €` : money(n));

// Mittelpunkt eines Elements relativ zu einem Canvas (für Funken-Explosionen).
function centerIn(canvas, el) {
  const a = canvas.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2 - a.left, b.top + b.height / 2 - a.top];
}

// Das eigene Konto als Eintrag fürs Ranking.
function meEntry() {
  if (!state.user || !state.account.total) return null;
  return {
    handle: state.user.insta || firstName(state.user.name) || 'du',
    amount: state.account.total,
    country: state.user.country || 'DE',
    region: state.user.region || '',
  };
}

// ---- Screens ----------------------------------------------------------------

function splash() {
  return {
    html: `<section class="screen screen--splash">
      <div class="sweep" aria-hidden="true"></div>
      <div class="splash-logo">${logo('xl')}</div>
      <div class="splash-space"></div>
      <a class="newhere" href="#/intro/1">
        <span class="newhere-q">Neu hier?</span>
        <span class="newhere-go">Zeig mir mehr <span aria-hidden="true">→</span></span>
      </a>
      <div class="splash-space splash-space--mid"></div>
      <div class="splash-login">${button('Login', 'data-go="login"')}</div>
    </section>`,
  };
}

// 1. Loot-Drop: der Diamant fällt in einer Lichtsäule herunter.
function intro1() {
  const legendary = RARITIES[4];
  return {
    html: `<section class="screen screen--dark screen--loot1" style="--rar:${legendary.color}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      <div class="loot1-logo">${logo('md')}</div>
      <div class="drop-stage">
        <div class="beam" aria-hidden="true"></div>
        <div class="drop-floor" aria-hidden="true"></div>
        <div class="drop-gem" data-gem><div class="stage3d" data-diamond></div></div>
      </div>
      <h1 class="claim claim--loot">Zeig was Du dir <em>leisten kannst</em> und tue dabei <strong>GUTES</strong>.</h1>
      <div class="screen-foot">
        ${dots(0)}
        ${button('Zeig mir mehr', 'data-go="intro/2"')}
      </div>
    </section>`,
    mount(el) {
      const dia = createDiamond(el.querySelector('[data-diamond]'), { level: 4, glow: 0.9, rim: '#ff8a1f', interactive: false });
      const canvas = el.querySelector('[data-fx]');
      const fx = particles(canvas, { color: '#ff9a3c', mode: 'embers', density: 0.6 });
      const gem = el.querySelector('[data-gem]');
      const timer = setTimeout(() => {
        rarityDrop(4);
        dia.pulse();
        const [x, y] = centerIn(canvas, gem);
        fx.burst(x, y + 30, 60, '#ffb35c');
        fx.setDensity(1.2);
        el.classList.add('is-landed');
      }, 820);
      return () => { clearTimeout(timer); fx.dispose(); dia.dispose(); };
    },
  };
}

// 2. Übersicht: vier Belohnungen. Der Text steht im Fokus, das Foto ist nur ein Begleiter.
const LOOT = [
  {
    level: 0, icon: 'cash', img: 'assets/img/cash.jpg', alt: 'Ein Bündel Dollarscheine',
    lead: `${hl('Ca$h')} ist für dich nichts?`,
    sub: `Beweise es und ${hl('zeig´s der Welt')}.`,
  },
  {
    level: 2, icon: 'crown', img: 'assets/img/ranking.jpg', alt: 'Siegerpodest mit Strichmännchen auf Platz 1',
    lead: `Steig im ${hl('Ranking')} auf.`,
    sub: 'Jeder Euro bringt dich höher – im Bundesland, im Land, weltweit.',
  },
  {
    level: 3, icon: 'pin', img: 'assets/img/pin.jpg', alt: 'Neon-Hand mit Diamant',
    lead: `Verdiene dir deinen ${hl('Diamant Pin')}.`,
    sub: `Echt, zum Anstecken. Ab ${money(PIN_FROM)}.`,
  },
  {
    level: 4, icon: 'heart', img: 'assets/img/animals.jpg', alt: 'Hund und Katze auf dem Sofa',
    lead: `${hl('Hilf')} damit auch Menschen und Tieren in Not.`,
    sub: 'Angeben und Gutes tun. Beides geht.',
  },
];
const PERK_MS = 4800;

function intro2() {
  return {
    html: `<section class="screen screen--dark screen--loot2" style="--rar:${RARITIES[0].color}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <header class="loot-head"><h1 class="loot-title">Das holst du dir bei ${LOGO_TEXT}</h1></header>
      <article class="perk" data-perk>
        <div class="perk-photo">${LOOT.map((it, i) => `<img class="perk-img${i === 0 ? ' is-active' : ''}" src="${it.img}" alt="${it.alt}" draggable="false">`).join('')}</div>
        <div class="perk-count"><b data-idx>01</b> / ${String(LOOT.length).padStart(2, '0')}</div>
        <div class="perk-text" data-perktext aria-live="polite"></div>
        <div class="perk-progress" aria-hidden="true"><i data-progress></i></div>
      </article>
      <div class="inventory" role="tablist" aria-label="Belohnungen">
        ${LOOT.map((it, i) => `<button class="slot" type="button" role="tab" data-i="${i}"
          style="--rar:${RARITIES[it.level].color}; --d:${i * 0.18 + 0.2}s" aria-label="Belohnung ${i + 1}">
          ${icons[it.icon]}</button>`).join('')}
      </div>
      <div class="screen-foot">
        ${dots(1)}
        ${button('Noch mehr!', 'data-go="intro/3"')}
      </div>
    </section>`,
    mount(el) {
      const slotEls = [...el.querySelectorAll('.slot')];
      const perk = el.querySelector('[data-perk]');
      const text = el.querySelector('[data-perktext]');
      const imgs = [...el.querySelectorAll('.perk-img')];
      const idx = el.querySelector('[data-idx]');
      const progress = el.querySelector('[data-progress]');
      const fx = particles(el.querySelector('[data-fx]'), { mode: 'dust', color: RARITIES[0].color });
      let i = -1;
      const show = (n, { sound = false } = {}) => {
        i = (n + LOOT.length) % LOOT.length;
        const it = LOOT[i];
        const rarity = RARITIES[it.level];
        slotEls.forEach((s, k) => s.setAttribute('aria-selected', k === i));
        imgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
        perk.className = `perk perk--${rarity.id}`;
        idx.textContent = String(i + 1).padStart(2, '0');
        text.innerHTML = `<p class="perk-lead">${it.lead}</p><p class="perk-sub">${it.sub}</p>`;
        text.classList.remove('is-in');
        void text.offsetWidth;
        text.classList.add('is-in');
        // Fortschrittsbalken bis zum nächsten automatischen Wechsel
        progress.style.transition = 'none';
        progress.style.width = '0%';
        void progress.offsetWidth;
        progress.style.transition = `width ${PERK_MS}ms linear`;
        progress.style.width = '100%';
        el.style.setProperty('--rar', rarity.color);
        fx.setColor(rarity.color);
        fx.setDensity(0.6 + it.level * 0.5);
        if (sound) rarityDrop(it.level);
      };
      const drops = slotEls.map((_, k) => setTimeout(() => plink(k), 200 + k * 180));
      show(0);
      let timer = setInterval(() => show(i + 1), PERK_MS);
      slotEls.forEach((s, k) => s.addEventListener('click', () => {
        clearInterval(timer);
        show(k, { sound: true });
        timer = setInterval(() => show(i + 1), PERK_MS);
      }));
      return () => { clearInterval(timer); drops.forEach(clearTimeout); fx.dispose(); };
    },
  };
}

// 3. Die Geschichte des Gründers – mittig im Spotlight, Zeile für Zeile.
function intro3() {
  const lines = [
    ['old', 'Eine Belvedere Flasche kostet im Club <b>300€ – 3.000€</b>,'],
    ['old', `der ${hl('Fame')} hält maximal <b>einen Abend</b>,`],
    ['old', 'die Reichweite begrenzt sich auf den Club.'],
    ['new', `Bei ${logoInline()} bestimmst du deine Kosten,`],
    ['new', `der ${hl('Fame')} hält dein ${hl('Leben lang')}`],
    ['new', 'und die Reichweite ist <b>grenzenlos</b>.'],
  ];
  return {
    html: `<section class="screen screen--dark screen--story" style="--rar:${RARITIES[4].color}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <div class="story-stage">
        <div class="spotlight" aria-hidden="true"></div>
        <h1 class="story-title">#Real_story, BRO</h1>
        <blockquote class="story-quote">
          <span class="story-mark" aria-hidden="true">“</span>
          ${lines.map(([kind, t], i) => `${i === 3 ? '<span class="story-divider" aria-hidden="true"></span>' : ''}
            <p class="story-line story-line--${kind}" style="--i:${i + (i >= 3 ? 1 : 0)}">${t}</p>`).join('')}
          <footer class="story-line" style="--i:8">${APP_NAME} Gründer</footer>
        </blockquote>
      </div>
      <div class="screen-foot">
        ${dots(2)}
        ${button('Fang an – JETZT', 'data-go="login"')}
      </div>
    </section>`,
    mount(el) {
      const canvas = el.querySelector('[data-fx]');
      const fx = particles(canvas, { color: '#ff9a3c', mode: 'embers', density: 0.4 });
      // Wenn der Fame-Teil erscheint: Licht, Funken, Sound
      const timer = setTimeout(() => {
        el.classList.add('is-lit');
        rarityDrop(4);
        const [x, y] = centerIn(canvas, el.querySelector('.story-divider'));
        fx.burst(x, y, 50, '#ffb35c');
        fx.setDensity(1);
      }, 1700);
      return () => { clearTimeout(timer); fx.dispose(); };
    },
  };
}

function regionOptions(countryId, selected) {
  return countryById(countryId).regions
    .map((r) => `<option${r === selected ? ' selected' : ''}>${esc(r)}</option>`).join('');
}

function login() {
  const u = state.user || {};
  const country = u.country || 'DE';
  return {
    html: `<section class="screen screen--login">
      ${hero(`<div class="stage3d" data-diamond></div>`, { cls: 'hero--tall' })}
      <form class="login-form" novalidate>
        <div class="login-icon">${diamondShadowed()}</div>
        <h1 class="headline">Werde ${LOGO_TEXT}</h1>
        <p class="sub">Leg dein Profil an und sichere dir deinen Platz im Ranking.</p>
        <label class="field"><span>Name</span>
          <input id="login-name" name="name" autocomplete="given-name" required value="${esc(u.name)}" placeholder="Max"></label>
        <label class="field"><span>Instagram</span>
          <input id="login-insta" name="insta" autocomplete="off" autocapitalize="off" value="${esc(u.insta ? '@' + u.insta : '')}" placeholder="@deinname"></label>
        <div class="field-row">
          <label class="field"><span>Land</span>
            <select id="login-country" name="country">${COUNTRIES.map((c) =>
              `<option value="${c.id}"${c.id === country ? ' selected' : ''}>${c.flag} ${c.name}</option>`).join('')}</select></label>
          <label class="field"><span>Bundesland</span>
            <select id="login-region" name="region">${regionOptions(country, u.region)}</select></label>
        </div>
        <div class="screen-foot">
          <button class="btn" type="submit"><span>Login</span></button>
          ${state.user ? '<button class="link" type="button" data-logout>Abmelden</button>' : ''}
        </div>
      </form>
    </section>`,
    mount(el) {
      const dia = createDiamond(el.querySelector('[data-diamond]'), { level: 4, glow: 0.6, rim: '#3dfa74' });
      const form = el.querySelector('form');
      form.country.addEventListener('change', () => {
        form.region.innerHTML = regionOptions(form.country.value);
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.name.value.trim();
        if (!name) {
          form.name.focus();
          form.name.closest('.field').classList.add('is-error');
          buzz(30);
          return;
        }
        state.user = { name, insta: cleanHandle(form.insta.value), country: form.country.value, region: form.region.value };
        store.set('user', state.user);
        const next = state.after || 'donate';
        state.after = null;
        go(next);
      });
      el.querySelector('[data-logout]')?.addEventListener('click', () => {
        state.user = null;
        store.set('user', null);
        go('');
      });
      return () => dia.dispose();
    },
  };
}

// Schrittweite für +/- je nach Größenordnung (1, 5, 50, 500 …).
function stepFor(amount, dir) {
  const base = amount < 10 ? 1 : 5 * 10 ** (Math.floor(Math.log10(dir > 0 ? amount : amount - 1)) - 1);
  return Math.max(1, base);
}

// Einzahlen: Wie ein Diamant aussieht, sieht nur, wer ihn besitzt. Alle anderen sehen nur
// seine leuchtenden Umrisse – das macht neugierig.
function donate() {
  const registered = !!state.user;
  const acc = state.account;
  const owned = acc.total ? tierFor(acc.total).level : -1;
  const start = tierFor(acc.total + state.amount);
  return {
    html: `<section class="screen screen--dark screen--donate" style="--rar:${start.css}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <div class="vault">
        <div class="vault-glow" aria-hidden="true"></div>
        <div class="stage3d" data-diamond></div>
        <div class="vault-q" aria-hidden="true">?</div>
        <div class="rarity-flash" data-flash aria-hidden="true"></div>
      </div>
      <div class="vault-info">
        <h1 class="vault-name" data-tier></h1>
        <p class="vault-teaser" data-teaser></p>
      </div>
      <div class="collection" aria-label="Deine Diamanten">
        ${TIERS.map((t) => `<span class="cslot" data-cslot="${t.level}" style="--c:${t.css}" title="${t.name}">
          ${t.level <= owned ? diamondSvg({ filled: true }) : '<span class="cslot-q">?</span>'}</span>`).join('')}
        <span class="collection-label">${owned + 1} von ${TIERS.length} entdeckt</span>
      </div>
      <div class="donate-body">
        ${acc.total ? `<div class="account">Dein Konto <b>${money(acc.total)}</b> → danach <b data-after></b></div>` : ''}
        <div class="amount-box">
          <button class="stepper" type="button" data-step="-1" aria-label="Weniger">−</button>
          <label class="amount-field">
            <span class="sr-only">Betrag in Euro</span>
            <input id="donate-amount" data-amount inputmode="numeric" autocomplete="off" enterkeyhint="done">
            <span class="amount-cur" aria-hidden="true">€</span>
          </label>
          <button class="stepper" type="button" data-step="1" aria-label="Mehr">+</button>
        </div>
        <p class="amount-hint">Betrag antippen zum Eintippen – oder Regler ziehen</p>
        <div class="arc" data-arc role="slider" tabindex="0" aria-label="Betrag einstellen"
          aria-valuemin="${MIN_AMOUNT}" aria-valuemax="${MAX_AMOUNT}">
          <svg viewBox="0 0 300 108" aria-hidden="true">
            <path class="arc-track" d="M20 16 Q150 168 280 16" pathLength="1"/>
            <path class="arc-fill" d="M20 16 Q150 168 280 16" pathLength="1" data-arcfill/>
            <g data-knob><circle class="knob-shadow" r="13" cx="3" cy="4"/><circle class="knob" r="13"/><circle class="knob-dot" r="4"/></g>
          </svg>
        </div>
        <button class="nudge" type="button" data-nudge></button>
        ${registered ? '<p class="rank-preview" data-rankline></p>' : ''}
        <label class="check">
          <input id="donate-accept" type="checkbox" data-accept ${state.accepted ? 'checked' : ''}>
          <span class="check-box" aria-hidden="true"></span>
          <span>Ich akzeptiere die <a href="#" data-terms>Bedingungen</a></span>
        </label>
        <div class="screen-foot">
          ${button('I´m awesome', 'data-awesome')}
        </div>
      </div>
    </section>`,
    mount(el) {
      const $ = (s) => el.querySelector(s);
      const dia = createDiamond($('[data-diamond]'), {
        level: start.level, rim: start.css, mystery: start.level > owned, glow: 0.6,
      });
      const canvas = $('[data-fx]');
      const fx = particles(canvas, { color: start.css, mode: 'embers', density: 0.3 + start.level * 0.3 });
      const input = $('[data-amount]');
      const arc = $('[data-arc]');
      const fill = $('[data-arcfill]');
      const knob = $('[data-knob]');
      const btn = $('[data-awesome]');
      const accept = $('[data-accept]');
      const flash = $('[data-flash]');
      const nudge = $('[data-nudge]');
      let level = start.level;
      let amount = state.amount;
      let nudgeTarget = 0;

      const tierChanged = (tier, up) => {
        rarityDrop(tier.level);
        dia.pulse();
        flash.classList.remove('is-on');
        void flash.offsetWidth;
        flash.classList.add('is-on');
        if (up) {
          const [x, y] = centerIn(canvas, $('[data-diamond]'));
          fx.burst(x, y, 20 + tier.level * 20, tier.css);
        }
      };

      const update = (next, { sound = false } = {}) => {
        const prev = amount;
        amount = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, Math.round(next)));
        state.amount = amount;
        const after = acc.total + amount;
        const pos = posFromAmount(amount);
        const tier = tierFor(after);
        const locked = tier.level > owned;

        knob.setAttribute('transform', `translate(${20 + 260 * pos} ${16 + 304 * pos * (1 - pos)})`);
        fill.style.strokeDasharray = `${pos} 1`;
        arc.setAttribute('aria-valuenow', amount);
        arc.setAttribute('aria-valuetext', `${money(amount)}, danach ${tier.name}`);
        if (document.activeElement !== input) input.value = fmt(amount);
        const afterEl = $('[data-after]');
        if (afterEl) afterEl.textContent = money(after);

        $('[data-tier]').textContent = tier.name;
        $('[data-teaser]').textContent = locked
          ? 'Wie er aussieht, wissen nur die, die ihn haben.'
          : 'Den kennst du schon. Willst du mehr sehen?';
        el.classList.toggle('is-locked', locked);
        el.querySelectorAll('[data-cslot]').forEach((s) => s.classList.toggle('is-target', +s.dataset.cslot === tier.level));
        el.style.setProperty('--rar', tier.css);
        el.style.setProperty('--glow', (0.3 + posFromAmount(after) * 0.7).toFixed(3));
        dia.setGlow(posFromAmount(after));

        // Anreiz: wie viel fehlt bis zum nächsten unbekannten Diamanten?
        const nx = nextTier(after);
        if (nx) {
          nudgeTarget = nx.min - acc.total;
          nudge.hidden = false;
          nudge.style.setProperty('--c', nx.css);
          nudge.innerHTML = `<span>Nur noch <b>${money(nx.min - after)}</b> bis zum <b>${nx.name}</b></span><span class="nudge-go">${nx.level > owned ? 'Freischalten' : 'Aufsteigen'} →</span>`;
        } else {
          nudge.hidden = true;
        }
        const rl = $('[data-rankline]');
        if (rl) {
          const { rank, total } = rankFor(after);
          rl.innerHTML = `${icons.trophy} Rang danach <b>${fmt(rank)}</b> von ${fmt(total)}`;
        }

        if (tier.level !== level) {
          dia.setLevel(tier.level);
          dia.setRim(tier.css);
          dia.setMystery(locked, tier.css);
          fx.setColor(tier.css);
          fx.setDensity(0.3 + tier.level * 0.3);
          if (sound) tierChanged(tier, tier.level > level);
          level = tier.level;
        } else if (sound && amount !== prev) {
          tick(pos, amount > prev);
        }
        store.set('amount', amount);
      };

      // Regler
      const svg = arc.querySelector('svg');
      const fromPointer = (e) => {
        const r = svg.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 300;
        return Math.min(1, Math.max(0, (x - 20) / 260));
      };
      let dragging = false;
      arc.addEventListener('pointerdown', (e) => {
        dragging = true;
        arc.setPointerCapture?.(e.pointerId);
        update(amountFromPos(fromPointer(e)), { sound: true });
      });
      arc.addEventListener('pointermove', (e) => { if (dragging) update(amountFromPos(fromPointer(e)), { sound: true }); });
      const stop = () => { dragging = false; };
      arc.addEventListener('pointerup', stop);
      arc.addEventListener('pointercancel', stop);
      arc.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        update(amountFromPos(Math.min(1, Math.max(0, posFromAmount(amount) + d * 0.01))), { sound: true });
      });

      // Betrag direkt eintippen: beim Antippen wird alles markiert, Eingabe wird live übernommen.
      input.addEventListener('focus', () => { input.value = String(amount); requestAnimationFrame(() => input.select()); });
      input.addEventListener('input', () => {
        const n = parseInt(input.value.replace(/\D/g, ''), 10);
        if (n) update(n, { sound: true });
      });
      input.addEventListener('blur', () => { input.value = fmt(amount); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });

      // Plus / Minus
      el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
        const d = +b.dataset.step;
        const step = stepFor(amount, d);
        update(d > 0 ? Math.floor(amount / step) * step + step : Math.ceil(amount / step) * step - step, { sound: true });
      }));

      nudge.addEventListener('click', () => { if (nudgeTarget > 0) update(nudgeTarget, { sound: true }); });

      const syncBtn = () => { btn.disabled = !accept.checked; };
      accept.addEventListener('change', () => { state.accepted = accept.checked; syncBtn(); buzz(8); });
      $('[data-terms]').addEventListener('click', (e) => {
        e.preventDefault();
        toast('Die Teilnahmebedingungen folgen in Kürze.');
      });

      btn.addEventListener('click', async () => {
        if (!accept.checked) return;
        if (!state.user) {
          state.after = 'donate';
          toast('Log dich ein, damit der Betrag auf deinem Konto landet.');
          go('login');
          return;
        }
        try { await window.DeviceOrientationEvent?.requestPermission?.(); } catch { /* abgelehnt */ }
        // Prototyp: die Zahlung wird simuliert und direkt dem Konto gutgeschrieben.
        const at = Date.now();
        acc.total += amount;
        acc.deposits.push({ amount, at });
        const tier = tierFor(acc.total);
        acc.cards.push({
          tier: tier.id, total: acc.total, at, revealed: false,
          serial: makeSerial(`${state.user.name}|${state.user.insta}|${acc.total}|${at}`),
        });
        saveAccount();
        go('card');
      });

      update(amount);
      syncBtn();
      return () => { fx.dispose(); dia.dispose(); };
    },
  };
}

// Fame-Card: liegt verdeckt da. Antippen baut Spannung auf, dann dreht sie sich mit Licht und Sound.
// Je höher die Stufe, desto länger die Spannung und desto größer der Gewinn-Moment.
function card() {
  const acc = state.account;
  const c = acc.cards?.[acc.cards.length - 1];
  if (!acc.total || !c) {
    queueMicrotask(() => go('donate'));
    return { html: '<section class="screen"></section>' };
  }
  const tier = TIERS.find((t) => t.id === c.tier) || tierFor(acc.total);
  const rarity = tier.rarity;
  const insta = state.user?.insta || '';
  const hidden = c.revealed === false;
  return {
    html: `<section class="screen screen--dark screen--card lvl-${tier.level}${hidden ? ' is-hidden' : ' is-open'}" style="--rar:${rarity.color}">
      <div class="loot-bg" aria-hidden="true">
        <div class="loot-rays"></div>
        <svg class="loot-runes" viewBox="0 0 200 200"><defs><path id="runepath" d="M100 100m-80 0a80 80 0 1 1 160 0a80 80 0 1 1-160 0"/></defs>
          <circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="68"/>
          <text><textPath href="#runepath">FAM€ ✦ THEN THE OTHERS ✦ FAM€ ✦ THEN THE OTHERS ✦ FAM€ ✦</textPath></text></svg>
        <div class="loot-pillar"></div>
        <div class="loot-ground"></div>
      </div>
      <div class="reveal-flash" data-flash aria-hidden="true"></div>
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <div class="card-wrap" data-tiltwrap>
        <div class="flip" data-flip role="button" tabindex="0" aria-label="${hidden ? 'Karte aufdecken' : tier.name}">
          <article class="famecard famecard--${rarity.id} flip-front" data-card>
            <div class="famecard-ring" aria-hidden="true"></div>
            <div class="famecard-inner">
              <div class="famecard-shine" data-shine></div>
              <div class="famecard-top">
                <span class="famecard-brand">${LOGO_TEXT}${diamondSvg({ filled: true, cls: 'dia-inline' })}</span>
                <span class="famecard-serial" title="Seriennummer">Nr. ${c.serial}</span>
              </div>
              <div class="famecard-gem"><div class="glow"></div><div class="stage3d" data-diamond></div></div>
              <h2 class="famecard-name">${tier.name}</h2>
              <p class="famecard-flavor">„${tier.flavor}“</p>
              <div class="famecard-insta">${icons.insta}
                ${insta
                  ? `<span>${esc(insta)}</span>`
                  : `<input id="card-insta" data-insta placeholder="dein Instagram" autocomplete="off" autocapitalize="off" aria-label="Instagram-Name">`}
              </div>
            </div>
          </article>
          <div class="cardback flip-back" aria-hidden="true">
            <div class="cardback-pattern"></div>
            <div class="cardback-logo">${logo('md')}</div>
            <div class="cardback-q">?</div>
            <div class="cardback-tap">Tippen zum Aufdecken</div>
          </div>
        </div>
      </div>
      <div class="screen-foot card-actions">
        <div class="quick-share">
          <button class="qs qs--ig" type="button" data-share="ig">${icons.insta}<span>Story</span></button>
          <button class="qs qs--tt" type="button" data-share="tt">${icons.tiktok}<span>TikTok</span></button>
          <button class="qs" type="button" data-open-sheet>${icons.share}<span>Mehr</span></button>
        </div>
        <div class="foot-links">
          <a class="link" href="#/donate">Nochmal einzahlen</a>
          <a class="link" href="#/ranking">Ranking</a>
        </div>
      </div>
      <div class="sheet" data-sheet hidden>
        <div class="sheet-backdrop" data-close-sheet></div>
        <div class="sheet-panel" role="dialog" aria-modal="true" aria-label="Card teilen">
          <div class="sheet-grip" aria-hidden="true"></div>
          <h2 class="sheet-title">Zeig´s der Welt</h2>
          <div class="sheet-preview"><img data-preview alt="Vorschau deiner Story"><span class="sheet-loading" data-loading>Story wird gebaut…</span></div>
          <div class="sheet-actions">
            <button class="share-btn share-btn--ig" type="button" data-share="ig">${icons.insta}<span>Instagram Story</span></button>
            <button class="share-btn share-btn--tt" type="button" data-share="tt">${icons.tiktok}<span>TikTok</span></button>
            <button class="share-btn" type="button" data-share="more">${icons.share}<span>Weitere Apps</span></button>
            <button class="share-btn" type="button" data-share="save">${icons.download}<span>Bild speichern</span></button>
          </div>
          <p class="sheet-note">Format 9:16 – passt für Instagram Story, TikTok und WhatsApp-Status.</p>
        </div>
      </div>
    </section>`,
    mount(el) {
      const dia = createDiamond(el.querySelector('[data-diamond]'), {
        level: tier.level, rim: rarity.color, glow: 0.8, interactive: false,
      });
      const canvas = el.querySelector('[data-fx]');
      const fx = particles(canvas, {
        color: hidden ? '#3dfa74' : rarity.color,
        mode: tier.level >= 2 && !hidden ? 'embers' : 'dust',
        density: hidden ? 0.5 : 0.4 + tier.level * 0.45,
      });
      const flip = el.querySelector('[data-flip]');
      const shine = el.querySelector('[data-shine]');
      const flash = el.querySelector('[data-flash]');
      const instaInput = el.querySelector('[data-insta]');
      const timers = [];

      // Drehwinkel der Karte: 180° = verdeckt, 0° = offen. Dazu Kippen und Wackeln.
      let angle = hidden ? 180 : 0, target = angle, shake = 0, phase = hidden ? 'hidden' : 'open';
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, idle = 0;
      const setTarget = (x, y) => { tx = Math.max(-1, Math.min(1, x)); ty = Math.max(-1, Math.min(1, y)); idle = 0; };
      const loop = (now) => {
        idle += 1;
        const ax = idle > 90 ? Math.sin(now / 1300) * 0.45 : tx;
        const ay = idle > 90 ? Math.cos(now / 1700) * 0.3 : ty;
        cx += (ax - cx) * 0.08;
        cy += (ay - cy) * 0.08;
        angle += (target - angle) * 0.14;
        const jitter = shake ? (Math.random() - 0.5) * shake : 0;
        flip.style.transform = `rotateY(${angle + cx * 12 + jitter * 3}deg) rotateX(${-cy * 12}deg) translateX(${jitter}px)`;
        shine.style.setProperty('--sx', `${50 + cx * 40}%`);
        shine.style.setProperty('--sy', `${50 + cy * 40}%`);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      const open = () => {
        if (phase !== 'hidden') return;
        phase = 'charging';
        el.classList.add('is-charging');
        fx.setColor(rarity.color);
        fx.setDensity(2 + tier.level);
        const dur = buildup(tier.level);
        // Wackeln wird immer stärker
        const t0 = performance.now();
        const grow = setInterval(() => {
          const p = Math.min(1, (performance.now() - t0) / (dur * 1000));
          shake = 1 + p * (4 + tier.level * 2);
          el.style.setProperty('--charge', p.toFixed(2));
        }, 30);
        timers.push(grow);
        timers.push(setTimeout(() => {
          clearInterval(grow);
          shake = 0;
          phase = 'open';
          target = 0;
          el.classList.remove('is-charging', 'is-hidden');
          el.classList.add('is-open', 'is-revealing');
          flash.classList.add('is-on');
          reveal(tier.level);
          dia.pulse();
          const [x, y] = centerIn(canvas, flip);
          fx.burst(x, y, 40 + tier.level * 40, rarity.color);
          if (tier.level >= 3) timers.push(setTimeout(() => fx.burst(x, y - 60, 60, '#ffffff'), 350));
          fx.setDensity(0.4 + tier.level * 0.45);
          c.revealed = true;
          saveAccount();
          flip.setAttribute('aria-label', tier.name);
        }, dur * 1000));
      };
      flip.addEventListener('click', open);
      flip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

      instaInput?.addEventListener('change', () => {
        if (state.user) {
          state.user.insta = cleanHandle(instaInput.value);
          store.set('user', state.user);
        }
      });

      const onOrient = (e) => {
        if (e.gamma == null) return;
        setTarget(e.gamma / 30, (e.beta - 45) / 30);
      };
      const wrap = el.querySelector('[data-tiltwrap]');
      const onMove = (e) => {
        const r = wrap.getBoundingClientRect();
        setTarget(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
      };
      window.addEventListener('deviceorientation', onOrient);
      wrap.addEventListener('pointermove', onMove);

      // Sharing-Bilder werden erst gebaut, wenn sie gebraucht werden, und dann wiederverwendet.
      const shareData = () => ({ tier, serial: c.serial, insta: state.user?.insta || '', gem: dia.snapshot(900, 700) });
      let cache = {};
      const memo = (key, make) => () => (cache[key] ||= make(shareData()));
      const assets = { story: memo('story', renderStory), sticker: memo('sticker', renderSticker) };
      instaInput?.addEventListener('change', () => { cache = {}; });

      const sheet = el.querySelector('[data-sheet]');
      const preview = el.querySelector('[data-preview]');
      let previewUrl = '';
      const openSheet = async () => {
        sheet.hidden = false;
        requestAnimationFrame(() => sheet.classList.add('is-open'));
        if (!previewUrl) {
          const story = await assets.story();
          previewUrl = story.toDataURL('image/jpeg', 0.85);
          preview.src = previewUrl;
          el.querySelector('[data-loading]').hidden = true;
        }
      };
      const closeSheet = () => {
        sheet.classList.remove('is-open');
        setTimeout(() => { sheet.hidden = true; }, 300);
      };
      el.querySelector('[data-open-sheet]').addEventListener('click', openSheet);
      el.querySelector('[data-close-sheet]').addEventListener('click', closeSheet);

      const ACTIONS = { ig: shareToInstagramStory, tt: shareToTikTok, more: shareElsewhere, save: saveImage };
      let busy = false;
      el.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        b.classList.add('is-busy');
        try {
          const data = { tier, serial: c.serial, insta: state.user?.insta || '' };
          const res = await ACTIONS[b.dataset.share](data, assets);
          if (res.how === 'native' || res.how === 'sheet') { closeSheet(); buzz(15); }
          if (res.hint) toast(res.hint);
        } catch {
          toast('Teilen hat nicht geklappt. Speicher das Bild und lade es selbst hoch.');
        } finally {
          busy = false;
          b.classList.remove('is-busy');
        }
      }));

      return () => {
        timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
        cancelAnimationFrame(raf);
        window.removeEventListener('deviceorientation', onOrient);
        fx.dispose();
        dia.dispose();
      };
    },
  };
}

// ---- Ranking: zwei Seiten (Bundesland / Länder) --------------------------------

// Deutschland als Kachelkarte: jede Kachel ein Bundesland, grob an seiner Lage.
const DE_TILES = {
  'Schleswig-Holstein': ['SH', 1, 0], 'Mecklenburg-Vorpommern': ['MV', 2, 0],
  Bremen: ['HB', 0, 1], Hamburg: ['HH', 1, 1], Brandenburg: ['BB', 2, 1], Berlin: ['BE', 3, 1],
  'Nordrhein-Westfalen': ['NW', 0, 2], Niedersachsen: ['NI', 1, 2], 'Sachsen-Anhalt': ['ST', 2, 2], Sachsen: ['SN', 3, 2],
  'Rheinland-Pfalz': ['RP', 0, 3], Hessen: ['HE', 1, 3], 'Thüringen': ['TH', 2, 3],
  Saarland: ['SL', 0, 4], 'Baden-Württemberg': ['BW', 1, 4], Bayern: ['BY', 2, 4],
};

const initials = (h) => (h.replace(/[^a-zA-Z]/g, '').slice(0, 2) || '?').toUpperCase();
const avatar = (r, cls = '') => `<span class="avatar ${cls}" style="--c:${tierFor(r.amount).css}">${esc(initials(r.handle))}</span>`;

function rankingPage(mode) {
  const me = meEntry();
  const userCountry = state.user?.country || 'DE';
  const view = state.rankView;
  const country = countryById(view.country || userCountry);
  const region = mode === 'region'
    ? (country.regions.includes(view.region) ? view.region
      : country.regions.includes(state.user?.region) ? state.user.region : country.regions[0])
    : null;

  const list = standings({ country: country.id, region, me });
  const top = list.slice(0, 20);
  const mine = list.find((r) => r.me);
  const groups = mode === 'region'
    ? groupTotals('region', { country: country.id, me })
    : groupTotals('country', { me });
  const maxGroup = groups[0]?.amount || 1;
  const sum = list.reduce((s, r) => s + r.amount, 0);
  const podium = [top[1], top[0], top[2]];
  const PODIUM_RAR = [RARITIES[4], RARITIES[3], RARITIES[2]]; // Platz 1, 2, 3

  const row = (r) => {
    const t = tierFor(r.amount);
    return `<li class="rrow${r.me ? ' rrow--me' : ''}" style="--rar:${t.css}">
      <span class="rrow-rank">${fmt(r.rank)}</span>
      ${avatar(r)}
      <span class="rrow-name">@${esc(r.handle)}<small>${t.name}</small></span>
      <span class="rrow-amount">${money(r.amount)}</span>
    </li>`;
  };

  // Duell: Kachelkarte für Deutschland, sonst Balken. Farbe: eine Farbe, je mehr Geld desto heller.
  const groupName = (g) => (mode === 'region' ? g.id : `${countryById(g.id).flag} ${countryById(g.id).name}`);
  const isMyGroup = (g) => (mode === 'region' ? g.id === me?.region : g.id === me?.country);
  const tileMap = mode === 'region' && country.id === 'DE'
    ? `<div class="tilemap" role="list">
        ${groups.map((g) => {
          const [code, col, rowIdx] = DE_TILES[g.id] || ['?', 0, 0];
          const t = g.amount / maxGroup;
          return `<button class="tile${g.id === region ? ' is-active' : ''}${isMyGroup(g) ? ' is-mine' : ''}" type="button" role="listitem"
            data-region="${esc(g.id)}" style="grid-column:${col + 1};grid-row:${rowIdx + 1};--t:${(0.12 + t * 0.88).toFixed(2)}"
            title="${esc(g.id)}: ${money(g.amount)} · Platz ${g.rank}">
            <b>${code}</b><small>${shortMoney(g.amount)}</small><i>${g.rank}.</i></button>`;
        }).join('')}
        <div class="tilemap-legend" aria-hidden="true"><span>weniger</span><i></i><span>mehr</span></div>
      </div>`
    : '';
  const bars = `<ol class="duel-list">${groups.slice(0, tileMap ? 5 : 12).map((g) => `<li class="duel-row${isMyGroup(g) ? ' is-mine' : ''}">
      <span class="duel-rank">${g.rank <= 3 ? `<span class="medal medal--${g.rank}">${g.rank}</span>` : g.rank}</span>
      <span class="duel-name">${esc(groupName(g))}</span>
      <span class="duel-bar"><i style="width:${Math.max(3, (g.amount / maxGroup) * 100)}%"></i></span>
      <span class="duel-amount">${shortMoney(g.amount)}</span>
    </li>`).join('')}</ol>`;

  return {
    html: `<section class="screen screen--dark screen--ranking" style="--rar:${RARITIES[4].color}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <nav class="rank-tabs" aria-label="Ranking">
        <a href="#/ranking/region" class="${mode === 'region' ? 'is-active' : ''}">Bundesland</a>
        <a href="#/ranking/country" class="${mode === 'country' ? 'is-active' : ''}">Länder</a>
      </nav>
      <header class="rank-head">
        <span class="rank-flag">${country.flag}</span>
        <h1>${esc(region || country.name)}</h1>
      </header>
      <div class="stat-tiles">
        <div class="stat"><b>${fmt(list.length)}</b><span>Spieler</span></div>
        <div class="stat"><b>${shortMoney(sum)}</b><span>Gesamt</span></div>
        <div class="stat stat--me"><b>${mine ? `#${fmt(mine.rank)}` : '–'}</b><span>Dein Platz</span></div>
      </div>
      <div class="chips" role="tablist">
        ${mode === 'region'
          ? country.regions.map((r) => `<button class="chip${r === region ? ' is-active' : ''}" type="button" data-region="${esc(r)}">${esc(r)}</button>`).join('')
          : COUNTRIES.map((c) => `<button class="chip${c.id === country.id ? ' is-active' : ''}" type="button" data-country="${c.id}">${c.flag} ${c.name}</button>`).join('')}
      </div>
      <div class="podium3">
        <div class="podium-beams" aria-hidden="true"></div>
        ${podium.map((p, k) => {
          if (!p) return '<div class="pstep"></div>';
          const place = [2, 1, 3][k];
          const rar = PODIUM_RAR[place - 1];
          return `<div class="pstep pstep--${place}${p.me ? ' is-me' : ''}" style="--rar:${rar.color}">
            ${place === 1 ? `<span class="pcrown">${icons.crown}</span>` : ''}
            ${avatar(p, 'avatar--big')}
            <span class="pname">@${esc(p.handle)}</span>
            <span class="pamount">${shortMoney(p.amount)}</span>
            <div class="pblock"><span>${place}</span></div>
          </div>`;
        }).join('')}
      </div>
      <ol class="rlist">${top.slice(3).map(row).join('')}</ol>
      ${mine && mine.rank > 20 ? `<div class="rows-gap">…</div><ol class="rlist">${row(mine)}</ol>` : ''}
      <section class="duel">
        <h2>${mode === 'region' ? `${country.name}: Bundesländer-Duell` : 'Länder-Duell'}</h2>
        ${tileMap}
        ${bars}
      </section>
      <div class="mebar">
        ${mine
          ? `<div><b>Platz ${fmt(mine.rank)}</b> in ${esc(region || country.name)}<small>${money(mine.amount)} · ${tierFor(mine.amount).name}</small></div>`
          : `<div><b>${state.user ? 'Noch nicht dabei' : 'Du fehlst noch'}</b><small>Zahl ein und steig ins Ranking ein</small></div>`}
        ${button(mine ? 'Höher steigen' : 'Steig ein', 'data-go="donate"')}
      </div>
    </section>`,
    mount(el) {
      const fx = particles(el.querySelector('[data-fx]'), { color: '#ffb35c', mode: 'embers', density: 0.5 });
      el.querySelectorAll('[data-region]').forEach((b) => b.addEventListener('click', () => {
        state.rankView = { country: country.id, region: b.dataset.region };
        render();
      }));
      el.querySelectorAll('[data-country]').forEach((b) => b.addEventListener('click', () => {
        state.rankView = { country: b.dataset.country };
        render();
      }));
      const chips = el.querySelector('.chips');
      const active = chips.querySelector('.chip.is-active');
      if (active) chips.scrollLeft = active.offsetLeft - chips.clientWidth / 2 + active.clientWidth / 2;
      return () => fx.dispose();
    },
  };
}

render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
