-- Rate limiting para Edge Functions (checkout, etc.)
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  bucket_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON public.rate_limit_events (action, bucket_key, created_at DESC);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Sin políticas públicas: solo service role / funciones SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.assert_rate_limit(
  p_action text,
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  IF p_bucket IS NULL OR length(trim(p_bucket)) = 0 THEN
    RAISE EXCEPTION 'invalid_bucket';
  END IF;

  IF p_max IS NULL OR p_max < 1 THEN
    RAISE EXCEPTION 'invalid_max';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid_window';
  END IF;

  DELETE FROM public.rate_limit_events
  WHERE created_at < now() - make_interval(secs => p_window_seconds);

  SELECT count(*)::integer
  INTO v_count
  FROM public.rate_limit_events
  WHERE action = p_action
    AND bucket_key = p_bucket
    AND created_at > now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_max THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.rate_limit_events (action, bucket_key)
  VALUES (p_action, left(p_bucket, 200));
END;
$$;

REVOKE ALL ON FUNCTION public.assert_rate_limit(text, text, integer, integer) FROM PUBLIC;
