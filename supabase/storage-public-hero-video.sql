-- Ejecutar en Supabase: SQL Editor
-- Permite que la landing lea el video del hero (y su poster) desde Mediateca.
--
-- Rutas fijas:
--   media-library/branding/hero-video
--   media-library/branding/hero-video-poster  (opcional)
--
-- 1) Si el bucket media-library no existe, créalo desde Storage con nombre: media-library
-- 2) Luego ejecuta este script completo.

DROP POLICY IF EXISTS "Public read hero video" ON storage.objects;

CREATE POLICY "Public read hero video"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'media-library'
  AND (
    name = 'branding/hero-video'
    OR name = 'branding/hero-video-poster'
  )
);

DROP POLICY IF EXISTS "Anon sign hero video" ON storage.objects;

CREATE POLICY "Anon sign hero video"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'media-library'
  AND (
    name = 'branding/hero-video'
    OR name = 'branding/hero-video-poster'
  )
);
