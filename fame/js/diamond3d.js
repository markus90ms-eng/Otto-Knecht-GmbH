// Drehbarer 3D-Diamant (360°, per Finger/Maus drehbar) mit three.js.
// Fällt auf ein SVG zurück, wenn kein WebGL verfügbar ist.

import * as THREE from '../vendor/three.module.min.js';
import { diamondSvg } from './ui.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// Brillantschliff als Rotationskörper: Unterteil (Pavillon) -> Rundiste -> Krone -> Tafel.
function brilliantGeometry() {
  const profile = [
    [0.0, -0.92],
    [1.0, -0.02],
    [1.0, 0.04],
    [0.82, 0.24],
    [0.56, 0.38],
    [0.0, 0.38],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 16);
  geo.rotateY(Math.PI / 16);
  return geo;
}

export function createDiamond(container, opts = {}) {
  const { color = 0xeaf6ff, glow = 0.4, autoRotate = true, interactive = true, tilt = 0.32 } = opts;

  if (!webglAvailable()) {
    container.innerHTML = `<div class="diamond-fallback">${diamondSvg()}</div>`;
    const el = container.firstElementChild;
    return {
      setColor(hex) { el.style.color = '#' + hex.toString(16).padStart(6, '0'); },
      setGlow() {},
      pulse() {},
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

  const geo = brilliantGeometry();
  const back = new THREE.MeshPhongMaterial({
    color, specular: 0xffffff, shininess: 160, flatShading: true,
    side: THREE.BackSide, transparent: true, opacity: 0.85,
  });
  const front = new THREE.MeshPhongMaterial({
    color, specular: 0xffffff, shininess: 220, flatShading: true,
    side: THREE.FrontSide, transparent: true, opacity: 0.5, depthWrite: false,
  });
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 1),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }),
  );

  const gem = new THREE.Group();
  gem.add(new THREE.Mesh(geo, back), new THREE.Mesh(geo, front), edges);
  gem.rotation.x = tilt;
  scene.add(gem);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1.5, 3, 4);
  scene.add(key);

  // Farbige Lichter kreisen um den Stein und erzeugen das Funkeln.
  const sparkles = [0xff3fd8, 0x3dfa74, 0x2fe6ff].map((c) => {
    const l = new THREE.PointLight(c, 18, 12, 1.6);
    scene.add(l);
    return l;
  });

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

    pulseT = Math.max(0, pulseT - dt * 2.5);
    const s = 1 + glowLevel * 0.08 + pulseT * 0.08;
    gem.scale.setScalar(s);

    const t = now / 1000;
    sparkles.forEach((l, i) => {
      const a = t * (0.9 + i * 0.35) + (i * Math.PI * 2) / 3;
      l.position.set(Math.cos(a) * 2.6, 1.2 + Math.sin(a * 1.3) * 0.8, Math.sin(a) * 2.6);
      l.intensity = 8 + glowLevel * 30 + pulseT * 25;
    });
    back.emissive.setHex(back.color.getHex()).multiplyScalar(0.08 + glowLevel * 0.25 + pulseT * 0.2);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    canvas: renderer.domElement,
    setColor(hex) {
      back.color.setHex(hex);
      front.color.setHex(hex);
    },
    setGlow(v) { glowLevel = Math.max(0, Math.min(1, v)); },
    pulse() { pulseT = 1; },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      geo.dispose();
      back.dispose();
      front.dispose();
      edges.geometry.dispose();
      edges.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
