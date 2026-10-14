# Salesforce-Browser-Bot

Steuert Salesforce über einen echten Browser (Playwright). Phase 1: nur lesen.

## Einrichten (auf deinem eigenen Rechner, nicht in der Cloud)
    pip install -r requirements.txt
    playwright install chromium
    cp .env.example .env     # SF_URL eintragen

## Benutzen
    python sf.py login            # einmalig: selbst einloggen (2FA ok), Sitzung wird gespeichert
    python sf.py accounts         # Kunden auflisten
    python sf.py accounts Müller  # filtern
    python sf.py accounts --headed  # Browser sichtbar, zum Debuggen

Passwörter werden nie gespeichert, nur die Browser-Sitzung in `.auth/` (git-ignoriert).

## Auswertung: Baden-Württemberg ohne Aktivität
    python sf.py bw                 # PLZ 7*, 88*, 89*, seit 90 Tagen keine Aktivität
    python sf.py bw --tage 120 --headed

In der Salesforce-Listenansicht "Alle Accounts" müssen die Spalten
"Rechnungsadresse PLZ" und "Letzte Aktivität" eingeblendet sein.
Ergebnis: Ausgabe im Terminal plus CSV in `output/` (git-ignoriert, enthält Kundendaten).

## Windows: per Doppelklick
1. `1_einrichten.bat` (einmalig)
2. `2_einloggen.bat` (bei Bedarf wiederholen, wenn die Sitzung abläuft)
3. `3_BW_Liste_erstellen.bat`

## Mehr als 2000 Konten (Grenze von Salesforce)
Listenansichten zeigen höchstens 2000 Einträge. Dann in Salesforce eine eigene Listenansicht anlegen:
Filter: Rechnungsadresse PLZ beginnt mit 7, 88, 89 und Letzte Aktivität älter als 90 Tage.
Die ID der Ansicht steht in der Adresszeile (`...list?filterName=00B...`). Dann:
    python sf.py bw --liste 00B...

## Ein-Klick-Betrieb mit dem Leadgenerator
1. `Salesforce_starten.bat` doppelklicken (Fenster offen lassen). Es öffnet die Leadgenerator-Seite im Tab **Salesforce**.
2. Beim ersten Mal dort auf **Bei Salesforce einloggen** klicken, danach auf **Liste erstellen**.
Der Server (`server.py`) läuft nur auf 127.0.0.1:8766 und antwortet nur der Leadgenerator-Seite. Die Kundendaten werden nicht hochgeladen.
Abfrage: erst direkt per SOQL (alle Treffer, ohne 2000er-Grenze), sonst Rückfall auf die Listenansicht.
