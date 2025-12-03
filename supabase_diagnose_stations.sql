-- =====================================================
-- DIAGNOSE: Stationen nicht sichtbar im Dashboard
-- =====================================================

-- 1. Prüfe ob stations Tabelle existiert
SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'stations'
) AS "Stations Tabelle existiert";

-- 2. Zähle Stationen
SELECT COUNT(*) AS "Anzahl Stationen" FROM stations;

-- 3. Prüfe RLS Status
SELECT 
    tablename,
    rowsecurity AS "RLS aktiviert"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'stations';

-- 4. Liste alle Policies für stations
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS "Operation",
    qual AS "USING",
    with_check AS "WITH CHECK"
FROM pg_policies 
WHERE tablename = 'stations'
ORDER BY policyname;

-- 5. Zeige erste 3 Stationen (zum Testen)
SELECT 
    id,
    name,
    short_code,
    is_active,
    owner_id,
    created_at
FROM stations
ORDER BY created_at DESC
LIMIT 3;

-- =====================================================
-- FIX: Policies für Dashboard-Zugriff
-- =====================================================

-- Entferne alle alten Policies
DROP POLICY IF EXISTS "Allow public read access to active stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated read access to all stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to insert stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to update stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to delete stations" ON stations;

-- Erstelle neue Policies (WICHTIG: In dieser Reihenfolge!)

-- 1. Öffentlicher Lesezugriff auf aktive Stationen (für Kunden-App)
CREATE POLICY "stations_public_read"
ON stations FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 2. Authentifizierte Benutzer können ALLE Stationen lesen (für Dashboard)
CREATE POLICY "stations_authenticated_read_all"
ON stations FOR SELECT
TO authenticated
USING (true);

-- 3. Authentifizierte Benutzer können Stationen hinzufügen
CREATE POLICY "stations_authenticated_insert"
ON stations FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Authentifizierte Benutzer können Stationen aktualisieren
CREATE POLICY "stations_authenticated_update"
ON stations FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Authentifizierte Benutzer können Stationen löschen
CREATE POLICY "stations_authenticated_delete"
ON stations FOR DELETE
TO authenticated
USING (true);

-- Stelle sicher, dass RLS aktiviert ist
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFICATION: Prüfe ob Policies korrekt sind
-- =====================================================

-- Zeige alle aktiven Policies
SELECT 
    policyname,
    cmd AS "Operation",
    roles,
    CASE 
        WHEN qual IS NULL THEN 'true' 
        ELSE qual::text 
    END AS "USING Clause"
FROM pg_policies 
WHERE tablename = 'stations'
ORDER BY policyname;

-- =====================================================
-- TEST: Teste Zugriff
-- =====================================================

-- Test 1: Kann ich als authenticated user Stationen sehen?
-- (Führe dies in Supabase SQL Editor aus, während du eingeloggt bist)
SELECT 
    'TEST 1: Authenticated Read' AS test_name,
    COUNT(*) AS anzahl_stationen,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ ERFOLGREICH' 
        ELSE '❌ FEHLGESCHLAGEN' 
    END AS status
FROM stations;

-- Test 2: Kann ich aktive Stationen sehen?
SELECT 
    'TEST 2: Active Stations' AS test_name,
    COUNT(*) AS anzahl_aktive_stationen,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ ERFOLGREICH' 
        ELSE '⚠️ KEINE AKTIVEN STATIONEN' 
    END AS status
FROM stations
WHERE is_active = true;

