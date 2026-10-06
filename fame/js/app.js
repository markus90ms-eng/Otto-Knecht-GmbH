// Fame – App-Shell, Router und Screens.

import {
  TIERS, RARITIES, PIN_FROM, COUNTRIES, countryById, tierFor, nextTier, tierProgress, fmt, money,
  amountFromPos, posFromAmount, niceRound, rankFor, standings, groupTotals, makeSerial,
  MAX_AMOUNT, MIN_AMOUNT,
} from './data.js';
import {
  APP_NAME, LOGO_TEXT, esc, logo, logoInline, hl, dots, hero, button, backButton, diamondSvg,
  diamondShadowed, icons,
} from './ui.js';
import { tick, plink, rarityDrop, buzz, unlockAudio } from './fx.js';
import { createDiamond } from './diamond3d.js';
import { particles } from './particles.js';

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
const shortMoney = (n) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €` : money(n));

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

// 2. Inventar: vier Belohnungen mit steigender Seltenheit, jeweils als drehender 3D-Gegenstand.
const LOOT = [
  {
    name: 'Bündel Ca$h', level: 0, icon: 'cash', img: 'assets/img/cash.jpg', alt: 'Ein Bündel Dollarscheine',
    stats: ['Ca$h ist für dich nichts?', 'Beweise es und zeig´s der Welt'],
    flavor: '„Geld hat jeder. Fame nicht.“',
  },
  {
    name: 'Krone des Rankings', level: 2, icon: 'crown', img: 'assets/img/ranking.jpg', alt: 'Siegerpodest mit Strichmännchen auf Platz 1',
    stats: ['Steig im Ranking auf', 'Jeder Euro bringt dich höher'],
    flavor: '„Platz 2 ist der erste Verlierer.“',
  },
  {
    name: 'Echter Diamant Pin', level: 3, icon: 'pin', img: 'assets/img/pin.jpg', alt: 'Neon-Hand mit Diamant',
    stats: ['Verdiene dir deinen Diamant Pin', `Ab ${money(PIN_FROM)}`],
    flavor: '„Zum Anstecken. Zum Angeben.“',
  },
  {
    name: 'Herz für Menschen & Tiere', level: 4, icon: 'heart', img: 'assets/img/animals.jpg', alt: 'Hund und Katze auf dem Sofa',
    stats: ['Hilf damit Menschen und Tieren in Not', '100 % gutes Gewissen'],
    flavor: '„Angeben und Gutes tun. Beides geht.“',
  },
];

function intro2() {
  return {
    html: `<section class="screen screen--dark screen--loot2" style="--rar:${RARITIES[0].color}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <header class="loot-head"><h1 class="loot-title">Das holst du dir bei ${LOGO_TEXT}</h1></header>
      <article class="tooltip tooltip--big" data-tooltip>
        <div class="tooltip-stage">${LOOT.map((it, i) => `<img class="tooltip-photo${i === 0 ? ' is-active' : ''}" src="${it.img}" alt="${it.alt}" draggable="false">`).join('')}</div>
        <div class="tooltip-text" data-tiptext aria-live="polite"></div>
      </article>
      <div class="inventory" role="tablist" aria-label="Belohnungen">
        ${LOOT.map((it, i) => `<button class="slot" type="button" role="tab" data-i="${i}"
          style="--rar:${RARITIES[it.level].color}; --d:${i * 0.18 + 0.2}s" aria-label="${it.name}">
          ${icons[it.icon]}</button>`).join('')}
      </div>
      <div class="screen-foot">
        ${dots(1)}
        ${button('Noch mehr!', 'data-go="intro/3"')}
      </div>
    </section>`,
    mount(el) {
      const slotEls = [...el.querySelectorAll('.slot')];
      const tip = el.querySelector('[data-tooltip]');
      const text = el.querySelector('[data-tiptext]');
      const photos = [...el.querySelectorAll('.tooltip-photo')];
      const fx = particles(el.querySelector('[data-fx]'), { mode: 'dust', color: RARITIES[0].color });
      let i = -1;
      const show = (n, { sound = false } = {}) => {
        i = (n + LOOT.length) % LOOT.length;
        const it = LOOT[i];
        const rarity = RARITIES[it.level];
        slotEls.forEach((s, k) => s.setAttribute('aria-selected', k === i));
        tip.className = `tooltip tooltip--big tooltip--${rarity.id}`;
        text.innerHTML = `<h3 class="tooltip-name">${it.name}</h3>
          <ul class="tooltip-stats">${it.stats.map((s) => `<li>${s}</li>`).join('')}</ul>
          <p class="tooltip-flavor">${it.flavor}</p>`;
        text.classList.remove('is-in');
        void text.offsetWidth;
        text.classList.add('is-in');
        el.style.setProperty('--rar', rarity.color);
        photos.forEach((ph, k) => ph.classList.toggle('is-active', k === i));
        fx.setColor(rarity.color);
        fx.setDensity(0.6 + it.level * 0.5);
        if (sound) rarityDrop(it.level);
      };
      // Gegenstände fallen nacheinander ins Inventar
      const drops = slotEls.map((_, k) => setTimeout(() => plink(k), 200 + k * 180));
      show(0);
      let timer = setInterval(() => show(i + 1), 4200);
      slotEls.forEach((s, k) => s.addEventListener('click', () => {
        clearInterval(timer);
        show(k, { sound: true });
        timer = setInterval(() => show(i + 1), 4200);
      }));
      return () => { clearInterval(timer); drops.forEach(clearTimeout); fx.dispose(); };
    },
  };
}

// 3. Die Geschichte des Gründers.
function intro3() {
  return {
    html: `<section class="screen screen--dark screen--loot3" style="--rar:${RARITIES[4].color}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <header class="loot-head"><h1 class="story-title">#Real_story, BRO</h1></header>
      <div class="story" data-story>
        <blockquote class="tooltip tooltip--legendary story-quote">
          <p>Eine Belvedere Flasche kostet im Club 300€ – 3.000€ der ${hl('Fame')} hält maximal einen Abend,
          die Reichweite begrenzt sich auf den Club.</p>
          <p>Bei ${logoInline()} bestimmst du deine Kosten, der ${hl('Fame')} hält dein ${hl('Leben lang')}
          und die Reichweite ist grenzenlos.</p>
          <footer>${APP_NAME} Gründer</footer>
        </blockquote>
      </div>
      <div class="screen-foot">
        ${dots(2)}
        ${button('Fang an – JETZT', 'data-go="login"')}
      </div>
    </section>`,
    mount(el) {
      const canvas = el.querySelector('[data-fx]');
      const fx = particles(canvas, { color: '#ff9a3c', mode: 'embers', density: 0.5 });
      const timer = setTimeout(() => {
        el.classList.add('is-revealed');
        rarityDrop(4);
        const [x, y] = centerIn(canvas, el.querySelector('[data-story]'));
        fx.burst(x, y, 50, '#ffb35c');
      }, 450);
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

function donate() {
  const registered = !!state.user;
  const acc = state.account;
  const start = tierFor(acc.total + state.amount);
  return {
    html: `<section class="screen screen--donate" style="--rar:${start.css}">
      ${hero(`<div class="glow" data-glow></div>
        <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
        <div class="rays" aria-hidden="true">${'<i></i>'.repeat(10)}</div>
        <div class="stage3d" data-diamond></div>
        <div class="rarity-flash" data-flash aria-hidden="true"></div>
        <div class="tier-info"><div class="tier-name" data-tier></div></div>
        <div class="spin-hint">${icons.rotate} 360°</div>`, { cls: 'hero--tall hero--gem' })}
      <div class="donate-body">
        ${acc.total ? `<div class="account">
          <span>Dein Konto <b>${money(acc.total)}</b></span>
          <span class="account-arrow" aria-hidden="true">→</span>
          <span>danach <b data-after></b></span>
        </div>` : '<div class="account account--new">Deine erste Einzahlung</div>'}
        <label class="amount">
          <span class="amount-label">Einzahlen</span>
          <input id="donate-amount" data-amount inputmode="numeric" autocomplete="off" aria-label="Einzahlung in Euro">
        </label>
        <div class="tierbar">
          <div class="tierbar-head"><span data-cur></span><span data-next></span></div>
          <div class="tierbar-track">${TIERS.map((t) => `<i style="--c:${t.css}"></i>`).join('')}
            <div class="tierbar-fill" data-fill></div></div>
        </div>
        <div class="arc" data-arc role="slider" tabindex="0" aria-label="Betrag einstellen"
          aria-valuemin="${MIN_AMOUNT}" aria-valuemax="${MAX_AMOUNT}">
          <svg viewBox="0 0 300 108" aria-hidden="true">
            <path class="arc-track" d="M20 16 Q150 168 280 16" pathLength="1"/>
            <path class="arc-fill" d="M20 16 Q150 168 280 16" pathLength="1" data-arcfill/>
            <g data-knob><circle class="knob-shadow" r="13" cx="3" cy="4"/><circle class="knob" r="13"/><circle class="knob-dot" r="4"/></g>
          </svg>
        </div>
        ${registered
          ? `<div class="rank">${icons.trophy}<span>RANK <b data-rank></b> / <span data-total></span></span></div>`
          : `<a class="rank rank--locked" href="#/login">${icons.trophy}<span>Log dich ein für dein Konto und Ranking</span></a>`}
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
      const dia = createDiamond($('[data-diamond]'), { level: start.level, rim: start.css });
      const canvas = $('[data-fx]');
      const fx = particles(canvas, { color: start.css, mode: 'embers', density: 0.3 + start.level * 0.45 });
      const input = $('[data-amount]');
      const arc = $('[data-arc]');
      const fill = $('[data-arcfill]');
      const knob = $('[data-knob]');
      const btn = $('[data-awesome]');
      const accept = $('[data-accept]');
      const flash = $('[data-flash]');
      let level = start.level;
      let amount = state.amount;

      // Stufenwechsel: Blitz, Funken und der Sound der Stufe – nach oben wie nach unten.
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
        amount = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, next));
        state.amount = amount;
        const after = acc.total + amount;
        const pos = posFromAmount(amount);
        const tier = tierFor(after);

        // Bogen-Slider: x verläuft linear, y als Parabel (quadratische Bézierkurve).
        knob.setAttribute('transform', `translate(${20 + 260 * pos} ${16 + 304 * pos * (1 - pos)})`);
        fill.style.strokeDasharray = `${pos} 1`;
        arc.setAttribute('aria-valuenow', amount);
        arc.setAttribute('aria-valuetext', `${money(amount)}, danach ${tier.name}`);

        if (document.activeElement !== input) input.value = money(amount);
        const afterEl = $('[data-after]');
        if (afterEl) afterEl.textContent = money(after);
        $('[data-tier]').textContent = tier.name;
        el.style.setProperty('--rar', tier.css);
        el.style.setProperty('--glow', (0.25 + posFromAmount(after) * 0.75).toFixed(3));
        dia.setGlow(posFromAmount(after));

        const nx = nextTier(after);
        $('[data-cur]').textContent = tier.name;
        $('[data-next]').textContent = nx ? `${nx.name}: noch ${money(nx.min - after)}` : 'Höchste Stufe';
        $('[data-fill]').style.width = `${((tier.level + tierProgress(after)) / TIERS.length) * 100}%`;
        if (state.user) {
          const { rank, total } = rankFor(after);
          $('[data-rank]').textContent = fmt(rank);
          $('[data-total]').textContent = fmt(total);
        }

        if (tier.level !== level) {
          dia.setLevel(tier.level);
          dia.setRim(tier.css);
          fx.setColor(tier.css);
          fx.setDensity(0.3 + tier.level * 0.45);
          if (sound) tierChanged(tier, tier.level > level);
          level = tier.level;
        } else if (sound && amount !== prev) {
          tick(pos, amount > prev);
        }
        store.set('amount', amount);
      };

      // Ziehen am Bogen
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

      // Direkte Eingabe des Betrags
      input.addEventListener('focus', () => { input.value = String(amount); input.select(); });
      input.addEventListener('input', () => {
        const n = parseInt(input.value.replace(/\D/g, ''), 10);
        if (n) update(n, { sound: true });
      });
      input.addEventListener('blur', () => { update(niceRound(amount)); input.value = money(amount); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });

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
        // iOS verlangt eine Freigabe für den Lagesensor – direkt beim Tippen anfragen.
        try { await window.DeviceOrientationEvent?.requestPermission?.(); } catch { /* abgelehnt */ }
        // Prototyp: die Zahlung wird simuliert und direkt dem Konto gutgeschrieben.
        const at = Date.now();
        acc.total += amount;
        acc.deposits.push({ amount, at });
        const tier = tierFor(acc.total);
        acc.cards.push({
          tier: tier.id, total: acc.total, at,
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

// Fame-Card: sieht je nach Stufe aus wie ein Gegenstand bei Diablo/WoW, mit Seriennummer.
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
  return {
    html: `<section class="screen screen--dark screen--card lvl-${tier.level}" style="--rar:${rarity.color}">
      <div class="loot-bg" aria-hidden="true">
        <div class="loot-rays"></div>
        <svg class="loot-runes" viewBox="0 0 200 200"><defs><path id="runepath" d="M100 100m-80 0a80 80 0 1 1 160 0a80 80 0 1 1-160 0"/></defs>
          <circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="68"/>
          <text><textPath href="#runepath">ᚠᚨᛗᛖ ✦ ᛏᚺᛖᚾ ᛏᚺᛖ ᛟᛏᚺᛖᚱᛊ ✦ ᚠᚨᛗᛖ ✦ ᛏᚺᛖᚾ ᛏᚺᛖ ᛟᛏᚺᛖᚱᛊ ✦</textPath></text></svg>
        <div class="loot-pillar"></div>
        <div class="loot-ground"></div>
      </div>
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <div class="card-wrap" data-tiltwrap>
        <div class="card-reveal" data-reveal>
          <article class="famecard famecard--${rarity.id}" data-card>
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
        </div>
      </div>
      <div class="screen-foot">
        ${button('Jetzt Posten', 'data-share')}
        <div class="foot-links">
          <button class="link" type="button" data-save>Speichern</button>
          <a class="link" href="#/donate">Nochmal einzahlen</a>
          <a class="link" href="#/ranking">Ranking</a>
        </div>
      </div>
    </section>`,
    mount(el) {
      const dia = createDiamond(el.querySelector('[data-diamond]'), {
        level: tier.level, rim: rarity.color, glow: 0.8, interactive: false,
      });
      const canvas = el.querySelector('[data-fx]');
      const fx = particles(canvas, { color: rarity.color, mode: tier.level >= 2 ? 'embers' : 'dust', density: 0.4 + tier.level * 0.45 });
      const cardEl = el.querySelector('[data-card]');
      const shine = el.querySelector('[data-shine]');
      const instaInput = el.querySelector('[data-insta]');

      // Aufdecken wie ein Loot-Fund
      const revealTimer = setTimeout(() => {
        el.classList.add('is-revealed');
        rarityDrop(tier.level);
        const [x, y] = centerIn(canvas, cardEl);
        fx.burst(x, y, 20 + tier.level * 25, rarity.color);
      }, 300);

      instaInput?.addEventListener('change', () => {
        if (state.user) {
          state.user.insta = cleanHandle(instaInput.value);
          store.set('user', state.user);
        }
      });

      // Karte kippt mit dem Gyrosensor – am Desktop folgt sie der Maus.
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, idle = 0;
      const setTarget = (x, y) => { tx = Math.max(-1, Math.min(1, x)); ty = Math.max(-1, Math.min(1, y)); idle = 0; };
      const loop = (now) => {
        idle += 1;
        // ohne Eingabe sanft von selbst wippen
        const ax = idle > 90 ? Math.sin(now / 1300) * 0.45 : tx;
        const ay = idle > 90 ? Math.cos(now / 1700) * 0.3 : ty;
        cx += (ax - cx) * 0.08;
        cy += (ay - cy) * 0.08;
        cardEl.style.transform = `rotateY(${cx * 14}deg) rotateX(${-cy * 14}deg)`;
        shine.style.setProperty('--sx', `${50 + cx * 40}%`);
        shine.style.setProperty('--sy', `${50 + cy * 40}%`);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

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

      const makeImage = () => renderCardImage({ tier, serial: c.serial, insta: state.user?.insta || '' }, dia.canvas);

      el.querySelector('[data-share]').addEventListener('click', async () => {
        const blob = await makeImage();
        const file = new File([blob], 'fame-card.png', { type: 'image/png' });
        const text = `Ich habe einen ${tier.name} auf ${APP_NAME} 💎 Nr. ${c.serial} #fame #thentheothers`;
        try {
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text, title: APP_NAME });
            return;
          }
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
        download(blob);
        toast('Bild gespeichert – jetzt auf Instagram posten!');
      });
      el.querySelector('[data-save]').addEventListener('click', async () => {
        download(await makeImage());
        toast('Deine Fame-Card wurde gespeichert.');
      });

      return () => {
        clearTimeout(revealTimer);
        cancelAnimationFrame(raf);
        window.removeEventListener('deviceorientation', onOrient);
        fx.dispose();
        dia.dispose();
      };
    },
  };
}

