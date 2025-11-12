-- Füge Ausgabe-Trigger Spalten zur stations Tabelle hinzu
-- Diese ermöglichen es der Web-App, dem ESP32 zu signalisieren, eine Powerbank auszugeben

DO $$ 
BEGIN
    -- Füge dispense_requested Spalte hinzu (Signal von App an ESP32)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'dispense_requested') THEN
        ALTER TABLE stations ADD COLUMN dispense_requested BOOLEAN DEFAULT false;
        RAISE NOTICE 'dispense_requested Spalte wurde erfolgreich hinzugefügt';
    ELSE
        RAISE NOTICE 'dispense_requested Spalte existiert bereits';
    END IF;
    
    -- Füge last_dispense_time Spalte hinzu (Zeitstempel der letzten Ausgabe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'last_dispense_time') THEN
        ALTER TABLE stations ADD COLUMN last_dispense_time TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'last_dispense_time Spalte wurde erfolgreich hinzugefügt';
    ELSE
        RAISE NOTICE 'last_dispense_time Spalte existiert bereits';
    END IF;
END $$;

-- Erstelle einen Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_stations_dispense_requested 
ON stations(dispense_requested) 
WHERE dispense_requested = true;

-- Informationen anzeigen
SELECT 'Setup abgeschlossen! Neue Spalten:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stations' 
AND column_name IN ('dispense_requested', 'last_dispense_time');

