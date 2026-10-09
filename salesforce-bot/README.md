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
