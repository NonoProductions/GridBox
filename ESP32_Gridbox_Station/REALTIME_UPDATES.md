# Updates ohne ständiges Polling

Statt alle paar Sekunden eine HTTP-Anfrage zu schicken, gibt es zwei bessere Ansätze.

---

## Was läuft über Realtime vs. HTTP?

| Richtung | Inhalt | Methode | Erklärung |
|----------|--------|---------|-----------|
| **Server → ESP32** | Ausgabe anfordern (`dispense_requested`) | **Realtime** (WebSocket) | App setzt Flag → Supabase pusht Änderung → ESP32 öffnet Servo sofort. |
| **ESP32 → Server** | Powerbank erkannt (Spannung, Ladezustand) | **HTTP** (REST PATCH), nur bei Änderung | `updateBatteryData()` wird nur aufgerufen, wenn eine Powerbank **eingesteckt** oder **entfernt** wurde (plus einmal beim Start). Kein 15‑Sekunden-Takt mehr – weniger Requests, schnellere Meldung bei Einstecken/Entfernen. |
| **ESP32 → Server** | Stationsdaten abrufen, Flag zurücksetzen | **HTTP** (REST GET/PATCH) | `getStationData()`, `resetDispenseFlag()`, `syncTotalUnits()` wie bisher. |

**Warum nicht „alles“ per Realtime?** Supabase Realtime ist ein **Abonnement**: Der Server schickt Änderungen an Clients. Daten **vom ESP32 zum Server** (Batterie, Erkennung) werden weiter per HTTP gesendet – das ist die richtige Richtung. Realtime wird nur genutzt, damit der ESP32 **sofort** die Ausgabe-Anfrage erhält, ohne Polling.

---

## 1. **Supabase Realtime (Push – empfohlen)**

Der Server schickt nur dann Daten, **wenn sich etwas geändert hat**. Kein Polling, sofortige Reaktion auf `dispense_requested`.

- **Vorteile:** Keine unnötigen Requests, sofortige Reaktion, weniger Last.
- **Technik:** WebSocket-Verbindung zu Supabase Realtime; du abonnierst Änderungen an der Tabelle `stations` (nur deine Station). Bei UPDATE mit `dispense_requested = true` bekommst du ein Event.
- **Voraussetzung:** Die Tabelle `stations` ist bereits in der Supabase-Realtime-Publikation. Du brauchst die **Station-UUID** für den Filter (nicht nur den Short-Code).

### Realtime im ESP32 nutzen (bereits im Sketch vorbereitet)

1. In der Arduino IDE: Bibliothek **„WebSockets“** von **Links2004** installieren (Library Manager).
2. Im Sketch ganz oben **`USE_SUPABASE_REALTIME`** auf **`1`** setzen.
3. **STATION_ID** (UUID deiner Station) muss gesetzt sein – der Realtime-Filter nutzt `id=eq.<UUID>`. Bei `USE_SHORT_CODE true` kannst du weiterhin den Short-Code für REST nutzen; für Realtime wird die UUID benötigt.
4. Upload – der ESP32 baut dann eine WebSocket-Verbindung zu Supabase auf und bekommt nur bei Änderungen an deiner Station ein Event (z. B. `dispense_requested`).

Die Tabelle `stations` ist in deinem Projekt bereits in der Realtime-Publikation. Kein weiteres Setup nötig.

---

## 2. **Leichtes Polling (aktuell umgesetzt)**

Es werden **keine vollen Stationsdaten** für die Ausgabe-Prüfung geholt, sondern nur eine minimale Abfrage:

- `checkDispenseRequest()` fragt nur **eine Spalte** ab: `select=dispense_requested`
- Kleine Antwort, wenig Egress
- Intervall: `DISPENSE_POLL_INTERVAL` (Standard 15 s)

Die großen Updates (z. B. `charge_enabled`, `available_units`) laufen weiter über `getStationData()` im `UPDATE_INTERVAL` (ebenfalls 15 s). Du kannst:

- **Schnellere Reaktion:** `DISPENSE_POLL_INTERVAL` auf z. B. 3000 (3 s) stellen. Dann wird nur diese kleine Abfrage öfter ausgeführt, nicht die großen Requests.

---

## Vergleich

| Methode              | Requests                    | Reaktion        | Aufwand ESP32   |
|----------------------|-----------------------------|-----------------|------------------|
| Realtime (WebSocket) | Nur bei Änderung (Push)     | Sofort          | WebSocket-Client |
| Leichtes Polling     | Kleine Anfrage alle X Sek.  | Nach dem Intervall | Bereits eingebaut |

Für „nur checken, wenn etwas geändert wurde“ ist **Supabase Realtime** der passende Weg; das leichte Polling ist bereits eine sparsame Variante ohne Realtime.
