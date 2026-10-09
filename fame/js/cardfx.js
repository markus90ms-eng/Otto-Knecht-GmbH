// Card-Hintergrund je Farbklasse: Samtglut + Prisma-Facetten.
//
// Unten im Card-Bild liegen Facetten wie geschliffene Flächen (hell oben, dunkel unten), darunter
// glüht die Klassenfarbe. Je höher die Klasse, desto kleiner und kontrastreicher die Facetten.
// Ab Rubellit brechen einzelne Facetten das Licht in Regenbogenfarben, bei Holo alle.
// Für die Bewegung liefert facetMask() die Form der Facetten: Über sie läuft in der App ein
// Regenbogen- und ein Lichtband, das der Neigung der Card folgt (wie bei einer Holo-Karte).

import { CLASSES } from './data.js';

export const FACET_W = 216;
export const FACET_H = 281; // Seitenverhältnis der Card (1,3)

const HOLO = ['#ff9ad5', '#9fd0ff', '#fff3a8', '#b6ffd9', '#c6b6ff'];
const RAINBOW = ['#ff6b6b', '#ffb347', '#fff275', '#7dff9a', '#6ad8ff', '#8f8bff', '#e78bff'];
const TOP = 115; // ab hier beginnen die Facetten (unter dem Stein)

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Alle Facetten einer Klasse: Dreiecke in Reihen, mit Füllfarbe und Deckkraft.
function facets(cls) {
  const k = cls / (CLASSES.length - 1);
  const holo = cls === CLASSES.length - 1;
  const base = CLASSES[cls].color;
  const color = (j) => (holo ? HOLO[j % HOLO.length] : base);
  const prism = holo ? 0.7 : cls >= 5 ? 0.06 + k * 0.15 : 0;
  const rnd = rng(7 + cls);
  const n = 4 + Math.round(k * 8);
  const w = FACET_W / n;
  const h = w * 0.86;
  const rows = Math.ceil((FACET_H - TOP) / h) + 1;
  const list = [];
  for (let y = 0; y < rows; y++) {
    for (let x = -1; x < n + 1; x++) {
      const X = x * w + (y % 2 ? w / 2 : 0);
      const Y = TOP + y * h;
      for (const pts of [[[X, Y], [X + w, Y], [X + w / 2, Y + h]], [[X + w / 2, Y + h], [X + w * 1.5, Y + h], [X + w, Y]]]) {
        const depth = (Y - TOP) / (FACET_H - TOP);
        const a = (0.05 + rnd() * (0.08 + k * 0.3)) * (holo ? 0.7 : 0.85) * (0.55 + depth * 0.6);
        let fill = color(x + y);
        if (prism && rnd() < prism) fill = RAINBOW[Math.floor(rnd() * RAINBOW.length)];
        list.push({ pts, a, fill, angle: Math.round(rnd() * 360), stroke: color(x + y) });
      }
    }
  }
  return { list, k, holo, base };
}

const poly = (pts) => pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');

