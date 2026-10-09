// 3D-Edelsteine: Schliffe, Materialien und gezeichnete Muster für alle 89 Steine.
// Facettierte Steine (auch alle Diamanten) mit Lichtbrechung aus refraction.js, Cabochons mit Mustern.

import * as THREE from '../vendor/three.module.min.js';
import { brilliantGeometry, facetGeometry, starTexture } from './diamond3d.js';
import { refractionMaterial } from './refraction.js';

// ---- Zufall mit festem Startwert, damit jeder Stein immer gleich aussieht ---------------

function seeded(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// ---- Schliffe -------------------------------------------------------------------------------

// ---- Umrisse -------------------------------------------------------------------------------

// Umriss als Liste von Punkten -> Radius je Winkel (360 Stufen), für das Umformen des Brillanten.
function radiusTable(points) {
  const bins = new Float32Array(360);
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [x1, z1] = points[i], [x2, z2] = points[(i + 1) % n];
    for (let k = 0; k <= 20; k++) {             // Kanten verdichten
      const x = x1 + (x2 - x1) * (k / 20), z = z1 + (z2 - z1) * (k / 20);
      const bin = Math.floor(((Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 360) % 360;
      bins[bin] = Math.max(bins[bin], Math.hypot(x, z));
    }
  }
  for (let k = 0; k < 720; k++) if (!bins[k % 360]) bins[k % 360] = bins[(k + 359) % 360];
  return (a) => bins[Math.floor(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 360) % 360];
}

// Geschlossene Kurve abtasten
const curve = (fn, steps = 720) => Array.from({ length: steps }, (_, i) => fn((i / steps) * Math.PI * 2));

// Rechteck mit abgeschrägten Ecken (Emerald, Asscher, Radiant), halbe Breite w, halbe Tiefe d
const cutRect = (w, d, c) => [[w, -d + c], [w, d - c], [w - c, d], [-w + c, d], [-w, d - c], [-w, -d + c], [-w + c, -d], [w - c, -d]];

const OUTLINES = {
  // r: Verhältnis Länge zu Breite (für die Legenden nach ihren echten Maßen)
  oval: (r = 1.44) => curve((t) => [0.9 * r * Math.cos(t), 0.9 * Math.sin(t)]),
  // Kissen: Superellipse, eckig mit runden Ecken
  cushion: (r = 1.24) => curve((t) => [0.95 * r * Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** 0.5, 0.95 * Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** 0.5]),
  cushionSquare: () => curve((t) => [1.02 * Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** 0.5, 1.02 * Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** 0.5]),
  // Marquise: Schiffchen mit zwei Spitzen
  marquise: () => curve((t) => [1.45 * Math.cos(t), 0.62 * Math.sin(t) * Math.abs(Math.sin(t)) ** 0.35]),
  // Birne: links rund, rechts spitz
  pear: (r = 1) => curve((t) => [(1.35 * Math.cos(t) - 0.28) * r, 0.95 * Math.sin(t) * Math.abs(Math.sin(t / 2)) ** 0.9]),
  princess: () => cutRect(0.9, 0.9, 0.001),
  radiant: () => cutRect(1.22, 0.9, 0.22),
  radiantSquare: () => cutRect(0.95, 0.95, 0.26),
};

// Treppenschliff-Umrisse
const STEP_OUTLINES = {
  // corner: Größe der abgeschrägten Ecken (Pink Legacy hat besonders große)
  emerald: (ratio = 1.4, corner = 0.2) => cutRect(0.92 * ratio, 0.92, corner),
  asscher: (ratio = 1, corner = 0.3) => cutRect(0.95 * ratio, 0.95, corner),
  octagon: () => curve((t) => [Math.cos(t), Math.sin(t)], 8).map(([x, z]) => {
    const a = Math.atan2(z, x) + Math.PI / 8;
    return [Math.cos(a), Math.sin(a)];
  }),
};

// Brillant auf einen Umriss umformen: jeder Punkt wird je nach Winkel nach außen/innen geschoben.
function reshape(geo, fn) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const f = fn(Math.atan2(z, x));
    pos.setXYZ(i, x * f, pos.getY(i), z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

// Treppenschliff aus einem Umriss: gestufte Ringe in Krone und Pavillon, flache Tafel oben.
function stepCut(outlinePts, { steps = 3, depth = 1 } = {}) {
  const crown = steps === 4
    ? [[1, 0.03], [0.93, 0.1], [0.86, 0.17], [0.78, 0.23], [0.7, 0.28]]
    : [[1, 0.03], [0.91, 0.12], [0.81, 0.21], [0.71, 0.28]];
  const pav = [[1, -0.03], [0.84, -0.2], [0.66, -0.37], [0.46, -0.53], [0.24, -0.66]].map(([k, y]) => [k, y * depth]);
  const ring = (k, y) => outlinePts.map(([x, z]) => new THREE.Vector3(x * k, y, z * k));
  const rings = [...crown.reverse().map(([k, y]) => ring(k, y)), ...pav.map(([k, y]) => ring(k, y))];
  const top = new THREE.Vector3(0, crown[0][1], 0);
  const culet = new THREE.Vector3(0, -0.74 * depth, 0);
  const n = outlinePts.length;
  const t = [];
  for (let i = 0; i < n; i++) t.push(top, rings[0][i], rings[0][(i + 1) % n]);
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a = rings[r][i], b = rings[r][(i + 1) % n], c = rings[r + 1][i], d = rings[r + 1][(i + 1) % n];
      t.push(a, c, b, b, c, d);
    }
  }
  const last = rings[rings.length - 1];
  for (let i = 0; i < n; i++) t.push(last[i], culet, last[(i + 1) % n]);
  return facetGeometry(t, new THREE.Vector3(0, -0.2, 0));
}

// Cabochon: glatte Wölbung mit flachem Boden. UVs als Draufsicht, damit Muster natürlich liegen.
function cabochonGeometry(oval = 1.2) {
  const pts = [new THREE.Vector2(0, -0.14), new THREE.Vector2(0.97, -0.14), new THREE.Vector2(1, -0.08)];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a), 0.58 * Math.sin(a)));
  }
  const geo = new THREE.LatheGeometry(pts, 64);
  geo.scale(oval, 1, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * oval) + 0.5, pos.getZ(i) / 2 + 0.5);
  geo.computeVertexNormals();
  return geo;
}

