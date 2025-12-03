# Verbindungsstatus-System für Gridbox Stationen

## Überblick

Das Dashboard zeigt jetzt in Echtzeit an, welche ESP32-Stationen verbunden sind und verwendet nur Daten von verbundenen Stationen.

## Wie es funktioniert

### 1. Datenbank-Tracking

Eine neue Spalte `last_seen` wurde zur `stations` Tabelle hinzugefügt:
```sql
ALTER TABLE stations ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

### 2. ESP32-Updates

Der ESP32-Code wurde angepasst, um bei jedem Update das `last_seen` Feld zu aktualisieren:
- In `updateAvailableUnits()` (wenn Slot-Status sich ändert)
- In `updateBatteryData()` (alle 10 Sekunden)

### 3. Dashboard-Anzeige

Das Dashboard prüft für jede Station, ob `last_seen` weniger als 30 Sekunden alt ist:
- **Verbunden** (🟢 grün, pulsierend): Station hat innerhalb der letzten 30 Sekunden Daten gesendet
- **Getrennt** (⚫ grau): Keine Verbindung seit über 30 Sekunden

### 4. Funktionen

#### Verbindungsstatus-Indikator
- Grüner pulsierender Punkt bei verbundenen Stationen
- Grauer Punkt bei getrennten Stationen
- Wird in der Stationsliste und Detail-Ansicht angezeigt

#### Filter "Nur Verbundene"
- Button im Stations-Tab
- Zeigt nur aktuell verbundene Stationen an
- Nützlich für große Installationen

#### Statistiken
- **Überblick-Tab**: Zeigt Anzahl verbundener Stationen
- **Stationen-Tab**: Zeigt "X von Y verbunden"

## Setup-Anleitung

### 1. Datenbank aktualisieren

Führe das SQL-Skript aus:
```bash
# In Supabase SQL-Editor:
supabase_add_connection_tracking.sql
```

Das Skript:
- Fügt die `last_seen` Spalte hinzu
- Löscht alle Testdaten
- Erstellt einen Index für bessere Performance

### 2. ESP32 neu flashen

1. Öffne `ESP32_Gridbox_Station.ino`
2. Der Code enthält bereits die Updates für `last_seen`
3. Flashe den Code auf alle ESP32-Geräte

### 3. Testdaten entfernen

Alle Test-Stationen wurden aus den SQL-Skripten entfernt:
- ❌ "Hauptbahnhof"
- ❌ "Stadttor"  
- ❌ "City Mall"
- ❌ "Demo Station"

Echte Stationen werden nur noch über:
- Das Owner Dashboard (UI)
- ESP32-Geräte (automatische Registrierung)

hinzugefügt.

## Verbindungsprobleme beheben

### Station zeigt "Getrennt" an

1. **ESP32 prüfen**
   - Ist das Gerät eingeschaltet?
   - Hat es WLAN-Verbindung?
   - Check Serial Monitor für Fehler

2. **Netzwerk prüfen**
   - Kann ESP32 Supabase erreichen?
   - Firewall-Einstellungen

3. **Datenbank prüfen**
   ```sql
   SELECT name, last_seen, 
          EXTRACT(EPOCH FROM (NOW() - last_seen)) as seconds_ago
   FROM stations 
   ORDER BY last_seen DESC;
   ```

### Falsche Stationen angezeigt

Wenn alte Test-Stationen noch in der Datenbank sind:
```sql
DELETE FROM stations 
WHERE name IN ('Hauptbahnhof', 'Stadttor', 'City Mall', 'Demo Station');
```

## Anpassungen

### Verbindungs-Timeout ändern

Im `OwnerDashboard.tsx`, Zeile ~576:
```typescript
const isStationConnected = (station: Station): boolean => {
  // ... 
  return diffSeconds < 30;  // ← Hier Sekunden anpassen
};
```

### Update-Intervall ESP32

Im `ESP32_Gridbox_Station.ino`:
```cpp
#define BATTERY_UPDATE_INTERVAL 10000  // 10 Sekunden
const unsigned long UPDATE_INTERVAL = 5000;  // 5 Sekunden
```

## Vorteile

✅ **Echtzeit-Überwachung**: Sofortige Erkennung von Verbindungsproblemen  
✅ **Keine Testdaten**: Nur echte, verbundene Stationen werden angezeigt  
✅ **Bessere Fehlersuche**: Schnelles Identifizieren von Offline-Geräten  
✅ **Saubere Daten**: Dashboard zeigt nur aktuelle, relevante Informationen  
✅ **Performance**: Index auf `last_seen` für schnelle Abfragen  

## Technische Details

### Datenbankstruktur

```sql
CREATE TABLE stations (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  -- ... andere Felder ...
  last_seen TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  INDEX idx_stations_last_seen (last_seen)
);
```

### Station Interface (TypeScript)

```typescript
export interface Station {
  id: string;
  name: string;
  // ...
  last_seen?: string;
  updated_at?: string;
  // ...
}
```

## Nächste Schritte

1. ✅ SQL-Skript ausführen
2. ✅ ESP32-Code flashen
3. ✅ Dashboard testen
4. 📊 Verbindungsstatus überwachen
5. 🔧 Bei Bedarf Timeout-Werte anpassen

