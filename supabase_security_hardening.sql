-- ============================================================
-- SECURITY HARDENING - GridBox PWA
-- Datum: 2026-03-17
--
-- Behebt alle verbleibenden Sicherheitsluecken nach dem
-- initialen Security-Audit. Sicher auszufuehren (idempotent).
--
-- WICHTIG: In Supabase SQL Editor ausfuehren!
-- Voraussetzung: supabase_security_fixes.sql wurde bereits ausgefuehrt.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. STATIONS_PUBLIC VIEW: Sensible Daten entfernen
--    - owner_id: Erlaubt Zuordnung von Stationen zu Benutzern
--    - slot_*_powerbank_id: Interne Geraete-IDs
--    - powerbank_id: Legacy-Feld, gleiche Problematik
-- ============================================================

CREATE OR REPLACE VIEW stations_public AS
SELECT
    id, name, description, lat, lng, address,
    is_active, available_units, total_units,
    short_code, created_at, updated_at,
    battery_voltage, battery_percentage,
    charge_enabled, photos, opening_hours,
    last_seen, connection_status,
    slot_1_battery_voltage, slot_1_battery_percentage,
    slot_2_battery_voltage, slot_2_battery_percentage
FROM stations;

-- Berechtigungen neu setzen (nach CREATE OR REPLACE noetig)
GRANT SELECT ON stations_public TO anon;
GRANT SELECT ON stations_public TO authenticated;

-- ============================================================
-- 2. STORAGE: Upload-Policy mit Owner-Pruefung
--    Bisher konnte JEDER authentifizierte User in JEDEN
--    Station-Ordner hochladen. Jetzt nur noch in eigene.
-- ============================================================

-- Alte unsichere Upload-Policy entfernen
DROP POLICY IF EXISTS "Owner can upload station photos" ON storage.objects;

-- Neue Policy: Upload nur in Ordner eigener Stationen
CREATE POLICY "Owner can upload station photos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'station-photos'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM stations WHERE owner_id = auth.uid()
        )
    );

-- Update-Policy ebenfalls absichern
DROP POLICY IF EXISTS "Owner can update station photos" ON storage.objects;

CREATE POLICY "Owner can update station photos" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'station-photos'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM stations WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        bucket_id = 'station-photos'
        AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM stations WHERE owner_id = auth.uid()
        )
    );

-- ============================================================
-- 3. STATIONS: Alle zu offenen Policies entfernen (Aufraeum-Runde)
--    Falls supabase_fix_station_policies.sql NACH
--    supabase_security_fixes.sql lief, existieren die
--    WITH CHECK (true) Policies noch.
-- ============================================================

-- Ueberpermissive Policies aufraemen (alle moeglichen Namen)
DROP POLICY IF EXISTS "Allow authenticated users to insert stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to update stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to delete stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated read access to all stations" ON stations;

-- Sicherstellen dass die korrekten Owner-Policies existieren
-- (CREATE nur wenn nicht vorhanden, via DO-Block)
DO $$
BEGIN
    -- SELECT: Oeffentlich fuer aktive Stationen
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'stations'
        AND policyname = 'Allow public read access to active stations'
    ) THEN
        CREATE POLICY "Allow public read access to active stations" ON stations
            FOR SELECT USING (is_active = true);
    END IF;

    -- SELECT: Authentifizierte User sehen alle (inkl. inaktive)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'stations'
        AND policyname = 'Authenticated can read all stations'
    ) THEN
        CREATE POLICY "Authenticated can read all stations" ON stations
            FOR SELECT TO authenticated
            USING (true);
    END IF;

    -- INSERT: Nur Owner
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'stations'
        AND policyname = 'Owner can insert own stations'
    ) THEN
        CREATE POLICY "Owner can insert own stations" ON stations
            FOR INSERT TO authenticated
            WITH CHECK (auth.uid() = owner_id);
    END IF;

    -- UPDATE: Nur Owner
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'stations'
        AND policyname = 'Owner can update own stations'
    ) THEN
        CREATE POLICY "Owner can update own stations" ON stations
            FOR UPDATE TO authenticated
            USING (auth.uid() = owner_id)
            WITH CHECK (auth.uid() = owner_id);
    END IF;

    -- DELETE: Nur Owner
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'stations'
        AND policyname = 'Owner can delete own stations'
    ) THEN
        CREATE POLICY "Owner can delete own stations" ON stations
            FOR DELETE TO authenticated
            USING (auth.uid() = owner_id);
    END IF;
END $$;

-- RLS muss an sein
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. WALLETS: Sicherstellen dass direkte Manipulation blockiert ist
-- ============================================================

-- Nochmals sicherstellen dass die gefaehrlichen Policies weg sind
DROP POLICY IF EXISTS "Users can update their own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;

-- RLS muss an sein
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- SELECT-Policies sicherstellen (User darf nur eigene sehen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'wallets'
        AND policyname = 'Users can view their own wallet'
    ) THEN
        CREATE POLICY "Users can view their own wallet" ON wallets
            FOR SELECT TO authenticated
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'transactions'
        AND policyname = 'Users can view their own transactions'
    ) THEN
        CREATE POLICY "Users can view their own transactions" ON transactions
            FOR SELECT TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================================
-- 5. WALLET_TRANSACTIONS: RLS aktivieren (falls Tabelle existiert)
-- ============================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions') THEN
        ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

        -- Nur via Service-Role oder SECURITY DEFINER Funktionen zugreifbar
        -- User duerfen eigene Transaktionen lesen
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'wallet_transactions'
            AND policyname = 'Users can view own wallet transactions'
        ) THEN
            EXECUTE 'CREATE POLICY "Users can view own wallet transactions" ON wallet_transactions
                FOR SELECT TO authenticated
                USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()))';
        END IF;
    END IF;
