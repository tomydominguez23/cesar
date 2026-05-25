-- Ejecutar en Supabase: SQL Editor
-- Permite que el sitio público lea el logo subido en Mediateca (branding/header-logo)

-- 1) Si el bucket media-library no existe, créalo desde Storage con nombre: media-library

-- 2) Política de lectura pública solo para el logo del header
DROP POLICY IF EXISTS "Public read header logo" ON storage.objects;

CREATE POLICY "Public read header logo"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'media-library'
  AND name = 'branding/header-logo'
);

-- 3) (Opcional) Permitir que usuarios anónimos generen URL firmada del logo
DROP POLICY IF EXISTS "Anon sign header logo" ON storage.objects;

CREATE POLICY "Anon sign header logo"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'media-library'
  AND name = 'branding/header-logo'
);
