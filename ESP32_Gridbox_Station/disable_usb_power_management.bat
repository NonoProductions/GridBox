@echo off
REM Deaktiviert USB Power Management um ESP32 Disconnects zu verhindern
REM Als Administrator ausführen!

echo ========================================
echo USB Power Management deaktivieren
echo ========================================
echo.
echo Dieses Script deaktiviert die "Computer kann Gerät ausschalten"
echo Funktion für alle USB Root Hubs.
echo.
echo Das verhindert, dass Windows den ESP32 abschaltet.
echo.
pause

echo.
echo Deaktiviere USB Power Management...
echo.

REM Deaktiviere "Allow computer to turn off device" für alle USB Root Hubs
powershell -Command "Get-WmiObject MSPower_DeviceEnable -Namespace root\wmi | Where-Object {$_.InstanceName -like '*USB*'} | ForEach-Object {$_.Enable = $False; $_.Put()}"

echo.
echo ✓ Fertig!
echo.
echo Bitte Computer NEU STARTEN damit Änderungen wirksam werden.
echo.
pause

