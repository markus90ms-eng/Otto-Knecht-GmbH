// Fame – App-Shell, Router und Screens.

import {
  TIERS, PIN_FROM, BOARD_SIZE, tierFor, nextTier, tierProgress, fmt, money,
  amountFromPos, posFromAmount, niceRound, rankFor, leaderboard, MAX_AMOUNT, MIN_AMOUNT,
} from './data.js';
import {
  APP_NAME, esc, logo, logoInline, hl, dots, hero, button, diamondSvg, diamondShadowed, icons,
} from './ui.js';
import { tick, tierUp, fanfare, buzz } from './fx.js';
import { createDiamond } from './diamond3d.js';

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

// ---- Kleine Helfer ----------------------------------------------------------

function toast(msg) {
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

// ---- Screens ----------------------------------------------------------------

function splash() {
  return {
    html: `<section class="screen screen--splash">
      <div class="splash-logo">${logo('lg')}</div>
      <div class="screen-foot">
        ${button('Login', 'data-go="login"')}
        <a class="link" href="#/intro/1">Neu hier? Zeig mir mehr</a>
      </div>
    </section>`,
  };
}

function intro1() {
  return {
    html: `<section class="screen screen--intro1">
      <div class="intro1-logo">${logo('lg')}</div>
      <h1 class="claim">Zeig was Du dir <em>leisten kannst</em> und tue dabei gutes.</h1>
      <div class="screen-foot">
        ${dots(0)}
        ${button('Zeig mir mehr', 'data-go="intro/2"')}
        <a class="link" href="#/login">registrier dich</a>
      </div>
    </section>`,
  };
}

// Bild-Karussell: jedes Bild gehört zu einem Aufzählungspunkt, der dann aktiv (schwarz) wird.
const SLIDES = [
  { img: 'assets/img/cash.jpg', alt: 'Ein Bündel Dollarscheine' },
  { img: 'assets/img/ranking.jpg', alt: 'Siegerpodest mit Strichmännchen auf Platz 1' },
  { img: 'assets/img/pin.jpg', alt: 'Neon-Hand mit Diamant' },
  { img: 'assets/img/animals.jpg', alt: 'Hund und Katze auf dem Sofa' },
];

function intro2() {
  const bullets = [
    `${hl('Ca$h')} ist für dich nichts? Beweise es und ${hl('zeig´s der Welt')}`,
    `Steig im ${hl('Ranking')} auf`,
    `Verdiene dir dein ${hl('Diamant Pin')} ab ${money(PIN_FROM)}`,
    `${hl('Hilf')} damit auch Menschen und Tiere in Not`,
  ];
  return {
    html: `<section class="screen screen--intro2">
      ${hero(`<div class="slides">${SLIDES.map((s, i) =>
        `<img class="slide${i === 0 ? ' is-active' : ''}" src="${s.img}" alt="${s.alt}" draggable="false">`).join('')}</div>`,
        { cls: 'hero--photo' })}
      <ul class="bullets">
        ${bullets.map((b, i) => `<li class="bullet${i === 0 ? ' is-active' : ''}" data-i="${i}">
          <span class="bullet-ico">${diamondShadowed()}</span><span class="bullet-txt">${b}</span></li>`).join('')}
      </ul>
      <div class="screen-foot">
        ${dots(1)}
        ${button('Noch mehr!', 'data-go="intro/3"')}
      </div>
    </section>`,
    mount(el) {
      const slides = [...el.querySelectorAll('.slide')];
      const items = [...el.querySelectorAll('.bullet')];
      let i = 0;
      const show = (n) => {
        i = (n + slides.length) % slides.length;
        slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
        items.forEach((s, k) => s.classList.toggle('is-active', k === i));
      };
      let timer = setInterval(() => show(i + 1), 3200);
      const restart = () => { clearInterval(timer); timer = setInterval(() => show(i + 1), 3200); };

      items.forEach((it, k) => it.addEventListener('click', () => { show(k); restart(); }));

      // Wischen im Bildbereich
      const shape = el.querySelector('.hero-shape');
      let x0 = null;
      shape.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
      shape.addEventListener('pointerup', (e) => {
        if (x0 == null) return;
        const dx = e.clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 40) { show(i + (dx < 0 ? 1 : -1)); restart(); }
      });
      return () => clearInterval(timer);
    },
  };
}

