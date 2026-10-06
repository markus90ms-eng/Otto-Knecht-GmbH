// Fame – App-Shell, Router und Screens.

import {
  TIERS, RARITIES, PIN_FROM, BOARD_SIZE, tierFor, nextTier, tierProgress, fmt, money,
  amountFromPos, posFromAmount, niceRound, rankFor, leaderboard, MAX_AMOUNT, MIN_AMOUNT,
} from './data.js';
import {
  APP_NAME, LOGO_TEXT, esc, logo, dots, hero, button, backButton, diamondSvg, diamondShadowed,
  itemTooltip, icons,
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

const state = {
  user: store.get('user'),            // { name, insta } wenn registriert
  amount: store.get('amount', 1_000),
  accepted: false,
  donation: store.get('donation'),    // { amount, tier, rank, total, name, insta, at }
};

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
  ranking: ranking,
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

// Mittelpunkt eines Elements relativ zu einem Canvas (für Funken-Explosionen).
function centerIn(canvas, el) {
  const a = canvas.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2 - a.left, b.top + b.height / 2 - a.top];
}

// ---- Screens ----------------------------------------------------------------

function splash() {
  return {
    html: `<section class="screen screen--splash">
      <div class="sweep" aria-hidden="true"></div>
      <div class="splash-logo">${logo('lg')}</div>
      <div class="splash-space"></div>
      <div class="splash-cta">
        <a class="newhere" href="#/intro/1">
          <span class="newhere-q">Neu hier?</span>
          <span class="newhere-go">Zeig mir mehr <span aria-hidden="true">→</span></span>
        </a>
        ${button('Login', 'data-go="login"')}
      </div>
      <div class="splash-space splash-space--low"></div>
    </section>`,
  };
}

// 1. Loot-Drop: der Diamant fällt in einer Lichtsäule herunter.
function intro1() {
  const legendary = RARITIES[4];
  return {
    html: `<section class="screen screen--dark screen--loot1" style="--rar:${legendary.color}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      <div class="loot1-logo">${logo('sm')}</div>
      <div class="drop-stage">
        <div class="beam" aria-hidden="true"></div>
        <div class="drop-floor" aria-hidden="true"></div>
        <div class="drop-gem" data-gem><div class="stage3d" data-diamond></div></div>
        <div class="drop-label" data-label>[ Perfekter Diamant ]</div>
      </div>
      <h1 class="claim claim--loot">Zeig was Du dir <em>leisten kannst</em> und tue dabei <strong>gutes</strong>.</h1>
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

// 2. Inventar: vier Belohnungen mit steigender Seltenheit, Tooltip wie bei Diablo.
const LOOT = [
  {
    name: 'Bündel Ca$h', level: 0, icon: 'cash', img: 'assets/img/cash.jpg',
    stats: ['Ca$h ist für dich nichts?', 'Beweise es und zeig´s der Welt'],
    flavor: '„Geld hat jeder. Fame nicht.“',
  },
  {
    name: 'Krone des Rankings', level: 2, icon: 'crown', img: 'assets/img/ranking.jpg',
    stats: ['Steig im Ranking auf', 'Jeder Euro bringt dich höher'],
    flavor: '„Platz 2 ist der erste Verlierer.“',
  },
  {
    name: 'Echter Diamant Pin', level: 3, icon: 'pin', img: 'assets/img/pin.jpg',
    stats: ['Verdiene dir deinen Diamant Pin', `Ab ${money(PIN_FROM)}`],
    flavor: '„Zum Anstecken. Zum Angeben.“',
  },
  {
    name: 'Herz für Menschen & Tiere', level: 4, icon: 'heart', img: 'assets/img/animals.jpg',
    stats: ['Hilf damit Menschen und Tieren in Not', '100 % gutes Gewissen'],
    flavor: '„Angeben und Gutes tun. Beides geht.“',
  },
];

function intro2() {
  return {
    html: `<section class="screen screen--dark screen--loot2" style="--rar:${RARITIES[0].color}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <header class="loot-head">
        <span class="loot-kicker">Deine Beute</span>
        <h1 class="loot-title">Das holst du dir bei ${LOGO_TEXT}</h1>
      </header>
      <div class="tooltip-slot" data-tooltip aria-live="polite"></div>
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
      const box = el.querySelector('[data-tooltip]');
      const fx = particles(el.querySelector('[data-fx]'), { mode: 'dust', color: RARITIES[0].color });
      let i = -1;
      const show = (n, { sound = false } = {}) => {
        i = (n + LOOT.length) % LOOT.length;
        const it = LOOT[i];
        const rarity = RARITIES[it.level];
        slotEls.forEach((s, k) => s.setAttribute('aria-selected', k === i));
        box.innerHTML = itemTooltip({
          name: it.name, rarity, img: it.img,
          stats: it.stats.map((text) => ({ text })), flavor: it.flavor, cls: 'is-in',
        });
        el.style.setProperty('--rar', rarity.color);
        fx.setColor(rarity.color);
        fx.setDensity(0.6 + it.level * 0.5);
        if (sound) rarityDrop(it.level);
      };
      // Gegenstände fallen nacheinander ins Inventar
      const drops = slotEls.map((_, k) => setTimeout(() => plink(k), 200 + k * 180));
      show(0);
      let timer = setInterval(() => show(i + 1), 3600);
      slotEls.forEach((s, k) => s.addEventListener('click', () => {
        clearInterval(timer);
        show(k, { sound: true });
        timer = setInterval(() => show(i + 1), 3600);
      }));
      return () => { clearInterval(timer); drops.forEach(clearTimeout); fx.dispose(); };
    },
  };
}