// Sichtbares Muster: Samtglut von unten + schattierte Facetten (SVG im Format 216 × 281).
export function facetArt(cls, id = 'fc') {
  const { list, k, holo, base } = facets(cls);
  let defs = '';
  let body = '';
  list.forEach((f, i) => {
    const gid = `${id}${i}`;
    defs += `<linearGradient id="${gid}" gradientTransform="rotate(${f.angle} .5 .5)">`
      + `<stop offset="0" stop-color="#fff" stop-opacity="${(f.a * 1.4).toFixed(3)}"/>`
      + `<stop offset=".45" stop-color="${f.fill}" stop-opacity="${(f.a * 1.2).toFixed(3)}"/>`
      + `<stop offset="1" stop-color="#000" stop-opacity="${(f.a * 0.6).toFixed(3)}"/></linearGradient>`;
    body += `<polygon points="${poly(f.pts)}" fill="url(#${gid})" stroke="${f.stroke}" stroke-opacity="${(0.5 * (0.15 + k * 0.4)).toFixed(3)}" stroke-width=".4"/>`;
  });
  // Glut: von unten in der Klassenfarbe, bei Holo zusätzlich Regenbogen-Schein links und rechts
  const glow = `<radialGradient id="${id}g" cx=".5" cy="1.1" r=".75"><stop offset="0" stop-color="${holo ? '#ffffff' : base}" stop-opacity="${(0.2 + k * 0.5).toFixed(2)}"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>`
    + (holo ? `<radialGradient id="${id}h1" cx=".15" cy=".9" r=".5"><stop offset="0" stop-color="${HOLO[1]}" stop-opacity=".45"/><stop offset="1" stop-color="${HOLO[1]}" stop-opacity="0"/></radialGradient>`
      + `<radialGradient id="${id}h2" cx=".85" cy=".9" r=".5"><stop offset="0" stop-color="${HOLO[0]}" stop-opacity=".45"/><stop offset="1" stop-color="${HOLO[0]}" stop-opacity="0"/></radialGradient>` : '');
  const fadeTop = ((TOP / FACET_H) - 0.06).toFixed(3);
  const fadeIn = ((TOP / FACET_H) + 0.2).toFixed(3);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FACET_W} ${FACET_H}" preserveAspectRatio="none">`
    + `<defs>${glow}${defs}<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="${fadeTop}" stop-color="#fff" stop-opacity="0"/><stop offset="${fadeIn}" stop-color="#fff" stop-opacity="1"/></linearGradient>`
    + `<mask id="${id}m"><rect width="${FACET_W}" height="${FACET_H}" fill="url(#${id}f)"/></mask></defs>`
    + `<rect width="${FACET_W}" height="${FACET_H}" fill="url(#${id}g)"/>`
    + (holo ? `<rect width="${FACET_W}" height="${FACET_H}" fill="url(#${id}h1)"/><rect width="${FACET_W}" height="${FACET_H}" fill="url(#${id}h2)"/>` : '')
    + `<g mask="url(#${id}m)">${body}</g></svg>`;
}

// Form der Facetten als Maske (weiß, Deckkraft je Facette): Regenbogen und Lichtband laufen
// nur über die Facetten, nicht über den Stein oder die Schrift.
export function facetMask(cls) {
  const { list } = facets(cls);
  const fadeTop = ((TOP / FACET_H) - 0.06).toFixed(3);
  const fadeIn = ((TOP / FACET_H) + 0.2).toFixed(3);
  const body = list.map((f, i) => `<polygon points="${poly(f.pts)}" fill="#fff" fill-opacity="${Math.min(1, 0.25 + f.a * 3 + (i % 5 === 0 ? 0.25 : 0)).toFixed(3)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FACET_W} ${FACET_H}" preserveAspectRatio="none">`
    + `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="${fadeTop}" stop-color="#fff" stop-opacity="0"/><stop offset="${fadeIn}" stop-color="#fff" stop-opacity="1"/></linearGradient>`
    + `<mask id="m"><rect width="${FACET_W}" height="${FACET_H}" fill="url(#f)"/></mask></defs>`
    + `<g mask="url(#m)">${body}</g></svg>`;
}

export const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// Stärke des Holo-Schimmers je Klasse: bei Kiesel kaum, ab Rubellit deutlich, Holo voll
export function holoStrength(cls) {
  if (cls === CLASSES.length - 1) return 0.4;
  return cls >= 5 ? 0.16 + (cls - 5) * 0.05 : 0.05 + cls * 0.025;
}

// Für das Story-Bild: Muster und Maske als Bilder laden
export function facetImages(cls) {
  const load = (svg) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = svgUrl(svg);
  });
  return Promise.all([load(facetArt(cls, 'sc')), load(facetMask(cls))]).then(([art, mask]) => ({ art, mask }));
}
