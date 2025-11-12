@echo off
REM Kompletter Reset für ESP32 Serial-Probleme

echo ========================================
echo ESP32 Kompletter Reset
echo ========================================
echo.
echo Dieser Reset behebt Serial-Probleme:
echo 1. Schließt Arduino IDE
echo 2. Trennt alle Serial-Verbindungen
echo 3. Resettet USB-Verbindung
echo.
pause

echo.
echo Schritt 1: Schließe Arduino IDE...
taskkill /F /IM arduino.exe 2>nul
taskkill /F /IM java.exe 2>nul
echo ✓ Arduino IDE geschlossen (falls offen)

echo.
echo Schritt 2: USB-Port freigeben...
timeout /t 2 /nobreak >nul

echo.
echo Schritt 3: Bereit für Neustart!
echo.
echo JETZT:
echo 1. ESP32 USB-Kabel ABSTECKEN
echo 2. Warte 5 Sekunden
echo 3. ESP32 USB-Kabel EINSTECKEN
echo 4. Arduino IDE neu starten
echo 5. Code hochladen
echo 6. Serieller Monitor öffnen
echo 7. Reset-Button am ESP32 drücken
echo.
pause

