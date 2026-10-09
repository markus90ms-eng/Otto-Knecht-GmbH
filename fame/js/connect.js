// Accounts verbinden: Snapchat (Login Kit, Popup im Browser), TikTok und Instagram (Weiterleitung).
// Ergebnis ist jeweils ein bestätigtes Profil { id, handle, name, avatar, verified: true }.
// Ohne Zugangsdaten in js/config.js meldet connectX() { error: 'setup' }.

import { SOCIAL, REDIRECT_URI } from './config.js';

const SNAP_SDK = 'https://sdk.snapkit.com/js/v1/login.js';
const TIKTOK_AUTH = 'https://www.tiktok.com/v2/auth/authorize/';
const INSTAGRAM_AUTH = 'https://www.instagram.com/oauth/authorize';
const PENDING = 'fame.oauth';

export const isReady = (id) => (id === 'sc' ? !!SOCIAL.snap.clientId
  : id === 'tt' ? !!(SOCIAL.tiktok.clientKey && SOCIAL.server)
    : id === 'ig' ? !!(SOCIAL.instagram.appId && SOCIAL.server) : false);

const randomState = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

// ---- Snapchat ---------------------------------------------------------------------------------
// Das Login-Kit-Skript bringt einen eigenen Knopf mit; die Anmeldung läuft im Popup, die Seite
// bleibt erhalten. Der Knopf wird direkt in die Zeile eingehängt, damit der Tipp darauf das Popup
// öffnen darf (Browser blockieren Popups ohne echten Tipp).

let snapLoad;
function loadSnap() {
  snapLoad ||= new Promise((resolve, reject) => {
    window.snapKitInit = () => resolve(window.snap);
    const s = document.createElement('script');
    s.src = SNAP_SDK;
    s.onerror = () => { snapLoad = null; reject(new Error('load')); };
    document.head.appendChild(s);
  });
  return snapLoad;
}

// Hängt den Snapchat-Knopf in `host` ein; onResult bekommt das Profil oder { error }.
export async function mountSnap(host, onResult) {
  if (!isReady('sc')) return false;
  let snap;
  try { snap = await loadSnap(); } catch { onResult({ error: 'load' }); return false; }
  host.id ||= `snap-login-${Date.now()}`;
  snap.loginkit.mountButton(host.id, {
    clientId: SOCIAL.snap.clientId,
    redirectURI: REDIRECT_URI,
    scopeList: ['user.display_name', 'user.bitmoji.avatar', 'user.external_id'],
    handleResponseCallback: () => {
      snap.loginkit.fetchUserInfo().then((res) => {
        const me = res?.data?.me;
        if (!me) { onResult({ error: 'denied' }); return; }
        onResult({
          id: 'sc', handle: me.displayName, name: me.displayName,
          avatar: me.bitmoji?.avatar || '', externalId: me.externalId, verified: true,
        });
      }, () => onResult({ error: 'denied' }));
    },
  });
  return true;
}

// ---- TikTok und Instagram ---------------------------------------------------------------------
// Weiterleitung zur Plattform, zurück kommt ein Code. Den tauscht unser Server (mit dem geheimen
// Schlüssel der Plattform) gegen das Profil; die App bekommt nur Name, Benutzername und Bild, nie den Token.
// Instagram verbindet nur Business- und Creator-Konten (so will es Meta).

const AUTH = {
  tt: () => [TIKTOK_AUTH, { client_key: SOCIAL.tiktok.clientKey, response_type: 'code', scope: 'user.info.basic,user.info.profile' }],
  ig: () => [INSTAGRAM_AUTH, { client_id: SOCIAL.instagram.appId, response_type: 'code', scope: 'instagram_business_basic', enable_fb_login: '0' }],
};
const PATH = { tt: 'tiktok', ig: 'instagram' };

export function connectRedirect(id, draft) {
  if (!isReady(id)) return { error: 'setup' };
  const state = randomState();
  try { localStorage.setItem(PENDING, JSON.stringify({ id, state, draft, at: Date.now() })); } catch { /* privat */ }
  const [url, params] = AUTH[id]();
  location.href = `${url}?${new URLSearchParams({ ...params, redirect_uri: REDIRECT_URI, state })}`;
  return { pending: true };
}

// Beim Start der App: Kommen wir gerade von TikTok/Instagram zurück? Dann Code einlösen.
// Gibt null zurück, wenn nichts ansteht, sonst { id, profile?, error?, draft }.
export async function finishRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has('state') || !(q.has('code') || q.has('error'))) return null;
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem(PENDING) || 'null'); localStorage.removeItem(PENDING); } catch { /* privat */ }
  history.replaceState(null, '', `${location.pathname}#/login`);
  const id = pending?.id;
  if (!pending || pending.state !== q.get('state') || !PATH[id]) return { id, error: 'state', draft: pending?.draft };
  if (q.has('error')) return { id, error: 'denied', draft: pending.draft };
  try {
    const r = await fetch(`${SOCIAL.server.replace(/\/$/, '')}/${PATH[id]}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: q.get('code'), redirect_uri: REDIRECT_URI }),
    });
    const p = await r.json();
    if (!r.ok || !p.id) return { id, error: p.error === 'not_professional' ? 'business' : 'server', draft: pending.draft };
    return {
      id, draft: pending.draft,
      profile: { id, handle: p.username || p.name, name: p.name || p.username, avatar: p.avatar || '', externalId: p.id, verified: true },
    };
  } catch {
    return { id, error: 'server', draft: pending.draft };
  }
}
