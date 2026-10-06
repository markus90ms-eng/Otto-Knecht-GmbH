// 3D-Gegenstände für das Inventar (Intro): Geldbündel, Krone, Diamant-Pin, Rubin-Herz.
// Drehen sich wie die Gegenstandsansicht in einem Loot-Spiel.

import { THREE, webglAvailable, studioEnvironment, diamondObject } from './diamond3d.js';

const gold = () => new THREE.MeshPhysicalMaterial({ color: 0xffc845, metalness: 1, roughness: 0.18, clearcoat: 0.6 });

function noteTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 512, 256);
  bg.addColorStop(0, '#3f7a4c'); bg.addColorStop(0.5, '#7fb07f'); bg.addColorStop(1, '#356b43');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(220,255,220,0.35)';
  for (let i = 0; i < 40; i++) { // Guilloche-Muster
    g.beginPath();
    g.ellipse(256, 128, 60 + i * 5, 30 + i * 2.5, i * 0.08, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = '#d9f0c8'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 236);
  g.fillStyle = '#f2ffe8';
  g.font = '800 92px "Source Code Pro", monospace';
  g.fillText('100', 24, 110);
  g.textAlign = 'right'; g.fillText('€', 490, 230);
  g.font = '800 34px "Source Code Pro", monospace'; g.textAlign = 'center';
  g.fillText('FAM€', 256, 140);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cashModel() {
  const grp = new THREE.Group();
  const tex = noteTexture();
  const side = new THREE.MeshStandardMaterial({ color: 0x7d9a7f, roughness: 0.9, envMapIntensity: 0.3 });
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, envMapIntensity: 0.35 });
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.035, 1.1), [side, side, top, side, side, side]);
    m.position.y = -0.3 + i * 0.045;
    m.rotation.y = Math.sin(i * 2.3) * 0.06;
    m.position.x = Math.sin(i * 1.7) * 0.03;
    grp.add(m);
  }
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 1.14), new THREE.MeshPhysicalMaterial({ color: 0xc8102e, roughness: 0.35, clearcoat: 0.5 }));
  band.position.y = -0.1;
  grp.add(band);
  const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 48);
  [[-1.25, -0.3, 0.55, 0.15], [1.3, -0.3, 0.45, -0.25], [1.0, 0.0, 0.85, 1.1]].forEach(([x, y, z, r]) => {
    const coin = new THREE.Mesh(coinGeo, gold());
    coin.position.set(x, y, z);
    coin.rotation.set(r, 0, r * 0.6);
    grp.add(coin);
  });
  grp.rotation.x = 0.85;
  grp.scale.setScalar(0.95);
  return grp;
}

function crownModel() {
  const grp = new THREE.Group();
  const mat = gold();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.82, 0.55, 48, 1, true), mat);
  mat.side = THREE.DoubleSide;
  grp.add(ring);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.06, 12, 48), mat);
  rim.rotation.x = Math.PI / 2; rim.position.y = -0.27;
  grp.add(rim);
  const gemCols = [0xff1744, 0x2979ff, 0x00e676, 0xd500f9, 0xffea00];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.75, 4), mat);
    spike.position.set(Math.cos(a) * 0.86, 0.6, Math.sin(a) * 0.86);
    grp.add(spike);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), mat);
    ball.position.set(Math.cos(a) * 0.86, 1.02, Math.sin(a) * 0.86);
    grp.add(ball);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), new THREE.MeshPhysicalMaterial({
      color: gemCols[i], metalness: 0.4, roughness: 0.05, clearcoat: 1, flatShading: true, emissive: gemCols[i], emissiveIntensity: 0.25,
    }));
    gem.position.set(Math.cos(a + 0.63) * 0.92, 0, Math.sin(a + 0.63) * 0.92);
    gem.scale.set(1, 1.3, 0.6);
    gem.lookAt(0, 0, 0);
    grp.add(gem);
  }
  grp.position.y = -0.25;
  grp.rotation.x = 0.28;
  return grp;
}

function pinModel() {
  const grp = new THREE.Group();
  const dia = diamondObject(3);
  dia.group.scale.setScalar(0.85);
  dia.group.rotation.x = -(Math.PI / 2) + 0.15; // Tafel zeigt nach vorn, wie bei einer Anstecknadel
  grp.add(dia.group);
  const mat = gold();
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.07, 12, 48), mat);
  bezel.rotation.x = 0.15;
  grp.add(bezel);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const prong = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), mat);
    prong.position.set(Math.cos(a) * 0.86, Math.sin(a) * 0.86, 0.12);
    grp.add(prong);
  }
  grp.userData.update = (t) => dia.update(t);
  grp.userData.dispose = () => dia.dispose();
  return grp;
}

function heartModel() {
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(-0.15, -0.75, -1.15, -0.25, -1.1, 0.35);
  s.bezierCurveTo(-1.05, 0.95, -0.25, 1.1, 0, 0.55);
  s.bezierCurveTo(0.25, 1.1, 1.05, 0.95, 1.1, 0.35);
  s.bezierCurveTo(1.15, -0.25, 0.15, -0.75, 0, -1);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.28, bevelSize: 0.2, bevelSegments: 2, curveSegments: 7 });
  geo.center();
  const ruby = new THREE.MeshPhysicalMaterial({
    color: 0xff1a4a, metalness: 0.35, roughness: 0.05, clearcoat: 1, flatShading: true,
    emissive: 0x5a0012, emissiveIntensity: 0.6, iridescence: 0.3,
  });
  const heart = new THREE.Mesh(geo, ruby);
  heart.scale.setScalar(0.82);
  const grp = new THREE.Group();
  grp.add(heart);
  return grp;
}

const MODELS = { cash: cashModel, crown: crownModel, pin: pinModel, heart: heartModel };

export function createItemShowcase(container) {
  if (!webglAvailable()) return { show() {}, dispose() {} };
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.classList.add('diamond-canvas');

  const scene = new THREE.Scene();
  const env = studioEnvironment(renderer);
  scene.environment = env;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.6, 5.2);
  camera.lookAt(0, 0, 0);
  const rim = new THREE.PointLight(0xffffff, 18, 10, 1.4);
  rim.position.set(0, -1.8, 1.8);
  scene.add(rim, new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 4);
  scene.add(key);

  let current = null;
  let popT = 0;
  const holder = new THREE.Group();
  scene.add(holder);

  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let raf = 0;
  const frame = (now) => {
    const t = now / 1000;
    popT = Math.min(1, popT + 0.04);
    const e = 1 - Math.pow(1 - popT, 3);
    holder.scale.setScalar(0.4 + e * 0.6 + Math.sin(popT * Math.PI) * 0.12);
    holder.rotation.y = t * 0.7;
    holder.position.y = Math.sin(t * 1.6) * 0.06;
    current?.userData.update?.(t);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const disposeCurrent = () => {
    if (!current) return;
    current.userData.dispose?.();
    current.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    holder.remove(current);
  };

  return {
    show(key, color = '#ffffff') {
      disposeCurrent();
      current = MODELS[key]();
      holder.add(current);
      rim.color.set(color);
      popT = 0;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposeCurrent();
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