// 3. Gegenstandsvergleich: Belvedere-Flasche gegen den Fame-Diamanten.
function intro3() {
  const bottle = itemTooltip({
    name: 'Belvedere Flasche', rarity: RARITIES[0], type: 'Normaler Gegenstand · nur im Club',
    stats: [
      { text: 'Preis: 300 € – 3.000 €' },
      { text: 'Fame hält: einen Abend', cls: 'neg' },
      { text: 'Reichweite: nur der Club', cls: 'neg' },
    ],
    cls: 'tooltip--compact',
  });
  const gem = itemTooltip({
    name: `${LOGO_TEXT} Diamant`, rarity: RARITIES[4],
    stats: [
      { text: 'Preis: bestimmst du', cls: 'pos' },
      { text: 'Fame hält: dein Leben lang', cls: 'pos' },
      { text: 'Reichweite: grenzenlos', cls: 'pos' },
      { text: 'Bonus: hilft Menschen & Tieren in Not', cls: 'pos' },
    ],
    flavor: '„Bei Fame bestimmst du deine Kosten. Der Fame hält dein Leben lang.“<br>– Fame Gründer',
    cls: 'tooltip--new',
  });
  return {
    html: `<section class="screen screen--dark screen--loot3" style="--rar:${RARITIES[4].color}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <header class="loot-head">
        <span class="loot-kicker">Gegenstandsvergleich</span>
        <h1 class="story-title">#Real_story, BRO</h1>
      </header>
      <div class="compare">
        <div class="compare-label">Ausgerüstet</div>
        ${bottle}
        <div class="compare-vs" aria-hidden="true">VS</div>
        <div class="compare-label compare-label--new">Neu gefunden</div>
        <div class="compare-new" data-new>${gem}</div>
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
        const [x, y] = centerIn(canvas, el.querySelector('[data-new]'));
        fx.burst(x, y, 50, '#ffb35c');
      }, 650);
      return () => { clearTimeout(timer); fx.dispose(); };
    },
  };
}

function login() {
  const u = state.user || {};
  return {
    html: `<section class="screen screen--login">
      ${hero(`<div class="stage3d" data-diamond></div>`, { cls: 'hero--tall' })}
      <form class="login-form" novalidate>
        <div class="login-icon">${diamondShadowed()}</div>
        <h1 class="headline">Werde Fame</h1>
        <p class="sub">Leg dein Profil an und sichere dir deinen Platz im Ranking.</p>
        <label class="field"><span>Name</span>
          <input id="login-name" name="name" autocomplete="given-name" required value="${esc(u.name)}" placeholder="Max"></label>
        <label class="field"><span>Instagram</span>
          <input id="login-insta" name="insta" autocomplete="off" autocapitalize="off" value="${esc(u.insta ? '@' + u.insta : '')}" placeholder="@deinname"></label>
        <div class="screen-foot">
          <button class="btn" type="submit"><span>Login</span></button>
          ${state.user ? '<button class="link" type="button" data-logout>Abmelden</button>' : ''}
        </div>
      </form>
    </section>`,
    mount(el) {
      const dia = createDiamond(el.querySelector('[data-diamond]'), { level: 4, glow: 0.6, rim: '#3dfa74' });
      const form = el.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.name.value.trim();
        if (!name) {
          form.name.focus();
          form.name.closest('.field').classList.add('is-error');
          buzz(30);
          return;
        }
        state.user = { name, insta: cleanHandle(form.insta.value) };
        store.set('user', state.user);
        go('donate');
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
  const start = tierFor(state.amount);
  return {
    html: `<section class="screen screen--donate" style="--rar:${start.css}">
      ${hero(`<div class="glow" data-glow></div>
        <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
        <div class="rays" aria-hidden="true">${'<i></i>'.repeat(10)}</div>
        <div class="stage3d" data-diamond></div>
        <div class="rarity-flash" data-flash aria-hidden="true"></div>
        <div class="tier-info">
          <div class="tier-name" data-tier></div>
          <div class="tier-rarity" data-rarity></div>
        </div>
        <div class="rarity-banner" data-banner aria-live="polite"></div>
        <div class="spin-hint">${icons.rotate} 360°</div>`, { cls: 'hero--tall hero--gem' })}
      <div class="donate-body">
        <label class="amount">
          <span class="sr-only">Betrag</span>
          <input id="donate-amount" data-amount inputmode="numeric" autocomplete="off" aria-label="Betrag in Euro">
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
          : `<a class="rank rank--locked" href="#/login">${icons.trophy}<span>Log dich ein für dein Ranking</span></a>`}
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
      const fx = particles(canvas, { color: start.css, mode: 'embers', density: 0.3 });
      const input = $('[data-amount]');
      const arc = $('[data-arc]');
      const fill = $('[data-arcfill]');
      const knob = $('[data-knob]');
      const btn = $('[data-awesome]');
      const accept = $('[data-accept]');
      const flash = $('[data-flash]');
      const banner = $('[data-banner]');
      let level = start.level;
      let amount = state.amount;
      let bannerTimer = 0;

      // Neue Seltenheit gefunden: Blitz, Banner, Funken, Sound.
      const lootFound = (tier) => {
        rarityDrop(tier.level);
        dia.pulse();
        flash.classList.remove('is-on');
        void flash.offsetWidth;
        flash.classList.add('is-on');
        banner.textContent = `${tier.rarity.label}!`;
        banner.classList.remove('is-on');
        void banner.offsetWidth;
        banner.classList.add('is-on');
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => banner.classList.remove('is-on'), 1400);
        const [x, y] = centerIn(canvas, $('[data-diamond]'));
        fx.burst(x, y, 20 + tier.level * 20, tier.css);
      };

      const update = (next, { sound = false } = {}) => {
        const prev = amount;
        amount = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, next));
        state.amount = amount;
        const pos = posFromAmount(amount);
        const tier = tierFor(amount);

        // Bogen-Slider: x verläuft linear, y als Parabel (quadratische Bézierkurve).
        knob.setAttribute('transform', `translate(${20 + 260 * pos} ${16 + 304 * pos * (1 - pos)})`);
        fill.style.strokeDasharray = `${pos} 1`;
        arc.setAttribute('aria-valuenow', amount);
        arc.setAttribute('aria-valuetext', `${money(amount)}, ${tier.name}`);

        if (document.activeElement !== input) input.value = money(amount);
        $('[data-tier]').textContent = tier.name;
        $('[data-rarity]').textContent = tier.rarity.item;
        el.style.setProperty('--rar', tier.css);
        el.style.setProperty('--glow', (0.25 + pos * 0.75).toFixed(3));
        dia.setGlow(pos);

        const nx = nextTier(amount);
        $('[data-cur]').textContent = tier.name;
        $('[data-next]').textContent = nx ? `${nx.name} ab ${money(nx.min)}` : 'Höchste Stufe';
        $('[data-fill]').style.width = `${((tier.level + tierProgress(amount)) / TIERS.length) * 100}%`;
        if (state.user) {
          const { rank, total } = rankFor(amount);
          $('[data-rank]').textContent = fmt(rank);
          $('[data-total]').textContent = fmt(total);
        }

        if (tier.level !== level) {
          dia.setLevel(tier.level);
          dia.setRim(tier.css);
          fx.setColor(tier.css);
          fx.setDensity(0.3 + tier.level * 0.45);
          if (sound && tier.level > level) lootFound(tier);
          else if (sound) tick(pos, false);
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
        // iOS verlangt eine Freigabe für den Lagesensor – direkt beim Tippen anfragen.
        try { await window.DeviceOrientationEvent?.requestPermission?.(); } catch { /* abgelehnt */ }
        const tier = tierFor(amount);
        const { rank, total } = rankFor(amount);
        state.donation = {
          amount, tier: tier.id, rank, total,
          name: state.user?.name || '', insta: state.user?.insta || '', at: Date.now(),
        };
        store.set('donation', state.donation);
        go('card');
      });

      update(amount);
      syncBtn();
      return () => { clearTimeout(bannerTimer); fx.dispose(); dia.dispose(); };
    },
  };
}

