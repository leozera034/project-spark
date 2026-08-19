-- Harden tenant membership helpers so an inactive user profile cannot retain
-- store access through role rows that remain active. Also repair legacy growth
-- queries that referenced order_status values no longer present in production.

CREATE OR REPLACE FUNCTION private.is_store_member(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT _store_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.user_profiles p
       JOIN public.user_roles r ON r.user_id = p.id
       WHERE p.id = auth.uid()
         AND p.is_active
         AND r.is_active
         AND r.store_id = _store_id
         AND r.role IN ('proprietario','gerente','atendente','cozinha')
     )
$function$;

CREATE OR REPLACE FUNCTION private.is_store_manager(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT _store_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.user_profiles p
       JOIN public.user_roles r ON r.user_id = p.id
       WHERE p.id = auth.uid()
         AND p.is_active
         AND r.is_active
         AND r.store_id = _store_id
         AND r.role IN ('proprietario','gerente')
     )
$function$;

CREATE OR REPLACE FUNCTION public.list_my_stores()
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.id, s.name, s.slug
  FROM public.stores s
  WHERE EXISTS (
    SELECT 1
    FROM public.user_profiles p
    JOIN public.user_roles r ON r.user_id = p.id
    WHERE p.id = auth.uid()
      AND p.is_active
      AND r.is_active
      AND r.store_id = s.id
      AND r.role IN ('proprietario','gerente','atendente','cozinha')
  )
  ORDER BY s.name
$function$;

CREATE OR REPLACE FUNCTION public.get_store_growth_summary(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.is_store_member(_store_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  SELECT jsonb_build_object(
    'customers', count(*),
    'newCustomers30d', count(*) FILTER (WHERE c.created_at >= now() - interval '30 days'),
    'repeatCustomers', count(*) FILTER (WHERE c.orders_count >= 2),
    'vipCustomers', count(*) FILTER (WHERE c.orders_count >= 5),
    'inactiveCustomers', count(*) FILTER (WHERE c.last_order_at < now() - interval '30 days'),
    'orders30d', coalesce((
      SELECT count(*)
      FROM public.orders o
      WHERE o.store_id = _store_id
        AND o.created_at >= now() - interval '30 days'
        AND o.status NOT IN ('cancelado','recusado')
    ), 0),
    'revenue30d', coalesce((
      SELECT sum(o.total_amount)
      FROM public.orders o
      WHERE o.store_id = _store_id
        AND o.created_at >= now() - interval '30 days'
        AND o.status IN ('entregue','retirado')
    ), 0),
    'avgTicket30d', coalesce((
      SELECT avg(o.total_amount)
      FROM public.orders o
      WHERE o.store_id = _store_id
        AND o.created_at >= now() - interval '30 days'
        AND o.status IN ('entregue','retirado')
    ), 0)
  ) INTO result
  FROM public.customers c
  WHERE c.store_id = _store_id;

  RETURN coalesce(result, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_store_revenue_series(_store_id uuid, _days integer DEFAULT 30)
RETURNS TABLE(day date, orders bigint, revenue numeric, avg_ticket numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT private.is_store_member(_store_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      current_date - (least(greatest(_days, 7), 90) - 1),
      current_date,
      interval '1 day'
    )::date AS d
  )
  SELECT
    days.d,
    count(o.id) FILTER (WHERE o.status NOT IN ('cancelado','recusado'))::bigint,
    coalesce(sum(o.total_amount) FILTER (WHERE o.status IN ('entregue','retirado')), 0)::numeric,
    coalesce(avg(o.total_amount) FILTER (WHERE o.status IN ('entregue','retirado')), 0)::numeric
  FROM days
  LEFT JOIN public.orders o
    ON o.store_id = _store_id
   AND o.created_at >= days.d
   AND o.created_at < days.d + interval '1 day'
  GROUP BY days.d
  ORDER BY days.d;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_store_customer_insights(
  _store_id uuid,
  _search text DEFAULT NULL,
  _segment text DEFAULT NULL,
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.is_store_member(_store_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  WITH ranked AS (
    SELECT
      c.id,
      c.first_name,
      c.phone,
      c.orders_count,
      c.last_order_at,
      c.created_at,
      coalesce(sum(o.total_amount) FILTER (WHERE o.status IN ('entregue','retirado')), 0)::numeric(12,2) AS lifetime_value,
      CASE
        WHEN c.orders_count >= 5 THEN 'vip'
        WHEN c.last_order_at IS NOT NULL AND c.last_order_at < now() - interval '30 days' THEN 'inativos'
        WHEN c.orders_count >= 2 THEN 'recorrentes'
        ELSE 'novos'
      END AS segment
    FROM public.customers c
    LEFT JOIN public.orders o
      ON o.store_id = c.store_id
     AND o.customer_id = c.id
    WHERE c.store_id = _store_id
    GROUP BY c.id
  ), filtered AS (
    SELECT *
    FROM ranked
    WHERE (
      _search IS NULL
      OR trim(_search) = ''
      OR first_name ILIKE '%' || trim(_search) || '%'
      OR phone ILIKE '%' || trim(_search) || '%'
    )
      AND (
        _segment IS NULL
        OR trim(_segment) = ''
        OR segment = _segment
      )
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'items', coalesce((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.lifetime_value DESC, x.last_order_at DESC NULLS LAST)
      FROM (
        SELECT * FROM filtered
        LIMIT least(greatest(_limit, 1), 200)
        OFFSET greatest(_offset, 0)
      ) x
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;
