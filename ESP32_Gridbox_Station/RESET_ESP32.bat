@echo off
REM ESP32 Komplett Löschen (Factory Reset)
REM Löscht alle Programme und Daten vom ESP32

echo ========================================
echo ESP32 Factory Reset
echo ========================================
echo.
echo ⚠️ WARNUNG: Dies löscht ALLES auf dem ESP32!
echo    - Alle Programme
echo    - Alle gespeicherten Daten
echo    - WiFi Credentials
echo    - Alles!
echo.
echo Der ESP32 wird komplett zurückgesetzt.
echo.
pause

echo.
set /p COM_PORT="Gib deinen COM-Port ein (z.B. COM3): "

echo.
echo Installiere esptool falls nicht vorhanden...
pip install esptool

echo.
echo ========================================
echo Lösche ESP32 Flash...
echo ========================================
echo.
echo WICHTIG: Wenn "Connecting..." erscheint:
echo → Halte BOOT-Button am ESP32 gedrückt!
echo.
pause

esptool.py --chip esp32 --port %COM_PORT% erase_flash

echo.
echo ========================================
if %ERRORLEVEL% EQU 0 (
    echo ✅ ESP32 wurde erfolgreich gelöscht!
    echo.
    echo Der ESP32 ist jetzt komplett leer.
    echo Du kannst jetzt neuen Code hochladen.
) else (
    echo ❌ Fehler beim Löschen!
    echo.
    echo Mögliche Probleme:
    echo - BOOT-Button nicht gedrückt?
    echo - Falscher COM-Port?
    echo - USB-Verbindung instabil?
)
echo ========================================
echo.
pause

