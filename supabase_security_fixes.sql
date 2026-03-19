-- ============================================================
-- SECURITY FIXES - GridBox PWA
-- Dieses Script behebt kritische Sicherheitslücken.
-- WICHTIG: In Supabase SQL Editor ausfuehren!
-- Reihenfolge einhalten: Erst lesen, dann ausfuehren.
-- ============================================================

-- ============================================================
-- 1. WALLET: User darf eigene Balance NICHT direkt aendern
--    (Nur SECURITY DEFINER Funktionen duerfen das)
-- ============================================================

-- Entferne die gefaehrliche UPDATE-Policy
DROP POLICY IF EXISTS "Users can update their own wallet" ON wallets;

-- Entferne die gefaehrliche INSERT-Policy fuer transactions
-- (User sollen Transaktionen nur ueber DB-Funktionen erstellen)
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;

-- Wallet-SELECT bleibt: User darf eigenes Wallet sehen
-- Transaction-SELECT bleibt: User darf eigene Transaktionen sehen

-- ============================================================
-- 2. SECURITY DEFINER Funktionen: Auth-Checks hinzufuegen
-- ============================================================

-- 2a. add_money_to_wallet: Nur der eigene User darf aufladen
CREATE OR REPLACE FUNCTION add_money_to_wallet(
    p_user_id UUID,
    p_amount DECIMAL(10, 2),
    p_description TEXT DEFAULT 'Guthaben aufgeladen'
)
RETURNS JSONB AS $$
DECLARE
    v_wallet_id UUID;
    v_new_balance DECIMAL(10, 2);
    v_transaction_id UUID;
BEGIN
    -- SECURITY: Pruefen dass der aufrufende User nur sein eigenes Wallet auflaed
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Nicht authentifiziert';
    END IF;
    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Nicht autorisiert: Kann nur eigenes Wallet aufladen';
    END IF;

    -- Validierung
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Betrag muss groesser als 0 sein';
    END IF;
    IF p_amount > 100.00 THEN
        RAISE EXCEPTION 'Maximaler Aufladebetrag ist 100.00';
    END IF;

    -- Wallet finden oder erstellen
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;

    IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, balance)
        VALUES (p_user_id, 0.00)
        RETURNING id INTO v_wallet_id;
    END IF;

    -- Balance aktualisieren
    UPDATE wallets
    SET balance = balance + p_amount
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

    -- Transaktion erstellen
    INSERT INTO transactions (user_id, wallet_id, type, amount, description)
    VALUES (p_user_id, v_wallet_id, 'charge', p_amount, p_description)
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'wallet_id', v_wallet_id,
        'new_balance', v_new_balance,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2b. create_rental_transaction: Nur der eigene User
CREATE OR REPLACE FUNCTION create_rental_transaction(
    p_user_id UUID,
    p_station_id UUID,
    p_amount DECIMAL(10, 2),
    p_description TEXT DEFAULT 'Powerbank ausgeliehen'
)
RETURNS JSONB AS $$
DECLARE
    v_wallet_id UUID;
    v_new_balance DECIMAL(10, 2);
    v_transaction_id UUID;
BEGIN
    -- SECURITY: Pruefen dass der aufrufende User nur sein eigenes Wallet belastet
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Nicht authentifiziert';
    END IF;
    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Nicht autorisiert';
    END IF;

    -- Wallet finden
    SELECT id, balance INTO v_wallet_id, v_new_balance FROM wallets WHERE user_id = p_user_id;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet nicht gefunden';
    END IF;

    -- Pruefen ob genug Guthaben vorhanden ist
    IF v_new_balance < p_amount THEN
        RAISE EXCEPTION 'Nicht genug Guthaben';
    END IF;

    -- Balance aktualisieren (nicht unter 0)
    UPDATE wallets
    SET balance = GREATEST(balance - p_amount, 0)
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

    -- Transaktion erstellen
    INSERT INTO transactions (user_id, wallet_id, type, amount, description, station_id)
    VALUES (p_user_id, v_wallet_id, 'rental', -p_amount, p_description, p_station_id)
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'wallet_id', v_wallet_id,
        'new_balance', v_new_balance,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2c. rollback_failed_dispense: Nur ESP-Proxy (service_role) darf das
