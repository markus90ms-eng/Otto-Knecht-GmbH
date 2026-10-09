// Sound & Vibration – Loot-Sounds je Seltenheit, Ticks beim Erhöhen des Betrags.

let ctx;
let lastTick = 0;

function audio() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Handys erlauben Ton erst nach einer echten Berührung. Als Erlaubnis zählt dort erst das
// Loslassen des Fingers (touchend/pointerup/click), nicht das Aufsetzen. Wir versuchen es bei
// jeder Berührung, bis der Ton wirklich läuft, und spielen dabei einen stillen Puffer ab (iOS).
export function unlockAudio() {
  // iPhone: Web-Töne auch bei eingeschaltetem Lautlos-Schalter abspielen (Safari 17+)
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* nicht unterstützt */ }
  const events = ['touchend', 'pointerup', 'click', 'keydown'];
  const tryUnlock = () => {
    const ac = audio();
    if (!ac) return;
    try {
      const src = ac.createBufferSource();
      src.buffer = ac.createBuffer(1, 1, 22050);
      src.connect(ac.destination);
      src.start(0);
    } catch { /* ignorieren */ }
    const done = () => events.forEach((ev) => window.removeEventListener(ev, tryUnlock, true));
    if (ac.state === 'running') done();
    else ac.resume().then(() => { if (ac.state === 'running') done(); }).catch(() => {});
  };
  events.forEach((ev) => window.addEventListener(ev, tryUnlock, true));
}

// Hall für die großen Aufdeck-Sounds: künstlicher Raumklang aus abklingendem Rauschen
let verb;
function reverb() {
  const ac = audio();
  if (!ac) return null;
  if (verb) return verb;
  const len = Math.floor(ac.sampleRate * 2.6);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  verb = ac.createConvolver();
  verb.buffer = ir;
  const back = ac.createGain();
  back.gain.value = 0.55;
  verb.connect(back).connect(ac.destination);
  return verb;
}
const send = (node, amount) => {
  if (!amount) return;
  const r = reverb();
  if (!r) return;
  const g = node.context.createGain();
  g.gain.value = amount;
  node.connect(g).connect(r);
};

function tone(freq, { at = 0, dur = 0.12, vol = 0.06, type = 'sine', slideTo = null, attack = 0.005, rev = 0, detune = 0 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  send(gain, rev);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ at = 0, dur = 0.4, vol = 0.05, from = 800, to = 4000, rev = 0, q = 1.2, peak = 0.3 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + dur * peak);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  send(gain, rev);
  src.start(t0);
}

export function buzz(pattern = 8) {
  try { navigator.vibrate?.(pattern); } catch { /* nicht unterstützt */ }
}

// intensity 0..1 – je höher der Betrag, desto höher der Ton.
export function tick(intensity, rising = true) {
  const now = performance.now();
  if (now - lastTick < 45) return;
  lastTick = now;
  tone(260 + intensity * 1100, { type: 'triangle', dur: 0.07, vol: rising ? 0.04 : 0.02 });
  if (rising) buzz(6 + Math.round(intensity * 14));
}

// Kurzes "Plink", wenn ein Gegenstand ins Inventar fällt.
export function plink(i = 0) {
  tone(880 + i * 180, { type: 'triangle', dur: 0.09, vol: 0.035 });
}

// Fund-Sound je Seltenheit (0 = Normal … 4 = Legendär).
export function rarityDrop(level) {
  switch (level) {
    case 0:
      tone(150, { type: 'sine', dur: 0.18, vol: 0.09, slideTo: 90 });
      noise({ dur: 0.08, vol: 0.03, from: 2000, to: 600 });
      buzz(12);
      break;
    case 1:
      [988, 1319].forEach((f, i) => tone(f, { at: i * 0.08, dur: 0.35, vol: 0.05 }));
      buzz([10, 30, 10]);
      break;
    case 2:
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.45, vol: 0.045, type: 'triangle' }));
      noise({ at: 0.05, dur: 0.5, vol: 0.015, from: 3000, to: 9000 });
      buzz([14, 30, 14, 30, 24]);
      break;
    case 3:
      [440, 523, 659, 784].forEach((f) => tone(f, { dur: 1.2, vol: 0.03, attack: 0.04 }));
      [1319, 1568, 1976, 2637].forEach((f, i) => tone(f, { at: 0.1 + i * 0.07, dur: 0.6, vol: 0.03, type: 'triangle' }));
      noise({ dur: 0.9, vol: 0.02, from: 1500, to: 8000 });
      buzz([20, 40, 20, 40, 60]);
      break;
    default:
      // Legendär: tiefer Einschlag, Rauschen und ein Glockenakkord
      tone(120, { dur: 0.7, vol: 0.14, slideTo: 38, attack: 0.01 });
      noise({ dur: 0.7, vol: 0.05, from: 300, to: 6000 });
      [523, 659, 784, 1046].forEach((f) => tone(f, { at: 0.12, dur: 1.8, vol: 0.035, attack: 0.02 }));
      [2093, 2637, 3136, 4186].forEach((f, i) => tone(f, { at: 0.25 + i * 0.08, dur: 0.7, vol: 0.02, type: 'triangle' }));
      buzz([40, 40, 40, 40, 120]);
  }
}

