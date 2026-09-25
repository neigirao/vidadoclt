-- Additive only: leaves scores INSERT policy untouched until the endpoint is
-- deployed, client switched, and a live smoke test succeeds.
CREATE TABLE IF NOT EXISTS public.score_rate_limits (
  subject_hash text PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts >= 0),
  window_start timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.score_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.score_rate_limits FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS score_rate_limits_expires_idx
  ON public.score_rate_limits (expires_at);

-- Only service_role may use this atomically across Edge Function isolates.
-- The input is a server-side HMAC of a gateway-observed IP, never the raw IP.
CREATE OR REPLACE FUNCTION public.accept_score_rate_limit(p_subject_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  accepted integer;
BEGIN
  IF p_subject_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid rate limit subject';
  END IF;

  INSERT INTO public.score_rate_limits AS r (subject_hash, attempts, window_start, expires_at)
    VALUES (p_subject_hash, 1, now(), now() + interval '1 hour')
  ON CONFLICT (subject_hash) DO UPDATE SET
    attempts = CASE WHEN r.expires_at <= now() THEN 1 ELSE r.attempts + 1 END,
    window_start = CASE WHEN r.expires_at <= now() THEN now() ELSE r.window_start END,
    expires_at = CASE WHEN r.expires_at <= now() THEN now() + interval '1 hour' ELSE r.expires_at END
  WHERE r.expires_at <= now() OR r.attempts < 3
  RETURNING 1 INTO accepted;
  RETURN accepted = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_score_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_score_rate_limit(text) TO service_role;

-- Cleanup is explicit: schedule this function via the project's maintenance
-- facility after checking pg_cron availability, or run it periodically by hand.
CREATE OR REPLACE FUNCTION public.prune_score_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE removed integer;
BEGIN
  DELETE FROM public.score_rate_limits WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION public.prune_score_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_score_rate_limits() TO service_role;
