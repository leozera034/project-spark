ALTER TABLE public.couriers DROP COLUMN IF EXISTS completed_deliveries_count;

CREATE OR REPLACE FUNCTION public.courier_completed_deliveries_count(_courier_id uuid, _store_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.deliveries d
  WHERE d.courier_id = _courier_id
    AND d.store_id = _store_id
    AND d.status = 'concluida'::delivery_status
$$;

CREATE OR REPLACE VIEW public.courier_delivery_counts
WITH (security_invoker = true)
AS
  SELECT c.id AS courier_id,
         c.store_id,
         count(d.id) FILTER (WHERE d.status = 'concluida'::delivery_status)::int AS completed_deliveries
  FROM public.couriers c
  LEFT JOIN public.deliveries d
    ON d.courier_id = c.id AND d.store_id = c.store_id
  GROUP BY c.id, c.store_id;

REVOKE ALL ON public.courier_delivery_counts FROM anon, authenticated;
GRANT SELECT ON public.courier_delivery_counts TO service_role;
REVOKE ALL ON FUNCTION public.courier_completed_deliveries_count(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.courier_completed_deliveries_count(uuid, uuid) TO service_role;