-- Ejecutar en Supabase → SQL Editor
-- Requiere: student-access-rls.sql (función public.is_admin())
--
-- Flag del chat con IA:
--   key = ai_chat_enabled
--   value = 'true' | 'false'
--
-- Mientras esté en false: solo administradores ven/usan el widget.
-- Al ponerlo en true: los alumnos con suscripción activa también lo ven.

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (key, value)
VALUES ('ai_chat_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read site settings" ON public.site_settings;
CREATE POLICY "Authenticated can read site settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage site settings" ON public.site_settings;
CREATE POLICY "Admins manage site settings"
ON public.site_settings
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

GRANT SELECT ON public.site_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
