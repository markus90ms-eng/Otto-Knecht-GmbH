// Teilen der Fame-Card: Instagram Story, TikTok, weitere Apps, Bild speichern.
//
// Instagram "Sharing to Stories" und das TikTok "Share Kit" sind Schnittstellen für native Apps.
// Läuft Fame in der nativen Hülle (Capacitor, siehe native/), nutzen wir sie direkt über das
// Plugin "FameShare". Im Browser gehen wir über das Teilen-Menü des Handys (Web Share API),
// dort erscheinen Instagram (Story) und TikTok als Ziel. Klappt auch das nicht, wird das Bild
// gespeichert und wir sagen, wie es weitergeht.

import { LOGO_TEXT, APP_NAME } from './ui.js';

// Wohin der Link in der Story führt (Echtheits-Seite der Card). Vor dem Livegang anpassen.
export const SHARE_BASE = 'https://fame.app/card/';

const STORY_W = 1080;
const STORY_H = 1920;
const FONT = '"Source Code Pro", ui-monospace, monospace';
const font = (w, s, style = '') => `${style} ${w} ${s}px ${FONT}`;

// ---- Zeichen-Helfer ------------------------------------------------------------------

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Rahmen-Füllung je Stufe: einfarbig, gold, oder umlaufender Farbverlauf ab "Makellos".
function ringFill(g, tier, cx, cy, x, y, w, h) {
  const c = tier.rarity.color;
  if (tier.level >= 3 && g.createConicGradient) {
    const cols = tier.level === 4 ? ['#ff8a1f', '#ffe08a', '#ff3d00'] : ['#b65cff', '#ff5fd2', '#5b8cff'];
    const grd = g.createConicGradient(-Math.PI / 4, cx, cy);
    [0, 1, 2, 3, 4, 5, 6].forEach((i) => grd.addColorStop(i / 6, cols[i % 3]));
    return grd;
  }
  if (tier.level === 2) {
    const grd = g.createLinearGradient(x, y, x + w, y + h);
    ['#fff3b0', '#ffd43b', '#8a6a00', '#ffd43b', '#fff3b0'].forEach((col, i) => grd.addColorStop(i / 4, col));
    return grd;
  }
  return c;
}

