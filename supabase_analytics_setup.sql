-- ============================================================
-- ANALYTICS SETUP - GridBox PWA
-- Datum: 2026-03-18
--
-- Erstellt die page_views Tabelle fuer Website-Analytics.
-- Erfasst Seitenaufrufe, Verweildauer, Herkunft etc.
--
-- WICHTIG: In Supabase SQL Editor ausfuehren!
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PAGE_VIEWS Tabelle
-- ============================================================

CREATE TABLE IF NOT EXISTS page_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    path TEXT NOT NULL,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    device_type TEXT, -- 'mobile', 'tablet', 'desktop'
    browser TEXT,
    os TEXT,
    screen_width INT,
    screen_height INT,
    language TEXT,
    country TEXT,
    duration_seconds INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index fuer schnelle Abfragen nach Zeitraum
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at DESC);

-- Index fuer Session-Gruppierung
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views (session_id);

-- Index fuer Pfad-Aggregation
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views (path);

-- ============================================================
-- 2. RLS: Nur Service-Role darf schreiben, Owner darf lesen
-- ============================================================

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Keine direkte INSERT/UPDATE/DELETE fuer anon oder authenticated
-- Tracking laeuft ueber API-Route mit Service-Role

-- Owner duerfen Analytics-Daten lesen
CREATE POLICY "Owners can view page_views" ON page_views
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- ============================================================
-- 3. DURATION UPDATE Funktion
--    Wird aufgerufen wenn der User die Seite verlaesst
-- ============================================================

CREATE OR REPLACE FUNCTION update_page_view_duration(
    p_session_id TEXT,
    p_path TEXT,
    p_duration INT
)
RETURNS void AS $$
BEGIN
        UPDATE page_views
        SET duration_seconds = p_duration
        WHERE id = (
                SELECT id
                FROM page_views
                WHERE session_id = p_session_id
                    AND path = p_path
                    AND duration_seconds = 0
                ORDER BY created_at DESC
                LIMIT 1
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. CLEANUP: Alte Daten nach 90 Tagen loeschen (optional)
--    Kann als Cron-Job in Supabase eingerichtet werden
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_page_views()
RETURNS void AS $$
BEGIN
    DELETE FROM page_views WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ZUSAMMENFASSUNG:
-- [x] page_views Tabelle mit allen relevanten Feldern
-- [x] Indizes fuer performante Abfragen
-- [x] RLS: Nur Owner duerfen lesen, schreiben nur via Service-Role
-- [x] Duration-Update Funktion
-- [x] Cleanup-Funktion fuer alte Daten
-- ============================================================

COMMIT;
