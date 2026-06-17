-- Enlaces de sesiones en vivo (Zoom): solo suscriptores activos
-- Ejecutar en Supabase SQL Editor (después de student-access-rls.sql)

CREATE TABLE IF NOT EXISTS public.live_session_links (
  slug text PRIMARY KEY,
  title text NOT NULL,
  zoom_url text NOT NULL,
  schedule_note text,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.live_session_links (slug, title, zoom_url, schedule_note, active)
VALUES (
  'qa-arizona',
  'Preguntas y Respuestas',
  'https://us06web.zoom.us/j/89321452328?pwd=Kcvax5ze3cXh5t5JBGXPynvcRGU4PC.1',
  'Lunes, miércoles y viernes a las 16:00 (hora Arizona)',
  true
)
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  zoom_url = EXCLUDED.zoom_url,
  schedule_note = EXCLUDED.schedule_note,
  active = EXCLUDED.active,
  updated_at = now();

ALTER TABLE public.live_session_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_session_links_select_subscribers" ON public.live_session_links;
CREATE POLICY "live_session_links_select_subscribers"
ON public.live_session_links
FOR SELECT
TO authenticated
USING (
  active = true
  AND (
    public.is_admin()
    OR public.has_active_subscription()
  )
);

DROP POLICY IF EXISTS "live_session_links_admin_manage" ON public.live_session_links;
CREATE POLICY "live_session_links_admin_manage"
ON public.live_session_links
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
