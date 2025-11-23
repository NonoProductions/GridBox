-- Erstelle Storage Bucket für Station-Fotos
-- Hinweis: Dies muss in der Supabase SQL-Konsole ausgeführt werden

-- Erstelle den Bucket (falls er noch nicht existiert)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'station-photos',
  'station-photos',
  true, -- Öffentlich zugänglich
  5242880, -- 5 MB Limit (in Bytes)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Erstelle Storage Policies für öffentlichen Zugriff (READ)
-- Jeder kann Fotos lesen
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'station-photos');

-- Erstelle Storage Policies für authentifizierte Benutzer (INSERT/UPDATE/DELETE)
-- Nur eingeloggte Benutzer können Fotos hochladen
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'station-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'station-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'station-photos' 
  AND auth.role() = 'authenticated'
);