function intro3() {
  return {
    html: `<section class="screen screen--intro3">
      ${hero(`<h1 class="story-title">#Real_story, BRO</h1>`)}
      <blockquote class="quote">
        <p>Eine Belvedere Flasche kostet im Club 300€ – 3.000€ der ${hl('Fame')} hält maximal einen Abend,
        die Reichweite begrenzt sich auf den Club.<br>
        Bei ${logoInline()} bestimmst du deine Kosten, der ${hl('Fame')} hält dein ${hl('Leben lang')}
        und die Reichweite ist grenzenlos.</p>
        <footer>${APP_NAME} Gründer</footer>
      </blockquote>
      <div class="screen-foot">
        ${dots(2)}
        ${button('Fang an – JETZT', 'data-go="donate"')}
      </div>
    </section>`,
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
          <input name="name" autocomplete="given-name" required value="${esc(u.name)}" placeholder="Max"></label>
        <label class="field"><span>Instagram</span>
          <input name="insta" autocomplete="off" autocapitalize="off" value="${esc(u.insta ? '@' + u.insta : '')}" placeholder="@deinname"></label>
        <div class="screen-foot">
          <button class="btn" type="submit"><span>Login</span></button>
          ${state.user ? '<button class="link" type="button" data-logout>Abmelden</button>' : ''}
        </div>
      </form>
    </section>`,
    mount(el) {
      const dia = createDiamond(el.querySelector('[data-diamond]'), { color: 0xeaf6ff, glow: 0.5 });
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
  return {
    html: `<section class="screen screen--donate">
      ${hero(`<div class="glow" data-glow></div>
        <div class="rays" aria-hidden="true">${'<i></i>'.repeat(10)}</div>
        <div class="stage3d" data-diamond></div>
        <div class="tier-name" data-tier></div>
        <div class="spin-hint">${icons.rotate} 360°</div>`, { cls: 'hero--tall hero--gem' })}
      <div class="donate-body">
        <label class="amount">
          <span class="sr-only">Betrag</span>
          <input data-amount inputmode="numeric" autocomplete="off" aria-label="Betrag in Euro">
        </label>
        ${registered ? `<div class="tierbar">
          <div class="tierbar-head"><span data-cur></span><span data-next></span></div>
          <div class="tierbar-track"><div class="tierbar-fill" data-fill></div></div>
        </div>` : ''}
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
          <input type="checkbox" data-accept ${state.accepted ? 'checked' : ''}>
          <span class="check-box" aria-hidden="true"></span>
          <span>Ich akzeptiere die <a href="#" data-terms>Bedingungen</a></span>
        </label>
        <div class="screen-foot">
          ${button('I´m awesome', 'data-awesome')}
        </div>
      </div>
    </section>`,
    mount(el) {
      const dia = createDiamond(el.querySelector('[data-diamond]'));
      const $ = (s) => el.querySelector(s);
      const input = $('[data-amount]');
      const arc = $('[data-arc]');
      const fill = $('[data-arcfill]');
      const knob = $('[data-knob]');
      const btn = $('[data-awesome]');
      const accept = $('[data-accept]');
      let tierId = null;
      let amount = state.amount;

      const update = (next, { sound = false } = {}) => {
        const prev = amount;
        amount = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, next));
        state.amount = amount;
        const pos = posFromAmount(amount);
        const tier = tierFor(amount);

        // Bogen-Slider: x verläuft linear, y als Parabel (quadratische Bézierkurve).
        const x = 20 + 260 * pos;
        const y = 16 + 304 * pos * (1 - pos);
        knob.setAttribute('transform', `translate(${x} ${y})`);
        fill.style.strokeDasharray = `${pos} 1`;
        arc.setAttribute('aria-valuenow', amount);
        arc.setAttribute('aria-valuetext', money(amount));

        if (document.activeElement !== input) input.value = money(amount);
        $('[data-tier]').textContent = tier.name;
        el.style.setProperty('--tier', tier.css);
        el.style.setProperty('--glow', (0.25 + pos * 0.75).toFixed(3));
        dia.setColor(tier.color);
        dia.setGlow(pos);

        if (state.user) {
          const nx = nextTier(amount);
          $('[data-cur]').textContent = tier.name;
          $('[data-next]').textContent = nx ? nx.name : 'Top Stufe';
          $('[data-fill]').style.width = `${Math.round(tierProgress(amount) * 100)}%`;
          const { rank, total } = rankFor(amount);
          $('[data-rank]').textContent = fmt(rank);
          $('[data-total]').textContent = fmt(total);
        }

        if (sound && amount !== prev) {
          if (tierId && tier.id !== tierId && amount > prev) { tierUp(); dia.pulse(); }
          else tick(pos, amount > prev);
        }
        tierId = tier.id;
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
        fanfare();
        go('card');
      });

      update(amount);
      syncBtn();
      return () => dia.dispose();
    },
  };
}

