# 🔧 Relay-Button Test-Anleitung

## Problem behoben!
Die Relais-Logik im ESP32 war fehlerhaft. Der Web-Schalter hat das Relais nicht korrekt gesteuert.

## Was wurde geändert:

### ✅ Neue Relais-Logik (Prioritäten):

1. **Web-Schalter AUS** → Relais **IMMER AUS** (Master-Override)
2. **Web-Schalter EIN** → Prüfe lokale Bedingungen:
   - Lokaler Button EIN? ✓
   - Batterie vorhanden? ✓ (falls `REQUIRE_BATTERY_FOR_RELAY = true`)
   - → Relais EIN

### ✅ Bessere Debug-Ausgabe:

```
--- Relais-Status Update ---
  📱 Web-Schalter: EIN ✓
  🔘 Lokaler Button: EIN ✓
  🔋 Batterie: ERKANNT ✓
     Spannung: 3.78 V

  💡 Entscheidung: Alle Bedingungen erfüllt
  ⚡ Relais soll: EIN
  ⚡ Relais aktuell: AUS

  🔧 Schalte Relais...
  → Pin 5 = HIGH
  ✅ RELAIS EIN - Laden aktiv
--- Ende Relais-Update ---
```

## Setup & Test:

### Schritt 1: SQL ausführen
```sql
-- In Supabase SQL Editor
-- Datei: supabase_complete_setup.sql
```

### Schritt 2: ESP32 Code hochladen
1. Öffne Arduino IDE
2. Lade `ESP32_Gridbox_Station.ino` hoch
3. Öffne Serial Monitor (115200 baud)

### Schritt 3: Dashboard testen

**Test 1: Web-Schalter AUS**
1. Dashboard → Station → "Laden AUS" Button klicken
2. ESP32 Serial Monitor sollte zeigen:
   ```
   🔄 Web-Schalter geändert!
     Alt: EIN
     Neu: AUS
   
   --- Relais-Status Update ---
     📱 Web-Schalter: AUS ✗
     🔘 Lokaler Button: EIN ✓
     🔋 Batterie: ERKANNT ✓
   
     💡 Entscheidung: Web-Schalter AUS
     ⚡ Relais soll: AUS
   
     🔧 Schalte Relais...
     → Pin 5 = LOW
     ⛔️ RELAIS AUS - Web-Schalter AUS
   ```

**Test 2: Web-Schalter EIN**
1. Dashboard → Station → "Laden EIN" Button klicken
2. ESP32 Serial Monitor sollte zeigen:
   ```
   🔄 Web-Schalter geändert!
     Alt: AUS
     Neu: EIN
   
   --- Relais-Status Update ---
     📱 Web-Schalter: EIN ✓
     🔘 Lokaler Button: EIN ✓
     🔋 Batterie: ERKANNT ✓
   
     💡 Entscheidung: Alle Bedingungen erfüllt
     ⚡ Relais soll: EIN
   
     🔧 Schalte Relais...
     → Pin 5 = HIGH
     ✅ RELAIS EIN - Laden aktiv
   ```

**Test 3: Lokaler Button (optional)**
1. Drücke physischen Button am ESP32
2. Relais sollte aus/ein gehen
3. Web-Schalter hat aber immer noch Priorität

## Fehlerbehebung:

### Problem: "column charge_enabled does not exist"
**Lösung:** SQL-Datei `supabase_complete_setup.sql` ausführen

### Problem: ESP32 reagiert nicht auf Web-Schalter
**Prüfe:**
1. Serial Monitor → Siehst du "🔄 Web-Schalter geändert!"?
2. Falls NEIN → ESP32 empfängt keine Updates
   - Prüfe: Ist Realtime aktiviert? (`supabase_enable_realtime.sql`)
   - Prüfe: Läuft `getStationData()` alle 5 Sekunden?
3. Falls JA aber Relais schaltet nicht:
   - Prüfe Pin-Konfiguration: `RELAY_PIN = 5`
   - Prüfe: `RELAY_ACTIVE_LOW = false` (dein Relais schaltet bei HIGH)
   - Prüfe: Ist Batterie erkannt? (falls `REQUIRE_BATTERY_FOR_RELAY = true`)

### Problem: Relais geht nicht an trotz "Web-Schalter EIN"
**Mögliche Ursachen:**
```
💡 Entscheidung: Lokaler Button AUS
```
→ Drücke den lokalen Button (Pin 33) einmal

```
💡 Entscheidung: Keine Batterie erkannt
```
→ Setze `REQUIRE_BATTERY_FOR_RELAY = false` (Zeile 52) für Tests ohne Batterie

### Problem: Relais schaltet ständig um
**Lösung:** Änderung nur bei Statuswechsel:
```cpp
if (shouldCharge == relayCurrentlyOn) {
  Serial.println("  → Keine Änderung nötig");
  return;
}
```
Dieser Code verhindert unnötige Schaltungen.

## Workflow (normal):

```
Dashboard: Klick "Laden AUS"
         ↓
Supabase: charge_enabled = false
         ↓ (< 100ms via Realtime)
ESP32: Empfängt Update
         ↓
ESP32: getStationData()
         ↓
ESP32: "🔄 Web-Schalter geändert!"
         ↓
ESP32: updateChargingState()
         ↓
ESP32: "💡 Entscheidung: Web-Schalter AUS"
         ↓
ESP32: digitalWrite(RELAY_PIN, LOW)
         ↓
Relais: AUS ⛔️
```

## Testen:
1. Lade ESP32 Code hoch
2. Öffne Serial Monitor
3. Öffne Dashboard
4. Klicke "Laden AUS" / "Laden EIN"
5. Beobachte Serial Monitor und Relais

Das Relais sollte jetzt zuverlässig funktionieren! 🎉

