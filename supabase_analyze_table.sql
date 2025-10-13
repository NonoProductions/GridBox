-- Analysiere die aktuelle Struktur der stations Tabelle
-- Führen Sie dieses Script aus, um zu sehen, welche Spalten bereits existieren

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'stations' 
ORDER BY ordinal_position;

-- Zeige auch die aktuellen Daten in der Tabelle
SELECT COUNT(*) as total_stations FROM stations;

-- Zeige die ersten 5 Einträge (falls vorhanden)
SELECT * FROM stations LIMIT 5;