// Trommelstein: rundlich polierter Kiesel, jeder Stein mit eigener, leicht unregelmäßiger Form.
// UVs als Draufsicht, damit Bänder und Adern wie bei echten Trommelsteinen über den Stein laufen.
function pebbleGeometry(name) {
  const rnd = seeded(`pebble-${name}`);
  const geo = new THREE.SphereGeometry(1, 96, 64);
  const sx = 1.05 + rnd() * 0.2, sy = 0.5 + rnd() * 0.12, sz = 0.72 + rnd() * 0.16;
  const k = Array.from({ length: 6 }, () => rnd() * Math.PI * 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // weiche Beulen und eine leicht abgeflachte Unterseite
    const bump = 1 + 0.07 * Math.sin(x * 2.1 + k[0]) * Math.cos(z * 1.7 + k[1])
      + 0.05 * Math.sin(y * 2.6 + x * 1.3 + k[2]) + 0.04 * Math.cos(z * 3.1 + y * 1.1 + k[3]);
    const flat = y < 0 ? 1 - 0.25 * y * y : 1;
    const taper = 1 + 0.12 * x * Math.sin(k[4]);
    pos.setXYZ(i, x * sx * bump * taper, y * sy * bump * flat, z * sz * bump * taper);
    uv.setXY(i, x * 0.5 + 0.5, z * 0.5 + 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}

export const isPebble = (spec) => spec.cut === 'cabochon' && ['opaque', 'milk', 'labra'].includes(spec.look);

// Rohdiamant: unregelmäßiger Kristall mit großen, flachen Spaltflächen (z. B. The Constellation)
function roughGeometry(name) {
  const rnd = seeded(`rough-${name}`);
  const base = new THREE.IcosahedronGeometry(1, 1);
  // Spaltflächen: Punkte jenseits einer Ebene werden auf die Ebene gedrückt
  const planes = Array.from({ length: 11 }, () => {
    const n = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    return { n, d: 0.62 + rnd() * 0.3 };
  });
  const seen = new Map();
  const pos = base.attributes.position;
  const t = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!seen.has(key)) {
      const w = v.clone().multiplyScalar(1 + (rnd() - 0.5) * 0.12);
      for (const { n, d } of planes) {
        const k = w.dot(n);
        if (k > d) w.addScaledVector(n, d - k);
      }
      seen.set(key, w.multiply(new THREE.Vector3(0.95, 1.3, 0.62)));
    }
    t.push(seen.get(key));
  }
  base.dispose();
  const geo = facetGeometry(t, new THREE.Vector3(0, 0, 0));
  geo.rotateX(-0.55); // gegen die Neigung der Bühne: der Kristall steht aufrecht
  return geo;
}

