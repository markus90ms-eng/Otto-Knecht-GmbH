# Native Hülle: Instagram Story & TikTok Share Kit

Instagram „Sharing to Stories“ und das TikTok „Share Kit“ gibt es nur für native iOS- und Android-Apps. Die Web-App nutzt deshalb das Teilen-Menü des Handys (Instagram und TikTok erscheinen dort als Ziel). Sobald Fame als App in die Stores geht, übernimmt dieses Plugin.

## Wie es zusammenspielt

`js/share.js` prüft, ob die App nativ läuft (`window.Capacitor.isNativePlatform()`), und ruft dann das Plugin `FameShare` auf:

| Aufruf | Daten | Ergebnis |
|---|---|---|
| `FameShare.instagramStory(...)` | `stickerImage` (PNG der Card, transparenter Rand), `backgroundTopColor` (Stufenfarbe), `backgroundBottomColor`, `contentUrl` | Instagram öffnet den Story-Editor. Die Card liegt als Sticker auf einem Verlauf und lässt sich verschieben, drehen und skalieren. |
| `FameShare.tiktok(...)` | `image` (Story-Bild 1080×1920) | TikTok öffnet den Editor mit dem Bild (Foto-Modus). |

Die Bilder baut die Web-App selbst (`renderSticker`, `renderStory`), damit Card und Story überall gleich aussehen.

## Einrichten

1. Capacitor einbinden: `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`, `npx cap init Fame app.fame`, `webDir` auf das Hauptverzeichnis dieses Repos zeigen lassen (dort liegt `index.html`).
2. **Meta App ID** auf developers.facebook.com anlegen und in beiden Plugin-Dateien eintragen.
3. **TikTok**: App im TikTok Developer Portal anlegen, „Share Kit“ freischalten lassen, Client Key und Redirect-URI eintragen.
4. Plugin-Dateien in die Projekte kopieren: `ios/FameSharePlugin.swift`, `android/FameSharePlugin.kt`.

### iOS
- SDK per Swift Package: `https://github.com/tiktok/tiktok-opensdk-ios` (Produkt `TikTokOpenShareSDK`).
- `Info.plist`:
  - `LSApplicationQueriesSchemes`: `instagram-stories`, `tiktokopensdk`, `tiktoksharesdk`, `snssdk1180`, `snssdk1233`
  - `TikTokClientKey`: dein Client Key, dazu ein URL-Scheme mit dem Client Key
  - `NSPhotoLibraryAddUsageDescription`: „Fame speichert deine Card in Fotos, damit du sie auf TikTok teilen kannst.“
- Im `AppDelegate` Rücksprünge von TikTok an `TikTokURLHandler.handleOpenURL(url)` weiterreichen.

### Android
- Gradle: `com.tiktok.open.sdk:tiktok-open-sdk-core` und `com.tiktok.open.sdk:tiktok-open-sdk-share` (aktuelle Version laut TikTok-Doku).
- `FileProvider` mit Authority `${applicationId}.fileprovider` und Pfad `cache/share/` anlegen.
- `AndroidManifest.xml`: `<queries>` für `com.instagram.android`, `com.zhiliaoapp.musically` und `com.ss.android.ugc.trill`, dazu eine `TikTokShareResultActivity` für die Rückmeldung.

## Wichtig

- Die Plugin-Dateien sind ein **Gerüst** und wurden noch in keiner echten App gebaut. Bitte beim Einbau gegen die aktuelle Doku von Meta und TikTok prüfen, die SDKs ändern sich regelmäßig.
- TikTok prüft Apps mit Share Kit vor der Freigabe. Plant dafür ein paar Tage ein.
