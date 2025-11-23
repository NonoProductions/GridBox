-- Füge opening_hours Spalte zur stations Tabelle hinzu (für Öffnungszeiten)

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'opening_hours') THEN
        ALTER TABLE stations ADD COLUMN opening_hours TEXT;
        RAISE NOTICE 'Spalte opening_hours hinzugefügt';
    ELSE
        RAISE NOTICE 'Spalte opening_hours existiert bereits';
    END IF;
END $$;

