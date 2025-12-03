-- Komplettes Setup für alle benötigten Spalten in der stations Tabelle
-- Führe diese Datei in Supabase SQL Editor aus

DO $$ 
BEGIN
    -- 1. Füge charge_enabled Spalte hinzu (für Relais-Steuerung)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'charge_enabled') THEN
        ALTER TABLE stations ADD COLUMN charge_enabled BOOLEAN DEFAULT true;
        RAISE NOTICE '✓ Spalte charge_enabled hinzugefügt';
    ELSE
        RAISE NOTICE '✓ Spalte charge_enabled existiert bereits';
    END IF;

    -- 2. Füge battery_voltage Spalte hinzu (ESP32 Batterie-Daten)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'battery_voltage') THEN
        ALTER TABLE stations ADD COLUMN battery_voltage DECIMAL(5, 2);
        RAISE NOTICE '✓ Spalte battery_voltage hinzugefügt';
    ELSE
        RAISE NOTICE '✓ Spalte battery_voltage existiert bereits';
    END IF;

    -- 3. Füge battery_percentage Spalte hinzu (ESP32 Batterie-Daten)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'battery_percentage') THEN
        ALTER TABLE stations ADD COLUMN battery_percentage INTEGER;
        RAISE NOTICE '✓ Spalte battery_percentage hinzugefügt';
    ELSE
        RAISE NOTICE '✓ Spalte battery_percentage existiert bereits';
    END IF;

    -- 4. Füge opening_hours Spalte hinzu (Öffnungszeiten)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'opening_hours') THEN
        ALTER TABLE stations ADD COLUMN opening_hours TEXT;
        RAISE NOTICE '✓ Spalte opening_hours hinzugefügt';
    ELSE
        RAISE NOTICE '✓ Spalte opening_hours existiert bereits';
    END IF;

    -- 5. Füge photos Spalte hinzu (Station Fotos als JSON Array)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'photos') THEN
        ALTER TABLE stations ADD COLUMN photos JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE '✓ Spalte photos hinzugefügt';
    ELSE
        RAISE NOTICE '✓ Spalte photos existiert bereits';
    END IF;

    -- 6. Füge short_code Spalte hinzu (4-stelliger Code für manuelle Eingabe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'short_code') THEN
        ALTER TABLE stations ADD COLUMN short_code VARCHAR(4) UNIQUE;
        RAISE NOTICE '✓ Spalte short_code hinzugefügt';
    ELSE
        RAISE NOTICE '✓ Spalte short_code existiert bereits';
    END IF;
END $$;

-- Aktiviere Realtime für die stations Tabelle
ALTER PUBLICATION supabase_realtime ADD TABLE stations;

-- Stelle sicher, dass Row Level Security (RLS) aktiv ist
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- Policy für Realtime: Erlaube allen Usern, Änderungen zu sehen
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stations' 
        AND policyname = 'Enable realtime for all users'
    ) THEN
        CREATE POLICY "Enable realtime for all users" 
        ON stations 
        FOR SELECT 
        USING (true);
        RAISE NOTICE '✓ Realtime Policy erstellt';
    ELSE
        RAISE NOTICE '✓ Realtime Policy existiert bereits';
    END IF;
END $$;

-- Fertig!
RAISE NOTICE '🎉 Setup abgeschlossen!';
RAISE NOTICE 'Alle Spalten sind vorhanden und Realtime ist aktiviert.';

