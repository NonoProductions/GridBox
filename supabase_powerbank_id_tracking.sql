-- Powerbank-ID Tracking Setup
-- Ziel: Erkennung primär über powerbank_id statt nur Batteriesensor-Daten.

DO $$
BEGIN
  -- Station speichert die aktuell erkannte Powerbank-ID (vom ESP32 gemeldet)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'powerbank_id'
  ) THEN
    ALTER TABLE stations ADD COLUMN powerbank_id TEXT;
  END IF;

  -- Rentals speichert die ausgeliehene Powerbank-ID
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'powerbank_id'
  ) THEN
    ALTER TABLE rentals ADD COLUMN powerbank_id TEXT;
  ELSE
    -- Falls früher als UUID angelegt, auf TEXT migrieren
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'rentals'
        AND column_name = 'powerbank_id'
        AND udt_name = 'uuid'
    ) THEN
      ALTER TABLE rentals
      ALTER COLUMN powerbank_id TYPE TEXT
      USING powerbank_id::text;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stations_powerbank_id ON stations(powerbank_id);
CREATE INDEX IF NOT EXISTS idx_rentals_powerbank_id ON rentals(powerbank_id);

-- Trigger: setzt powerbank_id bei neuer Ausleihe automatisch aus der Station.
CREATE OR REPLACE FUNCTION set_rental_powerbank_id_from_station()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.powerbank_id IS NULL OR length(trim(NEW.powerbank_id)) = 0 THEN
    SELECT s.powerbank_id
    INTO NEW.powerbank_id
    FROM stations s
    WHERE s.id = NEW.station_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_rental_powerbank_id_from_station ON rentals;
CREATE TRIGGER trigger_set_rental_powerbank_id_from_station
  BEFORE INSERT ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION set_rental_powerbank_id_from_station();
