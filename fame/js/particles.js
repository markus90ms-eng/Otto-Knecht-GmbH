// Leichtgewichtige Canvas-Partikel: Staub, aufsteigende Funken und Explosionen beim Loot-Fund.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function particles(canvas, { color = '#3dfa74', mode = 'embers', density = 1 } = {}) {
  const g = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let list = [];
  let raf = 0;
  let col = color;
  let rate = density;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const spawn = () => {
    if (mode === 'dust') {
      return { x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 6,
        life: 4 + Math.random() * 4, age: 0, r: 0.6 + Math.random() * 1.4, c: col };
    }
    return { x: w * (0.15 + Math.random() * 0.7), y: h + 4, vx: (Math.random() - 0.5) * 14, vy: -(20 + Math.random() * 45),
      life: 2 + Math.random() * 2.5, age: 0, r: 0.8 + Math.random() * 1.8, c: col };
  };

  let acc = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt * (mode === 'dust' ? 10 : 22) * rate;
    while (acc > 1 && !reduced()) { list.push(spawn()); acc -= 1; }

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    list = list.filter((p) => (p.age += dt) < p.life);
    if (list.length > 220) list.splice(0, list.length - 220);
    for (const p of list) {
      p.vy += (p.burst ? 60 : 0) * dt;
      p.x += p.vx * dt + Math.sin((now / 1000 + p.r) * 2) * 0.15;
      p.y += p.vy * dt;
      const fade = Math.sin(Math.PI * (p.age / p.life));
      // Leuchten ohne shadowBlur (der ist auf Handys teuer): großer blasser Kreis + heller Kern
      const a = Math.max(0, fade) * (mode === 'dust' ? 0.5 : 0.9);
      g.fillStyle = p.c;
      g.globalAlpha = a * 0.18;
      g.beginPath();
      g.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = a;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    setColor(c) { col = c; },
    setDensity(d) { rate = d; },
    // Explosion von Funken an einer Position (z. B. beim Erreichen einer neuen Seltenheit).
    burst(x = w / 2, y = h / 2, n = 40, c = col) {
      if (reduced()) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 180;
        list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.6 + Math.random() * 0.8,
          age: 0, r: 1 + Math.random() * 2, c, burst: true });
      }
    },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); },
  };
}
