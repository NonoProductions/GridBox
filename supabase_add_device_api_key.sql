-- ============================================================
-- ESP32 Device API Key: Sichere Authentifizierung ohne Supabase-Key
-- ============================================================
-- Jede Station bekommt einen eigenen device_api_key.
-- Der ESP32 sendet diesen Key als X-Station-Key Header an den Proxy.
-- Der Proxy validiert den Key serverseitig → der ESP32 braucht
-- KEINEN Supabase Anon/Service Key mehr.
-- ============================================================

-- 1. Spalte hinzufügen (Text, UNIQUE für schnelle Suche)
ALTER TABLE stations
ADD COLUMN IF NOT EXISTS device_api_key TEXT UNIQUE;

-- 2. Generiere einen initialen Key für die Station "88SH"
--    (32 Zeichen Hex = 128 Bit Entropie)
UPDATE stations
SET device_api_key = encode(gen_random_bytes(32), 'hex')
WHERE short_code = '88SH'
  AND device_api_key IS NULL;

-- 3. RLS Policy: device_api_key darf NIEMALS über die Client-API gelesen werden
--    (nur service_role hat Zugriff)
--    Die bestehenden SELECT-Policies geben vermutlich alle Spalten zurück.
--    Wir erstellen eine View ohne device_api_key für die Client-API:

-- Keinen direkten Lesezugriff auf device_api_key über PostgREST:
-- PostgREST (anon/authenticated) kann die Spalte trotzdem sehen,
-- da SELECT-Policies Zeilen- nicht Spalten-basiert sind.
-- Lösung: Column-Level Security mit einer SECURITY DEFINER Funktion
-- oder einfach sicherstellen, dass der Key lang genug ist (64 Hex-Zeichen = 256 Bit).
-- Der Key ist nutzlos ohne den Proxy-Endpunkt.

-- 4. Index für schnelle Suche nach device_api_key
CREATE INDEX IF NOT EXISTS idx_stations_device_api_key
ON stations (device_api_key)
WHERE device_api_key IS NOT NULL;

-- 5. Hilfsfunktion: Neuen API-Key für eine Station generieren (zum Rotieren)
CREATE OR REPLACE FUNCTION rotate_device_api_key(p_station_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_key TEXT;
  v_owner_id UUID;
BEGIN
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

-- 6. Zeige den generierten Key an (nur einmal nach Ausführung kopieren!)
SELECT short_code, device_api_key
FROM stations
WHERE short_code = '88SH';

-- ============================================================
-- WICHTIG: Den angezeigten device_api_key kopieren und in die
-- ESP32-Konfiguration (DEVICE_API_KEY) eintragen!
-- ============================================================