// Fame-Card: sieht je nach Seltenheit aus wie ein Gegenstand bei Diablo/WoW.
function card() {
  const d = state.donation;
  if (!d) {
    queueMicrotask(() => go('donate'));
    return { html: '<section class="screen"></section>' };
  }
  const tier = TIERS.find((t) => t.id === d.tier) || tierFor(d.amount);
  const rarity = tier.rarity;
  const name = firstName(d.name);
  return {
    html: `<section class="screen screen--dark screen--card lvl-${tier.level}" style="--rar:${rarity.color}">
      <canvas class="fx-canvas" data-fx aria-hidden="true"></canvas>
      ${backButton('back--dark')}
      <h1 class="omg">Omg… ${name ? esc(name) : 'du'}<br><em>Du bist so krass.</em></h1>
      <div class="card-wrap" data-tiltwrap>
        <div class="card-reveal" data-reveal>
          <article class="famecard famecard--${rarity.id}" data-card>
            <div class="famecard-ring" aria-hidden="true"></div>
            <div class="famecard-inner">
              <div class="famecard-shine" data-shine></div>
              <div class="famecard-top">
                <span class="famecard-brand">${LOGO_TEXT}${diamondSvg({ filled: true, cls: 'dia-inline' })}</span>
                <span class="famecard-rank">${icons.trophy}${fmt(d.rank)} / ${fmt(d.total)}</span>
              </div>
              <div class="famecard-gem"><div class="glow"></div><div class="stage3d" data-diamond></div></div>
              <h2 class="famecard-name">${tier.name}</h2>
              <div class="famecard-type">${rarity.item}</div>
              <ul class="famecard-stats">
                <li>+${money(d.amount)} Fame</li>
                <li>Rang ${fmt(d.rank)} von ${fmt(d.total)}</li>
              </ul>
              <p class="famecard-flavor">„${tier.flavor}“</p>
              <div class="famecard-insta">${icons.insta}
                ${d.insta
                  ? `<span>${esc(d.insta)}</span>`
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
          <a class="link" href="#/ranking">Zum Ranking</a>
        </div>
      </div>
    </section>`,
    mount(el) {
      const dia = createDiamond(el.querySelector('[data-diamond]'), {
        level: tier.level, rim: rarity.color, glow: 0.8, interactive: false,
      });
      const canvas = el.querySelector('[data-fx]');
      const fx = particles(canvas, { color: rarity.color, mode: tier.level >= 3 ? 'embers' : 'dust', density: 0.4 + tier.level * 0.4 });
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
        d.insta = cleanHandle(instaInput.value);
        store.set('donation', d);
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

      const makeImage = () => renderCardImage(d, tier, dia.canvas);

      el.querySelector('[data-share]').addEventListener('click', async () => {
        const blob = await makeImage();
        const file = new File([blob], 'fame-card.png', { type: 'image/png' });
        const text = `Ich habe einen ${tier.name} (${rarity.label}) auf ${APP_NAME} – Rang ${fmt(d.rank)} von ${fmt(d.total)} 💎 #fame #thentheothers`;
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
async function renderCardImage(d, tier, gemCanvas) {
  await document.fonts?.ready;
  const W = 1080, H = 1350;
  const rar = tier.rarity.color;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const font = (w, s, style = '') => `${style} ${w} ${s}px "Source Code Pro", ui-monospace, monospace`;

  g.fillStyle = '#0e0e10';
  g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W / 2, 520, 40, W / 2, 520, 560);
  rg.addColorStop(0, rar + '88');
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
  g.font = font(700, 38);
  g.fillText(`🏆 ${fmt(d.rank)} / ${fmt(d.total)}`, W - 100, 176);

  if (gemCanvas) {
    const s = 560;
    const ratio = gemCanvas.width / gemCanvas.height;
    const w = ratio >= 1 ? s : s * ratio;
    const h = ratio >= 1 ? s / ratio : s;
    g.drawImage(gemCanvas, (W - w) / 2, 520 - h / 2, w, h);
  }

  g.textAlign = 'center';
  g.font = font(800, 64);
  g.fillStyle = rar;
  g.shadowColor = rar;
  g.shadowBlur = 24;
  g.fillText(tier.name, W / 2, 880);
  g.shadowBlur = 0;
  g.font = font(500, 32);
  g.fillStyle = '#c9c9c4';
  g.fillText(tier.rarity.item, W / 2, 930);
  g.font = font(700, 46);
  g.fillStyle = '#7fb2ff';
  g.fillText(`+${money(d.amount)} Fame`, W / 2, 1020);
  g.font = font(500, 32, 'italic');
  g.fillStyle = '#d9a35b';
  g.fillText(`„${tier.flavor}“`, W / 2, 1100);
  if (d.insta) {
    g.font = font(600, 38);
    g.fillStyle = '#f8f8f6';
    g.fillText('@' + d.insta, W / 2, 1190);
  }

  return new Promise((res) => c.toBlob(res, 'image/png'));
}

function ranking() {
  const list = leaderboard();
  const d = state.donation;
  const me = d ? { handle: d.insta || firstName(d.name) || 'du', amount: d.amount, me: true, rank: d.rank } : null;
  const top = list.slice(0, 20).map((r, i) => ({ ...r, rank: i + 1 }));
  if (me && me.rank <= 20) top.splice(me.rank - 1, 0, me);
  const rows = top.slice(0, 20).map((r, i) => ({ ...r, rank: i + 1 }));
  const podium = rows.slice(0, 3);
  const row = (r) => {
    const t = tierFor(r.amount);
    return `<li class="row${r.me ? ' row--me' : ''}">
      <span class="row-rank">${fmt(r.rank)}</span>
      <span class="row-gem" style="color:${t.css}" title="${t.name}">${diamondSvg({ filled: true })}</span>
      <span class="row-name">@${esc(r.handle)}</span>
      <span class="row-amount">${money(r.amount)}</span>
    </li>`;
  };
  return {
    html: `<section class="screen screen--ranking">
      ${hero(`<div class="podium">
        ${[1, 0, 2].map((k) => podium[k] ? `<div class="step step--${k + 1}">
          ${k === 0 ? `<span class="podium-crown">${icons.crown}</span>` : ''}
          <span class="step-name">@${esc(podium[k].handle)}</span>
          <div class="step-block"><span>${k + 1}</span></div>
        </div>` : '').join('')}
      </div>`, { cls: 'hero--tall' })}
      <div class="ranking-body">
        <h1 class="headline">Ranking</h1>
        <p class="sub">${fmt(BOARD_SIZE + (me ? 1 : 0))} Leute zeigen, was sie sich leisten können.</p>
        <ol class="rows">${rows.map(row).join('')}</ol>
        ${me && me.rank > 20 ? `<div class="rows-gap">…</div><ol class="rows">${row(me)}</ol>` : ''}
        <div class="screen-foot">${button(me ? 'Noch höher steigen' : 'Steig ein', 'data-go="donate"')}</div>
      </div>
    </section>`,
  };
}

render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
