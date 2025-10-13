-- WICHTIG: Diese SQL-Datei fügt ALLE fehlenden Spalten zur stations Tabelle hinzu
-- Führen Sie diese Datei in Ihrem Supabase SQL Editor aus

-- Füge fehlende Spalten hinzu
DO $$ 
BEGIN
    -- Füge available_units Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'available_units') THEN
        ALTER TABLE stations ADD COLUMN available_units INTEGER DEFAULT 0;
        RAISE NOTICE '✅ available_units Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'ℹ️  available_units Spalte existiert bereits';
    END IF;
    
    -- Füge total_units Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'total_units') THEN
        ALTER TABLE stations ADD COLUMN total_units INTEGER DEFAULT 0;
        RAISE NOTICE '✅ total_units Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'ℹ️  total_units Spalte existiert bereits';
    END IF;
    
    -- Füge description Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'description') THEN
        ALTER TABLE stations ADD COLUMN description TEXT;
        RAISE NOTICE '✅ description Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'ℹ️  description Spalte existiert bereits';
    END IF;
    
    -- Füge address Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'address') THEN
        ALTER TABLE stations ADD COLUMN address TEXT;
        RAISE NOTICE '✅ address Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'ℹ️  address Spalte existiert bereits';
    END IF;
    
    -- Füge is_active Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'is_active') THEN
        ALTER TABLE stations ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ is_active Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'ℹ️  is_active Spalte existiert bereits';
    END IF;
    
    -- Füge created_at Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'created_at') THEN
        ALTER TABLE stations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✅ created_at Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'ℹ️  created_at Spalte existiert bereits';
    END IF;
    
    -- Füge updated_at Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'updated_at') THEN
        ALTER TABLE stations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✅ updated_at Spalte hinzugefügt';
    ELSE
        RAISE NOTICE 'ℹ️  updated_at Spalte existiert bereits';
    END IF;
END $$;

-- Aktualisiere bestehende Zeilen mit Standardwerten (falls Spalten gerade hinzugefügt wurden)
UPDATE stations 
SET 
    available_units = COALESCE(available_units, 0),
    total_units = COALESCE(total_units, 0)
WHERE available_units IS NULL OR total_units IS NULL;

-- Zeige die Struktur der Tabelle an
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'stations'
ORDER BY ordinal_position;