function cutGeometry(spec) {
  if (spec.cut === 'rough') return roughGeometry(spec.name);
  if (isPebble(spec)) return pebbleGeometry(spec.name);
  if (spec.cut === 'cabochon') return cabochonGeometry();
  // Pavillon je nach Brechzahl: Diamant (2,42) wie gehabt, Quarz (1,54) gut ein Viertel tiefer
  const depth = 1 + Math.max(0, 2.42 - (spec.ior ?? 2.42)) * 0.3;
  if (STEP_OUTLINES[spec.cut]) return stepCut(STEP_OUTLINES[spec.cut](spec.ratio, spec.corner), { steps: spec.cut === 'asscher' ? 4 : 3, depth });
  const geo = brilliantGeometry({ depth: 0.86 * depth });
  return OUTLINES[spec.cut] ? reshape(geo, radiusTable(OUTLINES[spec.cut](spec.ratio))) : geo;
}

// ---- Gezeichnete Muster (Canvas-Texturen) -----------------------------------------------

function canvasTexture(draw, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const PATTERNS = {
  // Malachit: gewellte, konzentrische Bänder
  bands(g, n, spec, rnd) {
    g.fillStyle = spec.c2;
    g.fillRect(0, 0, n, n);
    const cx = n * (0.3 + rnd() * 0.4), cy = n * (0.3 + rnd() * 0.4);
    for (let r = n; r > 4; r -= 6 + rnd() * 10) {
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.08) {
        const rr = r * (1 + 0.08 * Math.sin(a * 3 + r * 0.05));
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8);
      }
      g.fillStyle = (Math.round(r / 7) % 2) ? spec.c : spec.c2;
      g.fill();
    }
  },
  // Larimar, Sugilith: weiche Wolken
  clouds(g, n, spec, rnd) {
    g.fillStyle = spec.c;
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * n, y = rnd() * n, r = 20 + rnd() * 90;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, spec.c2 + '66');
      grd.addColorStop(1, spec.c2 + '00');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  },
  // Lapislazuli: tiefes Blau mit goldenen Pyrit-Flecken
  flecks(g, n, spec, rnd) {
    g.fillStyle = spec.c;
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * n, y = rnd() * n, r = 30 + rnd() * 80;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(10,20,80,0.45)');
      grd.addColorStop(1, 'rgba(10,20,80,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.fillStyle = spec.c2;
    for (let i = 0; i < 260; i++) g.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 3, 1 + rnd() * 3);
  },
  // Dendritenachat: helle Basis mit farnartigen dunklen Verästelungen
  dendrite(g, n, spec, rnd) {
    g.fillStyle = spec.c;
    g.fillRect(0, 0, n, n);
    g.strokeStyle = spec.c2;
    const branch = (x, y, a, len, w) => {
      if (len < 4) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      branch(x2, y2, a - 0.5 + rnd() * 0.3, len * 0.72, w * 0.7);
      branch(x2, y2, a + 0.5 - rnd() * 0.3, len * 0.72, w * 0.7);
    };
    for (let i = 0; i < 7; i++) branch(rnd() * n, n * (0.7 + rnd() * 0.3), -Math.PI / 2 + (rnd() - 0.5), 90 + rnd() * 60, 7);
  },
  // Türkis: Adernetz aus dunklem Muttergestein
  matrix(g, n, spec, rnd) {
    g.fillStyle = spec.c;
    g.fillRect(0, 0, n, n);
    g.strokeStyle = spec.c2;
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      let x = rnd() * n, y = rnd() * n;
      g.lineWidth = 1 + rnd() * 3;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; g.lineTo(x, y); }
      g.stroke();
    }
  },
  // Rhodonit: rosa mit schwarzen Adern
  veins(g, n, spec, rnd) {
    PATTERNS.matrix(g, n, spec, rnd);
  },
  // Sonnenstein: warmer Verlauf mit glitzernden Plättchen
  glitter(g, n, spec, rnd) {
    const grd = g.createLinearGradient(0, 0, n, n);
    grd.addColorStop(0, spec.c);
    grd.addColorStop(1, '#a33c12');
    g.fillStyle = grd;
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rnd() > 0.5 ? spec.c2 : '#ffffff';
      g.globalAlpha = 0.4 + rnd() * 0.6;
      g.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 3, 1 + rnd() * 2);
    }
    g.globalAlpha = 1;
  },
  // Opal: Farbspiel – leuchtende Flecken in allen Regenbogenfarben
  opal(g, n, spec, rnd) {
    const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n * 0.7);
    grd.addColorStop(0, spec.c);
    grd.addColorStop(1, spec.c2 || spec.c);
    g.fillStyle = grd;
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 180; i++) {
      const x = rnd() * n, y = rnd() * n, r = 8 + rnd() * 34;
      const hue = Math.floor(rnd() * 360);
      const p = g.createRadialGradient(x, y, 0, x, y, r);
      p.addColorStop(0, `hsla(${hue},95%,60%,0.95)`);
      p.addColorStop(0.6, `hsla(${(hue + 40) % 360},95%,55%,0.6)`);
      p.addColorStop(1, `hsla(${hue},95%,55%,0)`);
      g.fillStyle = p;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.4 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  },
  // Labradorit/Spektrolith: dunkle Basis mit schillernden Bändern
  labra(g, n, spec, rnd) {
    g.fillStyle = spec.c;
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 14; i++) {
      const y = rnd() * n, h = 20 + rnd() * 60, hue = 160 + rnd() * 120;
      const grd = g.createLinearGradient(0, y - h, 0, y + h);
      grd.addColorStop(0, `hsla(${hue},90%,55%,0)`);
      grd.addColorStop(0.5, `hsla(${hue},95%,55%,0.95)`);
      grd.addColorStop(1, `hsla(${hue},90%,55%,0)`);
      g.save();
      g.translate(n / 2, n / 2);
      g.rotate(-0.4 + rnd() * 0.3);
      g.fillStyle = grd;
      g.fillRect(-n, y - n / 2 - h, n * 2, h * 2);
      g.restore();
    }
  },
  // Sternsaphir/Sternrubin: seidiger Grund
  silk(g, n, spec, rnd) {
    const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n * 0.6);
    grd.addColorStop(0, '#ffffff55');
    grd.addColorStop(0.15, spec.c);
    grd.addColorStop(1, '#00000088');
    g.fillStyle = spec.c;
    g.fillRect(0, 0, n, n);
    g.fillStyle = grd;
    g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 300; i++) {
      const a = rnd() * Math.PI;
      g.beginPath();
      g.moveTo(n / 2, n / 2);
      g.lineTo(n / 2 + Math.cos(a) * n, n / 2 + Math.sin(a) * n);
      g.stroke();
    }
  },
};

