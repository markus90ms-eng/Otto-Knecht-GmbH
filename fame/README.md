# Fame – then the others

Erster klickbarer Stand der Fame-App als Web-App (PWA): läuft im Handy-Browser und lässt sich über „Zum Home-Bildschirm“ wie eine App installieren.

## Starten

ES-Module brauchen einen kleinen Webserver (ein Doppelklick auf `index.html` reicht nicht):

```bash
git clone https://github.com/markus90ms-eng/Fame_App.git
cd Fame_App
python3 -m http.server 8080
# dann http://localhost:8080 öffnen (am besten in der Handy-Ansicht der Browser-Devtools)
```

Über GitHub Pages (Einstellungen → Pages → Branch `main`, Ordner `/`) ist die App direkt unter der Pages-Adresse des Repos erreichbar.

## Screens

| Route | Inhalt |
|---|---|
| `#/` | Startseite: grünes Licht fährt von rechts nach links, danach glänzt das große Logo „Fam€“ mit gläsernem Diamanten. „Neu hier?“ steht oben, der Login unten |
| `#/intro/1` | Loot-Drop: ein Perfekter Diamant fällt in einer Lichtsäule herunter, dazu der Claim |
| `#/intro/2` | Übersicht: vier Belohnungen, der Text steht groß im Fokus, darüber ein kleines Foto aus dem Design. Wechselt automatisch (Fortschrittsbalken) oder per Antippen |
| `#/intro/3` | „#Real_story, BRO“: das Zitat des Gründers mittig im Spotlight, Zeile für Zeile. Beim Fame-Teil leuchtet es auf. „Fang an – JETZT“ führt zum Login |
| `#/login` | „Werde Fam€“: Name, Accounts (Instagram, TikTok, Snapchat), Land und Bundesland |
| `#/donate` | Einzahlen: Diamanten, die man noch nicht besitzt, sind nur als leuchtende Silhouette mit „?“ zu sehen. Sammlung (x von 5 entdeckt), Betrag per Eintippen, +/− oder Regler, Hinweis „Nur noch X € bis …“ mit Freischalten-Knopf |
| `#/card` | Fame-Card liegt verdeckt da. Antippen baut Spannung auf (Wackeln, Glühen, steigende Töne), dann dreht sie sich mit Lichtblitz, Funken und Gewinn-Sound um. Je höher die Stufe, desto größer der Moment |
| `#/ranking/region` | Ranking im Bundesland: Kennzahlen, Podest mit Avataren, Rangliste, Deutschland-Kachelkarte (antippbar) und Bundesländer-Duell, eigene Platzierung unten fixiert |
| `#/ranking/country` | Ranking im Land, dazu das Länder-Duell |

## 99 Edelsteine

Es gibt 99 Stufen, jede ist ein Edelstein: von **Stufe 1 Malachit** (ab 1 €) über **Stufe 89 Diamant** (ab 250.000 €) bis zu den **Legenden**: berühmte Diamanten von 300.000 € bis 1 Mio. €:

| Stufe | ab | Legende | Schliff |
|---|---|---|---|
| 90 | 300.000 € | Orangefarbener Diamant | Birne |
| 91 | 340.000 € | The Unique Pink | Birne |
| 92 | 390.000 € | De Beers Millennium Jewel 4 | Oval |
| 93 | 450.000 € | Fancy Intense Pink | Kissen |
| 94 | 510.000 € | Blue Moon of Josephine | Kissen |
| 95 | 590.000 € | Pink Legacy | Smaragdschliff |
| 96 | 670.000 € | Oppenheimer Blue | Smaragdschliff |
| 97 | 770.000 € | The Constellation | Rohdiamant |
| 98 | 870.000 € | Lesedi La Rona | Smaragdschliff (quadratisch) |
| 99 | 1.000.000 € | The Pink Star | Oval |
 Die Liste steht in `js/gems.js`, die Beträge rechnet `js/data.js` aus. Am Anfang kommt alle 5 € ein neuer Stein (1, 5, 10, 15 … 60 €). Danach wachsen die Schritte gleichmäßig bis 250.000 €, oben wird es exklusiv. Beispiele: 100 € → Stufe 17, 1.000 € → Stufe 38, 10.000 € → Stufe 59, 100.000 € → Stufe 81.

