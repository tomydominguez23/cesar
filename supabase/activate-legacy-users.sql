-- =============================================================================
-- Activar usuarios creados ANTES del sistema de precios / Stripe
-- Ejecutar en Supabase → SQL Editor
--
-- Nota: en muchas instalaciones `plan` es enum plan_tier (no text).
-- Por eso NO usamos trim() sobre plan; solo COALESCE con cast explícito.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PASO 0 (opcional): Ver quién está bloqueado ahora
-- -----------------------------------------------------------------------------
SELECT
  u.id,
  u.email,
  u.created_at AS usuario_creado,
  p.plan,
  p.role,
  p.subscription_status,
  p.stripe_subscription_id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE COALESCE(p.role::text, 'student') <> 'admin'
  AND COALESCE(p.subscription_status, 'inactive') NOT IN ('active', 'trialing')
ORDER BY u.created_at;

-- -----------------------------------------------------------------------------
-- PASO 1: Crear perfil a usuarios de Auth que no tienen fila en profiles
-- -----------------------------------------------------------------------------
INSERT INTO public.profiles (id, full_name, plan, role, subscription_status)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
  'basico'::plan_tier,
  'student',
  'active'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Si role no es enum, usa esta variante del PASO 1 en su lugar:
-- INSERT INTO public.profiles (id, full_name, plan, role, subscription_status)
-- SELECT u.id,
--   COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
--   'basico'::plan_tier, 'student', 'active'
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- WHERE p.id IS NULL
-- ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PASO 2: Activar usuarios legacy (sin suscripción Stripe en el perfil)
-- -----------------------------------------------------------------------------
UPDATE public.profiles p
SET
  subscription_status = 'active',
  plan = COALESCE(p.plan, 'basico'::plan_tier)
FROM auth.users u
WHERE u.id = p.id
  AND COALESCE(p.role::text, 'student') <> 'admin'
  AND COALESCE(p.subscription_status, 'inactive') NOT IN ('active', 'trialing')
  AND (p.stripe_subscription_id IS NULL OR btrim(p.stripe_subscription_id) = '')
  AND NOT EXISTS (
    SELECT 1
    FROM public.pending_subscriptions ps
    WHERE lower(ps.email) = lower(u.email)
  );

-- -----------------------------------------------------------------------------
-- PASO 3 (opcional): Dar plan Pro a todos los legacy activados
-- -----------------------------------------------------------------------------
-- UPDATE public.profiles p
-- SET plan = 'pro'::plan_tier
-- FROM auth.users u
-- WHERE u.id = p.id
--   AND COALESCE(p.role::text, 'student') <> 'admin'
--   AND p.subscription_status = 'active'
--   AND (p.stripe_subscription_id IS NULL OR btrim(p.stripe_subscription_id) = '');

-- -----------------------------------------------------------------------------
-- PASO 4: Verificar resultado
-- -----------------------------------------------------------------------------
SELECT
  u.email,
  p.plan,
  p.subscription_status,
  p.stripe_subscription_id,
  CASE
    WHEN COALESCE(p.role::text, 'student') = 'admin' THEN 'admin (siempre entra)'
    WHEN p.subscription_status IN ('active', 'trialing') THEN 'puede entrar'
    ELSE 'bloqueado'
  END AS acceso
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at;
