-- Owner-Setup für spezifischen Benutzer
-- User ID: 9a7b61be-0c51-453c-a657-93bac639f85e

-- 1. Erstelle die user_roles Tabelle, falls sie nicht existiert
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Erstelle Indizes für bessere Performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- 3. Erstelle eine Funktion zum automatischen Update des updated_at Feldes
CREATE OR REPLACE FUNCTION update_user_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Erstelle einen Trigger für automatisches Update
CREATE TRIGGER update_user_roles_updated_at 
    BEFORE UPDATE ON user_roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_user_roles_updated_at();

-- 5. Erstelle eine Funktion, um die Rolle eines Benutzers zu prüfen
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM user_roles 
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Erstelle eine Funktion, um zu prüfen, ob ein Benutzer Owner ist
CREATE OR REPLACE FUNCTION is_owner(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'owner' 
        FROM user_roles 
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Erstelle eine Funktion, um zu prüfen, ob ein Benutzer Admin oder Owner ist
CREATE OR REPLACE FUNCTION is_admin_or_owner(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role IN ('owner', 'admin') 
        FROM user_roles 
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Weise IHRER User ID die Owner-Rolle zu
INSERT INTO user_roles (user_id, role) 
VALUES ('9a7b61be-0c51-453c-a657-93bac639f85e', 'owner')
ON CONFLICT (user_id) DO UPDATE SET role = 'owner';

-- 9. Aktualisiere die stations Tabelle Policies für Owner-Zugriff
DROP POLICY IF EXISTS "Allow authenticated users to insert stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to update stations" ON stations;
DROP POLICY IF EXISTS "Allow authenticated users to delete stations" ON stations;

-- Neue Policies mit Rollen-basierter Zugriffskontrolle
CREATE POLICY "Allow public read access to active stations" ON stations
    FOR SELECT USING (is_active = true);

CREATE POLICY "Allow owners and admins to insert stations" ON stations
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        is_admin_or_owner(auth.uid())
    );

CREATE POLICY "Allow owners and admins to update stations" ON stations
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND 
        is_admin_or_owner(auth.uid())
    );

CREATE POLICY "Allow owners to delete stations" ON stations
    FOR DELETE USING (
        auth.role() = 'authenticated' AND 
        is_owner(auth.uid())
    );

-- 10. Erstelle Policies für user_roles Tabelle
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read their own role" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow owners to manage all roles" ON user_roles
    FOR ALL USING (
        auth.role() = 'authenticated' AND 
        is_owner(auth.uid())
    );

-- 11. Erstelle eine View für einfachere Abfragen
CREATE OR REPLACE VIEW user_with_role AS
SELECT 
    u.id,
    u.email,
    u.created_at as user_created_at,
    COALESCE(ur.role, 'user') as role,
    ur.created_at as role_assigned_at
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id;

-- 12. Erstelle eine Funktion zum Hinzufügen von Benutzern zu Rollen
CREATE OR REPLACE FUNCTION assign_user_role(user_uuid UUID, user_role VARCHAR(50))
RETURNS VOID AS $$
BEGIN
    -- Prüfe, ob der aufrufende Benutzer Owner ist
    IF NOT is_owner(auth.uid()) THEN
        RAISE EXCEPTION 'Nur Owner können Rollen zuweisen';
    END IF;
    
    -- Validiere die Rolle
    IF user_role NOT IN ('owner', 'admin', 'user') THEN
        RAISE EXCEPTION 'Ungültige Rolle: %', user_role;
    END IF;
    
    -- Weise die Rolle zu
    INSERT INTO user_roles (user_id, role) 
    VALUES (user_uuid, user_role)
    ON CONFLICT (user_id) DO UPDATE SET role = user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Erstelle eine Funktion zum Entfernen von Benutzern aus Rollen
CREATE OR REPLACE FUNCTION remove_user_role(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    -- Prüfe, ob der aufrufende Benutzer Owner ist
    IF NOT is_owner(auth.uid()) THEN
        RAISE EXCEPTION 'Nur Owner können Rollen entfernen';
    END IF;
    
    -- Entferne die Rolle (Benutzer wird zu 'user')
    DELETE FROM user_roles WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Erstelle eine Funktion zum Abrufen aller Benutzer mit Rollen
CREATE OR REPLACE FUNCTION get_all_users_with_roles()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Prüfe, ob der aufrufende Benutzer Owner oder Admin ist
    IF NOT is_admin_or_owner(auth.uid()) THEN
        RAISE EXCEPTION 'Nur Owner und Admins können alle Benutzer sehen';
    END IF;
    
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        COALESCE(ur.role, 'user') as role,
        u.created_at
    FROM auth.users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Bestätigung
SELECT 'Owner-Setup für User ID 9a7b61be-0c51-453c-a657-93bac639f85e abgeschlossen!' as status;