- **Einzahlen:** Dort steht nur „Edelstein · Stufe X von 99“, der Stein ist eine leuchtende Silhouette mit „?“. **Welcher Stein es ist, zeigt erst die aufgedeckte Card.** Steine aus der eigenen Sammlung sieht man echt.
- **Sammlung:** Ein Raster mit 99 Feldern zeigt, welche Steine man schon entdeckt hat (Stufe angepeilt = weißes Feld).
- **Anreiz:** „Nur noch X € bis Stufe Y – Nächster Edelstein →“ setzt den fehlenden Betrag ein.
- **Sound:** Jeder neue Stein beim Schieben gibt einen Kristall-Ton (je höher, desto heller). Bei einer neuen Farbklasse kommen Klassen-Sound, Farbwechsel und Funken dazu.
- **Farbklassen nach Kontostand** (nur Farben und Effekte, nicht sichtbar benannt, `CLASSES` in `js/data.js`):

  | Klasse | Farbe | Kontostand |
  |---|---|---|
  | Kiesel | Grau | 1 – 99 € |
  | Mint | Mint | 100 – 499 € |
  | Aquamarin | Türkis | 500 – 999 € |
  | Saphir | Blau | 1.000 – 4.999 € |
  | Amethyst | Lila | 5.000 – 9.999 € |
  | Rubellit | Pink | 10.000 – 49.999 € |
  | Rubin | Rot | 50.000 – 99.999 € |
  | Feuer | Orange | 100.000 – 499.999 € |
  | Gold | Gold | 500.000 – 999.999 € |
  | Diamant-Holo | Regenbogen | ab 1 Mio. € |

  An jeder Grenze beginnt genau ein neuer Stein. Die Einzahlseite wird mit jeder Klasse wertiger: ab Mint Lichtstrahlen um den Stein, ab Saphir ein Tresor-Ring, ab Amethyst ein Metallrahmen um Betragsfeld und Knopf, ab Rubellit ein Runenkreis, ab Rubin Metall-Schrift, ab Feuer ein Glanz über Feld und Knopf, ab 1 Mio. alles in Regenbogenfarben. Jede der 10 Klassen hat ihren eigenen Klang (`classDrop` in `js/fx.js`): von dumpfem Plopp über perlende Töne, Glocken und Arpeggios bis zu Einschlag mit Glockenakkord, Münzklimpern und Glitzerregen bei Gold und Holo. Beim Aufdecken der Card spielt der Klang der Klasse, ab Amethyst mit Gewinn-Jingle. Funken und Spannung steigen mit.
- **Startseite und Card-Seite je Klasse:** Eingeloggte sehen die Startseite weiterhin auf weißem Grund, aber mit Akzenten in ihrer Klassenfarbe: eigener Stein im Tresor, Licht-Wischer, Strahlen, Ring und Runen wie auf der Einzahlseite. Die Card-Seite nimmt ebenfalls die Klassenfarbe an (Hintergrund, Strahlen, Runenkreis, Lichtsäule, Kartenrückseite), die Card selbst bleibt in der Farbe ihres Steins. So wirkt die App in jeder Klasse wie neu.
- **Schneller Weg zur Card:** Wer schon eingezahlt hat, sieht auf der Startseite „Hey …, deine Card wartet“ mit dem Knopf „Meine Card“ und kann sich dort auch abmelden. Zum Testen gibt es auf der Startseite „Alles zurücksetzen“: löscht nach zweitem Tippen Konto, Cards und Login auf dem Gerät, danach geht es wieder bei 0 € los. Nach dem Login geht es ebenfalls zur Card. Auf Einzahlseite und Ranking gibt es den Knopf „Meine Card“ zum Posten.
- **Echte Lichtbrechung:** Facettierte Steine verfolgen das Licht im Stein. Es wird beim Eintritt gebrochen, an den Facetten mehrfach gespiegelt und beim Austritt in Regenbogenfarben aufgespalten (Feuer). Jede Steinart hat ihre echte Brechzahl (Diamant 2,42, Saphir 1,77, Smaragd 1,58 …). Technik: `js/refraction.js` mit three-mesh-bvh.
- **Foto-Look auf der Card:** Der Stein liegt wie auf einem Produktfoto schräg auf einem dunklen Tisch (`createDiamond(…, { photo: true })`). Dazu kommen ein warmer Lichtkegel dahinter, ein farbiger Lichtfleck davor, eine Spiegelung im Tisch und unscharfe Lichter (Bokeh) in der Steinfarbe. Die Lichtbrechung nutzt ein dunkles Fotostudio mit wenigen hellen Softboxen (`photoScene`). Der beleuchtete Tisch mit Lichtstreifen scheint durch die Tafel, so wirken gläserne Steine klar statt milchig. Fast farblose Steine (Bergkristall, Weißtopas …) werden wie der Diamant behandelt, zarte Farben bekommen wenig Körperfarbe, kräftige Farben bleiben satt. Nur helle Lichter spiegeln sich, und jede Facette leuchtet je nach Lichtrichtung heller oder dunkler. Tropfen und Marquisen liegen flacher, damit ihre Form zu sehen ist. Die Kamera rahmt jeden Stein automatisch ein.
- **Holo-Look auf den übrigen Seiten:** Dort spiegeln die Steine einen hellen Pastell-Himmel (`holoScene`), mit Regenbogen-Film und feinen silbernen Kanten.
- **Trommelsteine:** Undurchsichtige und milchige Steine (Malachit, Lapislazuli, Türkis, Rosenquarz, Labradorit …) sind polierte Kiesel, jeder mit eigener Form. Opale, Mondstein und Sternsteine bleiben gewölbte Cabochons.
- **Schliffe:** Jeder facettierte Stein hat seinen typischen Schliff (Liste `CUTS` in `js/gems.js`). Es gibt 12 Schliffarten:
  - **Brillant-Familie:** Round, Oval, Cushion, Cushion square, Marquise, Pear, Princess, Radiant, Radiant square. Der Rundbrillant wird in die jeweilige Umrissform gebracht, die Facetten bleiben erhalten.
  - **Treppenschliffe:** Emerald, Emerald square (Asscher), Octagon, mit gestuften Facetten entlang des Umrisses.
  - Die Legenden haben die Form des echten Steins.
