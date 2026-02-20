-- Automatische Rückgabe via Powerbank-ID
-- Wenn eine Station eine powerbank_id meldet, wird die passende aktive Ausleihe beendet,
-- Preis berechnet und Wallet belastet.

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
  -- Nur reagieren, wenn eine ID vorhanden ist und sich wirklich geändert hat
  IF NEW.powerbank_id IS NULL OR length(trim(NEW.powerbank_id)) = 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.powerbank_id, '') = COALESCE(NEW.powerbank_id, '') THEN
    RETURN NEW;
  END IF;

  -- Passende aktive Ausleihe zur Powerbank-ID finden
  SELECT r.id, r.user_id, r.started_at, r.start_price, r.price_per_minute
  INTO v_rental_id, v_user_id, v_started_at, v_start_price, v_price_per_minute
  FROM rentals r
  WHERE r.status = 'active'
    AND r.powerbank_id = NEW.powerbank_id
  ORDER BY r.started_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_rental_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_elapsed_minutes := GREATEST(EXTRACT(EPOCH FROM (NOW() - v_started_at)) / 60.0, 0);
  v_total_price := ROUND((COALESCE(v_start_price, 0) + v_elapsed_minutes * COALESCE(v_price_per_minute, 0))::NUMERIC, 2);

  -- Rental abschließen
  UPDATE rentals
  SET
    station_id = NEW.id,
    ended_at = NOW(),
    status = 'finished',
    total_price = v_total_price,
    updated_at = NOW()
  WHERE id = v_rental_id
    AND status = 'active';

  -- Wallet belasten (wenn vorhanden)
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
      'Powerbank Rückgabe (ID-basiert abgeschlossen)',
      NEW.id,
      jsonb_build_object(
        'rental_id', v_rental_id,
        'powerbank_id', NEW.powerbank_id,
        'charged_total', v_total_price
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_process_powerbank_return ON stations;
CREATE TRIGGER trigger_process_powerbank_return
  AFTER UPDATE OF powerbank_id ON stations
  FOR EACH ROW
  EXECUTE FUNCTION process_powerbank_return_on_station_update();
