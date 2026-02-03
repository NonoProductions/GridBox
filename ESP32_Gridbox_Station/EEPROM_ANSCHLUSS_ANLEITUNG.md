# EEPROM (24LC01B/02B) Anschluss-Anleitung

## Übersicht

Das EEPROM wird über den **TCA9548A I2C Multiplexer** angeschlossen, der bereits für den Fuel Gauge verwendet wird.

## Pin-Belegung 24LC01B/02B (MSOP-8 Package)

```
     ┌─────┐
VSS ─┤1   8├─ VCC  (GND / 3.3V)
SCL ─┤2   7├─ WP   (Write Protect - auf GND für Schreibzugriff)
SDA ─┤3   6├─ SCL  (I2C Clock)
A0  ─┤4   5├─ A1   (Adress-Pins für I2C-Adresse)
     └─────┘
```

**Wichtig:** A2 Pin existiert nicht bei 24LC01B/02B (nur A0 und A1)

## I2C-Adressen (abhängig von A0/A1 Pins)

| A1 | A0 | I2C-Adresse |
|----|----|-------------|
| GND| GND| 0x50 (Standard) |
| GND| VCC| 0x51 |
| VCC| GND| 0x52 |
| VCC| VCC| 0x53 |

**Hinweis:** Wenn mehrere EEPROMs verwendet werden, müssen A0/A1 unterschiedlich sein!

## Anschluss-Schema

### 1. EEPROM → TCA9548A Multiplexer

```
24LC01B/02B          TCA9548A
─────────────────────────────────
Pin 1 (VSS)    →    GND
Pin 2 (SCL)    →    SCL0-SCL7 (je nach gewähltem Kanal)
Pin 3 (SDA)    →    SDA0-SDA7 (je nach gewähltem Kanal)
Pin 4 (A0)     →    GND (für Adresse 0x50) oder VCC (für 0x51)
Pin 5 (A1)     →    GND (für Adresse 0x50/0x51) oder VCC (für 0x52/0x53)
Pin 6 (SCL)    →    NICHT VERWENDET (nur Pin 2)
Pin 7 (WP)     →    GND (für Schreibzugriff)
Pin 8 (VCC)    →    3.3V
```

### 2. TCA9548A → ESP32

```
TCA9548A              ESP32
─────────────────────────────────
VDD (Pin 1)     →    3.3V
GND (Pin 2)     →    GND
SDA (Pin 3)     →    GPIO 21 (SDA)
SCL (Pin 4)     →    GPIO 22 (SCL)
SDA0-SDA7       →    EEPROM SDA (je nach Kanal)
SCL0-SCL7       →    EEPROM SCL (je nach Kanal)
```

## Beispiel-Anschluss für Kanal 0

```
ESP32 GPIO 21 (SDA) ────┬─── TCA9548A Pin 3 (SDA)
                         │
ESP32 GPIO 22 (SCL) ────┬─── TCA9548A Pin 4 (SCL)
                         │
TCA9548A SDA0 ───────────┼─── 24LC01B/02B Pin 3 (SDA)
                         │
TCA9548A SCL0 ───────────┼─── 24LC01B/02B Pin 2 (SCL)
                         │
24LC01B/02B Pin 1 ───────┼─── GND
24LC01B/02B Pin 4 (A0) ──┼─── GND (für Adresse 0x50)
24LC01B/02B Pin 5 (A1) ──┼─── GND (für Adresse 0x50)
24LC01B/02B Pin 7 (WP) ──┼─── GND (Schreibzugriff aktivieren)
24LC01B/02B Pin 8 ───────┼─── 3.3V
```

## Wichtige Hinweise

### 1. Pullup-Widerstände
- **WICHTIG:** I2C benötigt Pullup-Widerstände auf SDA und SCL!
- Typischerweise **4.7kΩ** zwischen SDA/SCL und 3.3V
- Der TCA9548A hat möglicherweise bereits interne Pullups
- Falls Probleme auftreten: Externe 4.7kΩ Widerstände hinzufügen

### 2. Kanal-Auswahl
- Jedes EEPROM sollte auf einem **anderen TCA9548A Kanal** angeschlossen werden
- Kanal 0-7 verfügbar
- Im Code: `#define TEST_CHANNEL 0` (ändern falls nötig)

### 3. Adress-Pins (A0/A1)
- **A0 und A1 auf GND** → Adresse 0x50 (Standard)
- Wenn mehrere EEPROMs auf demselben Kanal: Unterschiedliche A0/A1 verwenden
- **A2 existiert nicht** bei 24LC01B/02B!

### 4. Write Protect (WP)
- **WP auf GND** = Schreibzugriff aktiviert
- **WP auf VCC** = Nur Lesen (Schutz)

### 5. Versorgung
- **VCC = 3.3V** (nicht 5V!)
- **VSS = GND**
- ESP32 liefert 3.3V

## Test-Anschluss (einfachste Variante)

Für den ersten Test:

1. **EEPROM Pin 1 (VSS)** → GND
2. **EEPROM Pin 2 (SCL)** → TCA9548A SCL0 (Kanal 0)
3. **EEPROM Pin 3 (SDA)** → TCA9548A SDA0 (Kanal 0)
4. **EEPROM Pin 4 (A0)** → GND
5. **EEPROM Pin 5 (A1)** → GND
6. **EEPROM Pin 7 (WP)** → GND
7. **EEPROM Pin 8 (VCC)** → 3.3V

**Ergebnis:** EEPROM sollte bei Adresse **0x50** auf **Kanal 0** erreichbar sein.

## Fehlerbehebung

### EEPROM wird nicht gefunden:

1. **Pullup-Widerstände prüfen**
   - SDA und SCL sollten Pullups haben (4.7kΩ zu 3.3V)

2. **Kanal prüfen**
   - Code testet automatisch alle Kanäle (0-7)
   - Prüfe ob EEPROM auf dem richtigen Kanal angeschlossen ist

3. **Adresse prüfen**
   - Code testet automatisch alle Adressen (0x50-0x57)
   - Prüfe A0/A1 Verbindungen

4. **Verkabelung prüfen**
   - SDA/SCL nicht vertauscht?
   - VCC/GND korrekt?
   - Alle Verbindungen fest?

5. **Multimeter-Test**
   - VCC sollte 3.3V zeigen
   - GND sollte 0V zeigen
   - SDA/SCL sollten ~3.3V zeigen (durch Pullups)

## Beispiel für mehrere EEPROMs

Wenn du 8 EEPROMs anschließen willst (eines pro Kanal):

```
EEPROM 1: Kanal 0, A0=GND, A1=GND → Adresse 0x50
EEPROM 2: Kanal 1, A0=GND, A1=GND → Adresse 0x50
EEPROM 3: Kanal 2, A0=GND, A1=GND → Adresse 0x50
...
EEPROM 8: Kanal 7, A0=GND, A1=GND → Adresse 0x50
```

**Wichtig:** Da jedes EEPROM auf einem anderen Kanal ist, können alle die gleiche Adresse (0x50) haben!

## Nächste Schritte

1. EEPROM nach obigem Schema anschließen
2. Code hochladen (`TEST_EEPROM.ino`)
3. Serial Monitor öffnen (115200 Baud)
4. Code findet automatisch:
   - Den richtigen Kanal
   - Die richtige Adresse
   - Zeigt ob EEPROM leer ist

Viel Erfolg! 🚀
