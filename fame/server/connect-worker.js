// Kleiner Server für die Anmeldung mit TikTok und Instagram (Cloudflare Worker, kostenlos).
// Tauscht den Code aus der Weiterleitung gegen einen Token und gibt der App nur das Profil zurück:
// { id, username, name, avatar }. Die geheimen Schlüssel stehen nur hier, nie in der App.
//
// Variablen im Worker (siehe texte/verbinden.md):
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET (geheim)
//   INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET (geheim)
//   ALLOWED_ORIGIN, z. B. https://markus90ms-eng.github.io

const form = (data) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) });
const getJson = async (res) => res.json().catch(() => ({}));

const PROVIDERS = {
  // TikTok Login Kit: Code → Token → /v2/user/info
  async tiktok(code, redirectUri, env) {
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', form({
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }));
    const token = await getJson(tokenRes);
    if (!tokenRes.ok || !token.access_token) return { error: 'token', detail: token.error_description || token.error || '' };
    const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const user = (await getJson(userRes))?.data?.user;
    if (!userRes.ok || !user?.open_id) return { error: 'user' };
    return { id: user.open_id, username: user.username || '', name: user.display_name || '', avatar: user.avatar_url || '' };
  },

  // Instagram API mit Instagram-Login (nur Business-/Creator-Konten): Code → Token → /me
  async instagram(code, redirectUri, env) {
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', form({
      client_id: env.INSTAGRAM_APP_ID,
      client_secret: env.INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code.replace(/#_$/, ''),
    }));
    const raw = await getJson(tokenRes);
    const token = raw.data?.[0] || raw;
    if (!tokenRes.ok || !token.access_token) return { error: 'token', detail: raw.error_message || raw.error?.message || '' };
    const userRes = await fetch(`https://graph.instagram.com/me?fields=user_id,username,name,profile_picture_url,account_type&access_token=${encodeURIComponent(token.access_token)}`);
    const user = await getJson(userRes);
    if (!userRes.ok || !user.username) return { error: 'user' };
    return { id: String(user.user_id || user.id || token.user_id), username: user.username, name: user.name || '', avatar: user.profile_picture_url || '' };
  },
};

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    const m = /^\/(tiktok|instagram)\/profile$/.exec(new URL(req.url).pathname);
    if (req.method !== 'POST' || !m) return json({ error: 'not_found' }, 404);

    let input;
    try { input = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
    if (!input?.code || !input?.redirect_uri) return json({ error: 'bad_request' }, 400);

    const profile = await PROVIDERS[m[1]](decodeURIComponent(input.code), input.redirect_uri, env);
    return profile.error ? json(profile, 502) : json(profile);
  },
};
