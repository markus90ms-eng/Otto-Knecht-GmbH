# Instagram, Snapchat und TikTok verbinden – Einrichtung

Die App kann Instagram-, Snapchat- und TikTok-Accounts **bestätigt verbinden**: Statt den Namen einzutippen,
meldet man sich kurz bei der Plattform an. Danach steht der echte Name mit einem grünen ✓
auf der Card und bei der Code-Prüfung.

Der Code dafür ist fertig (`js/connect.js`, `js/config.js`, `server/connect-worker.js`).
Es fehlen nur die Zugangsdaten der Plattformen. Die musst du selbst anlegen, weil sie an dein Konto gebunden sind.

> Die Menünamen in den Entwickler-Portalen ändern sich gelegentlich – sinngemäß sind die Schritte gleich.

---

## 0. Feste Adresse der App (Redirect URI)

Beide Plattformen schicken nach der Anmeldung zurück zu einer festen, eingetragenen HTTPS-Adresse.
In der Vorschau auf claude.ai klappt die Anmeldung deshalb nicht – getestet wird über GitHub Pages:

1. GitHub → Repo **Fame_App** → **Settings → Pages** → Source: Branch `main`, Ordner `/` → Save.
2. Nach 1–2 Minuten ist die App erreichbar unter: **`https://markus90ms-eng.github.io/Fame_App/`**
   Das ist die **Redirect URI** für die nächsten Schritte (genau so, mit `/` am Ende).

(Bei einem privaten Repo braucht GitHub Pages ein bezahltes Konto. Alternativ später eine eigene Domain.)

---

## 1. Snapchat (Login Kit)

1. Öffne **developers.snap.com** → Snap Kit / **Developer Portal** und melde dich mit deinem Snapchat-Konto an.
2. **Neue App anlegen** (Name z. B. „Fame“).
3. **Login Kit** aktivieren und diese Berechtigungen (Scopes) anhaken: **Display Name**, **Bitmoji Avatar**, **External ID**.
4. Bei **Redirect URIs** eintragen: `https://markus90ms-eng.github.io/Fame_App/`
   Falls nach erlaubten Web-Domains / Origins gefragt wird: `https://markus90ms-eng.github.io`
5. Unter **Demo Users** (bzw. Test-Nutzer) deinen eigenen Snapchat-Benutzernamen eintragen.
   Solange die App nicht von Snap freigegeben ist, können sich nur diese Nutzer anmelden.
6. Kopiere die **Staging OAuth2 Client ID** (später für alle: die Production Client ID).

➡️ Schick mir die **Client ID**. Sie ist nicht geheim.

---

## 2. TikTok (Login Kit for Web)

1. Öffne **developers.tiktok.com**, melde dich an und leg ein Entwicklerkonto an (Einzelperson reicht zum Testen).
2. **App erstellen** (Name „Fame“, Plattform **Web**, Website-Adresse wie oben).
3. Produkt **Login Kit** hinzufügen.
   - **Redirect URI (Web):** `https://markus90ms-eng.github.io/Fame_App/`
   - **Scopes:** `user.info.basic` und `user.info.profile` (für den @Benutzernamen)
4. **Sandbox** anlegen und unter **Target users** deinen eigenen TikTok-Account hinzufügen.
   So kannst du sofort testen, ohne dass TikTok die App schon geprüft hat.
5. Notiere **Client key** und **Client secret**.

⚠️ Der **Client secret** ist geheim: Er kommt **nur** in den Server (Schritt 4), nie in die App und nicht in den Chat.

---

## 3. Instagram (Instagram-API mit Instagram-Login)

Wichtig vorab: **Meta erlaubt das Verbinden nur für Business- und Creator-Konten.** Private Instagram-Konten
lassen sich nicht verbinden – wer eins hat, tippt seinen Namen wie bisher von Hand ein.
(Umstellen geht in Instagram kostenlos: Einstellungen → Kontotyp und Tools → Zu professionellem Konto wechseln.)

1. Öffne **developers.facebook.com** und melde dich an (Facebook-Konto nötig) → **Meine Apps → App erstellen**.
2. Anwendungsfall **„Nachrichten und Inhalte auf Instagram verwalten“** bzw. Produkt **Instagram** wählen.
3. Unter **Instagram → API-Einrichtung mit Instagram-Login**:
   - **Business-Login einrichten** → bei **Gültige OAuth-Redirect-URIs** eintragen: `https://markus90ms-eng.github.io/Fame_App/`
   - Berechtigung **instagram_business_basic** reicht (nur Profil lesen).
4. Unter **App-Rollen → Rollen** deinen Instagram-Account als **Instagram-Tester** hinzufügen und die Einladung in
   Instagram annehmen (Einstellungen → Website-Berechtigungen / Apps und Websites → Tester-Einladungen).
   Solange die App im Entwicklungsmodus ist, können sich nur eingetragene Tester verbinden.
5. Notiere **Instagram-App-ID** und **Instagram-App-Geheimcode** (beides auf der Seite „Business-Login“).

⚠️ Der **App-Geheimcode** ist geheim und kommt **nur** in den Server (Schritt 4).

➡️ Schick mir die **Instagram-App-ID**.

---

## 4. Kleiner Server für TikTok und Instagram (Cloudflare Worker, kostenlos)

TikTok und Instagram geben das Profil nur gegen einen geheimen Schlüssel heraus. Das erledigt ein winziger Server –
einer für beide.

1. Konto auf **dash.cloudflare.com** anlegen (kostenlos).
2. **Workers & Pages → Create → Worker** → Name z. B. `fame-connect` → Deploy.
3. **Edit code** → den Inhalt von `server/connect-worker.js` komplett einfügen → **Deploy**.
4. **Settings → Variables and Secrets** anlegen:
   - `TIKTOK_CLIENT_KEY` = dein Client key
   - `TIKTOK_CLIENT_SECRET` = dein Client secret (als **Secret** / verschlüsselt)
   - `INSTAGRAM_APP_ID` = deine Instagram-App-ID
   - `INSTAGRAM_APP_SECRET` = dein Instagram-App-Geheimcode (als **Secret** / verschlüsselt)
   - `ALLOWED_ORIGIN` = `https://markus90ms-eng.github.io`
5. Die Adresse des Workers kopieren, z. B. `https://fame-connect.DEINNAME.workers.dev`

➡️ Schick mir den TikTok **Client key** und die **Worker-Adresse**.

---

## 5. Was ich dann mache

Ich trage Snapchat Client ID, TikTok Client key, Instagram-App-ID und Worker-Adresse in `js/config.js` ein und pushe.
Danach auf dem Handy `https://markus90ms-eng.github.io/Fame_App/` öffnen → Login →
bei Instagram/TikTok/Snapchat auf **„Mit … verbinden“** tippen.

## Später für alle Nutzer

- **Snapchat:** App bei Snap zur Prüfung einreichen → danach die Production Client ID verwenden.
- **TikTok:** App zur Prüfung einreichen (Datenschutzerklärung, Nutzungsbedingungen und Demo-Video nötig).
- **Instagram:** App bei Meta zur Prüfung einreichen (App Review für instagram_business_basic, Unternehmensverifizierung) und auf „Live“ schalten.
- Alle drei verlangen eine Datenschutzerklärung unter der App-Adresse.
