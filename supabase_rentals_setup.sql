-- Rentals / Ausleihen Setup für Gridbox
-- Einmalig in Supabase im SQL-Editor ausführen.

-- 1. Rentals Tabelle
CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  powerbank_id UUID, -- optional: Referenz auf eine konkrete Powerbank
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'cancelled')),
  start_price DECIMAL(10, 2) NOT NULL DEFAULT 0.10,        -- Einmaliger Startpreis (z.B. 0,10 €)
  price_per_minute DECIMAL(10, 2) NOT NULL DEFAULT 0.05,   -- Preis pro Minute (z.B. 0,05 €/min)
  total_price DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Indizes
CREATE INDEX IF NOT EXISTS idx_rentals_user_id ON rentals(user_id);
CREATE INDEX IF NOT EXISTS idx_rentals_station_id ON rentals(station_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_started_at ON rentals(started_at DESC);

-- 3. updated_at Trigger
CREATE OR REPLACE FUNCTION update_rentals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_rentals_updated_at ON rentals;
CREATE TRIGGER trigger_rentals_updated_at
  BEFORE UPDATE ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION update_rentals_updated_at();

-- 4. Row Level Security
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own rentals" ON rentals;
CREATE POLICY "Users can view own rentals" ON rentals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own rentals" ON rentals;
CREATE POLICY "Users can insert own rentals" ON rentals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own rentals" ON rentals;
CREATE POLICY "Users can update own rentals" ON rentals
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. RPC: create_rental
-- Legt eine neue Ausleihe an, prüft:
-- - Mindestens 5 € Guthaben im Wallet
-- - User ist innerhalb von 100 m zur Station (PostGIS)
-- - Station ist aktiv und hat verfügbare Units
-- Setzt außerdem stations.dispense_requested = true,
-- damit der ESP32 die Ausgabe auslöst.

CREATE OR REPLACE FUNCTION create_rental(
  p_user_id UUID,
  p_station_id UUID,
  p_user_lat DOUBLE PRECISION,
  p_user_lng DOUBLE PRECISION
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

  -- Station laden (inkl. Geo-Daten und Aktiv-Status)
  SELECT
    id,
    is_active,
    lat,
    lng,
    available_units,
    total_units
  INTO v_station
  FROM stations
  WHERE id = p_station_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STATION_NOT_FOUND';
  END IF;

  IF v_station.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'STATION_INACTIVE';
  END IF;

  IF COALESCE(v_station.available_units, 0) <= 0 THEN
    RAISE EXCEPTION 'NO_UNITS_AVAILABLE';
  END IF;

  -- Distanz berechnen (User-Position -> Station), 100 m Radius
  v_distance_m := ST_Distance(
    ST_Point(v_station.lng, v_station.lat)::geography,
    ST_Point(p_user_lng, p_user_lat)::geography
  );

  IF v_distance_m > 100 THEN
    RAISE EXCEPTION 'OUT_OF_RANGE';
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

