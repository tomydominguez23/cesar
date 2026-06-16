-- =============================================================================
-- RLS: acceso de estudiantes según suscripción y plan
-- Ejecutar en Supabase → SQL Editor (después de stripe-profiles.sql)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funciones helper (eliminar versiones previas si cambió la firma)
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.apply_pending_subscription();
DROP FUNCTION IF EXISTS public.can_access_storage_object(text, text);
DROP FUNCTION IF EXISTS public.storage_path_course_id(text);
DROP FUNCTION IF EXISTS public.can_access_course(uuid);
DROP FUNCTION IF EXISTS public.can_access_plan(text);
DROP FUNCTION IF EXISTS public.has_active_subscription();
DROP FUNCTION IF EXISTS public.current_user_plan();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.plan_rank(text);

CREATE OR REPLACE FUNCTION public.plan_rank(p_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'basico' THEN 1
    WHEN 'medio' THEN 2
    WHEN 'avanzado' THEN 3
    WHEN 'pro' THEN 4
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_plan()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(plan, 'basico')
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND subscription_status IN ('active', 'trialing')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_plan(p_required_plan text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      public.has_active_subscription()
      AND public.plan_rank(public.current_user_plan()) >= public.plan_rank(COALESCE(p_required_plan, 'basico'))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      public.has_active_subscription()
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = p_course_id
          AND c.status = 'published'
          AND public.can_access_plan(COALESCE(c.plan_required, 'basico'))
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.storage_path_course_id(p_path text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_path ~ '^courses/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      THEN substring(p_path from '^courses/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')::uuid
    ELSE NULL::uuid
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_storage_object(p_bucket text, p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.is_admin() THEN true
      WHEN NOT public.has_active_subscription() THEN false
      WHEN p_bucket = 'media-library' AND p_path = 'branding/header-logo' THEN true
      WHEN public.storage_path_course_id(p_path) IS NULL THEN false
      WHEN p_bucket = 'media-library' AND p_path ~ '^courses/[0-9a-f-]{36}/cover' THEN
        public.can_access_course(public.storage_path_course_id(p_path))
      WHEN p_bucket = 'lesson-videos' THEN
        EXISTS (
          SELECT 1
          FROM public.lessons l
          INNER JOIN public.courses c ON c.id = l.course_id
          WHERE l.video_path = p_path
            AND c.id = public.storage_path_course_id(p_path)
            AND c.status = 'published'
            AND (
              COALESCE(l.is_free_preview, false) = true
              OR public.can_access_plan(COALESCE(c.plan_required, 'basico'))
            )
        )
      WHEN p_bucket = 'lesson-materials' THEN
        EXISTS (
          SELECT 1
          FROM public.lesson_materials m
          INNER JOIN public.courses c ON c.id = m.course_id
          WHERE m.storage_path = p_path
            AND c.status = 'published'
            AND public.can_access_plan(COALESCE(m.plan_required, c.plan_required, 'basico'))
        )
      ELSE false
    END;
$$;

-- Aplica pago pendiente (Stripe) al perfil del usuario autenticado.
-- Evita que el cliente modifique plan/suscripción directamente.
CREATE OR REPLACE FUNCTION public.apply_pending_subscription()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_pending public.pending_subscriptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not_authenticated');
  END IF;

  SELECT u.email
  INTO v_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_email');
  END IF;

  SELECT *
  INTO v_pending
  FROM public.pending_subscriptions
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false);
  END IF;

  UPDATE public.profiles
  SET
    plan = v_pending.plan,
    stripe_customer_id = v_pending.stripe_customer_id,
    stripe_subscription_id = v_pending.stripe_subscription_id,
    subscription_status = COALESCE(v_pending.subscription_status, 'active'),
    subscription_current_period_end = v_pending.subscription_current_period_end
  WHERE id = auth.uid();

  DELETE FROM public.pending_subscriptions
  WHERE lower(email) = lower(v_email);

  RETURN jsonb_build_object(
    'applied', true,
    'plan', v_pending.plan,
    'subscription_status', COALESCE(v_pending.subscription_status, 'active')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_pending_subscription() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_pending_subscription() TO authenticated;

GRANT EXECUTE ON FUNCTION public.plan_rank(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_plan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_plan(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_course(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_path_course_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_storage_object(text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_manage" ON public.profiles;
CREATE POLICY "profiles_admin_manage"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- pending_subscriptions (solo service role + función SECURITY DEFINER)
-- -----------------------------------------------------------------------------

ALTER TABLE public.pending_subscriptions ENABLE ROW LEVEL SECURITY;

-- Sin políticas para authenticated/anon: el webhook (service role) y apply_pending_subscription escriben.

-- -----------------------------------------------------------------------------
-- courses
-- -----------------------------------------------------------------------------

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses_select_students" ON public.courses;
CREATE POLICY "courses_select_students"
ON public.courses
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    status = 'published'
    AND public.has_active_subscription()
    AND public.can_access_plan(COALESCE(plan_required, 'basico'))
  )
);

DROP POLICY IF EXISTS "courses_admin_manage" ON public.courses;
CREATE POLICY "courses_admin_manage"
ON public.courses
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- course_modules
-- -----------------------------------------------------------------------------

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_modules_select_students" ON public.course_modules;
CREATE POLICY "course_modules_select_students"
ON public.course_modules
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.can_access_course(course_id)
);

DROP POLICY IF EXISTS "course_modules_admin_manage" ON public.course_modules;
CREATE POLICY "course_modules_admin_manage"
ON public.course_modules
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- lessons
-- -----------------------------------------------------------------------------

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lessons_select_students" ON public.lessons;
CREATE POLICY "lessons_select_students"
ON public.lessons
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    status = 'published'
    AND public.has_active_subscription()
    AND EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = lessons.course_id
        AND c.status = 'published'
    )
    AND (
      COALESCE(lessons.is_free_preview, false) = true
      OR public.can_access_plan(COALESCE(
        (SELECT c.plan_required FROM public.courses c WHERE c.id = lessons.course_id),
        'basico'
      ))
    )
  )
);

DROP POLICY IF EXISTS "lessons_admin_manage" ON public.lessons;
CREATE POLICY "lessons_admin_manage"
ON public.lessons
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- lesson_materials
-- -----------------------------------------------------------------------------

ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_materials_select_students" ON public.lesson_materials;
CREATE POLICY "lesson_materials_select_students"
ON public.lesson_materials
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    public.has_active_subscription()
    AND EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = lesson_materials.course_id
        AND c.status = 'published'
    )
    AND public.can_access_plan(COALESCE(
      lesson_materials.plan_required,
      (SELECT c.plan_required FROM public.courses c WHERE c.id = lesson_materials.course_id),
      'basico'
    ))
  )
);

DROP POLICY IF EXISTS "lesson_materials_admin_manage" ON public.lesson_materials;
CREATE POLICY "lesson_materials_admin_manage"
ON public.lesson_materials
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- lesson_external_resources (panel admin)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.lesson_external_resources') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.lesson_external_resources ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "lesson_external_resources_admin_manage" ON public.lesson_external_resources';
    EXECUTE $policy$
      CREATE POLICY "lesson_external_resources_admin_manage"
      ON public.lesson_external_resources
      FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin())
    $policy$;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Storage (videos, materiales, portadas)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins manage all storage objects" ON storage.objects;
CREATE POLICY "Admins manage all storage objects"
ON storage.objects
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Students read entitled storage objects" ON storage.objects;
CREATE POLICY "Students read entitled storage objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (public.can_access_storage_object(bucket_id, name));

-- Las políticas del logo público (storage-public-logo.sql) siguen aplicando para anon/public.
