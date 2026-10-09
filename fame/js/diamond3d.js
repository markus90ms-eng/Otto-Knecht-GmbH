// Realistischer 3D-Diamant (Brillantschliff, 57 Facetten) mit three.js.
// Spiegelungen aus einer Studio-Lichtumgebung, Regenbogen-Feuer (Iridescence) und kurze
// Lichtblitze auf den Facetten. Die Stufe (0 = lädiert … 4 = perfekt) bestimmt Schliff,
// Klarheit und Funkeln. Fällt auf ein SVG zurück, wenn kein WebGL verfügbar ist.

import * as THREE from '../vendor/three.module.min.js';
import { glassDiamond } from './ui.js';
import { gemObject } from './gem3d.js';
import { cubeFromScene } from './refraction.js';

// Der klassische Diamant, wenn kein bestimmter Stein angegeben ist (Intro, Login, Silhouette).
const DIAMOND = { name: 'Diamant', c: '#ffffff', cut: 'brilliant', look: 'diamond', ior: 2.42, disp: 0.024, level: 4 };

export { THREE };

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// ---- Geteilte Bausteine (auch für die 3D-Gegenstände im Inventar) ------------------------

// Studio mit hellen Lichtleisten auf schwarzem Grund: erzeugt die typischen
// Schwarz-Weiß-Reflexe eines Brillanten.
export function studioScene() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x16161a, side: THREE.BackSide })));
  const panel = (w, h, pos, color, k) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(6, 6, [0, 5.5, 0], 0xffffff, 4);                 // große Softbox oben
  for (let i = 0; i < 14; i++) {                          // Lichtleisten rundherum, oben und unten
    const a = (i / 14) * Math.PI * 2;
    const up = i % 2 === 0;
    panel(0.6 + (i % 3) * 0.35, 3, [Math.cos(a) * 5, up ? 3 : -1.5, Math.sin(a) * 5], 0xffffff, 3 + (i % 4) * 1.5);
  }
  panel(7, 3, [0, 3.5, -5], 0xffffff, 3.5);               // Licht hinten oben (spiegelt sich in der Tafel)
  panel(5, 1.2, [0, 0.5, 5.5], 0xffffff, 2);              // Streiflicht von vorn
  // Regenbogen-Punkte rundherum für das "Feuer" (Dispersion)
  [0xff3b3b, 0xff9d2e, 0xfff23a, 0x46ff6a, 0x35d4ff, 0x5b6bff, 0xd04bff, 0xff4fd8].forEach((c, i) => {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    panel(1.1, 1.1, [Math.cos(a) * 4.8, i % 2 ? 0.4 : 2.2, Math.sin(a) * 4.8], c, 5);
  });
  return s;
}

// Helle Holo-Umgebung für die Lichtbrechung: weiß-lavendel oben, zartes Cyan/Rosa am Horizont,
// tiefes Indigo unten, dazu pastellige Lichtflächen. Ergibt den gläsernen, schimmernden Look.
export function holoScene() {
  const s = new THREE.Scene();
  const sky = new THREE.SphereGeometry(10, 48, 32);
  const top = new THREE.Color('#f6f3ff'), mid = new THREE.Color('#bfe4ff'), pink = new THREE.Color('#ffd1ec'),
    low = new THREE.Color('#5a4fd6'), bottom = new THREE.Color('#1a1d5a');
  const pos = sky.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10, x = pos.getX(i) / 10;
    if (y > 0.35) c.copy(mid).lerp(top, (y - 0.35) / 0.65);
    else if (y > -0.05) c.copy(pink).lerp(mid, (y + 0.05) / 0.4).lerp(pink, Math.max(0, x) * 0.4);
    else if (y > -0.5) c.copy(low).lerp(pink, (y + 0.5) / 0.45);
    else c.copy(bottom).lerp(low, (y + 1) / 0.5);
    c.toArray(cols, i * 3);
  }
  sky.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  s.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, p, color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...p);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(5, 5, [0, 6, 0], '#ffffff', 2.4);
  ['#ffb3e6', '#b3ffe0', '#c9b3ff', '#ffe2b3', '#9fc4ff', '#ffffff', '#ffc6f0', '#a8fff5'].forEach((col, i) => {
    const a = (i / 8) * Math.PI * 2;
    panel(1.6, 2.6, [Math.cos(a) * 6, i % 2 ? 1.5 : -0.5, Math.sin(a) * 6], col, i === 5 ? 2.6 : 1.7);
  });
  return s;
}