// Sechsstrahliger Stern (Asterismus) als Leuchttextur
function asterismTexture() {
  return canvasTexture((g, n) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, n, n);
    g.translate(n / 2, n / 2);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      g.save();
      g.rotate((i * Math.PI) / 3);
      const grd = g.createLinearGradient(-n / 2, 0, n / 2, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(-n / 2, -3, n, 6);
      g.restore();
    }
    const c = g.createRadialGradient(0, 0, 0, 0, 0, 40);
    c.addColorStop(0, 'rgba(255,255,255,0.9)');
    c.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = c;
    g.fillRect(-40, -40, 80, 80);
  });
}

// ---- Materialien ---------------------------------------------------------------------------

function darker(hex, k) {
  return new THREE.Color(hex).multiplyScalar(k);
}

// Foto-Look je nach Farbe: fast farblose Steine (Bergkristall, Weißtopas …) klar wie ein Diamant,
// zarte Farben mit wenig Körperfarbe (sonst wirken sie milchig), kräftige Farben satt und tief.
function photoLook(hex, lum) {
  const col = new THREE.Color(hex);
  const max = Math.max(col.r, col.g, col.b), min = Math.min(col.r, col.g, col.b);
  const sat = max ? (max - min) / max : 0;
  if (sat < 0.12) return { body: 0.02, holo: 0, contrast: 0.3, exposure: 1.6, absorb: 0.5 };
  const k = Math.min(1, (sat - 0.1) / 0.55);
  return {
    body: 0.24 * Math.max(0.15, k),
    holo: 0,
    contrast: Math.min(1, Math.max(0.5, (0.85 - lum) * 3)),
    exposure: 1.2 + 0.35 * k + Math.max(0, 0.5 - lum) * 1.4,
    // Farbtiefe nach Weglänge im Stein (siehe refraction.js); zarte Farben etwas stärker,
    // damit sie trotz hellem Grundton Tiefe zeigen
    absorb: 0.45 + (1 - k) * 0.35,
  };
}

