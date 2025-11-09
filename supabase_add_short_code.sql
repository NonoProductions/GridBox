-- Füge short_code Spalte zur stations Tabelle hinzu
-- Dieser Code ist ein 4-stelliger alphanumerischer Code für manuelle Eingabe

DO $$ 
BEGIN
    -- Füge short_code Spalte hinzu, falls sie nicht existiert
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'stations' AND column_name = 'short_code') THEN
        ALTER TABLE stations ADD COLUMN short_code VARCHAR(4) UNIQUE;
        
        -- Erstelle einen Index für schnellere Suchen
        CREATE INDEX IF NOT EXISTS idx_stations_short_code ON stations(short_code);
        
        RAISE NOTICE 'short_code Spalte wurde erfolgreich hinzugefügt';
    ELSE
        RAISE NOTICE 'short_code Spalte existiert bereits';
    END IF;
END $$;

-- Funktion zum Generieren eines zufälligen 4-stelligen Codes
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS VARCHAR(4) AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Ohne 0, O, 1, I für bessere Lesbarkeit
    result VARCHAR(4) := '';
    i INTEGER;
BEGIN
    FOR i IN 1..4 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger-Funktion: Generiere automatisch einen short_code bei INSERT
CREATE OR REPLACE FUNCTION set_short_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code VARCHAR(4);
    code_exists BOOLEAN;
BEGIN
    -- Nur wenn kein short_code gesetzt wurde
    IF NEW.short_code IS NULL THEN
        LOOP
            -- Generiere neuen Code
            new_code := generate_short_code();
            
            -- Prüfe ob Code bereits existiert
            SELECT EXISTS(SELECT 1 FROM stations WHERE short_code = new_code) INTO code_exists;
            
            -- Wenn Code eindeutig ist, verwende ihn
            IF NOT code_exists THEN
                NEW.short_code := new_code;
                EXIT;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Erstelle Trigger für neue Stationen
DROP TRIGGER IF EXISTS trigger_set_short_code ON stations;
CREATE TRIGGER trigger_set_short_code
    BEFORE INSERT ON stations
    FOR EACH ROW
    EXECUTE FUNCTION set_short_code();

-- Generiere Codes für bestehende Stationen ohne short_code
DO $$
DECLARE
    station_record RECORD;
    new_code VARCHAR(4);
    code_exists BOOLEAN;
BEGIN
    FOR station_record IN SELECT id FROM stations WHERE short_code IS NULL LOOP
        LOOP
            -- Generiere neuen Code
            new_code := generate_short_code();
            
            -- Prüfe ob Code bereits existiert
            SELECT EXISTS(SELECT 1 FROM stations WHERE short_code = new_code) INTO code_exists;
            
            -- Wenn Code eindeutig ist, update Station
            IF NOT code_exists THEN
                UPDATE stations SET short_code = new_code WHERE id = station_record.id;
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Short codes für bestehende Stationen wurden generiert';
END $$;

