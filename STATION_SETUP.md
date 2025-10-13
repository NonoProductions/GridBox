# Station Setup Guide

Diese Anleitung erklärt, wie Sie echte Stationen mit Supabase-Datenbank zu Ihrer Gridbox PWA hinzufügen können.

## Voraussetzungen

1. **Supabase-Projekt**: Sie benötigen ein aktives Supabase-Projekt
2. **Umgebungsvariablen**: Konfigurieren Sie Ihre Supabase-Credentials

## Setup-Schritte

### 1. Supabase-Datenbank einrichten

1. Öffnen Sie Ihr Supabase-Projekt im Dashboard
2. Gehen Sie zu "SQL Editor"
3. Führen Sie das SQL-Script aus `supabase_stations_table.sql` aus:

```sql
-- Das komplette SQL-Script ist in der Datei supabase_stations_table.sql enthalten
-- Es erstellt:
-- - Die 'stations' Tabelle mit allen notwendigen Feldern
-- - Indizes für bessere Performance (ohne PostGIS)
-- - Row Level Security Policies
-- - Beispieldaten
```

**Hinweis**: Falls Sie PostGIS-Funktionen benötigen, verwenden Sie stattdessen `supabase_stations_table_with_postgis.sql`. PostGIS muss in Ihrem Supabase-Projekt aktiviert sein.

### 2. Benutzerrollen-System einrichten (Optional)

Falls Sie ein Owner-Dashboard mit Rollen-basierter Zugriffskontrolle benötigen:

1. Führen Sie das SQL-Script `supabase_user_roles.sql` aus
2. Ersetzen Sie `'your-user-uuid-here'` mit Ihrer tatsächlichen Benutzer-UUID
3. Sie finden Ihre UUID im Supabase Auth-Dashboard

### 3. Umgebungsvariablen konfigurieren

1. Kopieren Sie `env.example` zu `.env.local`:
```bash
cp env.example .env.local
```

2. Füllen Sie Ihre Supabase-Credentials aus:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Anwendung starten

```bash
npm run dev
```

## Neue Features

### Station-Management
- **StationManager**: Verwaltet alle CRUD-Operationen für Stationen
- **AddStationForm**: Formular zum Hinzufügen neuer Stationen
- **Automatisches Laden**: Stationen werden automatisch aus der Datenbank geladen

### Benutzeroberfläche
- **+ Button**: Grüner Plus-Button links unten zum Hinzufügen von Stationen
- **Formular**: Vollständiges Formular mit Validierung
- **Echtzeit-Updates**: Neue Stationen erscheinen sofort auf der Karte

## Datenbank-Schema

### Stations-Tabelle
```sql
CREATE TABLE stations (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  available_units INTEGER DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Sicherheit

- **Row Level Security**: Aktiviert für alle Operationen
- **Public Read**: Jeder kann aktive Stationen lesen
- **Authenticated Write**: Nur eingeloggte Benutzer können Stationen hinzufügen/bearbeiten

## Verwendung

### Station hinzufügen
1. **Owner**: Verwenden Sie das Owner-Dashboard (Menü → "Owner Dashboard")
2. Klicken Sie auf "Neue Station" im Dashboard
3. Füllen Sie das Formular aus
4. Die Station wird automatisch zur Karte hinzugefügt

**Hinweis**: Nur Owner können Stationen hinzufügen. Normale Benutzer können Stationen nur anzeigen und für Navigation verwenden.

### Owner-Dashboard (nur für Owner)
- **Zugriff**: 
  - Über das Menü (Account-Button) → "Owner Dashboard"
  - Direkter Link: `/dashboard` (mit Theme-Parameter: `/dashboard?theme=dark`)
- **Stationen verwalten**: Alle Stationen anzeigen, bearbeiten, löschen
- **Benutzer verwalten**: Rollen zuweisen (Owner, User)
- **Erweiterte Funktionen**: Vollständige CRUD-Operationen
- **Eigene Seite**: Vollständige Dashboard-Seite mit Navigation

### Station bearbeiten
- **Owner**: Über das Owner-Dashboard
- **Normale Benutzer**: Keine Bearbeitungsrechte

### Station löschen
- **Owner**: Über das Owner-Dashboard (echtes Löschen)
- **Normale Benutzer**: Keine Löschrechte

## Fehlerbehebung

### PostGIS-Fehler: "function st_point does not exist"
**Problem**: Der Fehler tritt auf, wenn PostGIS nicht aktiviert ist.
**Lösung**: 
- Verwenden Sie `supabase_stations_table.sql` (ohne PostGIS)
- Oder aktivieren Sie PostGIS in Ihrem Supabase-Projekt und verwenden Sie `supabase_stations_table_with_postgis.sql`

### Spalten-Fehler: "column does not exist"
**Problem**: Die Tabelle existiert bereits, aber ohne alle notwendigen Spalten.
**Lösung**: 
- **Empfohlen**: Verwenden Sie `supabase_universal_setup.sql` - funktioniert mit jeder Tabellenstruktur
- Oder verwenden Sie `supabase_add_missing_columns.sql` um fehlende Spalten hinzuzufügen
- Oder analysieren Sie zuerst mit `supabase_analyze_table.sql` die aktuelle Struktur
- Oder löschen Sie die bestehende Tabelle und verwenden Sie das vollständige Script

### Stationen werden nicht geladen
1. Überprüfen Sie Ihre Supabase-Credentials
2. Stellen Sie sicher, dass die Tabelle existiert
3. Überprüfen Sie die Browser-Konsole auf Fehler

### Formular funktioniert nicht
1. Überprüfen Sie die Supabase-Policies
2. Stellen Sie sicher, dass Sie eingeloggt sind (falls erforderlich)
3. Überprüfen Sie die Netzwerk-Verbindung

### Owner-Dashboard nicht sichtbar
**Problem**: Der "Owner Dashboard" Button erscheint nicht im Menü.
**Lösung**: 
1. Stellen Sie sicher, dass Sie das `supabase_user_roles.sql` Script ausgeführt haben
2. Überprüfen Sie, ob Ihre Benutzer-UUID korrekt als Owner eingetragen ist
3. Melden Sie sich ab und wieder an, um die Rollen zu aktualisieren

## Erweiterte Features (Optional)

### Geografische Abfragen
Die Datenbank unterstützt PostGIS-Funktionen für erweiterte geografische Abfragen:

```sql
-- Finde Stationen in einem bestimmten Radius
SELECT * FROM stations 
WHERE ST_DWithin(
  ST_Point(lng, lat)::geography,
  ST_Point(13.405, 52.52)::geography,
  1000  -- 1000 Meter
);
```

### Automatische Updates
Sie können Triggers für automatische Updates einrichten:

```sql
-- Beispiel: Automatisches Update des updated_at Feldes
CREATE TRIGGER update_stations_updated_at 
    BEFORE UPDATE ON stations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## Support

Bei Problemen oder Fragen:
1. Überprüfen Sie die Browser-Konsole
2. Überprüfen Sie die Supabase-Logs
3. Stellen Sie sicher, dass alle Abhängigkeiten installiert sind
