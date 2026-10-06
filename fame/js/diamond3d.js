// Realistischer 3D-Diamant (Brillantschliff, 57 Facetten) mit three.js.
// Spiegelungen aus einer Studio-Lichtumgebung, Regenbogen-Feuer (Iridescence) und kurze
// Lichtblitze auf den Facetten. Die Stufe (0 = lädiert … 4 = perfekt) bestimmt Schliff,
// Klarheit und Funkeln. Fällt auf ein SVG zurück, wenn kein WebGL verfügbar ist.

import * as THREE from '../vendor/three.module.min.js';
import { glassDiamond } from './ui.js';

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
export function studioEnvironment(renderer) {
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
export function brilliantGeometry({ damage = 0 } = {}) {
  const V = (r, a, y) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
  const n = 8, step = (Math.PI * 2) / n, half = step / 2;
  const rT = 0.56, yT = 0.33, yG = 0.025, yGb = -0.025, depth = 0.86;
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

// Aussehen je Stufe: trüb/angeschlagen -> klar mit viel Feuer und Funkeln.
const QUALITY = [
  { damage: 0.13, color: 0x9a9b94, rough: 0.32, iri: 0.15, env: 0.7, sparkles: 1, inner: 0x3a3b38 },
  { damage: 0.04, color: 0xc4ccd2, rough: 0.14, iri: 0.4, env: 1.0, sparkles: 3, inner: 0x4d5560 },
  { damage: 0,    color: 0xe6eef6, rough: 0.05, iri: 0.65, env: 1.25, sparkles: 6, inner: 0x60707e },
  { damage: 0,    color: 0xf4f8ff, rough: 0.02, iri: 0.85, env: 1.45, sparkles: 9, inner: 0x7a8a9c },
  { damage: 0,    color: 0xffffff, rough: 0.0,  iri: 1.0,  env: 1.7,  sparkles: 14, inner: 0x95a6ba },
];

// Diamant-Mesh mit Materialien und Funkeln – ohne Renderer, damit er in andere Szenen passt.
export function diamondObject(level = 2) {
  const group = new THREE.Group();
  // Innenseite: spiegelt die Rückseiten und wirkt wie Licht, das im Stein hin- und herläuft.
  const inner = new THREE.MeshPhysicalMaterial({
    metalness: 1, roughness: 0.05, side: THREE.BackSide, flatShading: true, envMapIntensity: 1.2,
  });
  const outer = new THREE.MeshPhysicalMaterial({
    metalness: 0.9, flatShading: true, transparent: true, opacity: 0.9,
    iridescenceIOR: 1.8, iridescenceThicknessRange: [120, 900], clearcoat: 1, clearcoatRoughness: 0,
  });
  const innerMesh = new THREE.Mesh(undefined, inner);
  const outerMesh = new THREE.Mesh(undefined, outer);
  innerMesh.scale.setScalar(0.985);
  group.add(innerMesh, outerMesh);

  const sparkles = new THREE.Group();
  group.add(sparkles);
  const spriteMat = () => new THREE.SpriteMaterial({
    map: starTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0,
  });

  let q;
  const setLevel = (lv) => {
    q = QUALITY[Math.max(0, Math.min(QUALITY.length - 1, lv))];
    const geo = brilliantGeometry({ damage: q.damage });
    innerMesh.geometry?.dispose();
    innerMesh.geometry = geo;
    outerMesh.geometry = geo;
    outer.color.setHex(q.color);
    outer.roughness = q.rough;
    outer.iridescence = q.iri;
    outer.envMapIntensity = q.env;
    inner.color.setHex(q.inner);

    // Lichtblitze auf zufälligen Kronen-Ecken
    sparkles.children.forEach((s) => s.material.dispose());
    sparkles.clear();
    const pos = geo.attributes.position;
    for (let i = 0; i < q.sparkles; i++) {
      const idx = Math.floor(((i * 7919) % pos.count + pos.count) % pos.count);
      const v = new THREE.Vector3().fromBufferAttribute(pos, idx);
      if (v.y < -0.05) v.set(v.x * 0.6, 0.2, v.z * 0.6);
      const sp = new THREE.Sprite(spriteMat());
      // Jeder dritte Blitz in Regenbogenfarbe – das "Feuer" eines Diamanten
      if (i % 3 === 2) sp.material.color.setHex([0xff7ae0, 0x7ae8ff, 0xfff07a, 0xa8ff9a][(i / 3) % 4 | 0]);
      sp.position.copy(v).multiplyScalar(1.04);
      sp.userData.phase = (i * 1.618) % 1;
      sp.userData.speed = 0.35 + ((i * 0.37) % 0.5);
      sparkles.add(sp);
    }
  };
  setLevel(level);

  return {
    group,
    setLevel,
    get quality() { return q; },
    update(t, boost = 0) {
      sparkles.children.forEach((sp) => {
        const ph = (t * sp.userData.speed + sp.userData.phase) % 1;
        const f = Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 14);
        sp.material.opacity = Math.min(1, f + boost * 0.6);
        sp.scale.setScalar(0.06 + f * 0.6 + boost * 0.35);
      });
    },
    dispose() {
      innerMesh.geometry?.dispose();
      inner.dispose();
      outer.dispose();
      sparkles.children.forEach((s) => s.material.dispose());
    },
  };
}

// ---- Fertige Bühne mit Renderer, Drehung per Finger und Glow ------------------------------

export function createDiamond(container, opts = {}) {
  const { level = 2, glow = 0.4, autoRotate = true, interactive = true, tilt = 0.38, rim = '#ffffff' } = opts;

  if (!webglAvailable()) {
    container.innerHTML = `<div class="diamond-fallback">${glassDiamond()}</div>`;
    return { setLevel() {}, setRim() {}, setGlow() {}, pulse() {}, canvas: null, dispose() { container.innerHTML = ''; } };
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  renderer.domElement.classList.add('diamond-canvas');

  const scene = new THREE.Scene();
  const env = studioEnvironment(renderer);
  scene.environment = env;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.5, 5.4);
  camera.lookAt(0, -0.14, 0);

  const gem = diamondObject(level);
  gem.group.rotation.x = tilt;
  scene.add(gem.group);

  // Farbiges Randlicht von unten (Seltenheit) und ein Spitzlicht
  const rimLight = new THREE.PointLight(rim, 10, 10, 1.4);
  rimLight.position.set(0, -2, 1.6);
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
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging) {
      velocity *= 0.94;
      spin += velocity + (autoRotate ? dt * 0.5 : 0);
    }
    gem.group.rotation.y = spin;
    pulseT = Math.max(0, pulseT - dt * 2.2);
    gem.group.scale.setScalar(1 + glowLevel * 0.04 + pulseT * 0.1);
    gem.update(now / 1000, pulseT);
    rimLight.intensity = 4 + glowLevel * 10 + pulseT * 25;
    renderer.toneMappingExposure = 1.05 + pulseT * 0.6;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    canvas: renderer.domElement,
    setLevel: gem.setLevel,
    setRim(color) { rimLight.color.set(color); },
    setGlow(v) { glowLevel = Math.max(0, Math.min(1, v)); },
    pulse() { pulseT = 1; },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gem.dispose();
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
