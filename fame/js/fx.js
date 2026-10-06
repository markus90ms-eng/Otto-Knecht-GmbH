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

// Browser spielen Ton erst nach einer Berührung – beim ersten Tippen freischalten.
export function unlockAudio() {
  const once = () => {
    audio();
    window.removeEventListener('pointerdown', once, true);
    window.removeEventListener('keydown', once, true);
  };
  window.addEventListener('pointerdown', once, true);
  window.addEventListener('keydown', once, true);
}

function tone(freq, { at = 0, dur = 0.12, vol = 0.06, type = 'sine', slideTo = null, attack = 0.005 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ at = 0, dur = 0.4, vol = 0.05, from = 800, to = 4000 } = {}) {
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
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
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

export function fanfare() {
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.22, vol: 0.05, type: 'square' }));
  buzz([30, 50, 30, 50, 80]);
}
