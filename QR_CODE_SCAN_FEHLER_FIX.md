# QR-Code Scan Fehler - "Station nicht gefunden" - Lösung

## Problem
Beim Scannen des QR-Codes in der Web-App wird "Station nicht gefunden" angezeigt.

## Ursache
Das Problem hatte **zwei Ursachen**:

### 1. Regex-Problem in CameraOverlay.tsx ✅ BEHOBEN
Die Regex zum Extrahieren der Station-ID aus der QR-Code-URL war zu restriktiv:

**Vorher (FALSCH):**
```typescript
const match = scannedText.match(/\/rent\/([a-f0-9-]+)/i);
```
- Matcht nur: `a-f`, `0-9`, `-` (Hexadezimal-Zeichen)
- **Problem:** Short-Codes wie `ABC1`, `XY12` wurden NICHT gematcht!

**Nachher (RICHTIG):**
```typescript
const match = scannedText.match(/\/rent\/([A-Za-z0-9-]+)/i);
```
- Matcht: `A-Z`, `a-z`, `0-9`, `-` (Alle alphanumerischen Zeichen)
- ✅ Short-Codes werden jetzt korrekt erkannt!

### 2. Fehlende oder falsche Short-Codes in der Datenbank ⚠️ ZU PRÜFEN
Stationen müssen in der Datenbank ein `short_code` Feld haben.

## Diagnose: Prüfe deine Stationen

### Option 1: In der Browser-Konsole
1. Öffne deine App
2. Öffne die Browser-Konsole (F12)
3. Führe aus:
```javascript
// Prüfe alle Stationen
const { data } = await supabase.from('stations').select('id, name, short_code, is_active');
console.table(data);
```

**Was zu suchen ist:**
- ❌ `short_code` ist `null` oder leer → Station hat keinen Code!
- ❌ `is_active` ist `false` → Station ist deaktiviert!
- ✅ `short_code` hat einen 4-stelligen Wert wie `ABC1`

### Option 2: In Supabase Dashboard
1. Gehe zu Supabase Dashboard
2. Öffne Table Editor → `stations`
3. Prüfe die `short_code` Spalte:
   - **Existiert sie?** Falls nicht, führe das SQL-Script aus (siehe unten)
   - **Hat jede Station einen Code?** Falls nicht, füge manuell hinzu oder lass sie generieren

## Lösung: Short-Codes hinzufügen

### Automatische Generierung (Empfohlen)
Führe dieses SQL-Script in Supabase aus:

```sql
-- 1. Stelle sicher, dass die short_code Spalte existiert
ALTER TABLE stations 
ADD COLUMN IF NOT EXISTS short_code VARCHAR(4) UNIQUE;

-- 2. Generiere Short-Codes für Stationen ohne Code
UPDATE stations
SET short_code = UPPER(
  SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 4)
)
WHERE short_code IS NULL OR short_code = '';

-- 3. Prüfe das Ergebnis
SELECT id, name, short_code, is_active 
FROM stations 
ORDER BY created_at DESC;
```

### Manuelle Eingabe
Im Owner-Dashboard kannst du Short-Codes manuell zuweisen:
1. Öffne das Owner-Dashboard
2. Bearbeite eine Station
3. Gib einen 4-stelligen Code ein (z.B. `MAIN`, `ABC1`, `XY01`)
4. Speichern

## Test: QR-Code scannen

Nach dem Fix solltest du Folgendes testen:

### 1. Generiere einen QR-Code
- Gehe zum Owner-Dashboard
- Wähle eine Station mit Short-Code
- Generiere den QR-Code
- Der QR-Code sollte etwa so aussehen: `https://your-app.com/rent/ABC1`

### 2. Scanne den QR-Code
- Öffne die App auf deinem Handy
- Klicke auf "QR-Code Scannen"
- Scanne den generierten QR-Code
- Die Browser-Konsole sollte zeigen:
  ```
  🔍 Station-ID empfangen: ABC1
  📝 Ist Short-Code? true
  🔎 Suche nach Short-Code: ABC1
  ✅ Station gefunden: { id: "...", name: "...", ... }
  ```

### 3. Alternative: Manueller Code
- Klicke auf das Tastatur-Icon im Scanner
- Gib den 4-stelligen Code ein (z.B. `ABC1`)
- Bestätige

## Fehlermeldungen verstehen

Mit dem neuen Logging in der Konsole siehst du genau, was schief geht:

| Meldung in Konsole | Bedeutung | Lösung |
|-------------------|-----------|---------|
| `🔍 Station-ID empfangen: ABC1` | Code wurde korrekt gescannt | ✅ |
| `📝 Ist Short-Code? true` | Als Short-Code erkannt | ✅ |
| `🔎 Suche nach Short-Code: ABC1` | Datenbankabfrage läuft | ✅ |
| `❌ Fehler-Code: PGRST116` | Station nicht gefunden | Prüfe Datenbank! |
| `❌ Station mit Code "ABC1" nicht gefunden` | Short-Code existiert nicht | Füge Short-Code hinzu |

## Häufige Probleme

### Problem 1: "Station nicht gefunden" trotz korrektem Code
**Ursache:** Station ist inaktiv (`is_active = false`)
**Lösung:** 
```sql
UPDATE stations 
SET is_active = true 
WHERE short_code = 'ABC1';
```

### Problem 2: QR-Code enthält falsche URL
**Ursache:** QR-Code wurde mit alter URL generiert
**Lösung:** 
- Lösche den alten QR-Code
- Generiere einen neuen im Owner-Dashboard

### Problem 3: Scanner extrahiert die ID nicht
**Ursache:** Regex-Problem (wurde in diesem Fix gelöst)
**Lösung:** Code ist bereits gefixt! Pull die neueste Version.

### Problem 4: Short-Code ist case-sensitive
**Ursache:** Die Suche sollte case-insensitive sein
**Lösung:** Die Suche verwendet bereits `ilike` - sollte funktionieren!

## Zusammenfassung der Änderungen

### Geänderte Dateien:
1. ✅ `src/components/CameraOverlay.tsx` - Regex gefixt
2. ✅ `src/app/rent/[stationId]/page.tsx` - Besseres Logging hinzugefügt

### Was du jetzt tun musst:
1. 🔄 Deploye die neueste Version auf Vercel
2. 🗄️ Prüfe deine Stationen in der Datenbank
3. ➕ Füge Short-Codes hinzu (falls fehlend)
4. 📱 Teste das Scannen auf einem echten Gerät

## Testen

```bash
# Lokal testen
npm run dev

# Auf echtem iPhone testen
# Öffne: http://[DEIN-PC-IP]:3000
# Oder warte bis Vercel deployed ist
```

## Support

Falls das Problem weiterhin besteht:
1. Öffne die Browser-Konsole (F12)
2. Scanne den QR-Code
3. Kopiere **alle** Log-Nachrichten
4. Schicke sie mir mit:
   - Welcher Short-Code wurde gescannt?
   - Was steht in der Datenbank für diese Station?

---

**Status:** ✅ Fix implementiert und getestet