- **Sprüche:** Jede der 99 Cards hat einen eigenen, frechen Spruch in der Sprache der Feeds („Aura“, „das crazy“, „no cap“, „goated“, „Main Character“ …), gesammelt in `SAYINGS` in `js/gems.js`. Lange Sprüche brechen auf der Card und im Story-Bild auf zwei Zeilen um.
- **3D-Darstellung je Stein:**
  - Cabochons mit gezeichnetem Muster: Malachit-Bänder, Lapislazuli mit Goldflecken, Türkis-Adern, Dendriten, Opal-Farbspiel, Labradorit-Schimmer, Mondstein-Schein, Sternsaphir und Sternrubin mit Stern.
  - Besondere Steine: Bicolor (Fluorit, Andalusit, Bicolor-Turmalin), Alexandrit mit Farbwechsel, Paraíba mit Neon-Leuchten, Rutilquarz mit goldenen Nadeln. Der Diamant ist ein Brillantschliff mit 57 Facetten. Die Legenden haben ihre echten Schliffe, Farben und Proportionen (Länge zu Breite) nach Fotos der echten Steine: Birne, Oval, Kissen, Smaragdschliff.
- **Fame-Card im Design des Steins:**
  - Rahmen aus Metall passend zur Steinfarbe: Gold für warme Töne, Roségold für Rosa und Rot, Platin für kühle und farblose Steine. Die Legenden haben einen umlaufenden Holo-Schimmer.
  - Oben randlos das Foto des Steins (live 3D, wiegt sich leicht im Licht), es läuft weich ins Schwarz aus. Logo und Seriennummer liegen darüber.
  - Hintergrund je Farbklasse: Samtglut + Prisma-Facetten (`js/cardfx.js`). Die Card glüht von unten in der Klassenfarbe, darüber liegen schattierte Facetten wie echte Schliffflächen. Je höher die Klasse, desto feiner und kontrastreicher; ab Rubellit brechen einzelne Facetten das Licht in Regenbogenfarben, Holo ganz prismatisch.
  - Holo-Effekt: Ein Regenbogen und ein Lichtband laufen über die Facetten und folgen der Neigung der Card (Lagesensor am Handy, Maus am Computer, sonst langsame Eigenbewegung). Im Story-Bild ist der Schimmer eingefroren.
  - Hinter Name, Spruch und Fuß liegt ein weicher Schatten, damit die Schrift in jeder Klasse ruhig bleibt.
  - Unter dem Stein steht nur der Name in Serifenschrift (Cormorant Garamond) mit Metall-Verlauf, dazu Zierlinie, Spruch und ein Echtheitssiegel. Keine Stufen-Zeile.
