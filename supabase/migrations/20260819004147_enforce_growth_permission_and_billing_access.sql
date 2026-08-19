-- Growth/CRM data contains customer contact and revenue. Keep it scoped to
-- reports.view_operational (owner/manager) and honor the existing billing
-- capability can_use_growth. The frontend may hide the route, but the database
-- remains the authoritative enforcement point.

CREATE OR REPLACE FUNCTION private.require_growth_access(_store_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _access jsonb;
BEGIN
  PERFORM private.require_permission('reports.view_operational'::public.app_permission, _store_id);

  _access := public.get_store_billing_access(_store_id);
  IF NOT coalesce((_access ->> 'can_use_growth')::boolean, false) THEN
    RAISE EXCEPTION 'BILLING_RESTRICTED' USING
      ERRCODE = 'P0001',
      DETAIL = jsonb_build_object(
        'stage', _access ->> 'stage',
        'capability', 'growth'
      )::text;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_store_growth_summary(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  PERFORM private.require_growth_access(_store_id);

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
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  PERFORM private.require_growth_access(_store_id);

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
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  PERFORM private.require_growth_access(_store_id);

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

CREATE OR REPLACE FUNCTION public.list_store_marketing_campaigns(_store_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  audience text,
  channel text,
  message text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  PERFORM private.require_growth_access(_store_id);

  RETURN QUERY
  SELECT c.id,c.name,c.audience,c.channel,c.message,c.status,c.created_at,c.updated_at
  FROM public.store_marketing_campaigns c
  WHERE c.store_id = _store_id
  ORDER BY c.updated_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_store_automation_rules(_store_id uuid)
RETURNS TABLE(
  id uuid,
  event_code text,
  action_code text,
  name text,
  is_enabled boolean,
  config jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  PERFORM private.require_growth_access(_store_id);

  RETURN QUERY
  SELECT r.id,r.event_code,r.action_code,r.name,r.is_enabled,r.config,r.created_at,r.updated_at
  FROM public.store_automation_rules r
  WHERE r.store_id = _store_id
  ORDER BY r.created_at;
END;
$function$;
