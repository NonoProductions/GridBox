-- ============================================
-- DIAGNOSE & FIX: Short-Codes für QR-Scanner
-- ============================================
-- Dieses Script prüft und behebt Probleme mit Short-Codes

-- 1️⃣ DIAGNOSE: Zeige aktuellen Status aller Stationen
-- ============================================
SELECT 
  id,
  name,
  short_code,
  is_active,
  CASE 
    WHEN short_code IS NULL THEN '❌ FEHLT'
    WHEN short_code = '' THEN '❌ LEER'
    WHEN LENGTH(short_code) != 4 THEN '⚠️ FALSCHE LÄNGE'
    ELSE '✅ OK'
  END as status,
  CASE 
    WHEN is_active = false THEN '⚠️ INAKTIV'
    ELSE '✅ AKTIV'
  END as aktiv_status
FROM stations
ORDER BY created_at DESC;

-- 2️⃣ STATISTIK: Wie viele Stationen haben welchen Status?
-- ============================================
SELECT 
  COUNT(*) as gesamt_stationen,
  COUNT(short_code) as mit_shortcode,
  COUNT(*) - COUNT(short_code) as ohne_shortcode,
  COUNT(CASE WHEN is_active = true THEN 1 END) as aktive_stationen,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inaktive_stationen
FROM stations;

-- 3️⃣ PRÜFUNG: Finde Duplikate (sollte keine geben)
-- ============================================
SELECT 
  short_code, 
  COUNT(*) as anzahl,
  STRING_AGG(name, ', ') as stationen
FROM stations
WHERE short_code IS NOT NULL AND short_code != ''
GROUP BY short_code
HAVING COUNT(*) > 1;
-- Falls Ergebnis: ❌ PROBLEM! Duplikate gefunden
-- Falls leer: ✅ Keine Duplikate

-- 4️⃣ FIX: Stelle sicher, dass die short_code Spalte existiert
-- ============================================
DO $$ 
BEGIN
  -- Prüfe ob Spalte existiert
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'stations' 
    AND column_name = 'short_code'
  ) THEN
    -- Erstelle Spalte falls sie nicht existiert
    ALTER TABLE stations ADD COLUMN short_code VARCHAR(4);
    RAISE NOTICE '✅ Spalte short_code wurde erstellt';
  ELSE
    RAISE NOTICE 'ℹ️ Spalte short_code existiert bereits';
  END IF;
END $$;

-- 5️⃣ FIX: Erstelle Unique Constraint (falls noch nicht vorhanden)
-- ============================================
DO $$ 
BEGIN
  -- Versuche Unique Constraint hinzuzufügen
  ALTER TABLE stations ADD CONSTRAINT stations_short_code_unique UNIQUE (short_code);
  RAISE NOTICE '✅ Unique Constraint erstellt';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'ℹ️ Unique Constraint existiert bereits';
  WHEN unique_violation THEN
    RAISE NOTICE '❌ FEHLER: Duplikate gefunden! Bereinige erst die Duplikate';
END $$;

-- 6️⃣ FIX: Generiere Short-Codes für Stationen ohne Code
-- ============================================
-- WICHTIG: Nur Stationen OHNE Short-Code bekommen einen neuen
UPDATE stations
SET short_code = UPPER(
  SUBSTRING(
    MD5(RANDOM()::TEXT || id::TEXT || NOW()::TEXT) 
    FROM 1 FOR 4
  )
)
WHERE short_code IS NULL OR short_code = ''
RETURNING id, name, short_code;
-- Zeigt die Stationen, die gerade einen Code bekommen haben

-- 7️⃣ FINAL CHECK: Zeige alle Stationen nach dem Fix
-- ============================================
SELECT 
  id,
  name,
  short_code,
  is_active,
  CASE 
    WHEN short_code IS NULL THEN '❌ PROBLEM'
    WHEN LENGTH(short_code) != 4 THEN '⚠️ FALSCHE LÄNGE'
    ELSE '✅ OK'
  END as code_status
FROM stations
ORDER BY created_at DESC;

-- 8️⃣ TEST: Teste die Suche nach Short-Code (wie in der App)
-- ============================================
-- Ersetze 'ABC1' mit einem tatsächlichen Short-Code aus deiner Datenbank
SELECT 
  id,
  name,
  short_code,
  is_active,
  address,
  available_units
FROM stations
WHERE UPPER(short_code) = UPPER('ABC1') -- ⬅️ Hier deinen Code eintragen
  AND is_active = true;
-- Falls Ergebnis: ✅ Station wird gefunden (QR-Scan sollte funktionieren)
-- Falls leer: ❌ Station nicht gefunden oder inaktiv

-- ============================================
-- 🔍 ANLEITUNG ZUM TESTEN:
-- ============================================
-- 1. Führe Schritt 1 aus → Sieh aktuellen Status
-- 2. Führe Schritt 2 aus → Sieh Statistik
-- 3. Führe Schritt 3 aus → Prüfe auf Duplikate
-- 4-6. Führe die FIX-Schritte aus → Behebt Probleme
-- 7. Führe Final Check aus → Verifiziere Erfolg
-- 8. Teste mit einem echten Code aus deiner DB
--
-- ⚠️ WICHTIG: Führe diese Schritte in Supabase SQL Editor aus:
-- Dashboard → SQL Editor → New Query → Code einfügen → Run
--
-- 📱 NACH DEM FIX:
-- - Deploye die App neu (Vercel)
-- - Scanne einen QR-Code
-- - Öffne Browser-Konsole (F12)
-- - Du solltest sehen: "✅ Station gefunden"
-- ============================================