function card() {
  const d = state.donation;
  if (!d) {
    queueMicrotask(() => go('donate'));
    return { html: '<section class="screen"></section>' };
  }
  const tier = TIERS.find((t) => t.id === d.tier) || tierFor(d.amount);
  const name = firstName(d.name);
  return {
    html: `<section class="screen screen--card" style="--tier:${tier.css}">
      <button class="back back--light" type="button" data-back aria-label="Zurück">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8"/></svg>
      </button>
      <h1 class="omg">Omg… ${name ? esc(name) : 'du'}<br><em>Du bist so krass.</em></h1>
      <div class="card-wrap" data-tiltwrap>
        <article class="famecard" data-card>
          <div class="famecard-shine" data-shine></div>
          <div class="famecard-top">
            <span class="famecard-brand">${APP_NAME}${diamondSvg({ filled: true, cls: 'dia-inline' })}</span>
            <span class="famecard-rank">${icons.trophy}${fmt(d.rank)} / ${fmt(d.total)}</span>
          </div>
          <div class="famecard-gem">
            <div class="glow"></div>
            <div class="stage3d" data-diamond></div>
          </div>
          <div class="famecard-amount">${money(d.amount)}</div>
          <div class="famecard-tier">${tier.name}</div>
          <div class="famecard-insta">${icons.insta}
            ${d.insta
              ? `<span>${esc(d.insta)}</span>`
              : `<input data-insta placeholder="dein Instagram" autocomplete="off" autocapitalize="off" aria-label="Instagram-Name">`}
          </div>
        </article>
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
      const dia = createDiamond(el.querySelector('[data-diamond]'), { color: tier.color, glow: 0.8, interactive: false });
      const cardEl = el.querySelector('[data-card]');
      const shine = el.querySelector('[data-shine]');
      const instaInput = el.querySelector('[data-insta]');

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
        const text = `Ich bin ${tier.name} auf ${APP_NAME} – Rang ${fmt(d.rank)} von ${fmt(d.total)} 💎 #fame #thentheothers`;
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
        cancelAnimationFrame(raf);
        window.removeEventListener('deviceorientation', onOrient);
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

// Fame-Card als PNG (4:5, Instagram-Format) zeichnen.
async function renderCardImage(d, tier, gemCanvas) {
  await document.fonts?.ready;
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const font = (w, s) => `${w} ${s}px "Source Code Pro", ui-monospace, monospace`;

  g.fillStyle = '#141414';
  g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W / 2, 560, 40, W / 2, 560, 520);
  rg.addColorStop(0, tier.css + 'aa');
  rg.addColorStop(1, '#14141400');
  g.fillStyle = rg;
  g.fillRect(0, 0, W, H);

  g.strokeStyle = '#3dfa74';
  g.lineWidth = 6;
  g.strokeRect(48, 48, W - 96, H - 96);

  g.textBaseline = 'alphabetic';
  g.font = font(800, 84);
  g.fillStyle = '#3dfa74';
  g.fillText(APP_NAME, 104, 186);
  g.fillStyle = '#f8f8f6';
  g.fillText(APP_NAME, 98, 178);
  g.font = font(500, 30);
  g.fillText('then the others', 100, 226);

  g.textAlign = 'right';
  g.font = font(700, 40);
  g.fillText(`🏆 ${fmt(d.rank)} / ${fmt(d.total)}`, W - 100, 178);

  if (gemCanvas) {
    const s = 640;
    const ratio = gemCanvas.width / gemCanvas.height;
    const w = ratio >= 1 ? s : s * ratio;
    const h = ratio >= 1 ? s / ratio : s;
    g.drawImage(gemCanvas, (W - w) / 2, 560 - h / 2, w, h);
  }

  g.textAlign = 'center';
  g.font = font(800, 104);
  g.fillStyle = '#3dfa74';
  g.fillText(money(d.amount), W / 2 + 6, 1000 + 6);
  g.fillStyle = '#f8f8f6';
  g.fillText(money(d.amount), W / 2, 1000);
  g.font = font(700, 56);
  g.fillStyle = tier.css;
  g.fillText(tier.name, W / 2, 1090);
  if (d.insta) {
    g.font = font(500, 40);
    g.fillStyle = '#f8f8f6';
    g.fillText('@' + d.insta, W / 2, 1180);
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
  const row = (r) => `<li class="row${r.me ? ' row--me' : ''}">
    <span class="row-rank">${fmt(r.rank)}</span>
    <span class="row-gem" style="color:${tierFor(r.amount).css}">${diamondSvg({ filled: true })}</span>
    <span class="row-name">@${esc(r.handle)}</span>
    <span class="row-amount">${money(r.amount)}</span>
  </li>`;
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
