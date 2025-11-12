# ESP32 Gridbox Station Controller

## 🚀 Schnellstart-Anleitung

### 1. Hardware vorbereiten
- ESP32 Board
- USB-Kabel
- Optional: LEDs, Sensoren für Powerbank-Erkennung

### 2. Software installieren

#### Arduino IDE installieren:
1. Download: https://www.arduino.cc/en/software
2. Windows Installer herunterladen und installieren

#### ESP32 Support hinzufügen:
1. Arduino IDE öffnen
2. `Datei` → `Voreinstellungen`
3. Bei "Zusätzliche Boardverwalter-URLs" einfügen:
```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```
4. `Werkzeuge` → `Board` → `Boardverwalter`
5. Nach "esp32" suchen und installieren

#### Bibliotheken installieren:
1. `Sketch` → `Bibliothek einbinden` → `Bibliotheken verwalten`
2. Suchen und installieren:
   - **ArduinoJson** (by Benoit Blanchon)

### 3. Code konfigurieren

Öffne `ESP32_Gridbox_Station.ino` und passe folgende Zeilen an:

```cpp
// WLAN Zugangsdaten
const char* WIFI_SSID = "MeinWLAN";           // ← Dein WLAN-Name
const char* WIFI_PASSWORD = "MeinPasswort";   // ← Dein WLAN-Passwort

// Supabase Konfiguration  
const char* SUPABASE_URL = "https://abcdefgh.supabase.co";  // ← Aus .env.local
const char* SUPABASE_KEY = "eyJhbGc...";                    // ← Aus .env.local

// Station Konfiguration (eine davon):
const char* STATION_ID = "uuid-hier";          // ← UUID aus Datenbank
// ODER
const char* STATION_SHORT_CODE = "AB12";       // ← Short-Code aus Datenbank
```

### 4. Hochladen

1. **ESP32 per USB verbinden**
2. **Board auswählen:** `Werkzeuge` → `Board` → `ESP32 Dev Module`
3. **Port auswählen:** `Werkzeuge` → `Port` → `COM3` (oder COM4, COM5...)
4. **Upload klicken:** ➡️ Button oben links
5. **Seriellen Monitor öffnen:** `Werkzeuge` → `Serieller Monitor` (115200 baud)

### 5. Testen

Im Seriellen Monitor siehst du:
```
=================================
Gridbox ESP32 Station Controller
=================================

Verbinde mit WLAN...
SSID: MeinWLAN
...........
✓ WLAN verbunden!
IP Adresse: 192.168.1.123

→ GET Station Data
✓ Station gefunden!
  Name: Hauptbahnhof
  Short-Code: AB12
  Verfügbar: 5/12
  Aktiv: Ja
```

## 📋 Wichtige Funktionen

### `connectWiFi()`
Verbindet den ESP32 mit deinem WLAN

### `getStationData()`
Lädt Station-Informationen aus der Datenbank

### `updateAvailableUnits(int units)`
Aktualisiert die Anzahl verfügbarer Powerbanks

### `countAvailableUnits()`
**HIER MUSST DU DEINE SENSOR-LOGIK IMPLEMENTIEREN!**

Beispiele:
```cpp
// Mit digitalen IR-Sensoren (8 Powerbank-Slots)
int countAvailableUnits() {
  int count = 0;
  for (int pin = 25; pin <= 32; pin++) {
    if (digitalRead(pin) == HIGH) count++;
  }
  return count;
}

// Mit analogem Gewichtssensor
int countAvailableUnits() {
  int weight = analogRead(34);
  return weight / 50;  // Jede Powerbank = ~50g
}
```

## 🔧 Fehlerbehebung

### Problem: "Port nicht gefunden"
**Lösung:** Treiber installieren
- CP210x: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
- CH340: http://www.wch.cn/downloads/CH341SER_ZIP.html

### Problem: "WLAN-Verbindung fehlgeschlagen"
**Lösung:** 
- SSID und Passwort prüfen
- ESP32 näher am Router platzieren
- 2.4 GHz WLAN verwenden (ESP32 unterstützt kein 5 GHz!)

### Problem: "HTTP Fehler 401"
**Lösung:**
- SUPABASE_KEY prüfen
- In Supabase: Row Level Security (RLS) Policies prüfen

### Problem: "Station nicht gefunden"
**Lösung:**
- STATION_ID oder STATION_SHORT_CODE prüfen
- In Supabase SQL Editor testen:
```sql
SELECT * FROM stations WHERE short_code = 'AB12';
```

## 🎯 Nächste Schritte

1. **Sensoren anschließen** für echte Powerbank-Erkennung
2. **Status-LEDs** für visuelle Anzeige
3. **Deep Sleep** für Batteriebetrieb implementieren
4. **OTA Updates** für drahtlose Firmware-Updates

## 📞 Support

Bei Fragen: Siehe Hauptprojekt README oder Supabase-Dokumentation

## 📄 Lizenz

Dieses Projekt ist Teil von Gridbox PWA