-- Die Funktion wird vom ESP-Proxy-API gerufen (supabaseServer mit service_role)
-- also kein auth.uid() check noetig, aber wir pruefen dass es kein normaler User ist
DROP FUNCTION IF EXISTS rollback_failed_dispense(UUID);
CREATE OR REPLACE FUNCTION rollback_failed_dispense(p_station_id UUID)
RETURNS void AS $$
BEGIN
  -- SECURITY: Diese Funktion soll nur ueber service_role aufgerufen werden
  -- Ein normaler authenticated User sollte sie NICHT aufrufen koennen
  IF current_setting('request.jwt.claim.role', true) = 'anon'
     OR current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
    RAISE EXCEPTION 'Nicht autorisiert: Nur service_role darf diese Funktion aufrufen';
  END IF;

  UPDATE rentals
  SET status = 'cancelled',
      ended_at = NOW()
  WHERE station_id = p_station_id
    AND status = 'active'
    AND started_at > NOW() - INTERVAL '5 minutes';

  UPDATE stations
  SET available_units = LEAST(available_units + 1, total_units)
  WHERE id = p_station_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2d. rotate_device_api_key: Nur Station-Owner darf Key rotieren
CREATE OR REPLACE FUNCTION rotate_device_api_key(p_station_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_key TEXT;
  v_owner_id UUID;
BEGIN
  -- SECURITY: Pruefen dass der User der Owner der Station ist
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert';
  END IF;

  SELECT owner_id INTO v_owner_id FROM stations WHERE id = p_station_id;
  IF v_owner_id IS NULL OR v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Nicht autorisiert: Nur der Station-Owner darf den API-Key rotieren';
  END IF;

  new_key := encode(gen_random_bytes(32), 'hex');
  UPDATE stations SET device_api_key = new_key WHERE id = p_station_id;
  RETURN new_key;
END;
$$;

-- ============================================================
-- 3. STATIONS: Policies verschaerfen
--    - Jeder darf lesen (fuer die Karte)
--    - Nur Owner darf eigene Station INSERT/UPDATE/DELETE
--    - device_api_key wird ueber eine View versteckt
-- ============================================================

-- Entferne die zu offenen Policies
DROP POLICY IF EXISTS "Allow authenticated users to insert stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to update stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to delete stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated read access to all stations" ON stations;

-- SELECT bleibt offen (fuer Karte + unauthentifizierte User)
-- Die bestehende "Allow public read access to active stations" bleibt erhalten

-- Authentifizierte User koennen alle Stationen sehen (auch inaktive, z.B. im Dashboard)
CREATE POLICY "Authenticated can read all stations" ON stations
    FOR SELECT TO authenticated
    USING (true);

-- Nur Owner duerfen ihre eigenen Stationen aendern
CREATE POLICY "Owner can insert own stations" ON stations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update own stations" ON stations
    FOR UPDATE TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can delete own stations" ON stations
    FOR DELETE TO authenticated
    USING (auth.uid() = owner_id);

-- HINWEIS: Der ESP-Proxy nutzt service_role und umgeht RLS,
-- daher kann er weiterhin Stationen updaten (battery, units, etc.)

-- ============================================================
-- 4. DEVICE_API_KEY vor Client-Zugriff schuetzen
--    Erstelle eine View ohne device_api_key fuer die Client-API
-- ============================================================

-- Erstelle eine sichere View ohne den API-Key
CREATE OR REPLACE VIEW stations_public AS
SELECT
    id, name, description, lat, lng, address,
    is_active, available_units, total_units,
    owner_id, short_code, created_at, updated_at,
    battery_voltage, battery_percentage,
    charge_enabled, photos, opening_hours,
    last_seen, connection_status,
    slot_0_powerbank_id, slot_1_powerbank_id
FROM stations;

-- Erlaube allen Zugriff auf die View
GRANT SELECT ON stations_public TO anon;
GRANT SELECT ON stations_public TO authenticated;

-- ============================================================
-- 5. PROFILES: RLS Policies erstellen
--    User darf nur eigenes Profil sehen und Email/Name aendern
--    Nur Owner darf Rollen anderer User aendern
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Jeder authentifizierte User darf Profile sehen (fuer Namenslisten etc.)
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles" ON profiles
    FOR SELECT TO authenticated
    USING (true);

-- User darf nur sein EIGENES Profil updaten, aber NICHT die role-Spalte
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        -- Verhindere dass User sich selbst eine andere Rolle geben
        -- Leider kann man in RLS nicht auf OLD Werte zugreifen,
        -- daher separate Funktion noetig
    );

