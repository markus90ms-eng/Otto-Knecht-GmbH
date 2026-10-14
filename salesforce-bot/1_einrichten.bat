@echo off
cd /d "%~dp0"
echo === Einrichtung (nur einmal) ===
pip install -r requirements.txt
python -m playwright install chromium
if not exist .env copy .env.example .env
echo.
echo Jetzt oeffnet sich die Datei .env. Trage dort bei SF_URL ein: https://stroeer-eins.lightning.force.com
echo Danach speichern und schliessen.
notepad .env
pause
