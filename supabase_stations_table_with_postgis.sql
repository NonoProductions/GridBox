-- Erstelle die Tabelle für Powerbank-Stationen (mit PostGIS Support)
-- HINWEIS: PostGIS muss in Ihrem Supabase-Projekt aktiviert sein

-- Aktiviere PostGIS Extension (falls noch nicht aktiviert)
CREATE EXTENSION IF NOT EXISTS postgis;

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

-- Erstelle einen PostGIS Index für bessere Performance bei geografischen Abfragen
CREATE INDEX IF NOT EXISTS idx_stations_location ON stations USING GIST (
  ST_Point(lng, lat)
);

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

-- Füge einige Beispieldaten hinzu (optional)
INSERT INTO stations (name, description, lat, lng, available_units, total_units, address) VALUES
('Hauptbahnhof', 'Powerbank-Station am Hauptbahnhof', 52.525, 13.369, 8, 12, 'Europaplatz 1, 10557 Berlin'),
('Stadttor', 'Station am Stadttor', 52.515, 13.405, 3, 8, 'Stadttor 1, 10117 Berlin'),
('City Mall', 'Powerbank-Station in der City Mall', 52.505, 13.39, 12, 15, 'Alexanderplatz 1, 10178 Berlin')
ON CONFLICT DO NOTHING;

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

-- Beispiel für geografische Abfragen mit PostGIS:
-- Finde Stationen in einem bestimmten Radius (1000 Meter)
-- SELECT * FROM stations 
-- WHERE ST_DWithin(
--   ST_Point(lng, lat)::geography,
--   ST_Point(13.405, 52.52)::geography,
--   1000
-- );
