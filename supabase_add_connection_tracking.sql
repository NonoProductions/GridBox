-- Füge Verbindungstracking für ESP32-Stationen hinzu
-- und lösche Testdaten

-- Füge last_seen Spalte hinzu (falls noch nicht vorhanden)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'last_seen') THEN
        ALTER TABLE stations ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'last_seen Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'last_seen Spalte existiert bereits';
    END IF;
END $$;

-- Erstelle Index für last_seen
CREATE INDEX IF NOT EXISTS idx_stations_last_seen ON stations (last_seen);

-- Lösche Testdaten
DELETE FROM stations WHERE name IN ('Hauptbahnhof', 'Stadttor', 'City Mall', 'Demo Station');

-- Aktualisiere vorhandene Stationen mit last_seen = updated_at (falls last_seen NULL ist)
UPDATE stations 
SET last_seen = updated_at 
WHERE last_seen IS NULL;

-- Info
DO $$
BEGIN
    RAISE NOTICE 'Verbindungstracking aktiviert und Testdaten entfernt';
    RAISE NOTICE 'Eine Station gilt als verbunden, wenn last_seen < 30 Sekunden alt ist';
END $$;