function drawInstaGlyph(g, x, y, s, color) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = s * 0.1;
  roundRect(g, x, y, s, s, s * 0.3);
  g.stroke();
  g.beginPath();
  g.arc(x + s / 2, y + s / 2, s * 0.22, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.arc(x + s * 0.76, y + s * 0.24, s * 0.06, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawDiamondGlyph(g, x, y, s, line, fill) {
  // gleiche Form wie das Logo-Icon (viewBox 48x40)
  const k = s / 48;
  const P = (px, py) => [x + px * k, y + py * k];
  g.save();
  g.fillStyle = fill;
  g.beginPath();
  [[12, 4], [36, 4], [44, 14], [4, 14]].forEach(([a, b], i) => (i ? g.lineTo(...P(a, b)) : g.moveTo(...P(a, b))));
  g.closePath();
  g.fill();
  g.strokeStyle = line;
  g.lineWidth = 3.2 * k;
  g.lineJoin = 'round';
  g.beginPath();
  [[12, 4], [36, 4], [44, 14], [24, 37], [4, 14]].forEach(([a, b], i) => (i ? g.lineTo(...P(a, b)) : g.moveTo(...P(a, b))));
  g.closePath();
  g.moveTo(...P(4, 14)); g.lineTo(...P(44, 14));
  g.moveTo(...P(18, 14)); g.lineTo(...P(24, 37)); g.lineTo(...P(30, 14));
  g.stroke();
  g.restore();
}

// ---- Die Card selbst (gleicher Look wie in der App) --------------------------------------

export function drawCard(g, { x, y, w, h, tier, serial, insta, gem }) {
  const c = tier.rarity.color;
  const s = w / 300; // Maßstab bezogen auf die 300px breite Card in der App
  const r = 16 * s;
  const cx = x + w / 2, cy = y + h / 2;

  // Leuchten hinter der Card
  g.save();
  g.shadowColor = hexA(c, 0.35 + tier.level * 0.12);
  g.shadowBlur = (24 + tier.level * 14) * s;
  g.fillStyle = '#000';
  roundRect(g, x, y, w, h, r);
  g.fill();
  g.restore();

  // versetzter Schatten in der Stufenfarbe (wie die Buttons der App)
  g.save();
  g.fillStyle = hexA(c, 0.55);
  roundRect(g, x + 9 * s, y + 11 * s, w, h, r);
  g.fill();
  g.restore();

  // Rahmen
  g.fillStyle = ringFill(g, tier, cx, cy, x, y, w, h);
  roundRect(g, x, y, w, h, r);
  g.fill();

  // Innenfläche
  const b = 3.5 * s;
  const ix = x + b, iy = y + b, iw = w - 2 * b, ih = h - 2 * b;
  const bg = g.createRadialGradient(cx, iy + ih * 0.34, 10 * s, cx, iy + ih * 0.34, ih * 0.75);
  bg.addColorStop(0, hexA(c, 0.32));
  bg.addColorStop(0.55, '#121214');
  bg.addColorStop(1, '#0a0a0c');
  g.fillStyle = bg;
  roundRect(g, ix, iy, iw, ih, r - b);
  g.fill();

  // feine Doppellinie ab "Diamant"
  if (tier.level >= 2) {
    g.strokeStyle = hexA(c, 0.5);
    g.lineWidth = 1.2 * s;
    roundRect(g, ix + 6 * s, iy + 6 * s, iw - 12 * s, ih - 12 * s, r - 8 * s);
    g.stroke();
  }

  // Strahlen hinter dem Diamanten
  g.save();
  roundRect(g, ix, iy, iw, ih, r - b);
  g.clip();
  g.translate(cx, iy + ih * 0.36);
  g.globalAlpha = 0.05 + tier.level * 0.035;
  g.fillStyle = c;
  for (let i = 0; i < 20; i++) {
    g.rotate((Math.PI * 2) / 20);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-14 * s, -ih);
    g.lineTo(14 * s, -ih);
    g.fill();
  }
  g.restore();

  // Kopfzeile: Logo links, Seriennummer rechts
  const pad = 16 * s;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = font(800, 19 * s);
  g.fillStyle = '#3dfa74';
  g.fillText(LOGO_TEXT, ix + pad + 2 * s, iy + pad + 18 * s);
  g.fillStyle = '#f8f8f6';
  g.fillText(LOGO_TEXT, ix + pad, iy + pad + 16 * s);
  const lw = g.measureText(LOGO_TEXT).width;
  drawDiamondGlyph(g, ix + pad + lw + 4 * s, iy + pad + 2 * s, 18 * s, '#f8f8f6', '#3dfa74');
  g.textAlign = 'right';
  g.font = font(600, 9.5 * s);
  g.fillStyle = hexA(c, 0.95);
  g.fillText(`Nr. ${serial}`, ix + iw - pad, iy + pad + 14 * s);
  g.textAlign = 'left';

  // Diamant
  const gemY = iy + 44 * s, gemH = 230 * s;
  const glow = g.createRadialGradient(cx, gemY + gemH / 2, 0, cx, gemY + gemH / 2, gemH * 0.6);
  glow.addColorStop(0, hexA(c, 0.55));
  glow.addColorStop(1, hexA(c, 0));
  g.fillStyle = glow;
  g.fillRect(ix, gemY - 20 * s, iw, gemH + 40 * s);
  if (gem) {
    // Aufnahme ist großzügig geschnitten – größer zeichnen und auf die Innenfläche begrenzen
    const gw = iw * 1.35;
    const gh = gw * (gem.height / gem.width);
    g.save();
    roundRect(g, ix, iy, iw, ih, r - b);
    g.clip();
    g.drawImage(gem, cx - gw / 2, gemY + (gemH - gh) / 2, gw, gh);
    g.restore();
  }

  // Name, Spruch, Instagram
  g.textAlign = 'center';
  g.save();
  g.shadowColor = hexA(c, 0.7);
  g.shadowBlur = 16 * s;
  g.font = font(800, 21 * s);
  g.fillStyle = c;
  g.fillText(tier.name, cx, gemY + gemH + 30 * s);
  g.restore();
  g.font = font(500, 11.5 * s, 'italic');
  g.fillStyle = '#d9a35b';
  g.fillText(`„${tier.flavor}“`, cx, gemY + gemH + 52 * s);
  if (insta) {
    g.font = font(600, 13 * s);
    const t = `@${insta}`;
    const tw = g.measureText(t).width;
    const gs = 14 * s;
    const tx = cx - (tw + gs + 6 * s) / 2;
    drawInstaGlyph(g, tx, gemY + gemH + 66 * s, gs, '#f8f8f6');
    g.textAlign = 'left';
    g.fillStyle = '#f8f8f6';
    g.fillText(t, tx + gs + 6 * s, gemY + gemH + 78 * s);
  }
  g.textAlign = 'left';

  // diagonaler Glanz über allem
  g.save();
  roundRect(g, x, y, w, h, r);
  g.clip();
  const sheen = g.createLinearGradient(x, y, x + w, y + h);
  sheen.addColorStop(0.3, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.42, 'rgba(255,255,255,0.10)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(x, y, w, h);
  g.restore();
}

export const CARD_RATIO = 1.3; // Höhe zu Breite der Card

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts?.load(`800 40px ${FONT}`),
      document.fonts?.load(`italic 500 20px ${FONT}`),
      document.fonts?.load(`600 20px ${FONT}`),
    ]);
  } catch { /* Ersatzschrift */ }
}

