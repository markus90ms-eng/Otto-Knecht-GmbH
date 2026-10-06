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
| `#/intro/2` | Inventar: vier Belohnungen als drehende 3D-Gegenstände (Geldbündel, Krone, Diamant-Pin, Rubin-Herz) mit großem Tooltip wie bei Diablo |
| `#/intro/3` | „#Real_story, BRO“: das Zitat des Gründers im legendären Rahmen. „Fang an – JETZT“ führt zum Login |
| `#/login` | „Werde Fam€“: Name, Instagram, Land und Bundesland |
| `#/donate` | Einzahlen: Kontostand, Betrag, Bogen-Slider, Stufe nach der Einzahlung, Rang, Bedingungen, „I´m awesome“ |
| `#/card` | Fame-Card im Look der Stufe mit Seriennummer, kippt mit dem Gyrosensor, „Jetzt Posten“ / „Speichern“ |
| `#/ranking/region` | Ranking im Bundesland: Podest, Rangliste, Bundesländer-Duell, eigene Platzierung unten fixiert |
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
- Jede Stufe hat ihren eigenen Sound, nach oben wie nach unten. Beim Aufstieg wechselt die Seite in die Farbe der Seltenheit, ein Banner („Selten!“) erscheint und Funken sprühen.
- Die Fame-Card bekommt den Rahmen der Seltenheit: Normal schlicht grau, Magisch blau, Selten mit goldenem Doppelrahmen. Ab Mystisch hat sie einen umlaufend leuchtenden Rand. Der Hintergrund wächst mit: Strahlen, ein Runenkreis, eine Lichtsäule.
- Oben rechts steht eine Seriennummer (`FM-XXXX-XXXX-P` mit Prüfzeichen) als Nachweis, dass die Card aus der App stammt.

## Konto und mehrfaches Einzahlen

Jede Einzahlung wird dem Konto gutgeschrieben. Stufe und Rang hängen an der **Summe aller Einzahlungen**, wer nochmal einzahlt, steigt also weiter auf. Die Einzahl-Seite zeigt „Dein Konto → danach“, mit jeder Einzahlung gibt es eine neue Fame-Card mit neuer Seriennummer.
- Auf der Card steht automatisch der Instagram-Name, wenn man registriert ist, sonst gibt es ein Eingabefeld.
- „Jetzt Posten“ teilt die Card als Bild (4:5) über das Teilen-Menü des Handys, „Speichern“ lädt sie als PNG herunter.

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
  js/items3d.js      3D-Gegenstände fürs Inventar
  js/fx.js           Loot-Sounds und Vibration
  js/particles.js    Funken und Staub
```

Stufen, Pin-Schwelle (`PIN_FROM`) und Währung lassen sich zentral in `js/data.js` anpassen.
