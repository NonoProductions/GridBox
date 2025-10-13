-- Universelles Setup-Script für die stations Tabelle
-- Funktioniert mit jeder bestehenden Tabellenstruktur

-- 1. Analysiere die aktuelle Tabellenstruktur
DO $$
DECLARE
    col_exists boolean;
BEGIN
    RAISE NOTICE 'Analysiere aktuelle Tabellenstruktur...';
    
    -- Prüfe jede Spalte einzeln
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'id'
    ) INTO col_exists;
    RAISE NOTICE 'id Spalte existiert: %', col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'name'
    ) INTO col_exists;
    RAISE NOTICE 'name Spalte existiert: %', col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'description'
    ) INTO col_exists;
    RAISE NOTICE 'description Spalte existiert: %', col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'lat'
    ) INTO col_exists;
    RAISE NOTICE 'lat Spalte existiert: %', col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'lng'
    ) INTO col_exists;
    RAISE NOTICE 'lng Spalte existiert: %', col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'available_units'
    ) INTO col_exists;
    RAISE NOTICE 'available_units Spalte existiert: %', col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'total_units'
    ) INTO col_exists;
    RAISE NOTICE 'total_units Spalte existiert: %', col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'address'
    ) INTO col_exists;
    RAISE NOTICE 'address Spalte existiert: %', col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'is_active'
    ) INTO col_exists;
    RAISE NOTICE 'is_active Spalte existiert: %', col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'created_at'
    ) INTO col_exists;
    RAISE NOTICE 'created_at Spalte existiert: %', col_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stations' AND column_name = 'updated_at'
    ) INTO col_exists;
    RAISE NOTICE 'updated_at Spalte existiert: %', col_exists;
END $$;

-- 2. Füge fehlende Spalten hinzu
DO $$ 
BEGIN
    -- Füge description Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'description') THEN
        ALTER TABLE stations ADD COLUMN description TEXT;
        RAISE NOTICE 'description Spalte hinzugefügt';
    END IF;
    
    -- Füge total_units Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'total_units') THEN
        ALTER TABLE stations ADD COLUMN total_units INTEGER DEFAULT 0;
        RAISE NOTICE 'total_units Spalte hinzugefügt';
    END IF;
    
    -- Füge address Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'address') THEN
        ALTER TABLE stations ADD COLUMN address TEXT;
        RAISE NOTICE 'address Spalte hinzugefügt';
    END IF;
    
    -- Füge is_active Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'is_active') THEN
        ALTER TABLE stations ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'is_active Spalte hinzugefügt';
    END IF;
    
    -- Füge created_at Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'created_at') THEN
        ALTER TABLE stations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'created_at Spalte hinzugefügt';
    END IF;
    
    -- Füge updated_at Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'updated_at') THEN
        ALTER TABLE stations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'updated_at Spalte hinzugefügt';
    END IF;
END $$;

-- 3. Erstelle Indizes, falls sie nicht existieren
CREATE INDEX IF NOT EXISTS idx_stations_lat_lng ON stations (lat, lng);
CREATE INDEX IF NOT EXISTS idx_stations_active ON stations (is_active) WHERE is_active = true;

-- 4. Erstelle Funktionen und Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_stations_updated_at ON stations;
CREATE TRIGGER update_stations_updated_at 
    BEFORE UPDATE ON stations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Füge Beispieldaten hinzu (nur wenn alle notwendigen Spalten existieren)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'available_units') THEN
        -- Füge Beispieldaten hinzu, falls noch keine vorhanden sind
        INSERT INTO stations (name, description, lat, lng, available_units, total_units, address) 
        SELECT 'Hauptbahnhof', 'Powerbank-Station am Hauptbahnhof', 52.525, 13.369, 8, 12, 'Europaplatz 1, 10557 Berlin'
        WHERE NOT EXISTS (SELECT 1 FROM stations WHERE name = 'Hauptbahnhof');
        
        INSERT INTO stations (name, description, lat, lng, available_units, total_units, address) 
        SELECT 'Stadttor', 'Station am Stadttor', 52.515, 13.405, 3, 8, 'Stadttor 1, 10117 Berlin'
        WHERE NOT EXISTS (SELECT 1 FROM stations WHERE name = 'Stadttor');
        
        INSERT INTO stations (name, description, lat, lng, available_units, total_units, address) 
        SELECT 'City Mall', 'Powerbank-Station in der City Mall', 52.505, 13.39, 12, 15, 'Alexanderplatz 1, 10178 Berlin'
        WHERE NOT EXISTS (SELECT 1 FROM stations WHERE name = 'City Mall');
        
        RAISE NOTICE 'Beispieldaten hinzugefügt';
    ELSE
        RAISE NOTICE 'available_units Spalte existiert nicht - Beispieldaten werden übersprungen';
    END IF;
END $$;

-- 6. Richte Row Level Security ein
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- Erstelle Policies, falls sie nicht existieren
DO $$
BEGIN
    -- Policy für öffentlichen Lesezugriff
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stations' AND policyname = 'Allow public read access to active stations') THEN
        CREATE POLICY "Allow public read access to active stations" ON stations
            FOR SELECT USING (is_active = true);
        RAISE NOTICE 'Policy für öffentlichen Lesezugriff erstellt';
    END IF;
    
    -- Policy für eingeloggte Benutzer zum Hinzufügen von Stationen
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stations' AND policyname = 'Allow authenticated users to insert stations') THEN
        CREATE POLICY "Allow authenticated users to insert stations" ON stations
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
        RAISE NOTICE 'Policy für eingeloggte Benutzer (INSERT) erstellt';
    END IF;
    
    -- Policy für eingeloggte Benutzer zum Aktualisieren von Stationen
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stations' AND policyname = 'Allow authenticated users to update stations') THEN
        CREATE POLICY "Allow authenticated users to update stations" ON stations
            FOR UPDATE USING (auth.role() = 'authenticated');
        RAISE NOTICE 'Policy für eingeloggte Benutzer (UPDATE) erstellt';
    END IF;
END $$;

-- 7. Zeige finale Tabellenstruktur
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'stations' 
ORDER BY ordinal_position;

RAISE NOTICE 'Setup abgeschlossen!';