// Klang je Farbklasse (0 = Kiesel … 9 = Diamant-Holo): jede Klasse hat ihren eigenen Sound,
// von dumpf und kurz bis zu Einschlag, Glockenakkord und Glitzerregen.
export function classDrop(cls) {
  switch (cls) {
    case 0: // Kiesel: dumpfer Plopp
      tone(150, { dur: 0.18, vol: 0.09, slideTo: 90 });
      noise({ dur: 0.08, vol: 0.03, from: 2000, to: 600 });
      buzz(12);
      break;
    case 1: // Mint: zwei weiche, helle Töne
      [880, 1175].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.3, vol: 0.05 }));
      buzz([8, 30, 8]);
      break;
    case 2: // Aquamarin: perlend wie Wasser
      [988, 1319, 1760].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.35, vol: 0.04, type: 'triangle' }));
      noise({ at: 0.04, dur: 0.35, vol: 0.012, from: 4000, to: 9000 });
      buzz([10, 30, 10, 30]);
      break;
    case 3: // Saphir: klare Glocke
      [659, 831, 988].forEach((f) => tone(f, { dur: 1, vol: 0.035, attack: 0.02 }));
      tone(1976, { at: 0.05, dur: 0.6, vol: 0.02, type: 'triangle' });
      buzz([14, 30, 14, 30, 20]);
      break;
    case 4: // Amethyst: Arpeggio mit Schimmer
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.45, vol: 0.045, type: 'triangle' }));
      noise({ at: 0.05, dur: 0.5, vol: 0.015, from: 3000, to: 9000 });
      buzz([14, 30, 14, 30, 24]);
      break;
    case 5: // Rubellit: verspielter Akkord mit Glitzer
      [523, 659, 784].forEach((f) => tone(f, { dur: 1, vol: 0.03, attack: 0.03 }));
      [1568, 1976, 2349, 3136].forEach((f, i) => tone(f, { at: 0.08 + i * 0.06, dur: 0.4, vol: 0.025, type: 'triangle' }));
      buzz([16, 30, 16, 30, 30]);
      break;
    case 6: // Rubin: tiefer Akzent und warmer Glockenakkord
      tone(196, { dur: 0.4, vol: 0.08, slideTo: 98 });
      [440, 523, 659, 784].forEach((f) => tone(f, { at: 0.05, dur: 1.2, vol: 0.03, attack: 0.04 }));
      [1319, 1568, 1976, 2637].forEach((f, i) => tone(f, { at: 0.15 + i * 0.07, dur: 0.6, vol: 0.03, type: 'triangle' }));
      noise({ dur: 0.9, vol: 0.02, from: 1500, to: 8000 });
      buzz([20, 40, 20, 40, 60]);
      break;
    case 7: // Feuer: Einschlag mit aufsteigendem Rauschen
      tone(130, { dur: 0.6, vol: 0.12, slideTo: 45 });
      noise({ dur: 0.8, vol: 0.05, from: 200, to: 7000 });
      [587, 740, 880, 1175].forEach((f, i) => tone(f, { at: 0.15 + i * 0.08, dur: 0.5, vol: 0.04, type: 'square' }));
      buzz([30, 40, 30, 40, 90]);
      break;
    case 8: // Gold: Einschlag, großer Glockenakkord und Münzklimpern
      tone(120, { dur: 0.7, vol: 0.14, slideTo: 38, attack: 0.01 });
      noise({ dur: 0.7, vol: 0.05, from: 300, to: 6000 });
      [523, 659, 784, 1046].forEach((f) => tone(f, { at: 0.12, dur: 1.8, vol: 0.035, attack: 0.02 }));
      for (let i = 0; i < 12; i++) tone(2600 + Math.random() * 1800, { at: 0.3 + i * 0.06, dur: 0.06, vol: 0.02, type: 'triangle' });
      buzz([40, 40, 40, 40, 120]);
      break;
    default: // Diamant-Holo: Einschlag, schwebendes Arpeggio über mehrere Oktaven, Glitzerregen
      tone(110, { dur: 0.9, vol: 0.15, slideTo: 33, attack: 0.01 });
      noise({ dur: 1, vol: 0.05, from: 200, to: 9000 });
      [523, 659, 784, 988, 1175, 1568, 1976, 2349, 3136].forEach((f, i) => tone(f, { at: 0.1 + i * 0.07, dur: 1.4, vol: 0.026, attack: 0.02 }));
      for (let i = 0; i < 26; i++) tone(2400 + Math.random() * 2600, { at: 0.6 + i * 0.045, dur: 0.05, vol: 0.02, type: 'triangle' });
      buzz([50, 40, 50, 40, 160]);
  }
}

