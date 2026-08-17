-- Crear o activar un estudiante con acceso a TODOS los cursos (plan Pro).
-- Ejecutar en Supabase → SQL Editor.
--
-- Caso: waneselduro@icloud.com | Plan Pro Trading
-- Contraseña: Protrading2026 (definida en Authentication → Users)

-- -----------------------------------------------------------------------------
-- PASO 1: Confirmar email del usuario
-- -----------------------------------------------------------------------------
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, timezone('utc', now()))
WHERE lower(email) = lower('waneselduro@icloud.com');

-- -----------------------------------------------------------------------------
-- PASO 2: Crear perfil si no existe (plan = enum plan_tier)
-- -----------------------------------------------------------------------------
INSERT INTO public.profiles (id, full_name, plan, role, subscription_status)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), 'Waneselduro'),
  'pro'::plan_tier,
  'student',
  'active'
FROM auth.users u
WHERE lower(u.email) = lower('waneselduro@icloud.com')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PASO 3: Activar plan Pro (acceso a todos los cursos)
-- -----------------------------------------------------------------------------
UPDATE public.profiles p
SET
  plan = 'pro'::plan_tier,
  subscription_status = 'active',
  role = COALESCE(p.role, 'student'),
  full_name = COALESCE(NULLIF(trim(p.full_name), ''), 'Waneselduro')
FROM auth.users u
WHERE u.id = p.id
  AND lower(u.email) = lower('waneselduro@icloud.com');

-- -----------------------------------------------------------------------------
-- PASO 4: Verificar
-- -----------------------------------------------------------------------------
SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmado,
  p.full_name,
  p.plan,
  p.role,
  p.subscription_status,
  CASE
    WHEN p.subscription_status IN ('active', 'trialing') AND p.plan::text = 'pro'
      THEN 'puede entrar (todos los cursos)'
    WHEN p.subscription_status IN ('active', 'trialing')
      THEN 'puede entrar'
    ELSE 'bloqueado'
  END AS acceso
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = lower('waneselduro@icloud.com');