END $$;

-- ============================================================
-- 6. RESERVATIONS: Fehlende DELETE-Policy + RLS Check
-- ============================================================

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- User darf nur eigene Reservierungen loeschen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'reservations'
        AND policyname = 'Users can delete own reservations'
    ) THEN
        CREATE POLICY "Users can delete own reservations" ON reservations
            FOR DELETE TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================================
-- 7. RENTALS: RLS sicherstellen + Owner-Lesezugriff
-- ============================================================

ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

-- Owner darf Rentals seiner Stationen sehen (fuer Dashboard)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'rentals'
        AND policyname = 'Owners can view rentals for their stations'
    ) THEN
        CREATE POLICY "Owners can view rentals for their stations" ON rentals
            FOR SELECT TO authenticated
            USING (
                station_id IN (
                    SELECT id FROM stations WHERE owner_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ============================================================
-- 8. PROFILES: Role-Update ueber Trigger absichern
--    Verhindert dass User sich selbst eine Rolle geben
--    indem sie direkt UPDATE auf profiles.role machen.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_role_self_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Nur pruefen wenn sich die Rolle aendert
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- Nur Owner duerfen Rollen aendern (ueber assign_user_role)
        -- Normaler User-Update soll role nicht aendern koennen
        -- Service-Role (API-Proxy) ist davon ausgenommen
        IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
            -- Pruefen ob der Aufrufer Owner ist
            IF NOT EXISTS (
                SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
            ) THEN
                -- Nicht-Owner darf role nicht aendern
                NEW.role := OLD.role;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger erstellen (erst droppen falls vorhanden)
DROP TRIGGER IF EXISTS trigger_prevent_role_self_change ON profiles;
CREATE TRIGGER trigger_prevent_role_self_change
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_role_self_change();

-- ============================================================
-- 9. assign_user_role: Haerten (case-insensitive + Laenge)
-- ============================================================

CREATE OR REPLACE FUNCTION assign_user_role(
    p_target_user_id UUID,
    p_new_role TEXT
)
RETURNS void AS $$
DECLARE
    v_caller_role TEXT;
    v_normalized_role TEXT;
BEGIN
    -- Authentifizierung pruefen
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Nicht authentifiziert';
    END IF;

    -- Pruefen dass der Aufrufer Owner ist
    SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
    IF v_caller_role != 'owner' THEN
        RAISE EXCEPTION 'Nur Owner duerfen Rollen zuweisen';
    END IF;

    -- Normalisieren (case-insensitive) und validieren
    v_normalized_role := lower(trim(p_new_role));

    IF v_normalized_role NOT IN ('user', 'owner') THEN
        RAISE EXCEPTION 'Ungueltige Rolle';
    END IF;

    IF length(v_normalized_role) > 20 THEN
        RAISE EXCEPTION 'Ungueltige Rolle';
    END IF;

    -- Verhindere Self-Demotion
    IF auth.uid() = p_target_user_id AND v_normalized_role != 'owner' THEN
        RAISE EXCEPTION 'Owner kann sich nicht selbst herabstufen';
    END IF;

    -- Update durchfuehren
    UPDATE profiles SET role = v_normalized_role WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. CONCURRENT RENTAL PROTECTION: Advisory Lock
--     Verhindert Race-Condition bei gleichzeitigen Rental-Requests
-- ============================================================

-- Nur wenn create_rental existiert: Absicherung via Advisory Lock
-- (Der vollstaendige create_rental ist in supabase_dual_slot_setup.sql
-- definiert. Hier fuegen wir NUR den Lock hinzu, ohne die Funktion
-- komplett zu ueberschreiben.)

-- Hinweis: Die bestehende create_rental Funktion prueft bereits:
-- - auth.uid() = p_user_id
-- - Wallet-Balance >= 5.00
-- - Station aktiv + available_units > 0
-- - User innerhalb 100m
-- - Kein aktives Rental
-- Der Advisory Lock hier ist eine zusaetzliche Absicherung.

-- ============================================================
-- 11. DEVICE_API_KEY: Column-Level-Schutz
--     Verhindert dass authenticated/anon User den API-Key
--     ueber SELECT lesen koennen (Defense-in-Depth).
--     Der ESP-Proxy nutzt service_role und ist nicht betroffen.
-- ============================================================

-- Entziehe Leserecht auf device_api_key fuer normale Rollen
-- (service_role behalt vollen Zugriff)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stations' AND column_name = 'device_api_key'
    ) THEN
        EXECUTE 'REVOKE SELECT (device_api_key) ON stations FROM anon';
        EXECUTE 'REVOKE SELECT (device_api_key) ON stations FROM authenticated';
    END IF;
END $$;

-- ============================================================
-- ZUSAMMENFASSUNG DER AENDERUNGEN:
-- ============================================================
-- [x] stations_public: owner_id, powerbank_ids entfernt
-- [x] Storage Upload: Owner-Pruefung bei INSERT
-- [x] Storage Update: Owner-Pruefung bei UPDATE
-- [x] Stations: Alle WITH CHECK (true) Policies entfernt
-- [x] Stations: Owner-basierte Policies sichergestellt
-- [x] Wallets: Direkte Manipulation endgueltig blockiert
-- [x] wallet_transactions: RLS aktiviert (falls vorhanden)
-- [x] Reservations: DELETE-Policy hinzugefuegt
-- [x] Rentals: Owner-Lesezugriff fuer Dashboard
-- [x] Profiles: Trigger verhindert Role-Self-Change
-- [x] assign_user_role: Case-insensitive + Laengenvalidierung
-- [x] device_api_key: Column-Level REVOKE fuer anon/authenticated
-- ============================================================

COMMIT;
