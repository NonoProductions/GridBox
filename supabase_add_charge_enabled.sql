-- Füge charge_enabled Spalte zur stations Tabelle hinzu (für Relais-Steuerung)

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'charge_enabled') THEN
        ALTER TABLE stations ADD COLUMN charge_enabled BOOLEAN DEFAULT true;
        RAISE NOTICE 'Spalte charge_enabled hinzugefügt';
    ELSE
        RAISE NOTICE 'Spalte charge_enabled existiert bereits';
    END IF;
END $$;


