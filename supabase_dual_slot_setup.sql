-- ============================================================
-- Dual-Slot Setup: Erweitert stations um pro-Slot Batteriedaten
-- Einmalig in Supabase im SQL-Editor ausführen.
-- ============================================================

-- 1. Neue Spalten für Slot 1 und Slot 2
DO $$
BEGIN
    -- Slot 1
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'slot_1_powerbank_id') THEN
        ALTER TABLE stations ADD COLUMN slot_1_powerbank_id TEXT;
        RAISE NOTICE 'slot_1_powerbank_id hinzugefügt';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'slot_1_battery_voltage') THEN
        ALTER TABLE stations ADD COLUMN slot_1_battery_voltage DECIMAL(5, 2);
        RAISE NOTICE 'slot_1_battery_voltage hinzugefügt';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'slot_1_battery_percentage') THEN
        ALTER TABLE stations ADD COLUMN slot_1_battery_percentage INTEGER;
        RAISE NOTICE 'slot_1_battery_percentage hinzugefügt';
    END IF;

    -- Slot 2
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'slot_2_powerbank_id') THEN
        ALTER TABLE stations ADD COLUMN slot_2_powerbank_id TEXT;
        RAISE NOTICE 'slot_2_powerbank_id hinzugefügt';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'slot_2_battery_voltage') THEN
        ALTER TABLE stations ADD COLUMN slot_2_battery_voltage DECIMAL(5, 2);
        RAISE NOTICE 'slot_2_battery_voltage hinzugefügt';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'slot_2_battery_percentage') THEN
        ALTER TABLE stations ADD COLUMN slot_2_battery_percentage INTEGER;
        RAISE NOTICE 'slot_2_battery_percentage hinzugefügt';
    END IF;
END $$;

-- 2. Trigger: Automatische Rückgabe bei Powerbank-Erkennung (Dual-Slot Version)
-- Reagiert auf Änderungen an slot_1_powerbank_id oder slot_2_powerbank_id
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
  v_changed_slot_id TEXT;