function download(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fame-card.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Fame-Card als PNG (4:5, Instagram-Format) im Look der Seltenheit zeichnen.
async function renderCardImage({ tier, serial, insta }, gemCanvas) {
  await document.fonts?.ready;
  const W = 1080, H = 1350;
  const rar = tier.rarity.color;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const font = (w, s, style = '') => `${style} ${w} ${s}px "Source Code Pro", ui-monospace, monospace`;

  g.fillStyle = '#0e0e10';
  g.fillRect(0, 0, W, H);
  // Strahlen hinter dem Diamanten
  g.save();
  g.translate(W / 2, 560);
  g.globalAlpha = 0.08 + tier.level * 0.05;
  g.fillStyle = rar;
  for (let i = 0; i < 24; i++) {
    g.rotate((Math.PI * 2) / 24);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-40, -900);
    g.lineTo(40, -900);
    g.fill();
  }
  g.restore();
  const rg = g.createRadialGradient(W / 2, 560, 40, W / 2, 560, 560);
  rg.addColorStop(0, rar + '99');
  rg.addColorStop(1, '#0e0e1000');
  g.fillStyle = rg;
  g.fillRect(0, 0, W, H);

  // Rahmen: ab "Selten" doppelt, wie bei hochwertigen Gegenständen
  g.strokeStyle = rar;
  g.lineWidth = 8;
  g.shadowColor = rar;
  g.shadowBlur = tier.level * 14;
  g.strokeRect(44, 44, W - 88, H - 88);
  g.shadowBlur = 0;
  if (tier.level >= 2) {
    g.lineWidth = 3;
    g.strokeRect(66, 66, W - 132, H - 132);
  }

  g.textBaseline = 'alphabetic';
  g.font = font(800, 80);
  g.fillStyle = '#3dfa74';
  g.fillText(LOGO_TEXT, 106, 184);
  g.fillStyle = '#f8f8f6';
  g.fillText(LOGO_TEXT, 100, 176);
  g.font = font(500, 28);
  g.fillText('then the others', 102, 222);

  g.textAlign = 'right';
  g.font = font(600, 30);
  g.fillStyle = '#c9c9c4';
  g.fillText('Nr.', W - 100, 150);
  g.font = font(700, 34);
  g.fillStyle = '#f8f8f6';
  g.fillText(serial, W - 100, 194);

  if (gemCanvas) {
    const s = 640;
    const ratio = gemCanvas.width / gemCanvas.height;
    const w = ratio >= 1 ? s : s * ratio;
    const h = ratio >= 1 ? s / ratio : s;
    g.drawImage(gemCanvas, (W - w) / 2, 560 - h / 2, w, h);
  }

  g.textAlign = 'center';
  g.font = font(800, 70);
  g.fillStyle = rar;
  g.shadowColor = rar;
  g.shadowBlur = 24;
  g.fillText(tier.name, W / 2, 960);
  g.shadowBlur = 0;
  g.font = font(500, 34, 'italic');
  g.fillStyle = '#d9a35b';
  g.fillText(`„${tier.flavor}“`, W / 2, 1040);
  if (insta) {
    g.font = font(600, 40);
    g.fillStyle = '#f8f8f6';
    g.fillText('@' + insta, W / 2, 1150);
  }

  return new Promise((res) => c.toBlob(res, 'image/png'));
}