// Fotostudio für die Lichtbrechung: fast schwarzer Raum mit wenigen, sehr hellen Softboxen.
// Ergibt satte Farben mit harten weißen Lichtkanten, wie auf Edelstein-Fotos.
export function photoScene() {
  const s = new THREE.Scene();
  // Raum: Wände mit weichen Lichtstreifen unterschiedlicher Helligkeit, oben dunkel, unten warm.
  // So sieht man durch die Tafel immer ein Muster aus hellen und dunklen Feldern (Kaleidoskop)
  // statt einer flachen Fläche.
  const wall = document.createElement('canvas');
  wall.width = 512;
  wall.height = 256;
  const g = wall.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#0b0b0e');
  grd.addColorStop(0.55, '#1c1a1a');
  grd.addColorStop(1, '#3a332c');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 256);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.filter = 'blur(3px)';
  for (let i = 0; i < 22; i++) {
    const x = rnd() * 512, w = 6 + rnd() * 26, v = Math.round(60 + rnd() * 170);
    g.fillStyle = `rgb(${v},${Math.round(v * 0.96)},${Math.round(v * 0.9)})`;
    g.fillRect(x, 20 + rnd() * 60, w, 90 + rnd() * 140);
  }
  for (let i = 0; i < 6; i++) {
    const v = Math.round(40 + rnd() * 90);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, 150 + rnd() * 90, 512, 3 + rnd() * 6);
  }
  const wallTex = new THREE.CanvasTexture(wall);
  wallTex.colorSpace = THREE.SRGBColorSpace;
  s.add(new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14), new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide })));
  const panel = (w, h, p, color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...p);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  // Softbox oben als Raster mit Lücken: ergibt feine helle und dunkle Felder in der Tafel
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) panel(1.4, 1.7, [-1.6 + i * 1.6, 6, -1.9 + j * 1.9], '#ffffff', 5 + ((i + j) % 2) * 2);
  panel(9, 2.2, [0, 2.2, -6], '#fff1dc', 6);      // breites, warmes Licht hinten
  panel(1.2, 5, [-5.5, 1.5, 1.5], '#ffffff', 5);  // Striplights links und rechts
  panel(1.2, 5, [5.5, 1.5, 1.5], '#ffffff', 5);
  panel(3, 1, [0, 1.2, 6], '#ffffff', 2.5);       // Aufheller von vorn
  // beleuchteter Tisch unter dem Stein: sein Licht fällt durch die Tafel zurück (gläserne Steine wirken klar)
  panel(14, 14, [0, -6.5, 0], '#cfc2ae', 1.1);
  // Lichtstreifen auf dem Tisch hinter dem Stein: geben der Tafel Struktur statt einer flachen Fläche
  for (let i = 0; i < 6; i++) panel(0.9, 4.5, [-5 + i * 2, -1.8, -6.5], '#d8c6a8', 0.6 + (i % 3) * 0.35);
  // Raumlicht rundherum als schmale Streifen unterschiedlicher Helligkeit: viele feine Reflexe
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.1;
    panel(0.55, 3.2, [Math.cos(a) * 6.4, i % 2 ? 0.4 : -1.4, Math.sin(a) * 6.4], '#f2ece2', [0.35, 1.6, 0.8, 2.4][i % 4]);
  }
  panel(6, 1.6, [0, -2.5, 5.5], '#ffffff', 3);       // Lichtkante vorne unten: Licht fällt durch den Stein zurück
  // zarte farbige Lichter für das Feuer – pastellig, damit keine grellen Farbflecken entstehen
  ['#ffb3b3', '#ffd9a8', '#fff3b0', '#c4ffcf', '#b5ecff', '#cfc6ff'].forEach((c, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    panel(0.4, 0.4, [Math.cos(a) * 5.6, 2.8, Math.sin(a) * 5.6], c, 3.5);
  });
  return s;
}

