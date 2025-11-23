-- Füge Batterie-Spalten zur stations Tabelle hinzu (falls sie noch nicht existieren)

-- Füge battery_voltage Spalte hinzu, falls sie nicht existiert
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'battery_voltage') THEN
        ALTER TABLE stations ADD COLUMN battery_voltage DECIMAL(5, 2);
        RAISE NOTICE 'Spalte battery_voltage hinzugefügt';
    ELSE
        RAISE NOTICE 'Spalte battery_voltage existiert bereits';
    END IF;
    
    -- Füge battery_percentage Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'battery_percentage') THEN
        ALTER TABLE stations ADD COLUMN battery_percentage INTEGER;
        RAISE NOTICE 'Spalte battery_percentage hinzugefügt';
    ELSE
        RAISE NOTICE 'Spalte battery_percentage existiert bereits';
    END IF;
END $$;


