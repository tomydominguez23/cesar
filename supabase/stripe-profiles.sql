-- Stripe + suscripciones: ejecutar en Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles (stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id
  ON public.profiles (stripe_subscription_id);

-- Pagos completados antes de que el usuario cree cuenta (mismo email)
CREATE TABLE IF NOT EXISTS public.pending_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  plan text NOT NULL CHECK (plan IN ('basico', 'medio', 'avanzado', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text DEFAULT 'active',
  subscription_current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_subscriptions ENABLE ROW LEVEL SECURITY;

-- Solo el service role (webhook) escribe; sin acceso público directo
DROP POLICY IF EXISTS "pending_subscriptions service only" ON public.pending_subscriptions;
