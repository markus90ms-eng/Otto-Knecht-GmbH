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
| `#/` | Splash mit Logo und Login |
| `#/intro/1` | „Zeig was Du dir leisten kannst und tue dabei gutes.“ |
| `#/intro/2` | Bild-Karussell (Cash, Ranking, Diamant Pin, Tiere), der passende Punkt wird aktiv; wischen geht auch |
| `#/intro/3` | „#Real_story, BRO“: Zitat vom Gründer |
| `#/login` | Registrieren mit Name und Instagram, dazu der drehende 3D-Diamant |
| `#/donate` | 3D-Diamant (360° drehbar), Betrag, Bogen-Slider, Stufe und Rang, Bedingungen, „I´m awesome“ |
| `#/card` | „Omg… Max, Du bist so krass.“: Fame-Card, die mit dem Gyrosensor kippt, „Jetzt Posten“ / „Speichern“ |
| `#/ranking` | Podest und Rangliste |

Was laut den Skizzen umgesetzt ist:
- Der Diamant leuchtet stärker, je höher der Betrag ist (Glow, Strahlen, Funkeln).
- Beim Erhöhen gibt es Sound und Vibration, beim Erreichen einer neuen Stufe einen extra Sound.
- Registrierte Nutzer sehen ihren Rang und den Fortschritt zur nächsten Stufe, z. B. Pink Glow bis Sancy Diamond. Der Rang passt sich dem Betrag an.
- Auf der Card steht automatisch der Instagram-Name, wenn man registriert ist, sonst gibt es ein Eingabefeld.
- „Jetzt Posten“ teilt die Card als Bild (4:5) über das Teilen-Menü des Handys, „Speichern“ lädt sie als PNG herunter.

## Noch Prototyp

- **Es wird kein echtes Geld bewegt.** „I´m awesome“ simuliert die Zahlung. Zahlungsanbieter, Spendenabwicklung und Bedingungen fehlen noch.
- Ranking und Mitspieler sind Beispieldaten (`js/data.js`), Profil und letzte Spende liegen nur im Browser (localStorage). Für echte Nutzer braucht es ein Backend.
- Die Fotos im Karussell stammen aus den Design-Screens. Für den Livegang die Originale bzw. lizenzierten Bilder in `assets/img/` ablegen.

## Struktur

```
fame/
  index.html, manifest.webmanifest, sw.js
  css/app.css        Design (Farben, Marker-Text, Buttons mit grünem Versatz, Kurven)
  js/app.js          Router und Screens
  js/ui.js           Logo, Diamant-Icons, Buttons, Hero mit Kurve
  js/data.js         Stufen, Beträge, Ranking
  js/diamond3d.js    3D-Diamant (three.js, liegt in vendor/)
  js/fx.js           Sound und Vibration
```

Stufen, Pin-Schwelle (`PIN_FROM`) und Währung lassen sich zentral in `js/data.js` anpassen.
