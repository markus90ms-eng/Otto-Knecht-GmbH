// Drehbarer 3D-Diamant (360°, per Finger/Maus drehbar) mit three.js.
// Die Qualitätsstufe (0 = lädiert … 4 = perfekt) bestimmt Schliff, Klarheit und Funkeln.
// Fällt auf ein SVG zurück, wenn kein WebGL verfügbar ist.

import * as THREE from '../vendor/three.module.min.js';
import { glassDiamond } from './ui.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// Aussehen je Stufe: Facettenzahl, Beschädigung, Farbe (trüb -> klar), Glanz, Funkeln.
const QUALITY = [
  { segments: 6,  damage: 0.16, color: 0x8e8f88, opacity: 0.9,  shininess: 20,  edges: 0.16, sparkle: 0.3 },
  { segments: 8,  damage: 0.06, color: 0xa9b2b6, opacity: 0.75, shininess: 60,  edges: 0.26, sparkle: 0.55 },
  { segments: 12, damage: 0,    color: 0xbfd2e0, opacity: 0.6,  shininess: 120, edges: 0.38, sparkle: 0.75 },
  { segments: 16, damage: 0,    color: 0xc8dcec, opacity: 0.5,  shininess: 200, edges: 0.5,  sparkle: 0.9 },
  { segments: 24, damage: 0,    color: 0xd2e6f6, opacity: 0.42, shininess: 300, edges: 0.62, sparkle: 1.05 },
];

// Brillantschliff als Rotationskörper: Pavillon -> Rundiste -> Krone -> Tafel.
function brilliantGeometry(level) {
  const q = QUALITY[level];
  const profile = [
    [0.0, -0.92],
    [1.0, -0.02],
    [1.0, 0.04],
    [0.82, 0.24],
    [0.56, 0.38],
    [0.0, 0.38],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  let geo = new THREE.LatheGeometry(profile, q.segments);
  geo.rotateY(Math.PI / q.segments);

  if (q.damage) {
    // Abgeplatzte Kanten: Punkte deterministisch nach innen drücken.
    // Gleiche Position -> gleicher Versatz, damit die Naht der Drehung geschlossen bleibt.
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (Math.hypot(v.x, v.z) < 0.05) continue;
      const key = Math.round(v.x * 97) * 31 + Math.round(v.y * 89) * 17 + Math.round(v.z * 83) * 7;
      const r = Math.abs(Math.sin(key * 12.9898) * 43758.5453) % 1;
      const k = 1 - q.damage * (r > 0.55 ? r : r * 0.3);
      pos.setXYZ(i, v.x * k, v.y + (r - 0.5) * q.damage * 0.4, v.z * k);
    }
    geo = geo.toNonIndexed();
    geo.computeVertexNormals();
  }
  return geo;
}

export function createDiamond(container, opts = {}) {
  const { level = 2, glow = 0.4, autoRotate = true, interactive = true, tilt = 0.32, rim = '#ffffff' } = opts;

  if (!webglAvailable()) {
    container.innerHTML = `<div class="diamond-fallback">${glassDiamond()}</div>`;
    return {
      setLevel() {}, setRim() {}, setGlow() {}, pulse() {},
      canvas: null,
      dispose() { container.innerHTML = ''; },
    };
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.classList.add('diamond-canvas');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.55, 5.2);
  camera.lookAt(0, -0.12, 0);

  const back = new THREE.MeshPhongMaterial({
    specular: 0xffffff, flatShading: true, side: THREE.BackSide, transparent: true, opacity: 0.7,
  });
  const front = new THREE.MeshPhongMaterial({
    specular: 0xffffff, flatShading: true, side: THREE.FrontSide, transparent: true, depthWrite: false,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true });
  const backMesh = new THREE.Mesh(undefined, back);
  const frontMesh = new THREE.Mesh(undefined, front);
  const edges = new THREE.LineSegments(undefined, edgeMat);

  const gem = new THREE.Group();
  gem.add(backMesh, frontMesh, edges);
  gem.rotation.x = tilt;
  scene.add(gem);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1.5, 3, 4);
  scene.add(key);

  // Randlicht von unten in der Farbe der Seltenheit
  const rimLight = new THREE.PointLight(rim, 14, 10, 1.4);
  rimLight.position.set(0, -2.2, 1.5);
  scene.add(rimLight);

  // Weiße und spektrale Lichter kreisen um den Stein und erzeugen das Funkeln.
  const sparkles = [0xffffff, 0x9fe8ff, 0xffe2a8, 0xffb8f0].map((c) => {
    const l = new THREE.PointLight(c, 18, 12, 1.6);
    scene.add(l);
    return l;
  });

  let q = QUALITY[level];
  const setLevel = (lv) => {
    q = QUALITY[Math.max(0, Math.min(QUALITY.length - 1, lv))];
    const geo = brilliantGeometry(QUALITY.indexOf(q));
    backMesh.geometry?.dispose();
    edges.geometry?.dispose();
    backMesh.geometry = geo;
    frontMesh.geometry = geo;
    edges.geometry = new THREE.EdgesGeometry(geo, 1);
    back.color.setHex(q.color);
    front.color.setHex(q.color);
    back.shininess = q.shininess;
    front.shininess = q.shininess * 1.4;
    front.opacity = q.opacity;
    edgeMat.opacity = q.edges;
  };
  setLevel(level);

  let spin = 0;
  let velocity = 0;
  let dragging = false;
  let lastX = 0;
  let glowLevel = glow;
  let pulseT = 0;

  const onDown = (e) => {
    dragging = true;
    lastX = e.clientX;
    velocity = 0;
    renderer.domElement.setPointerCapture?.(e.pointerId);
  };
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
      spin += velocity + (autoRotate ? dt * 0.6 : 0);
    }
    gem.rotation.y = spin;

    pulseT = Math.max(0, pulseT - dt * 2.2);
    gem.scale.setScalar(1 + glowLevel * 0.06 + pulseT * 0.12);

    const t = now / 1000;
    sparkles.forEach((l, i) => {
      const a = t * (0.9 + i * 0.35) + (i * Math.PI * 2) / sparkles.length;
      l.position.set(Math.cos(a) * 2.6, 1.2 + Math.sin(a * 1.3) * 0.8, Math.sin(a) * 2.6);
      l.intensity = (5 + glowLevel * 9) * q.sparkle + pulseT * 18;
    });
    rimLight.intensity = 5 + glowLevel * 10 + pulseT * 20;
    back.emissive.setHex(q.color).multiplyScalar(0.02 + glowLevel * 0.05 + pulseT * 0.2);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    canvas: renderer.domElement,
    setLevel,
    setRim(color) { rimLight.color.set(color); },
    setGlow(v) { glowLevel = Math.max(0, Math.min(1, v)); },
    pulse() { pulseT = 1; },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      backMesh.geometry?.dispose();
      edges.geometry?.dispose();
      back.dispose();
      front.dispose();
      edgeMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