// ---- Story-Bild 9:16 (Instagram Story, TikTok-Foto, Status) ----------------------------
// Oben ~14 % und unten ~20 % überdecken Instagram/TikTok mit Bedienelementen – dort steht nichts Wichtiges.

export async function renderStory(data) {
  await fontsReady();
  const { tier } = data;
  const c = tier.rarity.color;
  const cv = document.createElement('canvas');
  cv.width = STORY_W;
  cv.height = STORY_H;
  const g = cv.getContext('2d');

  // Hintergrund: oben Stufenfarbe, unten schwarz
  const bg = g.createLinearGradient(0, 0, 0, STORY_H);
  bg.addColorStop(0, hexA(c, 1));
  bg.addColorStop(0.08, '#141416');
  bg.addColorStop(1, '#070708');
  g.fillStyle = '#070708';
  g.fillRect(0, 0, STORY_W, STORY_H);
  g.globalAlpha = 0.55;
  g.fillStyle = bg;
  g.fillRect(0, 0, STORY_W, STORY_H);
  g.globalAlpha = 1;

  const cardW = 780, cardH = Math.round(780 * CARD_RATIO);
  const cardX = (STORY_W - cardW) / 2, cardY = 330;
  const ccx = STORY_W / 2, ccy = cardY + cardH * 0.4;

  // Strahlenkranz + Licht hinter der Card
  g.save();
  g.translate(ccx, ccy);
  g.globalAlpha = 0.06 + tier.level * 0.03;
  g.fillStyle = c;
  for (let i = 0; i < 28; i++) {
    g.rotate((Math.PI * 2) / 28);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-45, -1500);
    g.lineTo(45, -1500);
    g.fill();
  }
  g.restore();
  const halo = g.createRadialGradient(ccx, ccy, 50, ccx, ccy, 900);
  halo.addColorStop(0, hexA(c, 0.45));
  halo.addColorStop(1, hexA(c, 0));
  g.fillStyle = halo;
  g.fillRect(0, 0, STORY_W, STORY_H);

  // Funken
  let seed = data.serial.split('').reduce((a, ch) => a + ch.charCodeAt(0), 7);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 60 + tier.level * 20; i++) {
    const px = rnd() * STORY_W, py = 250 + rnd() * 1450, pr = 1.5 + rnd() * 4;
    g.fillStyle = hexA(i % 4 ? c : '#ffffff', 0.15 + rnd() * 0.6);
    g.beginPath();
    g.arc(px, py, pr, 0, Math.PI * 2);
    g.fill();
  }

  // Logo oben
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = font(800, 76);
  const lw = g.measureText(LOGO_TEXT).width;
  const lx = STORY_W / 2 - 34;
  g.fillStyle = '#3dfa74';
  g.fillText(LOGO_TEXT, lx + 5, 286);
  g.fillStyle = '#f8f8f6';
  g.fillText(LOGO_TEXT, lx, 280);
  drawDiamondGlyph(g, lx + lw / 2 + 10, 216, 64, '#f8f8f6', '#3dfa74');

  drawCard(g, { x: cardX, y: cardY, w: cardW, h: cardH, ...data });

  // Botschaft unter der Card
  g.textAlign = 'center';
  g.font = font(800, 46);
  g.fillStyle = '#f8f8f6';
  g.fillText('Erst Fame,', STORY_W / 2, cardY + cardH + 92);
  g.fillStyle = '#3dfa74';
  g.fillText('dann die anderen.', STORY_W / 2, cardY + cardH + 148);
  g.font = font(500, 26);
  g.fillStyle = 'rgba(248,248,246,0.6)';
  g.fillText(`${APP_NAME} · then the others`, STORY_W / 2, cardY + cardH + 196);
  return cv;
}

