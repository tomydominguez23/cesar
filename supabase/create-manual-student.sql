-- Crear o activar un estudiante manualmente (sin Stripe).
-- Ejecutar en Supabase → SQL Editor.
--
-- Ejemplo incluido: Ysafit18@gmail.com / Plan Básico
-- La contraseña se define al crear el usuario en Auth (Dashboard o API Admin).

DO $$
DECLARE
  v_email text := 'Ysafit18@gmail.com';
  v_full_name text := 'Ysafit';
  v_plan text := 'basico';
  v_user_id uuid;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado en auth.users: %. Créalo primero en Authentication → Users → Add user (marca "Auto Confirm User").', v_email;
  END IF;

  UPDATE auth.users
  SET
    email_confirmed_at = COALESCE(email_confirmed_at, timezone('utc', now())),
    confirmed_at = COALESCE(confirmed_at, timezone('utc', now()))
  WHERE id = v_user_id;

  INSERT INTO public.profiles (id, full_name, plan, subscription_status)
  VALUES (v_user_id, v_full_name, v_plan, 'active')
  ON CONFLICT (id) DO UPDATE
  SET
    plan = EXCLUDED.plan,
    subscription_status = 'active',
    full_name = COALESCE(NULLIF(trim(public.profiles.full_name), ''), EXCLUDED.full_name);
END $$;

-- Verificación
SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmado,
  p.full_name,
  p.plan,
  p.subscription_status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = lower('Ysafit18@gmail.com');
