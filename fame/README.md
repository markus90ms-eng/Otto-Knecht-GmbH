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
| `#/` | Startseite: grünes Licht fährt von rechts nach links über den Screen, danach glänzt das Logo „Fam€“ mit gläsernem Diamanten. „Neu hier?“ steht groß über dem Login |
| `#/intro/1` | Loot-Drop: ein Perfekter Diamant fällt in einer Lichtsäule herunter, dazu der Claim |
| `#/intro/2` | Inventar: vier Belohnungen (Normal, Selten, Mystisch, Legendär), dazu ein Tooltip wie bei Diablo |
| `#/intro/3` | „#Real_story, BRO“ als Gegenstandsvergleich: Belvedere-Flasche gegen den Fam€ Diamanten. „Fang an – JETZT“ führt zum Login |
| `#/login` | Registrieren mit Name und Instagram, dazu der drehende 3D-Diamant |
| `#/donate` | 3D-Diamant (360° drehbar), Betrag, Bogen-Slider, Stufe und Rang, Bedingungen, „I´m awesome“ |
| `#/card` | „Omg… Max, Du bist so krass.“: Fame-Card im Look der Seltenheit, kippt mit dem Gyrosensor, „Jetzt Posten“ / „Speichern“ |
| `#/ranking` | Podest und Rangliste |

Diamant-Stufen (wie die Edelsteine bei Diablo) und ihre Seltenheit:

| Stufe | ab | Seltenheit | Farbe |
|---|---|---|---|
| Lädierter Diamant | 1 € | Normal | grau |
| Fehlerhafter Diamant | 100 € | Magisch | blau |
| Diamant | 1.000 € | Selten | gelb |
| Makelloser Diamant | 10.000 € | Mystisch | lila |
| Perfekter Diamant | 100.000 € | Legendär | orange |

- Je höher die Stufe, desto sauberer der Schliff und desto stärker das Funkeln. Der lädierte Diamant ist angeschlagen und trüb.
- Bei einer neuen Stufe wechselt die ganze Seite in die Farbe der Seltenheit. Es blitzt, ein Banner („Selten!“) erscheint, Funken sprühen, und es gibt einen eigenen Fund-Sound mit Vibration.
- Die Fame-Card bekommt den Rahmen der Seltenheit: Normal schlicht grau, Magisch blau, Selten mit goldenem Doppelrahmen. Ab Mystisch hat sie einen umlaufend leuchtenden Rand und eine Lichtsäule.
- Auf der Card steht automatisch der Instagram-Name, wenn man registriert ist, sonst gibt es ein Eingabefeld.
- „Jetzt Posten“ teilt die Card als Bild (4:5) über das Teilen-Menü des Handys, „Speichern“ lädt sie als PNG herunter.

## Noch Prototyp

- **Es wird kein echtes Geld bewegt.** „I´m awesome“ simuliert die Zahlung. Zahlungsanbieter, Spendenabwicklung und Bedingungen fehlen noch.
- Ranking und Mitspieler sind Beispieldaten (`js/data.js`), Profil und letzte Spende liegen nur im Browser (localStorage). Für echte Nutzer braucht es ein Backend.
- Die Fotos im Inventar stammen aus den Design-Screens. Für den Livegang die Originale bzw. lizenzierten Bilder in `assets/img/` ablegen.

## Struktur

```
fame/
  index.html, manifest.webmanifest, sw.js
  css/app.css        Design (Farben, Marker-Text, Buttons mit grünem Versatz, Kurven)
  js/app.js          Router und Screens
  js/ui.js           Logo, Diamant-Icons, Buttons, Hero mit Kurve
  js/data.js         Stufen, Beträge, Ranking
  js/diamond3d.js    3D-Diamant (three.js, liegt in vendor/)
  js/fx.js           Loot-Sounds und Vibration
  js/particles.js    Funken und Staub
```

Stufen, Pin-Schwelle (`PIN_FROM`) und Währung lassen sich zentral in `js/data.js` anpassen.