function buildMaterials(spec, geo, envCube, style) {
  const rnd = seeded(spec.name);
  const disposables = [];
  const tex = (name) => {
    const t = canvasTexture((g, n) => PATTERNS[name](g, n, spec, rnd));
    disposables.push(t);
    return t;
  };

  if (spec.cut !== 'cabochon' && envCube) {
    // Facettiert: echte Lichtbrechung im Stein (siehe refraction.js)
    const lum = new THREE.Color(spec.c).getHSL({}).l;
    // Rohdiamant: kaum Feuer, milchig wie Eis
    const rough = spec.cut === 'rough';
    const outer = refractionMaterial(geo, envCube, {
      color: spec.bicolor ? '#ffffff' : spec.c, ior: spec.ior ?? 2.42, dispersion: rough ? 0.004 : spec.disp ?? 0.02,
      bounces: spec.look === 'diamond' ? 5 : 4,
      glow: spec.glow ? 0.18 : 0, vertexColors: !!spec.bicolor,
      ...(style === 'photo'
        // Foto-Look: satte Farbe, harte weiße Lichtreflexe, kein Holo-Film
        ? rough ? { body: 0.07, holo: 0, contrast: 0.5, exposure: 1.35 } : photoLook(spec.c, lum)
        : { body: spec.c === '#ffffff' ? 0.06 : 0.16, holo: spec.c === '#ffffff' ? 0.75 : 0.4, exposure: 1.05 + Math.max(0, 0.5 - lum) * 1.2 }),
    });
    return { outer, inner: null, disposables };
  }

  if (spec.cut !== 'cabochon') {
    // Ersatz ohne Würfel-Umgebung: farbiger, durchscheinender Stein mit getönten Innenreflexen
    const outer = new THREE.MeshPhysicalMaterial({
      color: spec.bicolor ? 0xffffff : spec.c, vertexColors: !!spec.bicolor,
      metalness: 0.55, roughness: 0.03, flatShading: true, transparent: true, opacity: 0.88,
      clearcoat: 1, clearcoatRoughness: 0, iridescence: 0.18, iridescenceIOR: 1.6, envMapIntensity: 1.35,
      emissive: spec.glow ? spec.c : 0x000000, emissiveIntensity: spec.glow ? 0.45 : 0,
    });
    const inner = new THREE.MeshPhysicalMaterial({
      color: darker(spec.c, 0.6), metalness: 1, roughness: 0.05, side: THREE.BackSide, flatShading: true, envMapIntensity: 1.1,
    });
    return { outer, inner, disposables };
  }

  // Cabochons: wenig Umgebungsspiegelung, sonst überstrahlt der Glanz das Muster
  const base = style === 'photo'
    // polierte Oberfläche wie bei Trommelsteinen: klare Glanzlichter, Muster bleibt sichtbar
    ? { roughness: 0.5, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.3 }
    : { roughness: 0.55, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.05, envMapIntensity: 0.22 };
  let outer;
  switch (spec.look) {
    case 'opaque':
      outer = new THREE.MeshPhysicalMaterial({ ...base, map: tex(spec.pattern) });
      break;
    case 'opal': {
      const map = tex('opal');
      outer = new THREE.MeshPhysicalMaterial({
        ...base, map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.28,
        iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 1100],
      });
      break;
    }
    case 'labra': {
      const map = tex('labra');
      outer = new THREE.MeshPhysicalMaterial({
        ...base, map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.95,
        iridescence: 0.25, iridescenceIOR: 2, iridescenceThicknessRange: [300, 1300],
      });
      break;
    }
    case 'moon':
      outer = new THREE.MeshPhysicalMaterial({
        ...base, color: spec.c, transparent: true, opacity: 0.92, sheen: 0.5, sheenColor: new THREE.Color('#9cc4ff'),
        sheenRoughness: 0.3, emissive: new THREE.Color('#7fa6ff'), emissiveIntensity: 0.12, iridescence: 0.35,
      });
      break;
    case 'star': {
      const star = asterismTexture();
      disposables.push(star);
      outer = new THREE.MeshPhysicalMaterial({
        ...base, map: tex('silk'), emissiveMap: star, emissive: 0xffffff, emissiveIntensity: 0.85,
      });
      break;
    }
    default: // milk: milchig-durchscheinend mit innerem Leuchten
      outer = new THREE.MeshPhysicalMaterial({
        ...base, color: spec.c, transparent: true, opacity: 0.9, sheen: 0.25, sheenColor: new THREE.Color('#ffffff'),
        emissive: spec.c, emissiveIntensity: 0.06,
      });
  }
  return { outer, inner: null, disposables };
}