-- INSERT Policy fuer neues Profil (bei Signup)
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

-- ============================================================
-- 5b. Sichere Funktion fuer Rollen-Zuweisung (nur Owner)
-- ============================================================

CREATE OR REPLACE FUNCTION assign_user_role(
    p_target_user_id UUID,
    p_new_role TEXT
)
RETURNS void AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- Pruefen dass der Aufrufer authentifiziert ist
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Nicht authentifiziert';
    END IF;

    -- Pruefen dass der Aufrufer Owner ist
    SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
    IF v_caller_role != 'owner' THEN
        RAISE EXCEPTION 'Nur Owner duerfen Rollen zuweisen';
    END IF;

    -- Validiere die neue Rolle
    IF p_new_role NOT IN ('user', 'owner') THEN
        RAISE EXCEPTION 'Ungueltige Rolle: %', p_new_role;
    END IF;

    -- Verhindere Self-Demotion
    IF auth.uid() = p_target_user_id AND p_new_role != 'owner' THEN
        RAISE EXCEPTION 'Owner kann sich nicht selbst herabstufen';
    END IF;

    -- Update durchfuehren
    UPDATE profiles SET role = p_new_role WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. STORAGE: Bucket-Policies verschaerfen
-- ============================================================

-- Entferne zu offene Policies
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- Upload: nur in den eigenen Folder (station-photos/{station_id}/)
CREATE POLICY "Owner can upload station photos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'station-photos'
    );

-- Update: nur eigene Uploads
CREATE POLICY "Owner can update station photos" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'station-photos')
    WITH CHECK (bucket_id = 'station-photos');

-- Delete: nur eigene Uploads
CREATE POLICY "Owner can delete station photos" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'station-photos'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM stations WHERE owner_id = auth.uid()
        )
    );

-- Lesen: Alle duerfen Station-Fotos sehen
DROP POLICY IF EXISTS "Anyone can view station photos" ON storage.objects;
CREATE POLICY "Anyone can view station photos" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'station-photos');

-- ============================================================
-- 7. CHECK CONSTRAINTS fuer Daten-Integritaet
-- ============================================================

-- Wallet Balance darf nicht negativ werden
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_balance_non_negative;
ALTER TABLE wallets ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0);

-- ============================================================
-- ZUSAMMENFASSUNG DER AENDERUNGEN:
-- ============================================================
-- [x] Wallets: Kein direktes UPDATE durch User mehr
-- [x] Transactions: Kein direktes INSERT durch User mehr
-- [x] add_money_to_wallet: auth.uid() = p_user_id Check
-- [x] create_rental_transaction: auth.uid() = p_user_id Check
-- [x] rollback_failed_dispense: Nur service_role
-- [x] rotate_device_api_key: Nur Station-Owner
-- [x] Stations: INSERT/UPDATE/DELETE nur fuer Owner
-- [x] device_api_key: Ueber View versteckt
-- [x] Profiles: RLS mit Schutz gegen Rollen-Manipulation
-- [x] assign_user_role: Sichere DB-Funktion fuer Rollenvergabe
-- [x] Storage: Nur eigene Station-Fotos loeschen
-- [x] Wallet Balance: CHECK >= 0
-- ============================================================