// ---- Aufdecken: Spielautomat + Loot-Fund (Novoline trifft WoW/Diablo) -----------------------

// Glocke mit unharmonischen Obertönen (wie der „Shing“ beim Loot-Fund)
function bell(f, { at = 0, dur = 2.2, vol = 0.05, rev = 0.5 } = {}) {
  [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([m, v]) => tone(f * m, { at, dur: dur / Math.sqrt(m), vol: vol * v, attack: 0.002, rev }));
}
// Chor-Fläche wie bei legendären Funden: verstimmte Sägezähne, weich gefiltert, langsam einblenden
function choir(freqs, { at = 0, dur = 2.6, vol = 0.018 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  lp.Q.value = 3;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.5);
  g.gain.setValueAtTime(vol, t0 + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  lp.connect(g).connect(ac.destination);
  send(g, 1.2);
  freqs.forEach((f) => [-9, 0, 9].forEach((d) => {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = d;
    o.connect(lp);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
  }));
}
// Tiefer Einschlag (Boom) mit Druck
function impact(vol = 0.2, at = 0) {
  tone(90, { at, dur: 0.9, vol, slideTo: 28, attack: 0.003, rev: 0.3 });
  tone(45, { at, dur: 1.2, vol: vol * 0.7, attack: 0.01 });
  noise({ at, dur: 0.35, vol: vol * 0.4, from: 2500, to: 120, peak: 0.05 });
}
// Gewinnzähler wie am Spielautomaten: schnell steigende Töne, am Ende Ding-Ding-Ding
function rollup(at, len, base = 523) {
  const steps = Math.round(len / 0.045);
  for (let i = 0; i < steps; i++) {
    const f = base * Math.pow(2, (i / steps) * 1.5);
    tone(f, { at: at + i * 0.045, dur: 0.05, vol: 0.03, type: 'square' });
  }
  const end = at + steps * 0.045;
  [0, 0.16, 0.32].forEach((d) => bell(base * 4, { at: end + d, dur: 0.9, vol: 0.05, rev: 0.25 }));
  return end + 0.5;
}

// Aufdecken je Farbklasse (0 Kiesel … 9 Holo). Unten noch kurz und freundlich, oben ein großes
// Spektakel: Einschlag, Loot-Glocke, Chor, Gewinnzähler und Münzregen.
export function classReveal(cls) {
  const k = cls / 9;
  const root = [262, 294, 330, 349, 392, 440, 466, 523, 587, 659][cls] || 523;
  impact(0.06 + k * 0.16);
  // Loot-„Shing“: heller Glockenakkord, je Klasse höher und voller
  bell(root * 2, { vol: 0.05 + k * 0.03, rev: 0.4 + k * 0.6 });
  if (cls >= 2) bell(root * 2.52, { at: 0.06, vol: 0.035, rev: 0.6 });
  if (cls >= 3) bell(root * 3, { at: 0.12, vol: 0.03, rev: 0.8 });
  // Glitzer-Schweif nach oben (WoW-Loot)
  const sparks = 4 + cls * 3;
  for (let i = 0; i < sparks; i++) tone(root * 4 * Math.pow(2, (i / sparks) * 1.3), { at: 0.1 + i * 0.035, dur: 0.18, vol: 0.016, type: 'triangle', rev: 0.6 });
  // Ab Amethyst: Chor wie bei einem legendären Fund (Diablo)
  if (cls >= 4) choir([root, root * 1.26, root * 1.5, root * 2].slice(0, cls >= 7 ? 4 : 3), { at: 0.05, dur: 2.2 + k * 1.6, vol: 0.012 + k * 0.012 });
  // Ab Rubellit: Gewinnzähler mit Ding-Ding-Ding (Spielautomat)
  let t = 0.45;
  if (cls >= 5) t = rollup(0.45, 0.3 + (cls - 5) * 0.25, root * 2);
  // Ab Feuer: zweiter Einschlag und Fanfare
  if (cls >= 7) {
    impact(0.18, t);
    [1, 1.26, 1.5, 2].forEach((m, i) => tone(root * 2 * m, { at: t + 0.05 + i * 0.09, dur: 0.5, vol: 0.04, type: 'square', rev: 0.4 }));
    [1, 1.26, 1.5, 2].forEach((m) => tone(root * 2 * m, { at: t + 0.45, dur: 1.4, vol: 0.025, type: 'sawtooth', attack: 0.02, rev: 0.8 }));
  }
  // Gold und Holo: Münzregen
  if (cls >= 8) for (let i = 0; i < 18 + (cls - 8) * 16; i++) tone(2400 + Math.random() * 2600, { at: t + 0.3 + i * 0.04, dur: 0.07, vol: 0.02, type: 'triangle', rev: 0.3 });
  buzz(cls >= 7 ? [60, 40, 60, 40, 200] : cls >= 4 ? [40, 40, 40, 40, 120] : [30, 40, 60]);
}

export function fanfare() {
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.22, vol: 0.05, type: 'square' }));
  buzz([30, 50, 30, 50, 80]);
}

