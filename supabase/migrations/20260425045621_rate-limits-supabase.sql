-- Rate limits table: one row per unique key (IP or IP+slug), used by check_rate_limit().
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = deny all direct access; function uses SECURITY DEFINER to bypass RLS.

-- Atomic sliding-window rate limiter.
-- Upserts a counter for the key; resets counter when window expires.
-- Returns: success (count <= max), remaining attempts, window reset timestamp.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max_attempts INTEGER,
  p_window_secs INTEGER
) RETURNS TABLE(success BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_reset TIMESTAMPTZ;
BEGIN
  INSERT INTO public.rate_limits (key, count, reset_at)
  VALUES (p_key, 1, NOW() + (p_window_secs || ' seconds')::INTERVAL)
  ON CONFLICT (key) DO UPDATE
    SET
      count    = CASE WHEN public.rate_limits.reset_at <= NOW() THEN 1
                      ELSE public.rate_limits.count + 1 END,
      reset_at = CASE WHEN public.rate_limits.reset_at <= NOW()
                      THEN NOW() + (p_window_secs || ' seconds')::INTERVAL
                      ELSE public.rate_limits.reset_at END
  RETURNING public.rate_limits.count, public.rate_limits.reset_at
  INTO v_count, v_reset;

  RETURN QUERY
  SELECT
    (v_count <= p_max_attempts)            AS success,
    GREATEST(0, p_max_attempts - v_count)  AS remaining,
    v_reset                                AS reset_at;
END;
$$;