- Oben rechts steht eine Seriennummer (`FM-XXXX-XXXX-P` mit Prüfzeichen) als Nachweis, dass die Card aus der App stammt.
- **Zeig mir mehr:** 7 Story-Slides zum Durchtippen wie eine Instagram-Story (`introStory` in `js/app.js`, Text in `texte/zeig-mir-mehr.md`). Rechts tippen oder nach links wischen = weiter, links tippen = zurück, oben Fortschrittsbalken. Jede Slide in einer Klassenfarbe (Kiesel → Holo), mit Klassen-Sound. Kein Stein ist sichtbar: Slide 3 zeigt eine verdeckte Card, Slide 4 die Farbleiter aus Logo-Diamanten. Slide 7 „#Real_story, BRO“: Club-Flasche gegen Fame, dazu „Fang an – JETZT“ zum Login.
- **Code prüfen:** Auf der Startseite zwischen „Neu hier?“ und „Login“ (eingeloggt als Link unter „Fame steigern“) führt „Code prüfen“ zu `#/check`. Dort gibt man eine Seriennummer ein (Schreibweise egal, wird zu `FM-XXXX-XXXX-X` ergänzt). Ergebnis: **Echt** mit Besitzer (@Instagram-Name), Edelstein und Stufe, Klasse, Herkunft und Ausstellungsdatum, **Nicht im Verzeichnis** (Prüfzeichen stimmt, aber keine Card dazu – Vorsicht, Fälschung möglich) oder **Kein gültiger Code** (Prüfzeichen falsch). Direkter Link: `#/check/<Seriennummer>`. Im Prototyp kennt das Verzeichnis die Cards auf dem Gerät und die Ranking-Spieler (`lookupSerial` in `js/data.js`); mit Backend fragt dieselbe Funktion den Fame-Server.

## Konto und mehrfaches Einzahlen

Jede Einzahlung wird dem Konto gutgeschrieben. Stufe und Rang hängen an der **Summe aller Einzahlungen**, wer nochmal einzahlt, steigt also weiter auf. Die Einzahl-Seite zeigt „Dein Konto → danach“, mit jeder Einzahlung gibt es eine neue Fame-Card mit neuer Seriennummer.
- **Accounts:** Bei der Anmeldung tippt man an, wo man unterwegs ist (Instagram, TikTok, Snapchat – mehrere möglich), und trägt je Plattform den Namen ein. Mit „Auf die Card“ wählt man, welche Accounts auf der Card stehen – einer oder alle (`onCard`, `normalizeUser`/`cardAccounts` in `js/data.js`); der erste davon gilt fürs Ranking und die Code-Prüfung. Im Teilen-Fenster lassen sich die Accounts fürs Story-Bild an- und abwählen. Ohne Account gibt es auf der Card ein Eingabefeld für Instagram.
- **Übersicht nach dem Login:** Statt direkt zu bezahlen landet man auf der Startseite in der eigenen Klasse: Hauptknopf (Erste Card holen / Card aufdecken / Meine Card), darunter Kacheln für Einzahlen bzw. Fame steigern, Ranking und Code prüfen; Abmelden ganz unten.
- **Teilen:** Instagram Story, TikTok, Snapchat, „WhatsApp & mehr“ (System-Teilen), Bild speichern, Profilbild-Rahmen. Geht das System-Teilen nicht (z. B. in eingebetteten Ansichten) und bei „Bild speichern“ öffnet sich eine Bildansicht: Bild gedrückt halten → in Fotos sichern, dazu die Schritte für die gewählte Plattform und „Herunterladen“.
- **Accounts verbinden (Instagram, Snapchat, TikTok):** Bei der Anmeldung gibt es „Mit … verbinden“. Snapchat läuft über das Login Kit im Popup, TikTok und Instagram über eine Weiterleitung; den Code tauscht ein kleiner Server (`server/connect-worker.js`, Cloudflare Worker) mit dem geheimen Schlüssel der Plattform gegen das Profil. Instagram verbindet nur Business- und Creator-Konten. Bestätigte Accounts bekommen ein grünes ✓ auf der Card und bei der Code-Prüfung (`user.verified`). Zugangsdaten in `js/config.js`, Einrichtung in `texte/verbinden.md`. Ohne Zugangsdaten zeigt die App einen Hinweis und man tippt den Namen von Hand ein.
- **Bedingungen:** `#/terms`, vorerst ein Platzhalter.
- **Card-Seite:** oben rechts ein Haus-Knopf zurück zur Übersicht.
- **Sound beim Aufdecken** (`buildup`/`classReveal` in `js/fx.js`): Spannung wie am Spielautomaten (ratternde Walzen, Herzschlag, steigendes Rauschen), dann der Fund wie bei WoW/Diablo: Einschlag, Loot-Glocke mit Hall und Glitzer-Schweif; ab Amethyst ein Chor, ab Rubellit ein Gewinnzähler mit Ding-Ding-Ding, ab Feuer zweiter Einschlag und Fanfare, ab Gold Münzregen.

