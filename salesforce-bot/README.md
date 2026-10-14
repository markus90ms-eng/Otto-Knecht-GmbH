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
