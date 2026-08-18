CREATE TABLE public.edge_rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.edge_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.edge_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  _key text,
  _limit integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  _row public.edge_rate_limits%ROWTYPE;
  _now timestamptz := clock_timestamp();
BEGIN
  IF coalesce(length(_key), 0) < 1 OR length(_key) > 200 THEN
    RAISE EXCEPTION 'INVALID_RATE_LIMIT_KEY';
  END IF;
  IF _limit < 1 OR _limit > 100000 OR _window_seconds < 1 OR _window_seconds > 604800 THEN
    RAISE EXCEPTION 'INVALID_RATE_LIMIT_CONFIG';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_key, 20260818));

  SELECT * INTO _row
  FROM public.edge_rate_limits
  WHERE key = _key
  FOR UPDATE;

  IF NOT FOUND OR _row.window_started_at + make_interval(secs => _window_seconds) <= _now THEN
    INSERT INTO public.edge_rate_limits(key, window_started_at, hits, updated_at)
    VALUES (_key, _now, 1, _now)
    ON CONFLICT (key) DO UPDATE
      SET window_started_at = EXCLUDED.window_started_at,
          hits = 1,
          updated_at = EXCLUDED.updated_at;
    RETURN true;
  END IF;

  IF _row.hits >= _limit THEN
    RETURN false;
  END IF;

  UPDATE public.edge_rate_limits
  SET hits = hits + 1,
      updated_at = _now
  WHERE key = _key;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) TO service_role;

COMMENT ON TABLE public.edge_rate_limits IS 'Server-only fixed-window counters for external Edge gateway abuse protection.';
COMMENT ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) IS 'Atomically consumes a server-only Edge rate limit bucket; callable only by service_role.';
