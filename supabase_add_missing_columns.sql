-- Füge fehlende Spalten zur bestehenden stations Tabelle hinzu
-- Verwenden Sie dieses Script, wenn die Tabelle bereits existiert

-- Füge fehlende Spalten hinzu, falls sie nicht existieren
DO $$ 
BEGIN
    -- Füge description Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'description') THEN
        ALTER TABLE stations ADD COLUMN description TEXT;
        RAISE NOTICE 'description Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'description Spalte existiert bereits';
    END IF;
    
    -- Füge total_units Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'total_units') THEN
        ALTER TABLE stations ADD COLUMN total_units INTEGER DEFAULT 0;
        RAISE NOTICE 'total_units Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'total_units Spalte existiert bereits';
    END IF;
    
    -- Füge address Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'address') THEN
        ALTER TABLE stations ADD COLUMN address TEXT;
        RAISE NOTICE 'address Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'address Spalte existiert bereits';
    END IF;
    
    -- Füge is_active Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'is_active') THEN
        ALTER TABLE stations ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'is_active Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'is_active Spalte existiert bereits';
    END IF;
    
    -- Füge created_at Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'created_at') THEN
        ALTER TABLE stations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'created_at Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'created_at Spalte existiert bereits';
    END IF;
    
    -- Füge updated_at Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'updated_at') THEN
        ALTER TABLE stations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'updated_at Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'updated_at Spalte existiert bereits';
    END IF;
END $$;

-- Erstelle Indizes, falls sie nicht existieren
CREATE INDEX IF NOT EXISTS idx_stations_lat_lng ON stations (lat, lng);
CREATE INDEX IF NOT EXISTS idx_stations_active ON stations (is_active) WHERE is_active = true;

-- Erstelle eine Funktion zum automatischen Update des updated_at Feldes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Erstelle einen Trigger für automatisches Update
DROP TRIGGER IF EXISTS update_stations_updated_at ON stations;
CREATE TRIGGER update_stations_updated_at 
    BEFORE UPDATE ON stations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Keine Testdaten - Stationen werden über die UI oder ESP32-Geräte hinzugefügt

-- Erlaube öffentlichen Zugriff auf die Tabelle (für anonyme Benutzer)
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- Erstelle Policies, falls sie nicht existieren
DO $$
BEGIN
    -- Policy für öffentlichen Lesezugriff
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stations' AND policyname = 'Allow public read access to active stations') THEN
        CREATE POLICY "Allow public read access to active stations" ON stations
            FOR SELECT USING (is_active = true);
    END IF;
    
    -- Policy für eingeloggte Benutzer zum Hinzufügen von Stationen
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stations' AND policyname = 'Allow authenticated users to insert stations') THEN
        CREATE POLICY "Allow authenticated users to insert stations" ON stations
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    
    -- Policy für eingeloggte Benutzer zum Aktualisieren von Stationen
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stations' AND policyname = 'Allow authenticated users to update stations') THEN
        CREATE POLICY "Allow authenticated users to update stations" ON stations
            FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
END $$;