export function studioEnvironment(renderer, s = studioScene()) {
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.015).texture;
  pm.dispose();
  return tex;
}

// Sternförmiger Lichtblitz als Textur (für Sprites).
let starTex;
export function starTexture() {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.35, 'rgba(200,230,255,0.15)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[128, 5], [5, 128]]) {
    const lg = g.createLinearGradient(w > h ? 0 : 64, w > h ? 64 : 0, w > h ? 128 : 64, w > h ? 64 : 128);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(64 - w / 2, 64 - h / 2, w, h);
  }
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}

// Dreiecke so ausrichten, dass die Normale vom Mittelpunkt weg zeigt (für konvexe Körper).
export function facetGeometry(tris, center = new THREE.Vector3()) {
  const pos = [];
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < tris.length; i += 3) {
    let [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    m.copy(a).add(b).add(c).divideScalar(3).sub(center);
    if (n.dot(m) < 0) [b, c] = [c, b];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// Runder Brillant: Tafel, 8 Sterne, 8 Hauptfacetten, 16 obere und 16 untere Rundistenfacetten,
// 8 Pavillonfacetten. Maße nach Tolkowsky (Tafel 56 %, Kronenwinkel ~34°, Pavillon ~41°).
// depth: Tiefe des Pavillons (Unterteil). Steine mit geringerer Brechzahl brauchen einen tieferen
// Pavillon, sonst fällt das Licht unten durch und die Tafel wirkt leer.
export function brilliantGeometry({ damage = 0, depth = 0.86 } = {}) {
  const V = (r, a, y) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
  const n = 8, step = (Math.PI * 2) / n, half = step / 2;
  const rT = 0.56, yT = 0.33, yG = 0.025, yGb = -0.025;
  const rS = 0.78, yS = yG + ((1 - rS) / (1 - rT)) * (yT - yG) * 1.08;
  const rL = 0.2, yL = yGb - (1 - rL) * depth;
  const culet = new THREE.Vector3(0, yGb - depth, 0);
  const tableC = new THREE.Vector3(0, yT, 0);

  const T = [], S = [], G = [], H = [], Gb = [], Hb = [], L = [];
  for (let k = 0; k < n; k++) {
    const a = k * step;
    T.push(V(rT, a + half, yT));
    S.push(V(rS, a, yS));
    G.push(V(1, a, yG));
    H.push(V(1, a + half, yG));
    Gb.push(V(1, a, yGb));
    Hb.push(V(1, a + half, yGb));
    L.push(V(rL, a + half, yL));
  }
  const nx = (k) => (k + 1) % n, pv = (k) => (k + n - 1) % n;
  const t = [];
  const tri = (a, b, c) => t.push(a, b, c);
  for (let k = 0; k < n; k++) {
    tri(tableC, T[k], T[nx(k)]);                                 // Tafel
    tri(T[pv(k)], T[k], S[k]);                                   // Stern
    tri(T[k], S[k], H[k]); tri(T[k], H[k], S[nx(k)]);            // Hauptfacette (Drachen)
    tri(S[k], G[k], H[k]); tri(S[nx(k)], H[k], G[nx(k)]);        // obere Rundistenfacetten
    tri(G[k], H[k], Gb[k]); tri(H[k], Hb[k], Gb[k]);             // Rundiste
    tri(H[k], G[nx(k)], Hb[k]); tri(G[nx(k)], Gb[nx(k)], Hb[k]);
    tri(Gb[k], Hb[k], L[k]); tri(Hb[k], Gb[nx(k)], L[k]);        // untere Rundistenfacetten
    tri(Gb[k], L[pv(k)], culet); tri(Gb[k], culet, L[k]);        // Pavillon
  }
  // T, S und Stern-Geometrie: Tafelecken liegen auf den Halbwinkeln, daher Stern zwischen T[k-1] und T[k].

  if (damage) {
    // Abgeplatzte Ecken: gleiche Position -> gleicher Versatz, damit die Facetten zusammenhängen.
    const seen = new Map();
    for (const v of t) {
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      if (!seen.has(key)) {
        const r = Math.abs(Math.sin((v.x * 97 + v.y * 89 + v.z * 83) * 12.9898) * 43758.5453) % 1;
        const k = 1 - damage * (r > 0.5 ? r : r * 0.3);
        seen.set(key, new THREE.Vector3(v.x * k, v.y + (r - 0.5) * damage * 0.35, v.z * k));
      }
    }
    for (let i = 0; i < t.length; i++) {
      const v = t[i];
      t[i] = seen.get(`${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`);
    }
  }
  return facetGeometry(t, new THREE.Vector3(0, -0.2, 0));
}

// ---- Fotostudio: Stein liegt auf einem dunklen Tisch ----------------------------------------
// Wie ein Produktfoto: flacher Blick, Lichtkegel hinter dem Stein, Spiegelung im Tisch,
// farbiger Lichtfleck vor dem Stein und unscharfe Lichter (Bokeh) im Hintergrund.

const FLOOR_Y = -0.62;
const FOG = '#0d0c10';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function backdropTexture(color) {
  return canvasTex(512, 1024, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#050506');
    bg.addColorStop(0.62, FOG);
    bg.addColorStop(1, FOG);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // Bokeh: weiche Lichtkreise in Steinfarbe und Weiß
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.filter = 'blur(14px)';
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const x = rnd() * w, y = h * (0.06 + rnd() * 0.26), r = 16 + rnd() * 46;
      const col = new THREE.Color(i % 4 === 0 ? '#fff4e0' : color).multiplyScalar((i % 4 === 0 ? 0.12 : 0.22) + rnd() * 0.3);
      g.fillStyle = `#${col.getHexString()}`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function floorTexture(color) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const cx = w / 2, cy = h / 2, u = w / 16; // 1 Einheit = 64 px
    g.fillStyle = '#17151a';
    g.fillRect(0, 0, w, h);
    // feine Körnung des Tischs
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 14 + (Math.random() > 0.999 ? 40 : 0);
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    const blob = (x, y, rx, ry, stops) => {
      g.save();
      g.translate(x, y);
      g.scale(rx / ry, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry);
      stops.forEach(([o, c]) => gr.addColorStop(o, c));
      g.fillStyle = gr;
      g.fillRect(-ry, -ry, ry * 2, ry * 2);
      g.restore();
    };
    // warmer Lichtkegel hinter dem Stein
    g.globalCompositeOperation = 'screen';
    blob(cx + u * 0.6, cy - u * 0.9, u * 4.6, u * 2.6, [[0, 'rgba(255,214,150,0.85)'], [0.45, 'rgba(220,165,100,0.32)'], [1, 'rgba(0,0,0,0)']]);
    // farbiges Licht, das durch den Stein fällt
    const col = new THREE.Color(color);
    const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
    blob(cx - u * 0.2, cy + u * 1.2, u * 2.2, u * 1.1, [[0, `rgba(${rgb},0.55)`], [0.6, `rgba(${rgb},0.12)`], [1, 'rgba(0,0,0,0)']]);
    // Kontaktschatten direkt unter dem Stein
    g.globalCompositeOperation = 'multiply';
    blob(cx, cy, u * 1.25, u * 0.75, [[0, 'rgba(0,0,0,0.85)'], [0.7, 'rgba(0,0,0,0.25)'], [1, 'rgba(255,255,255,1)']]);
    // zum Rand hin dunkler
    g.globalCompositeOperation = 'source-over';
    const v = g.createRadialGradient(cx, cy, u * 2, cx, cy, w * 0.5);
    v.addColorStop(0.3, 'rgba(13,12,16,0)');
    v.addColorStop(1, 'rgba(13,12,16,1)');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  });
}

// ---- Fertige Bühne mit Renderer, Drehung per Finger und Glow ------------------------------

export function createDiamond(container, opts = {}) {
  const { level = 2, glow = 0.4, autoRotate = true, interactive = true, rim = '#ffffff', mystery = false, photo = false, bare = false } = opts;
  // opts.bare (mit photo): nur der Stein im Foto-Licht, ohne Tisch, Hintergrund und Spiegelbild (z. B. fürs Profilbild-Abzeichen)
  const tilt = opts.tilt ?? (photo ? 0.62 : 0.2);
  // opts.gem: ein Edelstein aus data.js (TIERS). Ohne Angabe zeigt die Bühne den Diamanten.
  // opts.photo: Stein liegt wie auf einem Produktfoto auf einem dunklen Tisch.

  if (!webglAvailable()) {
    container.innerHTML = `<div class="diamond-fallback">${glassDiamond()}</div>`;
    return { setLevel() {}, setGem() {}, setMystery() {}, setRim() {}, setGlow() {}, pulse() {}, snapshot() { return null; }, canvas: null, dispose() { container.innerHTML = ''; } };
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  renderer.domElement.classList.add('diamond-canvas');

  const scene = new THREE.Scene();
  const env = studioEnvironment(renderer, photo ? photoScene() : studioScene());
  scene.environment = env;
  // Würfel-Umgebung für die Lichtbrechung in facettierten Steinen
  let envCube = null;
  try { envCube = cubeFromScene(renderer, photo ? photoScene() : holoScene(), 256); } catch { /* Ersatzmaterial */ }
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  // Foto-Modus: Kamera so weit weg, dass der Stein etwa 4/5 der Bildbreite füllt
  let gemWidth = 2.6, gemHeight = 1.2;
  const fitCamera = () => {
    if (!photo) return;
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max((gemWidth / 2) / (0.8 * half * camera.aspect), 1.2 / (0.55 * half), gemHeight / (1.3 * half), 3.6);
    camera.position.set(0, FLOOR_Y + 0.5 + dist * 0.14, dist);
    camera.lookAt(0, FLOOR_Y + 0.85, 0);
  };
  if (photo) {
    fitCamera();
  } else {
    camera.position.set(0, 0.5, 5.4);
    camera.lookAt(0, -0.14, 0);
  }

  // Tisch, Hintergrund und Spiegelbild (nur im Foto-Modus)
  const stageTex = [];
  let floor = null, mirror = null, mHolder = null, reflection = null;
  const setStage = (color) => {
    if (!photo || bare) return;
    stageTex.forEach((t) => t.dispose());
    stageTex.length = 0;
    const bgTex = backdropTexture(color), flTex = floorTexture(color);
    stageTex.push(bgTex, flTex);
    scene.background = bgTex;
    if (!floor) {
      floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.87, depthWrite: true }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = FLOOR_Y;
      scene.add(floor);
    }
    floor.material.map = flTex;
    floor.material.needsUpdate = true;
  };
  if (photo && !bare) {
    scene.fog = new THREE.Fog(FOG, 7, 16);
    mirror = new THREE.Group();
    mirror.scale.y = -1;
    mirror.position.y = 2 * FLOOR_Y;
    mHolder = new THREE.Group();
    mirror.add(mHolder);
    scene.add(mirror);
  }

  // Halter für den Stein: kippen, drehen, pulsieren. Der Stein darin lässt sich austauschen.
  const holder = new THREE.Group();
  holder.rotation.x = tilt;
  scene.add(holder);
  let gem = null;
  let mysteryOn = mystery;
  let mysteryColor = rim;
  const style = photo ? 'photo' : 'holo';
  const setGem = (spec) => {
    if (gem) { holder.remove(gem.group); gem.dispose(); }
    gem = gemObject(spec || DIAMOND, { envCube: envCube?.texture, style });
    holder.add(gem.group);
    if (mysteryOn) gem.setMystery(true, mysteryColor);
    if (photo) {
      // Lange Formen (Tropfen, Marquise) von schräg oben zeigen, damit ihre Form erkennbar ist
      if (opts.tilt == null) holder.rotation.x = ['pear', 'marquise'].includes((spec || DIAMOND).cut) ? 1.05 : tilt;
      if (mHolder) {
        if (reflection) { mHolder.remove(reflection.group); reflection.dispose(); }
        reflection = gemObject(spec || DIAMOND, { envCube: envCube?.texture, style });
        mHolder.add(reflection.group);
        if (mysteryOn) reflection.setMystery(true, mysteryColor);
      }
      setStage(mysteryOn ? mysteryColor : (spec || DIAMOND).c);
      // Breite des Steins (auch beim Wiegen) für den Bildausschnitt
      gem.mesh.geometry.computeBoundingBox();
      const bb = gem.mesh.geometry.boundingBox;
      gemWidth = Math.max(bb.max.x - bb.min.x, (bb.max.z - bb.min.z) * 0.8);
      gemHeight = bb.max.y - bb.min.y;
      fitCamera();
    }
  };
  setGem(opts.gem);

  // Farbiges Randlicht von unten (Seltenheit) und ein Spitzlicht
  const rimLight = new THREE.PointLight(rim, 10, 10, 1.4);
  if (photo) rimLight.position.set(0.8, 1.2, -2.5);
  else rimLight.position.set(0, -2, 1.6);
  scene.add(rimLight);
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(1.5, 3, 4);
  scene.add(key);

  let spin = 0, velocity = 0, dragging = false, lastX = 0, glowLevel = glow, pulseT = 0;
  const onDown = (e) => { dragging = true; lastX = e.clientX; velocity = 0; renderer.domElement.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    velocity = dx * 0.012;
    spin += velocity;
  };
  const onUp = () => { dragging = false; };
  if (interactive) {
    const el = renderer.domElement;
    el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCamera();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // Stein so anheben, dass er mit seinem tiefsten Punkt auf dem Tisch aufliegt; Spiegelbild folgt
  const box = new THREE.Box3();
  const placeOnFloor = (now) => {
    holder.updateMatrixWorld(true);
    box.setFromObject(gem.mesh, true);
    holder.position.y += FLOOR_Y - box.min.y;
    if (!mHolder) return;
    mHolder.position.copy(holder.position);
    mHolder.rotation.copy(holder.rotation);
    mHolder.scale.copy(holder.scale);
    reflection.update(now / 1000, pulseT);
  };

  let raf = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging) {
      velocity *= 0.94;
      spin += velocity + (autoRotate && !photo ? dt * 0.5 : 0);
    }
    // Foto-Modus: der Stein liegt und wiegt sich nur leicht im Licht
    holder.rotation.y = spin + (photo && autoRotate ? Math.sin(now / 1000 * 0.45) * 0.45 : 0);
    pulseT = Math.max(0, pulseT - dt * 2.2);
    holder.scale.setScalar(1 + glowLevel * 0.04 + pulseT * 0.1);
    gem.update(now / 1000, pulseT);
    if (photo) placeOnFloor(now);
    rimLight.intensity = 4 + glowLevel * 10 + pulseT * 25;
    renderer.toneMappingExposure = (photo ? 1.3 : 1.05) + pulseT * 0.6;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    canvas: renderer.domElement,
    setLevel(lv) { gem.setLevel?.(lv); },
    setGem,
    setMystery(on, color) {
      mysteryOn = on;
      if (color) mysteryColor = color;
      gem.setMystery(on, mysteryColor);
      reflection?.setMystery(on, mysteryColor);
    },
    setRim(color) { rimLight.color.set(color); },
    setGlow(v) { glowLevel = Math.max(0, Math.min(1, v)); },
    pulse() { pulseT = 1; },
    // Scharfes Standbild in beliebiger Größe (für Story- und Sharing-Bilder).
    snapshot(w, h) {
      const pr = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fitCamera();
      gem.update(performance.now() / 1000, 0.35);
      if (photo) placeOnFloor(performance.now());
      renderer.render(scene, camera);
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      out.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h);
      renderer.setPixelRatio(pr);
      resize();
      return out;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gem.dispose();
      reflection?.dispose();
      stageTex.forEach((t) => t.dispose());
      floor?.geometry.dispose();
      floor?.material.dispose();
      env.dispose();
      envCube?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