// ---- Ranking: zwei Seiten (Bundesland / Länder) --------------------------------

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
  const PODIUM_RAR = [RARITIES[4], RARITIES[3], RARITIES[2]]; // Platz 1 legendär, 2 mystisch, 3 selten

  const row = (r) => {
    const t = tierFor(r.amount);
    return `<li class="rrow${r.me ? ' rrow--me' : ''}" style="--rar:${t.css}">
      <span class="rrow-rank">${fmt(r.rank)}</span>
      <span class="rrow-gem">${diamondSvg({ filled: true })}</span>
      <span class="rrow-name">@${esc(r.handle)}<small>${t.name}</small></span>
      <span class="rrow-amount">${money(r.amount)}</span>
    </li>`;
  };
  const groupName = (g) => (mode === 'region' ? g.id : `${countryById(g.id).flag} ${countryById(g.id).name}`);
  const isMyGroup = (g) => (mode === 'region' ? g.id === (me?.region) : g.id === (me?.country));

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
        <div>
          <h1>${esc(region || country.name)}</h1>
          <p>${fmt(list.length)} Spieler · ${shortMoney(sum)}</p>
        </div>
      </header>
      <div class="chips" role="tablist">
        ${mode === 'region'
          ? country.regions.map((r) => `<button class="chip${r === region ? ' is-active' : ''}" type="button" data-region="${esc(r)}">${esc(r)}</button>`).join('')
          : COUNTRIES.map((c) => `<button class="chip${c.id === country.id ? ' is-active' : ''}" type="button" data-country="${c.id}">${c.flag} ${c.name}</button>`).join('')}
      </div>
      <div class="podium3">
        ${podium.map((p, k) => {
          if (!p) return '<div class="pstep"></div>';
          const place = [2, 1, 3][k];
          const rar = PODIUM_RAR[place - 1];
          return `<div class="pstep pstep--${place}${p.me ? ' is-me' : ''}" style="--rar:${rar.color}">
            ${place === 1 ? `<span class="pcrown">${icons.crown}</span>` : ''}
            <span class="pgem">${diamondSvg({ filled: true })}</span>
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
        <ol>${groups.slice(0, 16).map((g) => `<li class="duel-row${isMyGroup(g) ? ' is-mine' : ''}">
          <span class="duel-rank">${g.rank}</span>
          <span class="duel-name">${esc(groupName(g))}</span>
          <span class="duel-bar"><i style="width:${Math.max(3, (g.amount / maxGroup) * 100)}%"></i></span>
          <span class="duel-amount">${shortMoney(g.amount)}</span>
        </li>`).join('')}</ol>
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
      el.querySelector('.chip.is-active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
      return () => fx.dispose();
    },
  };
}

render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
