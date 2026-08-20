-- Crear o activar un estudiante manualmente (sin Stripe).
-- Ejecutar en Supabase → SQL Editor.
--
-- Ejemplo: Ysafit18@gmail.com | Plan Básico | Contraseña: Protrading2026
-- (La contraseña se define en Authentication → Users, no en este SQL.)

-- -----------------------------------------------------------------------------
-- PASO 1: Confirmar email del usuario
-- -----------------------------------------------------------------------------
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, timezone('utc', now()))
WHERE lower(email) = lower('Ysafit18@gmail.com');

-- -----------------------------------------------------------------------------
-- PASO 2: Crear perfil si no existe (plan = enum plan_tier en esta BD)
-- -----------------------------------------------------------------------------
INSERT INTO public.profiles (id, full_name, plan, role, subscription_status)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), 'Ysafit'),
  'basico'::plan_tier,
  'student',
  'active'
FROM auth.users u
WHERE lower(u.email) = lower('Ysafit18@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PASO 3: Activar plan básico y suscripción
-- -----------------------------------------------------------------------------
UPDATE public.profiles p
SET
  plan = 'basico'::plan_tier,
  subscription_status = 'active',
  role = COALESCE(p.role, 'student'),
  full_name = COALESCE(NULLIF(trim(p.full_name), ''), 'Ysafit')
FROM auth.users u
WHERE u.id = p.id
  AND lower(u.email) = lower('Ysafit18@gmail.com');

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
    WHEN p.subscription_status IN ('active', 'trialing') THEN 'puede entrar'
    ELSE 'bloqueado'
  END AS acceso
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = lower('Ysafit18@gmail.com');
