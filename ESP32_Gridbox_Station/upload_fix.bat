der esp connectet und de connecte immer wieder
@echo off
REM ESP32 Upload Fix Script
REM Wenn Arduino IDE nicht uploaden kann, versuche esptool direkt

echo ========================================
echo ESP32 Upload Fix Script
echo ========================================
echo.
echo Stelle sicher dass:
echo 1. ESP32 ist per USB verbunden
echo 2. Du weisst den COM-Port (z.B. COM3)
echo.
pause

echo.
echo Installiere esptool...
pip install esptool

echo.
echo Versuche Upload mit esptool...
echo.
set /p COM_PORT="Gib deinen COM-Port ein (z.B. COM3): "

REM Hole .bin Datei aus Arduino Build
echo.
echo HINWEIS: Die .bin Datei findest du in:
echo C:\Users\%USERNAME%\AppData\Local\Temp\arduino\sketches\
echo.
echo Oder compiliere in Arduino IDE mit "Sketch" → "Export compiled Binary"
echo.
pause

REM Beispiel Upload-Befehl
echo.
echo Führe aus:
echo esptool.py --chip esp32 --port %COM_PORT% --baud 115200 write_flash 0x10000 ESP32_Gridbox_Station.ino.bin
echo.
echo Drücke BOOT-Button am ESP32 bevor Upload startet!
pause

