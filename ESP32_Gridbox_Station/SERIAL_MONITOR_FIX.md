# Serieller Monitor zeigt nichts - Lösungen

## Problem
Upload war erfolgreich, aber Serieller Monitor zeigt keine Ausgabe.

## ✅ Lösung 1: ESP32 Reset (Häufigste Lösung!)

Nach dem Upload:
1. **Drücke RST/EN-Button** am ESP32
2. ESP32 startet neu
3. Ausgabe erscheint im Seriellen Monitor

---

## ✅ Lösung 2: Baudrate prüfen

Im Seriellen Monitor (Arduino IDE):

1. **Unten rechts** muss stehen: **115200 baud**
2. Falls nicht, ändere auf 115200
3. ESP32 neu starten (RST-Button)

---

## ✅ Lösung 3: Richtigen COM-Port wählen

1. **Arduino IDE:** Werkzeuge → Port
2. **Wähle:** COM5 (oder den Port mit "USB" im Namen)
3. **Serieller Monitor schließen und neu öffnen**

---

## ✅ Lösung 4: Serieller Monitor neu öffnen

1. **Schließe** den Seriellen Monitor
2. **Warte 2 Sekunden**
3. **Öffne neu:** Werkzeuge → Serieller Monitor (oder Strg+Shift+M)
4. **Reset-Button** am ESP32 drücken

---

## ✅ Lösung 5: USB-Verbindung zurücksetzen

1. **ESP32 USB-Kabel abstecken**
2. **Seriellen Monitor schließen**
3. **Warte 5 Sekunden**
4. **USB-Kabel wieder einstecken**
5. **Serieller Monitor öffnen**
6. **Reset-Button** am ESP32 drücken

---

## 🔍 Diagnose: Läuft der Code?

Teste ob der Code läuft (auch ohne Serial Monitor):

### LED-Test:
- **Schaut die LED am ESP32?**
- Bei Ausgabe sollte sie blinken!
- Teste: Ausleihe über App starten

### WiFi-Test:
- Leuchtet eine WiFi-LED?
- Blinkt irgendwas am ESP32?

---

## 🐛 Erweiterte Lösungen

### PowerShell COM-Port prüfen:
```powershell
[System.IO.Ports.SerialPort]::getportnames()
```

Sollte zeigen: `COM5` (oder ähnlich)

### Arduino IDE neustart:
1. Arduino IDE **komplett schließen**
2. ESP32 **abstecken**
3. ESP32 **wieder einstecken**
4. Arduino IDE **neu starten**
5. Port wählen
6. Seriellen Monitor öffnen

---

## ✅ Checkliste

Gehe diese Liste durch:

- [ ] Baudrate = 115200 baud
- [ ] Richtiger COM-Port (COM5)
- [ ] Serieller Monitor ist offen
- [ ] ESP32 Reset-Button gedrückt
- [ ] USB-Kabel fest eingesteckt
- [ ] Arduino IDE zeigt richtigen Port
- [ ] "Beide NL & CR" ist egal (egal welche Einstellung)

---

## 🎯 Was du sehen solltest:

Nach Reset sollte erscheinen:

```
╔═════════════════════════════════════════╗
║  Gridbox ESP32 Station Controller  ║
╚═════════════════════════════════════════╝

LED-Konfiguration:
  Pin: 2
  Status-Blinken: AUS (nur bei Ausgabe)
  Ausgabe-Dauer: 5 Sekunden

Sensor Pin 25 initialisiert
Sensor Pin 26 initialisiert
[...]

Verbinde mit WLAN...
SSID: [Dein WLAN]
..........
✓ WLAN verbunden!
IP Adresse: 192.168.x.x

=================================
Setup abgeschlossen!
=================================
```

---

## 💡 Immer noch nichts?

### Test-Code hochladen:

Lade diesen Mini-Test-Code hoch um Serial zu testen:

```cpp
void setup() {
  Serial.begin(115200);
  delay(2000);
}

void loop() {
  Serial.println("TEST - ESP32 läuft! Sekunde: " + String(millis()/1000));
  delay(1000);
}
```

Wenn das funktioniert → Upload vom Haupt-Code wiederholen
Wenn das nicht funktioniert → Hardware-Problem!

---

## 🆘 Noch Fragen?

Sag mir:
1. Siehst du die LED blinken am ESP32?
2. Welcher COM-Port ist ausgewählt?
3. Welche Baudrate steht unten rechts?
4. Passiert IRGENDWAS im Seriellen Monitor? (auch Zeichen/Müll?)