// Nur die Card mit transparentem Rand – als Sticker für Instagram (natives Sharing to Stories).
export async function renderSticker(data) {
  await fontsReady();
  const w = 900, pad = 90;
  const cv = document.createElement('canvas');
  cv.width = w + pad * 2;
  cv.height = Math.round(w * CARD_RATIO) + pad * 2;
  drawCard(cv.getContext('2d'), { x: pad, y: pad, w, h: Math.round(w * CARD_RATIO), ...data });
  return cv;
}

const toBlob = (cv) => new Promise((res) => cv.toBlob(res, 'image/png'));
const toBase64 = (cv) => cv.toDataURL('image/png').split(',')[1];

// ---- Native Brücke (Capacitor-Plugin "FameShare", siehe native/README.md) ---------------

function nativeShare() {
  return window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.FameShare : null;
}

// ---- Teilen ---------------------------------------------------------------------------------

export function shareText(data) {
  return `Mein ${data.tier.name} auf ${APP_NAME} 💎 Nr. ${data.serial} – erst Fame, dann die anderen. #fame #thentheothers`;
}

async function webShare(blob, data, name) {
  const file = new File([blob], name, { type: 'image/png' });
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], text: shareText(data), title: APP_NAME });
    return 'shared';
  } catch (err) {
    return err?.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Ergebnis: { how: 'native' | 'sheet' | 'saved' | 'cancelled', hint?: string }
export async function shareToInstagramStory(data, assets) {
  const native = nativeShare();
  if (native) {
    const sticker = await assets.sticker();
    await native.instagramStory({
      stickerImage: toBase64(sticker),
      backgroundTopColor: data.tier.rarity.color,
      backgroundBottomColor: '#070708',
      contentUrl: SHARE_BASE + data.serial,
    });
    return { how: 'native' };
  }
  const blob = await toBlob(await assets.story());
  const r = await webShare(blob, data, 'fame-story.png');
  if (r === 'shared') return { how: 'sheet' };
  if (r === 'cancelled') return { how: 'cancelled' };
  download(blob, 'fame-story.png');
  return { how: 'saved', hint: 'Story-Bild gespeichert. In Instagram: Story → Bild aus der Galerie wählen.' };
}

export async function shareToTikTok(data, assets) {
  const story = await assets.story();
  const native = nativeShare();
  if (native) {
    await native.tiktok({ image: toBase64(story) });
    return { how: 'native' };
  }
  const blob = await toBlob(story);
  const r = await webShare(blob, data, 'fame-tiktok.png');
  if (r === 'shared') return { how: 'sheet' };
  if (r === 'cancelled') return { how: 'cancelled' };
  download(blob, 'fame-tiktok.png');
  return { how: 'saved', hint: 'Bild gespeichert. In TikTok: + → Hochladen → Foto wählen.' };
}

export async function shareElsewhere(data, assets) {
  const blob = await toBlob(await assets.story());
  const r = await webShare(blob, data, 'fame-card.png');
  if (r === 'shared') return { how: 'sheet' };
  if (r === 'cancelled') return { how: 'cancelled' };
  download(blob, 'fame-card.png');
  return { how: 'saved', hint: 'Bild gespeichert.' };
}

export async function saveImage(data, assets) {
  download(await toBlob(await assets.story()), `fame-${data.serial}.png`);
  return { how: 'saved', hint: 'Story-Bild gespeichert.' };
}
