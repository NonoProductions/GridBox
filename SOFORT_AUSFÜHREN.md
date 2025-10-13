# 🚨 SOFORT AUSFÜHREN - Fehlende Datenbank-Spalten

## Probleme behoben
1. ✅ `available_units` und `total_units` Spalten fehlen
2. ✅ `owner_id` wird nicht automatisch gesetzt

**Beide Probleme sind jetzt behoben!**

## ✅ LÖSUNG (3 einfache Schritte)

### Schritt 1: Supabase Dashboard öffnen
1. Öffnen Sie: https://supabase.com/dashboard
2. Wählen Sie Ihr Projekt aus
3. Klicken Sie auf **"SQL Editor"** im linken Menü

### Schritt 2: SQL-Dateien ausführen

**WICHTIG: In dieser Reihenfolge ausführen!**

#### A) Fehlende Spalten hinzufügen
Datei: `supabase_fix_missing_columns.sql`

1. Öffnen Sie die Datei
2. Kopieren Sie den gesamten Inhalt
3. Fügen Sie ihn in den SQL Editor ein
4. Klicken Sie auf **"Run"** (oder F5)
5. ✅ Sie sollten sehen: "✅ available_units Spalte hinzugefügt"

#### B) Policies aktualisieren
Datei: `supabase_fix_station_policies.sql`

1. Öffnen Sie die Datei
2. Kopieren Sie den gesamten Inhalt
3. Fügen Sie ihn in den SQL Editor ein
4. Klicken Sie auf **"Run"** (oder F5)

### Schritt 3: Überprüfen

Im SQL Editor ausführen:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stations'
ORDER BY ordinal_position;
```

Sie sollten ALLE diese Spalten sehen:
- ✅ id
- ✅ name
- ✅ lat
- ✅ lng
- ✅ **available_units** ← Diese war vorher nicht da!
- ✅ **total_units** ← Diese war vorher nicht da!
- ✅ description
- ✅ address
- ✅ is_active
- ✅ created_at
- ✅ updated_at

## 🎉 Fertig!

### Code-Änderungen (bereits erledigt)
Die `owner_id` wird jetzt **automatisch** hinzugefügt! Der Code:
- Holt den aktuell eingeloggten Benutzer
- Fügt dessen ID als `owner_id` automatisch hinzu
- **Sie müssen nichts weiter tun!**

Siehe: `OWNER_ID_FIX.md` für Details

Jetzt sollte das Hinzufügen von Stationen funktionieren!

### Testen:
1. Gehen Sie zurück zu Ihrer App
2. Aktualisieren Sie die Seite (F5)
3. Klicken Sie auf "+ Neue Station"
4. Füllen Sie das Formular aus
5. Klicken Sie auf "Hinzufügen"

✅ Es sollte jetzt funktionieren!

## ❓ Immer noch Fehler?

### Cache-Problem
Supabase cached manchmal das Schema. Warten Sie 30 Sekunden und versuchen Sie es erneut.

Oder führen Sie aus:
```sql
NOTIFY pgrst, 'reload schema';
```

### Überprüfen Sie die Browser-Konsole
Öffnen Sie die Konsole (F12) und suchen Sie nach:
- ✅ "Station erfolgreich hinzugefügt"
- ❌ Anderen Fehlermeldungen

