# ⚡ Realtime Powerbank-Updates im Dashboard

## 🎯 Ziel
Wenn du eine Powerbank an den ESP32 anschließt, soll das Dashboard **sofort** (< 5 Sekunden) aktualisiert werden - **ohne** manuelles Neuladen der Seite.

---

## ✅ So funktioniert es

### 1. ESP32 sendet Update an Supabase
```cpp
// ESP32_Gridbox_Station.ino - Zeile 1008
doc["battery_voltage"] = batteryVoltage;
doc["battery_percentage"] = batteryPercentage;
doc["updated_at"] = "now()";  // ← Triggert Realtime-Update
```

### 2. Supabase Realtime benachrichtigt das Dashboard
```
ESP32 → Supabase Database → Realtime Broadcast → Dashboard
```

### 3. Dashboard aktualisiert sich automatisch
```typescript
// Dashboard empfängt Update
channel.on('postgres_changes', (payload) => {
  console.log('📡 Station Update empfangen:', payload);
  setStations(prev => prev.map(station => 
    station.id === payload.new.id ? {...station, ...payload.new} : station
  ));
});
```

---

## 🔧 Setup-Checkliste

### Schritt 1: Prüfe Supabase Realtime (WICHTIG!)

**Führe diese SQL in Supabase aus:**

```sql
-- supabase_enable_realtime.sql

-- 1. Aktiviere Realtime für stations Tabelle
ALTER PUBLICATION supabase_realtime ADD TABLE stations;

-- 2. Prüfe ob aktiviert
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Sollte zeigen: stations | true
```

**Wie ausführen:**
1. Gehe zu https://supabase.com/dashboard
2. Wähle dein Projekt
3. Klick auf "SQL Editor"
4. Kopiere obigen Code
5. Klick auf "Run"

---

### Schritt 2: ESP32 konfigurieren

**Prüfe in `ESP32_Gridbox_Station.ino`:**

```cpp
// 1. WiFi & Supabase Credentials korrekt?
const char* ssid = "Dein_WiFi_Name";
const char* password = "Dein_WiFi_Passwort";
const char* SUPABASE_URL = "https://xyz.supabase.co";
const char* SUPABASE_KEY = "dein_anon_key";

// 2. Station ID korrekt?
#define STATION_ID "deine-station-uuid"
// ODER Short Code:
#define STATION_SHORT_CODE "TEST01"
```

**Upload zum ESP32:**
```bash
# In Arduino IDE:
1. Code öffnen
2. Board wählen: ESP32 Dev Module
3. Port wählen: COM3 (oder dein Port)
4. Upload klicken
```

---

### Schritt 3: Dashboard öffnen

```bash
# Terminal:
npm run dev
```

**Dann öffne:** http://localhost:3000/dashboard

---

## 🧪 Test-Ablauf

### 1. Vorbereitung
```
✅ ESP32 ist an und mit WiFi verbunden
✅ Dashboard ist geöffnet im Browser
✅ Browser-Console ist offen (F12)
```

### 2. Powerbank anschließen
```
1. Schließe Powerbank an ESP32 an
2. Warte 3-5 Sekunden
3. Beobachte Console und Dashboard
```

### 3. Was du sehen solltest

**Im Seriellen Monitor (ESP32):**
```
→ UPDATE Battery Data
  Spannung: 3.95 V
  Prozent: 87 %
  → Batterie erkannt, sende Werte
  Body: {"battery_voltage":3.95,"battery_percentage":87,"updated_at":"now()"}
✓ Batteriedaten erfolgreich aktualisiert!
```

**Im Dashboard (Browser-Console):**
```
📡 Station Update empfangen: UPDATE Test Station
✅ Station aktualisiert: Test Station
   Geänderte Felder: battery_voltage: null → 3.95, battery_percentage: null → 87
```

**Im Dashboard (UI):**
- Slot 1 wechselt von "Leer" → **"Powerbank eingelegt"** ✅
- Spannung zeigt: **3.95 V** ✅
- Ladezustand zeigt: **87%** (grüner Balken) ✅
- "Aktuell eingelegt" zähler ändert sich: 0 → **1 Powerbank** ✅

---

## ⚡ Timing

| Event | Zeitpunkt | Verzögerung |
|-------|-----------|-------------|
| Powerbank anschließen | 0s | - |
| ESP32 erkennt Batterie | +1s | 1s |
| ESP32 sendet an Supabase | +2s | 1s |
| Supabase empfängt | +2.5s | 0.5s |
| Dashboard erhält Update | +3s | 0.5s |
| UI aktualisiert | +3.5s | 0.5s |
| **GESAMT** | **~3-5s** | ✅ Automatisch |

---

## 🐛 Troubleshooting

### Problem 1: Dashboard aktualisiert nicht

**Prüfe Console (F12):**

**Siehst du:**
```
✅ Realtime-Verbindung aktiv (Hintergrund-Updates enabled)
```

**Wenn NEIN:**
```
⚠️ Realtime-Verbindung fehlgeschlagen, nutze Polling als Fallback...
⏱️ Starte Polling-Fallback (alle 10s)...
```

**Lösung:**
1. Führe `supabase_enable_realtime.sql` aus (siehe Schritt 1)
2. Warte 10-15 Sekunden
3. Reload Dashboard (F5)

---

### Problem 2: "Keine Updates empfangen"

**Prüfe Browser-Console:**

Siehst du **GAR NICHTS** wenn Powerbank angeschlossen wird?

**Mögliche Ursachen:**

