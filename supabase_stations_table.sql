-- Erstelle die Tabelle für Powerbank-Stationen
CREATE TABLE IF NOT EXISTS stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Füge fehlende Spalten hinzu, falls die Tabelle bereits existiert
DO $$ 
BEGIN
    -- Füge description Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'description') THEN
        ALTER TABLE stations ADD COLUMN description TEXT;
    END IF;
    
    -- Füge total_units Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'total_units') THEN
        ALTER TABLE stations ADD COLUMN total_units INTEGER DEFAULT 0;
    END IF;
    
    -- Füge address Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'address') THEN
        ALTER TABLE stations ADD COLUMN address TEXT;
    END IF;
    
    -- Füge is_active Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'is_active') THEN
        ALTER TABLE stations ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    -- Füge created_at Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'created_at') THEN
        ALTER TABLE stations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    -- Füge updated_at Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'updated_at') THEN
        ALTER TABLE stations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Erstelle einen Index für bessere Performance bei geografischen Abfragen
-- Hinweis: PostGIS muss aktiviert sein für ST_Point Funktion
-- Falls PostGIS nicht verfügbar ist, verwenden Sie stattdessen einen einfachen Index:
CREATE INDEX IF NOT EXISTS idx_stations_lat_lng ON stations (lat, lng);

-- Erstelle einen Index für aktive Stationen
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
CREATE TRIGGER update_stations_updated_at 
    BEFORE UPDATE ON stations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Füge Beispieldaten hinzu (nur wenn die entsprechenden Spalten existieren)
DO $$
BEGIN
    -- Prüfe, welche Spalten existieren
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

-- Erlaube öffentlichen Zugriff auf die Tabelle (für anonyme Benutzer)
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- Erstelle eine Policy für öffentlichen Lesezugriff
CREATE POLICY "Allow public read access to active stations" ON stations
    FOR SELECT USING (is_active = true);

-- Erstelle eine Policy für eingeloggte Benutzer zum Hinzufügen von Stationen
CREATE POLICY "Allow authenticated users to insert stations" ON stations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Erstelle eine Policy für eingeloggte Benutzer zum Aktualisieren von Stationen
CREATE POLICY "Allow authenticated users to update stations" ON stations
    FOR UPDATE USING (auth.role() = 'authenticated');
