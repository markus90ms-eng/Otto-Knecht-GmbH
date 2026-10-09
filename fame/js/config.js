// Zugangsdaten für die Verbindung mit Snapchat, TikTok und Instagram.
// Leer = noch nicht eingerichtet: Die App zeigt dann einen Hinweis statt der Anmeldung.
// Anleitung zum Einrichten: texte/verbinden.md

export const SOCIAL = {
  snap: {
    // Snap Kit → Developer Portal → App → OAuth2 Client ID (zum Testen die Staging-ID)
    clientId: '',
  },
  instagram: {
    // Meta for Developers → App → Instagram → API-Einrichtung mit Instagram-Login → Instagram-App-ID
    // (das App-Secret gehört NUR auf den Server)
    appId: '',
  },
  tiktok: {
    // TikTok for Developers → App → Client key (der Client secret gehört NUR auf den Server)
    clientKey: '',
  },
  // Adresse des kleinen Servers, der den Code von TikTok/Instagram gegen das Profil tauscht
  // (server/connect-worker.js, ein Cloudflare Worker für beide)
  server: '',
};

// Rücksprung-Adresse nach der Anmeldung: die App selbst, ohne #-Teil.
// Genau diese Adresse muss bei Snapchat und TikTok als Redirect URI eingetragen sein.
export const REDIRECT_URI = `${location.origin}${location.pathname}`;
