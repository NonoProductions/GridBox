# ESP32 LED-Ausgabesystem - Vollständige Anleitung

## 🎯 Was ist das?

Ein System, bei dem die LED am ESP32 blinkt, wenn jemand über die Web-App eine Powerbank ausleiht.

## 🔄 So funktioniert es:

```
┌─────────────┐         ┌──────────────┐         ┌──────────┐
│   Web-App   │         │   Supabase   │         │  ESP32   │
│  (Kunde)    │         │  (Database)  │         │ (Station)│
└──────┬──────┘         └───────┬──────┘         └────┬─────┘
       │                        │                      │
       │ 1. QR-Code scannen     │                      │
       │    + "Ausleihen"       │                      │
       │────────────────────────>│                      │
       │                        │                      │
       │ 2. SET dispense_       │                      │
       │    requested = true    │                      │
       │                        │                      │
       │                        │ 3. Polling (alle 2s) │
       │                        │<─────────────────────│
       │                        │                      │
       │                        │ 4. dispense_         │
       │                        │    requested = true! │
       │                        │──────────────────────>│
       │                        │                      │
       │                        │                   ┌──┴──┐
       │                        │                   │ LED │
       │                        │                   │ 💡  │
       │                        │                   │BLINK│
       │                        │                   └──┬──┘
       │                        │                      │
       │                        │ 5. SET dispense_     │
       │                        │    requested = false │
       │                        │<─────────────────────│
```

## 📋 Setup-Schritte

### Schritt 1: Datenbank erweitern

1. **Öffne Supabase Dashboard**
2. **Gehe zu SQL Editor**
3. **Führe das Script aus:** `supabase_add_dispense_trigger.sql`

```sql
-- Das Script fügt hinzu:
-- ✓ dispense_requested (boolean) - Signal von App an ESP32
-- ✓ last_dispense_time (timestamp) - Zeitstempel der letzten Ausgabe
```

4. **Prüfen ob erfolgreich:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'stations' 
AND column_name IN ('dispense_requested', 'last_dispense_time');
```

### Schritt 2: ESP32 Code hochladen

1. **Öffne:** `ESP32_Gridbox_Station/ESP32_Gridbox_Station.ino`
2. **Stelle sicher, dass deine Credentials richtig sind:**
   - WIFI_SSID
   - WIFI_PASSWORD
   - SUPABASE_URL
   - SUPABASE_KEY
   - STATION_SHORT_CODE (z.B. "88SH")

3. **Upload zum ESP32**
4. **Öffne Seriellen Monitor** (115200 baud)

### Schritt 3: Web-App testen

1. **Starte die App:**
```bash
npm run dev
```

2. **Öffne:** http://localhost:3000

3. **Test-Ablauf:**
   - QR-Code scannen (oder Station auf Karte wählen)
   - Auf "Ausleihen" klicken
   - Bestätigen
   - **Schaue auf den ESP32!** Die LED sollte jetzt 5 Sekunden blinken! 💡

## 🔧 Wie es funktioniert

### Im ESP32:

```cpp
// Alle 2 Sekunden wird geprüft:
void checkDispenseRequest() {
  // Frage Datenbank: dispense_requested = true?
  if (dispenseRequested) {
    // ✅ JA! Aktiviere LED
    activateDispenseLED();  // Blinkt 5 Sekunden
    resetDispenseFlag();    // Setze Flag zurück
  }
}
```

### In der Web-App:

```typescript
// Beim Klick auf "Ausleihen":
await supabase
  .from('stations')
  .update({ 
    dispense_requested: true,  // 🚨 Signal an ESP32!
    available_units: current - 1
  })
  .eq('id', stationId);
```

## ⚙️ Konfiguration anpassen

### LED-Blink-Dauer ändern:

In `ESP32_Gridbox_Station.ino` Zeile 53:

```cpp
#define DISPENSE_LED_DURATION 5000   // 5000 = 5 Sekunden
                                     // Ändere z.B. auf 10000 für 10 Sek
```

### Polling-Intervall ändern:

```cpp
#define DISPENSE_POLL_INTERVAL 2000  // 2000 = alle 2 Sekunden
                                     // Ändere z.B. auf 1000 für jede Sekunde
```

### LED-Pin ändern:

```cpp
#define LED_PIN 2  // Standard: Pin 2 (eingebaute LED)
                   // Ändere z.B. auf 5 für externen Pin
```

## 🎨 Erweiterte Features hinzufügen

### 1. Servo-Motor für mechanische Ausgabe

```cpp
#include <ESP32Servo.h>

Servo myServo;
#define SERVO_PIN 18

void setup() {
  myServo.attach(SERVO_PIN);
}

void activateDispenseLED() {
  dispenseLEDActive = true;
  dispenseLEDStartTime = millis();
  
  // Servo bewegen (Powerbank freigeben)
  myServo.write(90);   // Position 90°
  delay(1000);
  myServo.write(0);    // Zurück zu 0°
}
```

### 2. Piezo-Buzzer für akustisches Signal

```cpp
#define BUZZER_PIN 19

