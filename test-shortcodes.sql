-- Teste ob short_codes existieren
SELECT id, name, short_code FROM stations LIMIT 10;

-- Zähle Stationen mit und ohne short_code
SELECT 
  COUNT(*) as total,
  COUNT(short_code) as with_code,
  COUNT(*) - COUNT(short_code) as without_code
FROM stations;

