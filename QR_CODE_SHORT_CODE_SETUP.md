# QR-Code & Short Code Setup Anleitung

## 📋 Übersicht

Diese Anleitung erklärt, wie das neue QR-Code System mit 4-stelligen Short Codes eingerichtet wird.

## 🎯 Features

### 1. **QR-Codes mit URLs**
- QR-Codes enthalten jetzt vollständige URLs: `https://gridbox-app.vercel.app/rent/[station-id]`
- Funktionieren mit jeder Handy-Kamera App
- Öffnen direkt die Ausleih-Bestätigungsseite im Browser

### 2. **4-stellige Short Codes**
- Jede Station hat einen eindeutigen 4-stelligen Code (z.B. "A3B7", "K4P9")
- Für manuelle Eingabe wenn QR-Code nicht lesbar ist
- Verwendet nur gut lesbare Zeichen (ohne 0, O, 1, I)
- Wird automatisch bei Station-Erstellung generiert

### 3. **Owner Dashboard Integration**
- Neuer "QR-Codes" Tab im Owner Dashboard
- Download-Funktion für jeden QR-Code
- Short Code wird prominent angezeigt
- Verwendungshinweise für Ausdrucken und Platzieren

## 🛠️ Datenbank Setup

### Schritt 1: SQL-Script ausführen

Führe das SQL-Script `supabase_add_short_code.sql` in deiner Supabase-Datenbank aus:

```sql
-- Im Supabase SQL Editor
-- Kopiere und führe den Inhalt von supabase_add_short_code.sql aus
```

Das Script macht folgendes:
- ✅ Fügt `short_code` Spalte zur `stations` Tabelle hinzu
- ✅ Erstellt einen Index für schnellere Suchen
- ✅ Erstellt eine Funktion zum Generieren von Codes
- ✅ Erstellt einen Trigger für automatische Code-Generierung bei neuen Stationen
- ✅ Generiert Codes für alle bestehenden Stationen

### Schritt 2: Verifizieren

Prüfe ob alles funktioniert hat:

```sql
-- Prüfe ob short_code Spalte existiert
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stations' AND column_name = 'short_code';

-- Prüfe ob Codes generiert wurden
SELECT id, name, short_code FROM stations;
```

## 📱 Verwendung

### Für Station-Betreiber (Owner)

1. **Öffne das Owner Dashboard**
   - Navigiere zum Dashboard in der App
   - Wechsle zum "QR-Codes" Tab

2. **QR-Code herunterladen**
   - Wähle eine Station
   - Klicke auf "QR-Code herunterladen"
   - Der Code wird als PNG-Datei heruntergeladen

3. **QR-Code ausdrucken**
   - Drucke in guter Qualität (mindestens 10x10 cm)
   - Laminiere den Code oder verwende wetterfeste Aufkleber
   - Notiere den 4-stelligen Short Code auf den Ausdruck

4. **QR-Code anbringen**
   - Platziere an gut sichtbarer Stelle (Augenhöhe 1,2-1,6m)
   - Gute Beleuchtung sicherstellen
   - Zusätzlich den 4-stelligen Code gut lesbar anbringen

### Für Nutzer

#### Option A: QR-Code scannen (Handy-Kamera)
1. Öffne die Kamera-App deines Handys
2. Richte die Kamera auf den QR-Code
3. Tippe auf die erscheinende Benachrichtigung
4. Browser öffnet sich mit Ausleih-Bestätigung
5. Gib Email und Name ein (falls nicht angemeldet)
6. Bestätige die Ausleihe

#### Option B: QR-Code scannen (In-App)
1. Öffne die GridBox App
2. Tippe auf den Scan-Button
3. Scanne den QR-Code
4. Bestätigungsmodal erscheint
5. Bestätige die Ausleihe

#### Option C: Manueller Code
1. Öffne die GridBox App
2. Tippe auf den Scan-Button
3. Tippe auf das Tastatur-Symbol
4. Gib den 4-stelligen Code ein (z.B. "A3B7")
5. Bestätige
6. Bestätigungsmodal erscheint

## 🔧 Technische Details

### Unterstützte Formate

Der Scanner erkennt automatisch verschiedene Formate:

1. **URL**: `https://gridbox-app.vercel.app/rent/abc-123-def`
2. **Alt-Format**: `GRIDBOX-STATION-abc-123-def`
3. **Station-ID**: `abc-123-def`
4. **Short Code**: `A3B7` (4-stellig, alphanumerisch)

### Short Code Generierung

Codes werden automatisch generiert mit:
- 4 Zeichen
- Großbuchstaben (A-Z, ohne O, I)
- Zahlen (2-9, ohne 0, 1)
- Eindeutig in der Datenbank
- Beispiele: A3B7, K4P9, M8R2, etc.

### Datenbank-Schema

```sql
ALTER TABLE stations ADD COLUMN short_code VARCHAR(4) UNIQUE;
CREATE INDEX idx_stations_short_code ON stations(short_code);
```

## 📝 Neue Dateien

- `src/app/rent/[stationId]/page.tsx` - Ausleih-Bestätigungsseite
- `src/components/RentalConfirmationModal.tsx` - Bestätigungsmodal
- `supabase_add_short_code.sql` - Datenbank-Migration

## ✅ Checkliste

Nach dem Setup:

- [ ] SQL-Script erfolgreich ausgeführt
- [ ] Alle Stationen haben einen `short_code`
- [ ] Owner Dashboard zeigt QR-Codes Tab
- [ ] QR-Code Download funktioniert
- [ ] Short Codes sind sichtbar
- [ ] Manuelle Code-Eingabe funktioniert
- [ ] QR-Codes öffnen richtige URL (gridbox-app.vercel.app)
- [ ] Ausleih-Bestätigung erscheint nach Scan

## 🆘 Troubleshooting

### Problem: Short Codes werden nicht generiert

**Lösung**: Führe das SQL-Script erneut aus oder generiere manuell:

```sql
-- Generiere Codes für Stationen ohne short_code
UPDATE stations 
SET short_code = generate_short_code() 
WHERE short_code IS NULL;
```

### Problem: QR-Code öffnet falsche URL

**Lösung**: Prüfe die Base-URL in `src/components/StationQRCode.tsx`:

```typescript
const baseUrl = 'https://gridbox-app.vercel.app';
```

### Problem: Manueller Code wird nicht erkannt

**Lösung**: Prüfe ob Code in Datenbank existiert:

```sql
SELECT * FROM stations WHERE short_code = 'A3B7';
```

## 🎉 Fertig!

Das System ist jetzt einsatzbereit! Nutzer können Stationen auf drei Arten scannen:
1. ✅ Handy-Kamera (QR-Code → URL → Browser)
2. ✅ In-App Scanner (QR-Code → Modal)
3. ✅ Manueller Code (4-stellig → Modal)