// Spannung vor dem Aufdecken wie am Spielautomaten: Walzen rattern immer schneller, darunter ein
// Herzschlag und ein Rauschen, das nach oben zieht. Gibt die Dauer zurück; höhere Stufen bauen länger auf.
export function buildup(level) {
  const ac = audio();
  const dur = 0.9 + level * 0.25;
  if (!ac) return dur;
  let t = 0, i = 0;
  while (t < dur) {
    const p = t / dur;
    // Walzen-Klick: kurzes helles Rauschen plus Ton, der mit der Zeit steigt
    noise({ at: t, dur: 0.03, vol: 0.05 + p * 0.04, from: 5000, to: 3000, q: 4, peak: 0.1 });
    tone(330 * Math.pow(2, p * 1.6), { at: t, dur: 0.05, vol: 0.025 + p * 0.025, type: 'square' });
    t += 0.13 - p * 0.1;
    i++;
  }
  // Herzschlag, der schneller wird
  for (let h = 0; h < dur; h += 0.55 - (h / dur) * 0.25) {
    tone(70, { at: h, dur: 0.16, vol: 0.12, slideTo: 45 });
    tone(62, { at: h + 0.14, dur: 0.14, vol: 0.08, slideTo: 40 });
  }
  // Steigendes Rauschen und ein Ton, der bis zum Aufdecken nach oben zieht
  noise({ dur: dur + 0.05, vol: 0.05, from: 300, to: 9000, peak: 0.95, rev: 0.3 });
  tone(220, { dur: dur + 0.05, vol: 0.02, slideTo: 880, type: 'sawtooth', attack: dur * 0.8 });
  buzz(Array.from({ length: Math.min(12, i) }, (_, k) => (k % 2 ? 40 - k * 2 : 8)));
  return dur;
}

// Gewinn beim Aufdecken: Fund-Sound der Stufe, ab "Diamant" ein Gewinn-Jingle, beim
// perfekten Diamanten zusätzlich ein Münzregen.
export function reveal(level) {
  rarityDrop(level);
  if (level >= 2) {
    const scale = [523, 659, 784, 1046, 1318, 1568];
    for (let r = 0; r < level - 1; r++) {
      scale.forEach((f, i) => tone(f, { at: 0.25 + r * 0.36 + i * 0.05, dur: 0.12, vol: 0.035, type: 'square' }));
    }
  }
  if (level >= 4) {
    for (let i = 0; i < 26; i++) tone(2400 + Math.random() * 2400, { at: 0.5 + i * 0.045, dur: 0.05, vol: 0.02, type: 'triangle' });
  }
}

// Neuer Edelstein beim Schieben: kurzer Kristall-Ton, je höher die Stufe, desto heller.
export function stageTick(stage, up = true) {
  const now = performance.now();
  if (now - lastTick < 60) return;
  lastTick = now;
  const f = 520 * Math.pow(2, stage / 36);
  tone(f, { type: 'sine', dur: 0.18, vol: up ? 0.05 : 0.03 });
  tone(f * 1.5, { at: 0.04, type: 'sine', dur: 0.16, vol: up ? 0.03 : 0.015 });
  if (up) buzz(10);
}
