# Fame – then the others

Erster klickbarer Stand der Fame-App als Web-App (PWA): läuft im Handy-Browser und lässt sich über „Zum Home-Bildschirm“ wie eine App installieren.

## Starten

ES-Module brauchen einen kleinen Webserver (ein Doppelklick auf `index.html` reicht nicht):

```bash
cd fame
python3 -m http.server 8080
# dann http://localhost:8080 öffnen (am besten in der Handy-Ansicht der Browser-Devtools)
```

Über GitHub Pages ist die App unter `/fame/` erreichbar.

## Screens

| Route | Inhalt |
|---|---|
| `#/` | Startseite: grünes Licht fährt von rechts nach links, danach glänzt das große Logo „Fam€“ mit gläsernem Diamanten. „Neu hier?“ steht oben, der Login unten |
| `#/intro/1` | Loot-Drop: ein Perfekter Diamant fällt in einer Lichtsäule herunter, dazu der Claim |
| `#/intro/2` | Übersicht: vier Belohnungen, der Text steht groß im Fokus, darüber ein kleines Foto aus dem Design. Wechselt automatisch (Fortschrittsbalken) oder per Antippen |
| `#/intro/3` | „#Real_story, BRO“: das Zitat des Gründers mittig im Spotlight, Zeile für Zeile. Beim Fame-Teil leuchtet es auf. „Fang an – JETZT“ führt zum Login |
| `#/login` | „Werde Fam€“: Name, Instagram, Land und Bundesland |
| `#/donate` | Einzahlen: Diamanten, die man noch nicht besitzt, sind nur als leuchtende Silhouette mit „?“ zu sehen. Sammlung (x von 5 entdeckt), Betrag per Eintippen, +/− oder Regler, Hinweis „Nur noch X € bis …“ mit Freischalten-Knopf |
| `#/card` | Fame-Card liegt verdeckt da. Antippen baut Spannung auf (Wackeln, Glühen, steigende Töne), dann dreht sie sich mit Lichtblitz, Funken und Gewinn-Sound um. Je höher die Stufe, desto größer der Moment |
| `#/ranking/region` | Ranking im Bundesland: Kennzahlen, Podest mit Avataren, Rangliste, Deutschland-Kachelkarte (antippbar) und Bundesländer-Duell, eigene Platzierung unten fixiert |
| `#/ranking/country` | Ranking im Land, dazu das Länder-Duell |

Diamant-Stufen (wie die Edelsteine bei Diablo) und ihre Seltenheit:

| Stufe | ab | Seltenheit | Farbe |
|---|---|---|---|
| Lädierter Diamant | 1 € | Normal | grau |
| Fehlerhafter Diamant | 100 € | Magisch | blau |
| Diamant | 1.000 € | Selten | gelb |
| Makelloser Diamant | 10.000 € | Mystisch | lila |
| Perfekter Diamant | 100.000 € | Legendär | orange |

- Der Diamant ist ein echter Brillantschliff mit 57 Facetten. Er spiegelt eine Studio-Lichtumgebung und hat Regenbogen-Feuer und Lichtblitze auf den Facetten. Je höher die Stufe, desto klarer der Stein und desto mehr Funkeln. Der lädierte Diamant ist angeschlagen und trüb.
- Jede Stufe hat ihren eigenen Sound, nach oben wie nach unten. Beim Aufstieg wechselt die Seite in die Farbe der Stufe und Funken sprühen.
- Die Fame-Card bekommt den Rahmen der Seltenheit: Normal schlicht grau, Magisch blau, Selten mit goldenem Doppelrahmen. Ab Mystisch hat sie einen umlaufend leuchtenden Rand. Der Hintergrund wächst mit: Strahlen, ein Runenkreis, eine Lichtsäule.
- Oben rechts steht eine Seriennummer (`FM-XXXX-XXXX-P` mit Prüfzeichen) als Nachweis, dass die Card aus der App stammt.

## Konto und mehrfaches Einzahlen

Jede Einzahlung wird dem Konto gutgeschrieben. Stufe und Rang hängen an der **Summe aller Einzahlungen**, wer nochmal einzahlt, steigt also weiter auf. Die Einzahl-Seite zeigt „Dein Konto → danach“, mit jeder Einzahlung gibt es eine neue Fame-Card mit neuer Seriennummer.
- Auf der Card steht automatisch der Instagram-Name, wenn man registriert ist, sonst gibt es ein Eingabefeld.

## Card teilen: Instagram Story & TikTok

Nach dem Aufdecken stehen unter der Card drei Knöpfe: **Story** (Instagram), **TikTok** und **Mehr**. „Mehr“ öffnet ein Fenster mit Vorschau der fertigen Story und den Zielen Instagram Story, TikTok, weitere Apps und Bild speichern.

- **Story-Bild 1080×1920 (9:16):**
  - Oben das Logo, in der Mitte die Card im Look der Stufe, darunter „Erst Fame, dann die anderen.“
  - Hintergrund, Strahlen und Funken in der Stufenfarbe.
  - Oben und unten bleibt Platz für die Bedienelemente von Instagram und TikTok.
- **Card-Sticker** (transparenter Rand) für den nativen Instagram-Weg: Instagram legt ihn auf einen Verlauf in der Stufenfarbe, der Nutzer kann ihn frei platzieren.
- **Im Browser:** Das Bild geht über das Teilen-Menü des Handys raus, dort Instagram (Story) bzw. TikTok wählen. Gibt es kein Teilen-Menü, wird das Bild gespeichert, mit Hinweis, wie es weitergeht.
- **In der nativen App:** Das Plugin `FameShare` ruft die offiziellen Schnittstellen auf, Instagram „Sharing to Stories“ und TikTok Share Kit. Einrichtung siehe [`native/README.md`](native/README.md).
- Der Link in der Story (`SHARE_BASE` in `js/share.js`) zeigt auf `https://fame.app/card/<Seriennummer>`. Die Domain ist ein Platzhalter.

## Ton

Ton und Vibration starten nach dem ersten Antippen, so verlangen es die Handy-Browser. Auf dem iPhone spielt der Ton ab Safari 17 auch bei eingeschaltetem Lautlos-Schalter, bei älteren Versionen den Schalter ausschalten.

## Noch Prototyp

- **Es wird kein echtes Geld bewegt.** „I´m awesome“ simuliert die Zahlung. Zahlungsanbieter, Spendenabwicklung und Bedingungen fehlen noch.
- Ranking und Mitspieler sind Beispieldaten (`js/data.js`). Profil und Konto liegen nur im Browser (localStorage). Für echte Nutzer braucht es ein Backend mit Nutzerkonten, Zahlungsanbieter und serverseitig vergebenen, signierten Seriennummern.

## Struktur

```
fame/
  index.html, manifest.webmanifest, sw.js
  css/app.css        Design (Farben, Marker-Text, Buttons mit grünem Versatz, Kurven)
  js/app.js          Router und Screens
  js/ui.js           Logo, Diamant-Icons, Buttons, Hero mit Kurve
  js/data.js         Stufen, Länder/Bundesländer, Ranking, Seriennummern
  js/diamond3d.js    Realistischer 3D-Diamant (three.js, liegt in vendor/)
  js/fx.js           Loot-Sounds und Vibration
  js/particles.js    Funken und Staub
  js/share.js        Story-Bild, Card-Sticker, Teilen zu Instagram/TikTok
  native/            Capacitor-Plugin für Instagram Stories und TikTok Share Kit (iOS/Android)
```

Stufen, Pin-Schwelle (`PIN_FROM`) und Währung lassen sich zentral in `js/data.js` anpassen.
