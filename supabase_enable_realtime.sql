-- Aktiviere Realtime für die stations Tabelle
-- Dies ermöglicht automatische Updates im Dashboard ohne Seiten-Refresh

-- 1. Aktiviere Realtime für die stations Tabelle
ALTER PUBLICATION supabase_realtime ADD TABLE stations;

-- 2. Stelle sicher, dass Row Level Security (RLS) aktiv ist
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- 3. Policy für Realtime: Erlaube allen Usern, Änderungen zu sehen
-- (Bestehende Policies werden nicht überschrieben)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stations' 
        AND policyname = 'Enable realtime for all users'
    ) THEN
        CREATE POLICY "Enable realtime for all users" 
        ON stations 
        FOR SELECT 
        USING (true);
    END IF;
END $$;

-- Fertig! Realtime ist jetzt aktiv.
-- Das Dashboard empfängt automatisch Updates wenn:
-- - ESP32 Batterie-Daten sendet
-- - Stationen erstellt/gelöscht werden
-- - Kapazität geändert wird
-- - Relais-Status geändert wird

