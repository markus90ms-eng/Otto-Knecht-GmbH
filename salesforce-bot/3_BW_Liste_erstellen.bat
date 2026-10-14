@echo off
cd /d "%~dp0"
echo Starte ... (der Browser oeffnet sich, bitte nicht schliessen)
python sf.py bw --headed > log.txt 2>&1
type log.txt
echo.
echo === Ende. Ausgabe steht auch in log.txt ===
pause
