# Anleitung: Stationen hinzufügen - Fehlerbehebung

## Problem
Das Hinzufügen einer Station funktionierte nicht aufgrund von:
- Fehlenden Datenbankfeldern im TypeScript Interface
- Zu restriktiven Row Level Security (RLS) Policies
- Unzureichender Fehlerbehandlung
- Fehlende automatische Standorterkennung

## Lösung

### ✅ Neue Features
- **Automatische Standorterkennung**: Ihr aktueller Standort wird automatisch als Koordinaten verwendet
- **Erweiterte Felder**: Beschreibung, Adresse und Powerbank-Anzahl
- **Bessere Fehlerbehandlung**: Detaillierte Fehlermeldungen

### 1. SQL-Policies aktualisieren

Führen Sie die folgende SQL-Datei in Ihrem Supabase SQL Editor aus:

```bash
supabase_fix_station_policies.sql
```

**Oder manuell in Supabase:**

1. Öffnen Sie Ihren Supabase Dashboard
2. Gehen Sie zu "SQL Editor"
3. Führen Sie den Inhalt von `supabase_fix_station_policies.sql` aus

### 2. Umgebungsvariablen überprüfen

Stellen Sie sicher, dass Sie eine `.env.local` Datei haben mit:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Anwendung neu starten

```bash
npm run dev
```

### 4. Testen

1. Melden Sie sich als Owner an
2. Gehen Sie zum Dashboard (`/dashboard`)
3. Klicken Sie auf "+ Neue Station"
4. **Erlauben Sie Standortzugriff** wenn der Browser danach fragt
5. Sie sehen eine grüne Meldung: "Ihr aktueller Standort wird als Koordinaten verwendet"
6. Füllen Sie das Formular aus:
   - **Name** (erforderlich): z.B. "Hauptbahnhof"
   - **Beschreibung** (optional): z.B. "Powerbank-Station am Hauptbahnhof"
   - **Adresse** (optional): z.B. "Europaplatz 1, 10557 Berlin"
   - **Breitengrad/Längengrad**: Automatisch Ihr Standort (kann manuell geändert werden)
   - **Verfügbare Powerbanks**: z.B. 8
   - **Gesamt Powerbanks**: z.B. 12
7. Klicken Sie auf "Hinzufügen"

### 5. Browser-Konsole öffnen (zum Debuggen)

Öffnen Sie die Browser-Entwicklerkonsole um detaillierte Informationen zu sehen:
- **Chrome/Edge**: F12 oder Rechtsklick → "Untersuchen" → "Console"
- **Firefox**: F12 oder Rechtsklick → "Element untersuchen" → "Konsole"

Sie sollten folgende Meldungen sehen:
```
Benutzerstandort erhalten: {lat: 52.xxx, lng: 13.xxx}
Station erfolgreich hinzugefügt: [{...}]
```

Bei Fehlern sehen Sie:
```
Supabase Fehler: {message: "...", details: "..."}
```

## Neue Felder im Formular

Das Formular hat jetzt folgende neue Felder:

- **Beschreibung**: Optionale Beschreibung der Station
- **Adresse**: Optionale Adresse der Station
- **Breitengrad/Längengrad**: **Automatisch Ihr aktueller Standort** 📍
- **Verfügbare Powerbanks**: Anzahl der verfügbaren Powerbanks
- **Gesamt Powerbanks**: Gesamtanzahl der Powerbanks

### Standorterkennung

Das Formular verwendet automatisch Ihren aktuellen Standort:
1. Der Browser fragt nach Standortberechtigung
2. Wenn erlaubt: Ihre GPS-Koordinaten werden automatisch eingesetzt
3. Eine grüne Info-Box zeigt: "Ihr aktueller Standort wird als Koordinaten verwendet"
4. Sie können die Koordinaten manuell ändern, falls gewünscht
5. Fallback: Wenn Standort nicht verfügbar → Berlin-Koordinaten (52.52, 13.405)

## Fehlerbehandlung

Wenn ein Fehler auftritt, wird jetzt eine detaillierte Fehlermeldung angezeigt:
- Im Formular selbst (rote Box)
- Im Dashboard (oben)
- In der Browser-Konsole (für Entwickler)

## Häufige Fehler

### "new row violates row-level security policy"
**Ursache**: Die Datenbank-Policies erlauben das Einfügen nicht
**Lösung**: Führen Sie `supabase_fix_station_policies.sql` aus

### "permission denied for table stations"
**Ursache**: Sie sind nicht eingeloggt oder haben keine Berechtigung
**Lösung**: 
1. Stellen Sie sicher, dass Sie eingeloggt sind
2. Überprüfen Sie ob Sie die Owner-Rolle haben
3. Führen Sie `supabase_fix_station_policies.sql` aus

### "null value in column violates not-null constraint"
**Ursache**: Ein erforderliches Feld fehlt
**Lösung**: Füllen Sie mindestens das Name-Feld aus

### Standort wird nicht erkannt
**Ursache**: Browser-Berechtigung fehlt oder Geolocation nicht verfügbar
**Lösung**:
1. Erlauben Sie Standortzugriff in Ihrem Browser
2. Überprüfen Sie die Browser-Konsole auf Geolocation-Fehler
3. Fallback: Koordinaten werden automatisch auf Berlin gesetzt (können manuell geändert werden)

### Station wird nicht in der Liste angezeigt
**Ursache**: Möglicherweise wurde die Station deaktiviert oder Fehler beim Einfügen
**Lösung**:
1. Überprüfen Sie die Browser-Konsole auf Fehler
2. Aktualisieren Sie die Seite (F5)
3. Überprüfen Sie in Supabase, ob die Station eingefügt wurde

## Überprüfung der Policies

Um zu überprüfen, ob die Policies korrekt sind:

```sql
SELECT * FROM pg_policies WHERE tablename = 'stations';
```

Sie sollten folgende Policies sehen:
- Allow public read access to active stations
- Allow authenticated read access to all stations
- Allow authenticated users to insert stations
- Allow authenticated users to update stations
- Allow authenticated users to delete stations