1. **ESP32 sendet nicht**
   ```bash
   # Serieller Monitor prüfen:
   # Siehst du "✓ Batteriedaten erfolgreich aktualisiert!"?
   ```

2. **Falsche Station ID**
   ```sql
   -- In Supabase SQL Editor:
   SELECT id, name, short_code FROM stations;
   
   -- Vergleiche mit ESP32 Code:
   #define STATION_ID "..."  // Muss übereinstimmen!
   ```

3. **Realtime nicht aktiviert**
   ```sql
   -- Prüfe in Supabase:
   SELECT * FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime' 
   AND tablename = 'stations';
   
   -- Sollte Ergebnis zeigen, wenn nicht → Schritt 1 ausführen
   ```

---

### Problem 3: "Updates kommen verzögert (> 15s)"

**Wahrscheinlich läuft Polling statt Realtime**

**Prüfe:**
- Header zeigt "Live" (grün) oder "Auto-Update" (gelb)?
- Wenn "Auto-Update" → Realtime funktioniert nicht → Siehe Problem 1

**Polling ist OK als Fallback:**
- Updates alle 10 Sekunden
- Nicht optimal, aber funktional
- Powerbank wird trotzdem erkannt

---

### Problem 4: "Powerbank wird als nicht verbunden angezeigt"

**Prüfe ESP32 Seriellen Monitor:**

```
⚠️ Keine Batterie erkannt → Setze Werte auf NULL
→ Spannung zu niedrig: 0.00 V (Schwellwert: 2.5 V)
```

**Ursache:** Fuel Gauge nicht korrekt angeschlossen

**Lösung:**
1. Prüfe I2C-Verbindung (SDA, SCL)
2. Prüfe Multiplexer (TCA9548A)
3. Prüfe Fuel Gauge (BQ27441)
4. Siehe: `ESP32_Gridbox_Station/README.md`

---

## 📊 Debug-Logs verstehen

### Normal (Alles OK)

**ESP32:**
```
✓ Batteriedaten erfolgreich aktualisiert!
```

**Dashboard Console:**
```
📡 Station Update empfangen: UPDATE Test Station
✅ Station aktualisiert: Test Station
   Geänderte Felder: battery_percentage: 85 → 87
```

**Header:**
```
Live (grüner Punkt, pulsierend)
```

---

### Fallback (Realtime nicht verfügbar)

**Dashboard Console:**
```
⚠️ Realtime-Verbindung fehlgeschlagen, nutze Polling als Fallback...
⏱️ Starte Polling-Fallback (alle 10s)...
```

**Header:**
```
Auto-Update (gelber Punkt, pulsierend)
```

**Verhalten:**
- Updates alle 10 Sekunden statt sofort
- Funktioniert, aber langsamer

---

### Fehler (Muss behoben werden)

**ESP32:**
```
✗ Update Fehler: 400
  Response: {"message":"..."}
```

**Dashboard Console:**
```
❌ Supabase Fehler beim Laden der Stationen: ...
```

**Lösung:** Siehe DASHBOARD_STATIONEN_FIX.md

---

## 🎯 Schnell-Test

**Terminal 1 (ESP32 Serieller Monitor):**
```bash
# In Arduino IDE: Tools → Serial Monitor
# Baudrate: 115200
```

**Terminal 2 (Dashboard):**
```bash
npm run dev
```

**Browser:**
```
1. Öffne: http://localhost:3000/dashboard
2. Drücke F12 (Console öffnen)
3. Wechsel zu "Stationen" Tab
```

**Aktion:**
```
1. Schließe Powerbank an ESP32 an
2. Beobachte BEIDE Konsolen gleichzeitig
3. Nach 3-5 Sekunden sollte Dashboard aktualisieren
```

**Erwartetes Ergebnis:**
```
ESP32 Monitor:    ✓ Batteriedaten erfolgreich aktualisiert!
Browser Console:  📡 Station Update empfangen: UPDATE ...
Dashboard UI:     Slot 1: "Powerbank eingelegt" ✅
```

---

## 🚀 Performance-Tipps

### Tipp 1: Realtime statt Polling
- **Mit Realtime:** < 1 Sekunde Latenz
- **Mit Polling:** 0-10 Sekunden Latenz
- **Immer Realtime aktivieren** für beste Performance

### Tipp 2: Mehrere Browser-Tabs
- Alle Tabs erhalten Realtime-Updates
- Du kannst Dashboard in mehreren Tabs offen haben
- Alle synchronisieren sich automatisch

### Tipp 3: Mobile & Desktop gleichzeitig
- Dashboard funktioniert auf Handy UND Desktop
- Beide sehen Updates gleichzeitig
- Perfekt zum Testen

---

## ✅ Erfolgskriterien

Nach diesem Setup solltest du:

✅ Powerbank anschließen → Dashboard aktualisiert in < 5s
✅ Powerbank entfernen → Dashboard aktualisiert in < 5s
✅ Keine manuelle Aktualisierung nötig
✅ Funktioniert in allen Tabs gleichzeitig
✅ Funktioniert auf Mobile & Desktop
✅ Console zeigt "✅ Realtime-Verbindung aktiv"
✅ Header zeigt "Live" (grün)

---

## 📚 Weitere Dokumentation

- **Setup:** `DASHBOARD_STATIONEN_FIX.md`
- **Performance:** `DASHBOARD_PERFORMANCE_OPTIMIERUNG.md`
- **ESP32:** `ESP32_Gridbox_Station/README.md`
- **Realtime Fix:** `DASHBOARD_REALTIME_FIX.md`

