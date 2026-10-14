@echo off
cd /d "%~dp0"
echo Es oeffnet sich ein Browser. Bitte bei Salesforce einloggen.
python sf.py login
pause
