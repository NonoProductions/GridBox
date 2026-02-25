-- ============================================================
-- FIX: Automatische Rückgabe bei Powerbank-Einstecken
-- ============================================================
-- PROBLEM: Die Ausleihe wird nicht beendet wenn die Powerbank
--          zurückgesteckt wird, weil der Trigger nur per
--          powerbank_id matched, diese aber in rentals oft NULL ist.
--
-- LÖSUNG:  Trigger matched jetzt PRIMÄR per station_id (Fallback)
--          und optional per powerbank_id (wenn gesetzt).
--          Zusätzlich: available_units wird wieder hochgezählt.
--
-- ANLEITUNG: Dieses SQL im Supabase SQL-Editor ausführen.
-- ============================================================

-- 1. Sicherstellen dass powerbank_id in beiden Tabellen TEXT ist (nicht UUID)
DO $$
BEGIN
  -- stations.powerbank_id → TEXT
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'powerbank_id'
  ) THEN
    ALTER TABLE stations ADD COLUMN powerbank_id TEXT;
  ELSE
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'stations' AND column_name = 'powerbank_id' AND udt_name = 'uuid'
    ) THEN
      ALTER TABLE stations ALTER COLUMN powerbank_id TYPE TEXT USING powerbank_id::text;
    END IF;
  END IF;

  -- rentals.powerbank_id → TEXT
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'powerbank_id'
  ) THEN
    ALTER TABLE rentals ADD COLUMN powerbank_id TEXT;
  ELSE
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rentals' AND column_name = 'powerbank_id' AND udt_name = 'uuid'
    ) THEN
      ALTER TABLE rentals ALTER COLUMN powerbank_id TYPE TEXT USING powerbank_id::text;
    END IF;
  END IF;
END $$;

-- 2. Indizes
CREATE INDEX IF NOT EXISTS idx_stations_powerbank_id ON stations(powerbank_id);
CREATE INDEX IF NOT EXISTS idx_rentals_powerbank_id ON rentals(powerbank_id);
CREATE INDEX IF NOT EXISTS idx_rentals_station_status ON rentals(station_id, status);

-- 3. Trigger: Beim Erstellen einer Ausleihe automatisch powerbank_id von Station kopieren
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

-- 4. HAUPTFIX: Automatische Rückgabe-Trigger (matched per station_id UND powerbank_id)
CREATE OR REPLACE FUNCTION process_powerbank_return_on_station_update()
RETURNS TRIGGER AS $$
DECLARE
  v_rental_id UUID;
  v_user_id UUID;
  v_started_at TIMESTAMPTZ;
  v_start_price NUMERIC(10,2);
  v_price_per_minute NUMERIC(10,2);
  v_elapsed_minutes NUMERIC;
  v_total_price NUMERIC(10,2);
  v_wallet_id UUID;
BEGIN
  -- Nur reagieren wenn eine Powerbank-ID vorhanden ist (= Powerbank eingesteckt)
  IF NEW.powerbank_id IS NULL OR length(trim(NEW.powerbank_id::text)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Nur reagieren wenn sich powerbank_id tatsächlich geändert hat
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.powerbank_id::text, '') = COALESCE(NEW.powerbank_id::text, '') THEN
    RETURN NEW;
  END IF;

  -- STRATEGIE 1: Suche aktive Ausleihe per powerbank_id (exakter Match)
  SELECT r.id, r.user_id, r.started_at, r.start_price, r.price_per_minute
  INTO v_rental_id, v_user_id, v_started_at, v_start_price, v_price_per_minute
  FROM rentals r
  WHERE r.status = 'active'
    AND r.powerbank_id IS NOT NULL
    AND r.powerbank_id::text = NEW.powerbank_id::text
  ORDER BY r.started_at DESC
  LIMIT 1
  FOR UPDATE;

  -- STRATEGIE 2 (Fallback): Suche per station_id falls powerbank_id nicht gesetzt war
  IF v_rental_id IS NULL THEN
    SELECT r.id, r.user_id, r.started_at, r.start_price, r.price_per_minute
    INTO v_rental_id, v_user_id, v_started_at, v_start_price, v_price_per_minute
    FROM rentals r
    WHERE r.status = 'active'
      AND r.station_id = NEW.id
    ORDER BY r.started_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- Keine aktive Ausleihe gefunden → nichts zu tun
  IF v_rental_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Dauer und Preis berechnen
  v_elapsed_minutes := GREATEST(EXTRACT(EPOCH FROM (NOW() - v_started_at)) / 60.0, 0);
  v_total_price := ROUND((COALESCE(v_start_price, 0) + v_elapsed_minutes * COALESCE(v_price_per_minute, 0))::NUMERIC, 2);

  -- Rental abschließen
  UPDATE rentals
  SET
    station_id = NEW.id,
    powerbank_id = NEW.powerbank_id::text,
    ended_at = NOW(),
    status = 'finished',
    total_price = v_total_price,
    updated_at = NOW()
  WHERE id = v_rental_id
    AND status = 'active';

  -- available_units wieder hochzählen (Powerbank zurück in Station)
  UPDATE stations
  SET available_units = LEAST(COALESCE(available_units, 0) + 1, COALESCE(total_units, 1))
  WHERE id = NEW.id;

  -- Wallet belasten
  SELECT w.id INTO v_wallet_id
  FROM wallets w
  WHERE w.user_id = v_user_id
  LIMIT 1
  FOR UPDATE;

  IF v_wallet_id IS NOT NULL THEN
    UPDATE wallets
    SET
      balance = COALESCE(balance, 0) - v_total_price,
      updated_at = NOW()
    WHERE id = v_wallet_id;

    INSERT INTO transactions (
      user_id,
      wallet_id,
      type,
      amount,
      description,
      station_id,
      metadata
    )
    VALUES (
      v_user_id,
      v_wallet_id,
      'rental',
      -v_total_price,
      'Powerbank Rückgabe (automatisch abgeschlossen)',
      NEW.id,
      jsonb_build_object(
        'rental_id', v_rental_id,
        'powerbank_id', NEW.powerbank_id,
        'elapsed_minutes', ROUND(v_elapsed_minutes, 1),
        'charged_total', v_total_price
      )
    );
  END IF;

  RAISE NOTICE 'Ausleihe % automatisch beendet. Dauer: % min, Preis: % €',
    v_rental_id, ROUND(v_elapsed_minutes, 1), v_total_price;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_process_powerbank_return ON stations;
CREATE TRIGGER trigger_process_powerbank_return
  AFTER UPDATE OF powerbank_id ON stations
  FOR EACH ROW
  EXECUTE FUNCTION process_powerbank_return_on_station_update();

-- 5. Falls es aktuell eine hängende aktive Ausleihe gibt, zeige sie an
SELECT r.id, r.user_id, r.station_id, r.started_at, r.powerbank_id, r.status,
       ROUND(EXTRACT(EPOCH FROM (NOW() - r.started_at)) / 60.0, 1) AS elapsed_minutes
FROM rentals r
WHERE r.status = 'active'
ORDER BY r.started_at DESC;