// Bicolor: Farbe wechselt von einer Seite zur anderen
function paintBicolor(geo, c1, c2) {
  const a = new THREE.Color(c1), b = new THREE.Color(c2), tmp = new THREE.Color();
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.smoothstep((pos.getX(i) - min.x) / (max.x - min.x), 0.35, 0.65);
    tmp.copy(a).lerp(b, t).toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ---- Edelstein-Objekt ----------------------------------------------------------------------

export function gemObject(spec, { envCube = null, style = 'holo' } = {}) {
  const group = new THREE.Group();
  const geo = cutGeometry(spec);
  if (spec.bicolor) paintBicolor(geo, spec.c, spec.c2);
  const { outer, inner, disposables } = buildMaterials(spec, geo, envCube, style);
  const main = new THREE.Mesh(geo, outer);
  let innerMesh = null;
  if (inner) {
    innerMesh = new THREE.Mesh(geo, inner);
    innerMesh.scale.setScalar(0.985);
    group.add(innerMesh);
  }
  group.add(main);

  // Rutilquarz: goldene Nadeln im Stein
  if (spec.name === 'Rutilquarz') {
    const rnd = seeded('rutil');
    const v = [];
    for (let i = 0; i < 18; i++) {
      const x = (rnd() - 0.5) * 1.4, y = -0.4 + rnd() * 0.6, z = (rnd() - 0.5) * 1.2, a = rnd() * Math.PI;
      v.push(x, y, z, x + Math.cos(a) * 0.5, y + (rnd() - 0.5) * 0.2, z + Math.sin(a) * 0.5);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: spec.c2, transparent: true, opacity: 0.8 }));
    lines.renderOrder = 2;
    group.add(lines);
    disposables.push(lg, lines.material);
  }

  // Lichtblitze: facettierte Steine funkeln mehr als Cabochons
  const sparkles = new THREE.Group();
  group.add(sparkles);
  // im Foto-Modus ist die Kamera näher dran: kleinere, feinere Lichtblitze
  const sparkleSize = style === 'photo' ? 0.4 : 1;
  const count = spec.cut === 'cabochon' ? 2 : 3 + (spec.level ?? 2) * 2 + (spec.legend ? 4 : 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, (i * 7919) % pos.count);
    if (v.y < -0.05) v.set(v.x * 0.6, 0.2, v.z * 0.6);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: starTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0,
    }));
    if (i % 3 === 2) sp.material.color.set(spec.c === '#ffffff' ? ['#ff9ae6', '#9ae8ff', '#fff29a'][i % 3] : spec.c);
    sp.position.copy(v).multiplyScalar(1.04);
    sp.userData = { phase: (i * 1.618) % 1, speed: 0.35 + ((i * 0.37) % 0.5) };
    sparkles.add(sp);
  }

  // Mystery: schwarzer Stein mit leuchtenden Kanten
  const edgeMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, spec.cut === 'cabochon' ? 30 : 1), edgeMat);
  edges.scale.setScalar(1.003);
  // Feine Silberkanten auf den Facetten (im Mystery-Modus leuchten sie in der Klassenfarbe)
  const faceted = spec.cut !== 'cabochon';
  edgeMat.color.set('#ffffff');
  const edgeOn = faceted && style !== 'photo' ? 0.22 : 0;
  edgeMat.opacity = edgeOn;
  edges.visible = edgeOn > 0;
  group.add(edges);
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.8, flatShading: true, emissiveIntensity: 0.14 });
  const colA = new THREE.Color(spec.c), colB = new THREE.Color(spec.c2 || spec.c);

  let mystery = false;
  return {
    group,
    mesh: main,
    setMystery(on, color) {
      mystery = on;
      if (color) blackMat.emissive.set(color);
      edgeMat.color.set(on && color ? color : '#ffffff');
      edgeMat.opacity = on ? 1 : edgeOn;
      edges.visible = on || edgeOn > 0;
      sparkles.visible = !on;
      main.material = on ? blackMat : outer;
      if (innerMesh) innerMesh.visible = !on;
      group.children.forEach((c) => { if (c.isLineSegments && c !== edges) c.visible = !on; });
    },
    update(t, boost = 0) {
      if (spec.shift && !mystery) {
        // Alexandrit: Farbwechsel zwischen Grün (Tageslicht) und Purpur (Kunstlicht)
        const col = colA.clone().lerp(colB, (Math.sin(t * 0.8) + 1) / 2);
        if (outer.uniforms) outer.uniforms.color.value.copy(col);
        else outer.color.copy(col);
        inner?.color.copy(col).multiplyScalar(0.6);
      }
      if (spec.look === 'moon' && !mystery) outer.emissiveIntensity = 0.08 + (Math.sin(t * 1.4) + 1) * 0.08;
      sparkles.children.forEach((sp) => {
        const ph = (t * sp.userData.speed + sp.userData.phase) % 1;
        const f = Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 14);
        sp.material.opacity = Math.min(1, f + boost * 0.6);
        sp.scale.setScalar((0.06 + f * 0.55 + boost * 0.35) * sparkleSize);
      });
    },
    dispose() {
      geo.dispose();
      edges.geometry.dispose();
      edgeMat.dispose();
      blackMat.dispose();
      outer.dispose();
      inner?.dispose();
      disposables.forEach((d) => d.dispose());
      sparkles.children.forEach((sp) => sp.material.dispose());
    },
  };
}
