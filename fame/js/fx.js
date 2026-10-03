// Sound & Vibration – "Sound u. Vibration bei Erhöhung des Betrages".

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

function blip(freq, { at = 0, dur = 0.08, vol = 0.06, type = 'triangle' } = {}) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function buzz(pattern = 8) {
  try { navigator.vibrate?.(pattern); } catch { /* nicht unterstützt */ }
}

// intensity 0..1 – je höher der Betrag, desto höher der Ton.
export function tick(intensity, rising = true) {
  const now = performance.now();
  if (now - lastTick < 45) return;
  lastTick = now;
  blip(260 + intensity * 1100, { vol: rising ? 0.05 : 0.025 });
  if (rising) buzz(6 + Math.round(intensity * 14));
}

export function tierUp() {
  [0, 0.07, 0.14].forEach((at, i) => blip(660 * (1 + i * 0.26), { at, dur: 0.14, vol: 0.06, type: 'sine' }));
  buzz([18, 40, 28]);
}

export function fanfare() {
  [523, 659, 784, 1046, 1318].forEach((f, i) => blip(f, { at: i * 0.09, dur: 0.22, vol: 0.06, type: 'square' }));
  buzz([30, 50, 30, 50, 80]);
}