## Card teilen: Instagram Story & TikTok

Nach dem Aufdecken stehen unter der Card drei Knöpfe: **Story** (Instagram), **TikTok** und **Mehr**. „Mehr“ öffnet ein Fenster mit Vorschau der fertigen Story und den Zielen Instagram Story, TikTok, weitere Apps und Bild speichern.

- **Story-Bild 1080×1920 (9:16):**
  - Oben das Logo, darunter in einer Zeile „Erst Fame, dann die anderen.“, dann die Card (740 px breit) im Look der Stufe.
  - Hintergrund, Strahlen und Funken in der Stufenfarbe.
  - Freie Zonen geprüft (Instagram, Snapchat, TikTok): Logo und Slogan liegen unter der Profilzeile, die Card endet vor dem Antwortfeld und bleibt links von der Button-Spalte und über der Beschreibung von TikTok.
- **Profilbild-Rahmen:** Auf der Card-Seite unter „Mehr“ → „Profilbild-Rahmen“ ein Foto wählen. Die App legt einen wachsenden Glasbogen aus Milchglas in der Farbe der eigenen Klasse darüber: Er beginnt links neben dem Stein und läuft dort schräg aus, unten sitzt der eigene Edelstein (echtes 3D-Bild, freigestellt), und mit jeder erreichten Klasse wächst der Bogen weiter Richtung rechte Mitte. Ab Klasse 2 kommt pro Klasse ein Logo-Diamant in ihrer Farbe dazu, bei Diamant-Holo sind es 9 und der Bogen reicht bis zur rechten Mitte. Den Ausschnitt passt man in der Vorschau an: ziehen zum Verschieben, zwei Finger, Mausrad oder Regler zum Zoomen (1- bis 4-fach), „Zurücksetzen“ stellt die Mitte wieder her. Das Foto füllt den Kreis dabei immer ganz aus. Ergebnis: 1080 × 1080 px, alles im Kreis (`renderAvatar` in `js/share.js`).
- **Erinnerung an den neuen Rahmen:** Steigt man mit einer Einzahlung in eine neue Farbklasse auf, erscheint nach dem Aufdecken der Card „Neue Klasse: …! Hol dir deinen neuen Profilbild-Rahmen“. Hat man schon einen Rahmen aus einer niedrigeren Klasse erstellt, bleibt der Hinweis stehen, bis der neue gespeichert ist (`fame.frameCls`).
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
Fame_App/
  index.html, manifest.webmanifest, sw.js
  css/app.css        Design (Farben, Marker-Text, Buttons mit grünem Versatz, Kurven)
  js/app.js          Router und Screens
  js/ui.js           Logo, Diamant-Icons, Buttons, Hero mit Kurve
  js/gems.js         Die 99 Edelsteine (Name, Farbe, Schliff, Look)
  js/gem3d.js        3D-Edelsteine: Schliffe, Materialien, Muster
  js/refraction.js   Lichtbrechung im Stein (Strahlverfolgung mit three-mesh-bvh, liegt in vendor/)
  js/data.js         Stufen und Beträge, Länder/Bundesländer, Ranking, Seriennummern
  js/diamond3d.js    Realistischer 3D-Diamant (three.js, liegt in vendor/)
  js/fx.js           Loot-Sounds und Vibration
  js/particles.js    Funken und Staub
  js/cardfx.js       Card-Hintergrund je Farbklasse: Samtglut, Prisma-Facetten, Holo-Maske
  js/share.js        Story-Bild, Card-Sticker, Teilen zu Instagram/TikTok
  native/            Capacitor-Plugin für Instagram Stories und TikTok Share Kit (iOS/Android)
```

Stufen, Pin-Schwelle (`PIN_FROM`) und Währung lassen sich zentral in `js/data.js` anpassen.