BEGIN
  -- Prüfe welcher Slot sich geändert hat (Powerbank neu eingesteckt)
  v_changed_slot_id := NULL;
  
  -- Slot 1: Powerbank neu erkannt?
  IF NEW.slot_1_powerbank_id IS NOT NULL 
     AND length(trim(NEW.slot_1_powerbank_id)) > 0
     AND COALESCE(OLD.slot_1_powerbank_id, '') <> COALESCE(NEW.slot_1_powerbank_id, '') THEN
    v_changed_slot_id := NEW.slot_1_powerbank_id;
  END IF;
  
  -- Slot 2: Powerbank neu erkannt?
  IF v_changed_slot_id IS NULL
     AND NEW.slot_2_powerbank_id IS NOT NULL 
     AND length(trim(NEW.slot_2_powerbank_id)) > 0
     AND COALESCE(OLD.slot_2_powerbank_id, '') <> COALESCE(NEW.slot_2_powerbank_id, '') THEN
    v_changed_slot_id := NEW.slot_2_powerbank_id;
  END IF;
  
  -- Abwärtskompatibilität: Legacy powerbank_id Feld
  IF v_changed_slot_id IS NULL
     AND NEW.powerbank_id IS NOT NULL 
     AND length(trim(NEW.powerbank_id::text)) > 0
     AND COALESCE(OLD.powerbank_id::text, '') <> COALESCE(NEW.powerbank_id::text, '') THEN
    v_changed_slot_id := NEW.powerbank_id::text;
  END IF;
  
  -- Keine relevante Änderung → nichts tun
  IF v_changed_slot_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- STRATEGIE 1: Suche aktive Ausleihe per powerbank_id (exakter Match)
  SELECT r.id, r.user_id, r.started_at, r.start_price, r.price_per_minute
  INTO v_rental_id, v_user_id, v_started_at, v_start_price, v_price_per_minute
  FROM rentals r
  WHERE r.status = 'active'
    AND r.powerbank_id IS NOT NULL
    AND r.powerbank_id::text = v_changed_slot_id
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
    powerbank_id = v_changed_slot_id,
    ended_at = NOW(),
    status = 'finished',
    total_price = v_total_price,
    updated_at = NOW()
  WHERE id = v_rental_id
    AND status = 'active';

  -- available_units wieder hochzählen (Powerbank zurück in Station)
  NEW.available_units := LEAST(COALESCE(NEW.available_units, 0) + 1, COALESCE(NEW.total_units, 2));

  -- Wallet belasten (wenn vorhanden)
  SELECT w.id INTO v_wallet_id
  FROM wallets w
  WHERE w.user_id = v_user_id;

  IF v_wallet_id IS NOT NULL THEN
    UPDATE wallets
    SET balance = GREATEST(balance - v_total_price, 0),
        updated_at = NOW()
    WHERE id = v_wallet_id;

    INSERT INTO wallet_transactions (wallet_id, amount, type, description, rental_id)
    VALUES (v_wallet_id, -v_total_price, 'rental_charge',
            'Powerbank-Ausleihe beendet', v_rental_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger neu erstellen (BEFORE UPDATE, damit NEW modifiziert werden kann)
DROP TRIGGER IF EXISTS trigger_powerbank_return ON stations;
CREATE TRIGGER trigger_powerbank_return
  BEFORE UPDATE ON stations
  FOR EACH ROW
  EXECUTE FUNCTION process_powerbank_return_on_station_update();

-- 3. Aktualisiere create_rental: Berechnet available_units basierend auf belegten Slots
CREATE OR REPLACE FUNCTION create_rental(
  p_user_id UUID,
  p_station_id UUID,
  p_user_lat DOUBLE PRECISION DEFAULT NULL,
  p_user_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_wallet_balance DECIMAL(10, 2);
  v_station RECORD;
  v_distance_m DOUBLE PRECISION;
  v_rental_id UUID;
  v_start_price DECIMAL(10, 2) := 0.10;
  v_price_per_minute DECIMAL(10, 2) := 0.05;
  v_available INT;
BEGIN
  -- Sicherheits-Check: der aufrufende User muss sich selbst meinen
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Wallet finden
  SELECT id, balance
  INTO v_wallet_id, v_wallet_balance
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet nicht gefunden';
  END IF;

  -- Mindestguthaben prüfen (5 €)
  IF v_wallet_balance < 5.00 THEN
    RAISE EXCEPTION 'MIN_BALANCE';
  END IF;

  -- Station laden
  SELECT *
  INTO v_station
  FROM stations
  WHERE id = p_station_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STATION_NOT_FOUND';
  END IF;

  IF v_station.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'STATION_INACTIVE';
  END IF;

  -- Berechne verfügbare Powerbanks aus Slot-Daten
  v_available := 0;
  IF v_station.slot_1_powerbank_id IS NOT NULL AND length(trim(v_station.slot_1_powerbank_id)) > 0 THEN
    v_available := v_available + 1;
  END IF;
  IF v_station.slot_2_powerbank_id IS NOT NULL AND length(trim(v_station.slot_2_powerbank_id)) > 0 THEN
    v_available := v_available + 1;
  END IF;
  -- Fallback auf available_units wenn keine Slot-Daten vorhanden
  IF v_available = 0 THEN
    v_available := COALESCE(v_station.available_units, 0);
  END IF;

  IF v_available <= 0 THEN
    RAISE EXCEPTION 'NO_UNITS_AVAILABLE';
  END IF;

  -- Distanz berechnen (wenn Koordinaten mitgegeben werden)
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_m := ST_Distance(
      ST_Point(v_station.lng, v_station.lat)::geography,
      ST_Point(p_user_lng, p_user_lat)::geography
    );

    IF v_distance_m > 100 THEN
      RAISE EXCEPTION 'OUT_OF_RANGE';
    END IF;
  ELSE
    v_distance_m := 0;
  END IF;

  -- Prüfen, ob der User schon eine aktive Ausleihe hat
  IF EXISTS (
    SELECT 1 FROM rentals
    WHERE user_id = p_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'HAS_ACTIVE_RENTAL';
  END IF;

  -- Ausleihe anlegen
  INSERT INTO rentals (
    user_id,
    station_id,
    start_price,
    price_per_minute
  )
  VALUES (
    p_user_id,
    p_station_id,
    v_start_price,
    v_price_per_minute
  )
  RETURNING id INTO v_rental_id;

  -- Station anpassen: eine Unit weniger, dispense_requested = true
  UPDATE stations
  SET
    available_units = GREATEST(0, COALESCE(available_units, 0) - 1),
    dispense_requested = true,
    updated_at = NOW()
  WHERE id = p_station_id;

  RETURN jsonb_build_object(
    'success', true,
    'rental_id', v_rental_id,
    'station_id', p_station_id,
    'start_price', v_start_price,
    'price_per_minute', v_price_per_minute,
    'distance_m', v_distance_m
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Aktualisiere rollback_failed_dispense für Dual-Slot
CREATE OR REPLACE FUNCTION rollback_failed_dispense(p_station_id UUID)
RETURNS void AS $$
BEGIN
  -- Letzte aktive Ausleihe dieser Station stornieren
  UPDATE rentals
  SET status = 'cancelled',
      ended_at = NOW(),
      total_price = 0,
      updated_at = NOW()
  WHERE station_id = p_station_id
    AND status = 'active'
    AND started_at > NOW() - INTERVAL '5 minutes';

  -- available_units wieder hochzählen
  UPDATE stations
  SET available_units = LEAST(COALESCE(available_units, 0) + 1, COALESCE(total_units, 2)),
      dispense_requested = false,
      updated_at = NOW()
  WHERE id = p_station_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Realtime für neue Spalten aktivieren (falls Publikation existiert)
DO $$
BEGIN
  -- Versuche die Publikation zu aktualisieren (ignoriere Fehler wenn nicht vorhanden)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE stations;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'stations ist bereits in supabase_realtime';
    WHEN undefined_object THEN
      RAISE NOTICE 'supabase_realtime Publikation nicht vorhanden';
  END;
END $$;

-- 6. Verifizierung
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'stations'
  AND column_name IN (
    'slot_1_powerbank_id', 'slot_1_battery_voltage', 'slot_1_battery_percentage',
    'slot_2_powerbank_id', 'slot_2_battery_voltage', 'slot_2_battery_percentage',
    'powerbank_id', 'battery_voltage', 'battery_percentage'
  )
ORDER BY column_name;
