-- Entferne alte Policies
DROP POLICY IF EXISTS "Allow public read access to active stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to insert stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to update stations" ON stations;

-- Erstelle neue, verbesserte Policies

-- 1. Öffentlicher Lesezugriff auf aktive Stationen
CREATE POLICY "Allow public read access to active stations" ON stations
    FOR SELECT USING (is_active = true);

-- 2. Authentifizierte Benutzer können alle Stationen lesen
CREATE POLICY "Allow authenticated read access to all stations" ON stations
    FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Authentifizierte Benutzer können Stationen hinzufügen
CREATE POLICY "Allow authenticated users to insert stations" ON stations
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

-- 4. Authentifizierte Benutzer können Stationen aktualisieren
CREATE POLICY "Allow authenticated users to update stations" ON stations
    FOR UPDATE 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Authentifizierte Benutzer können Stationen löschen
CREATE POLICY "Allow authenticated users to delete stations" ON stations
    FOR DELETE 
    TO authenticated
    USING (true);

-- Stelle sicher, dass RLS aktiviert ist
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