void activateDispenseLED() {
  dispenseLEDActive = true;
  dispenseLEDStartTime = millis();
  
  // Kurzer Piepton
  tone(BUZZER_PIN, 1000, 200);  // 1000 Hz, 200ms
}
```

### 3. LCD Display für Statusanzeige

```cpp
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void activateDispenseLED() {
  dispenseLEDActive = true;
  dispenseLEDStartTime = millis();
  
  // Zeige auf Display
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Powerbank");
  lcd.setCursor(0, 1);
  lcd.print("wird ausgegeben");
}
```

### 4. Solenoid Lock (Elektrisches Schloss)

```cpp
#define SOLENOID_PIN 17

void activateDispenseLED() {
  dispenseLEDActive = true;
  dispenseLEDStartTime = millis();
  
  // Schloss öffnen
  digitalWrite(SOLENOID_PIN, HIGH);
  delay(2000);  // 2 Sekunden offen
  digitalWrite(SOLENOID_PIN, LOW);
}
```

## 🐛 Fehlerbehebung

### LED blinkt nicht bei Ausleihe:

1. **Prüfe Seriellen Monitor:**
   ```
   Sollte zeigen:
   🚨🚨🚨 AUSGABE-ANFRAGE ERKANNT! 🚨🚨🚨
   💡 LED-Ausgabe aktiviert!
   ```

2. **Falls nicht:**
   - Ist ESP32 mit WLAN verbunden?
   - Ist STATION_SHORT_CODE korrekt?
   - Sind die Supabase Credentials richtig?

3. **Prüfe Datenbank manuell:**
   ```sql
   SELECT dispense_requested, last_dispense_time 
   FROM stations 
   WHERE short_code = '88SH';
   ```

### "HTTP Fehler 400" im Seriellen Monitor:

- Problem: Short-Code oder UUID falsch
- Lösung: Prüfe `STATION_SHORT_CODE` in Zeile 29

### Datenbank gibt Fehler:

```
Column "dispense_requested" does not exist
```

- Problem: SQL-Script nicht ausgeführt
- Lösung: Führe `supabase_add_dispense_trigger.sql` aus

## 📊 Live-Monitoring

### Datenbank-Logs in Supabase ansehen:

```sql
-- Letzte Ausgaben anzeigen
SELECT 
  name,
  short_code,
  dispense_requested,
  last_dispense_time,
  available_units
FROM stations
ORDER BY last_dispense_time DESC NULLS LAST;
```

### ESP32 Debug-Infos anzeigen:

Im Seriellen Monitor eingeben: (implementiere dies optional)

```cpp
// In loop() hinzufügen:
if (Serial.available()) {
  char cmd = Serial.read();
  if (cmd == 'd') {
    printDebugInfo();
  }
}
```

## 🎯 Test-Checkliste

- [ ] SQL Script in Supabase ausgeführt
- [ ] ESP32 Code hochgeladen
- [ ] ESP32 mit WLAN verbunden
- [ ] Serielle Ausgabe zeigt "Setup abgeschlossen!"
- [ ] Web-App gestartet (npm run dev)
- [ ] QR-Code gescannt / Station gewählt
- [ ] "Ausleihen" geklickt
- [ ] LED am ESP32 blinkt! 🎉

## 🚀 Produktiv-Tipps

1. **Sicherheit:** Nutze Service Role Key nur auf ESP32, nie im Browser
2. **Realtime:** Für sofortige Updates erwäge Supabase Realtime (WebSocket)
3. **Backup:** Nutze Hardware-Watchdog für ESP32-Neustart bei Problemen
4. **Logging:** Speichere Ausgaben in `rentals` Tabelle für Historie
5. **Monitoring:** Sende ESP32-Status regelmäßig (Uptime, Free Heap, etc.)

## 📝 Nächste Schritte

1. **Mechanische Ausgabe:** Servo-Motor oder Solenoid integrieren
2. **Feedback:** Buzzer oder Display hinzufügen
3. **Security:** JWT-Token statt Anon Key verwenden
4. **Monitoring:** Dashboard für Station-Status erstellen
5. **Offline-Modus:** ESP32 speichert Queue bei WLAN-Verlust

## 💡 Zusätzliche Ideen

- **NFC-Leser:** Statt QR-Code NFC-Karte nutzen
- **LED-Ring:** WS2812B für bunte Status-Anzeige
- **E-Paper Display:** Zeige QR-Code direkt an Station
- **Camera:** Erfasse Nutzer-Foto bei Ausgabe
- **Weight Sensor:** Automatische Erkennung von Entnahme

---

**Viel Erfolg mit deinem ESP32-System! 🎉**

Bei Fragen: Schaue in den Code-Kommentare oder teste Schritt für Schritt.

