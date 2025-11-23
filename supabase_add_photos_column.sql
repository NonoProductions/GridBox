-- Füge photos Spalte zur stations Tabelle hinzu (falls sie noch nicht existiert)
-- Speichert bis zu 3 Foto-URLs als JSON Array

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'photos') THEN
        ALTER TABLE stations ADD COLUMN photos JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Spalte photos hinzugefügt';
    ELSE
        RAISE NOTICE 'Spalte photos existiert bereits';
    END IF;
END $$;

-- Erstelle eine Constraint, um sicherzustellen, dass maximal 3 Fotos gespeichert werden können
-- (Dies wird auf Anwendungsebene durchgesetzt, aber wir können auch eine Check-Constraint hinzufügen)
-- Hinweis: JSONB unterstützt keine direkte Array-Längen-Constraint, daher wird dies in der App validiert

