-- Multi-store users must be able to carry an explicit store selection into
-- delivery reports. Keep the previous signatures for compatibility, but add
-- overloads with _store_id as the first argument. Authorization remains
-- server-side through reports.view_operational.

CREATE OR REPLACE FUNCTION private.require_delivery_report_store(_store_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _sid uuid;
BEGIN
  _sid := private.resolve_store(_store_id);
  PERFORM private.require_permission('reports.view_operational'::public.app_permission, _sid);
  RETURN _sid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_store_delivery_report_summary(
  _store_id uuid,
  _period_type text,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _sid uuid;
  _limits record;
  _completed bigint;
  _couriers bigint;
BEGIN
  _sid := private.require_delivery_report_store(_store_id);
  SELECT * INTO _limits
  FROM private.delivery_report_period_limits(_sid, _period_type, _start_date, _end_date);

  SELECT count(*), count(DISTINCT d.courier_id)
  INTO _completed, _couriers
  FROM public.deliveries d
  JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
  WHERE d.store_id = _sid
    AND d.status = 'concluida'
    AND d.completed_at IS NOT NULL
    AND d.courier_id IS NOT NULL
    AND d.completed_at >= _limits.start_utc
    AND d.completed_at < _limits.end_utc
    AND o.fulfillment = 'entrega'
    AND o.status = 'entregue';

  RETURN jsonb_build_object(
    'completedDeliveries', coalesce(_completed, 0),
    'couriersWithCompletions', coalesce(_couriers, 0),
    'period', jsonb_build_object(
      'type', _period_type,
      'start', _limits.start_utc,
      'end', _limits.end_utc
    ),
    'timezone', _limits.store_tz,
    'generatedAt', now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_store_delivery_report_series(
  _store_id uuid,
  _period_type text,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _sid uuid;
  _limits record;
  _series jsonb;
BEGIN
  _sid := private.require_delivery_report_store(_store_id);
  SELECT * INTO _limits
  FROM private.delivery_report_period_limits(_sid, _period_type, _start_date, _end_date);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'local_date', x.local_date::text,
        'completed_deliveries', x.completed_deliveries
      ) ORDER BY x.local_date
    ),
    '[]'::jsonb
  )
  INTO _series
  FROM (
    SELECT
      (d.completed_at AT TIME ZONE _limits.store_tz)::date AS local_date,
      count(*) AS completed_deliveries
    FROM public.deliveries d
    JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
    WHERE d.store_id = _sid
      AND d.status = 'concluida'
      AND d.completed_at IS NOT NULL
      AND d.courier_id IS NOT NULL
      AND d.completed_at >= _limits.start_utc
      AND d.completed_at < _limits.end_utc
      AND o.fulfillment = 'entrega'
      AND o.status = 'entregue'
    GROUP BY (d.completed_at AT TIME ZONE _limits.store_tz)::date
  ) x;

  RETURN jsonb_build_object('series', _series, 'timezone', _limits.store_tz);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_store_delivery_report_by_courier(
  _store_id uuid,
  _period_type text,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _sid uuid;
  _limits record;
  _rows jsonb;
BEGIN
  _sid := private.require_delivery_report_store(_store_id);
  SELECT * INTO _limits
  FROM private.delivery_report_period_limits(_sid, _period_type, _start_date, _end_date);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'courierId', x.courier_id,
        'courierName', x.courier_name,
        'courierStatus', x.courier_status,
        'completed_deliveries', x.completed_deliveries
      ) ORDER BY x.completed_deliveries DESC, x.courier_name, x.courier_id
    ),
    '[]'::jsonb
  )
  INTO _rows
  FROM (
    SELECT
      c.id AS courier_id,
      c.full_name AS courier_name,
      c.status::text AS courier_status,
      count(*) AS completed_deliveries
    FROM public.deliveries d
    JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
    JOIN public.couriers c ON c.id = d.courier_id AND c.store_id = d.store_id
    WHERE d.store_id = _sid
      AND d.status = 'concluida'
      AND d.completed_at IS NOT NULL
      AND d.completed_at >= _limits.start_utc
      AND d.completed_at < _limits.end_utc
      AND o.fulfillment = 'entrega'
      AND o.status = 'entregue'
    GROUP BY c.id, c.full_name, c.status
  ) x;

  RETURN jsonb_build_object('rows', _rows, 'timezone', _limits.store_tz);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_store_completed_deliveries(
  _store_id uuid,
  _period_type text,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL,
  _courier_id uuid DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _sid uuid;
  _limits record;
  _items jsonb;
  _total bigint;
  _lim integer := least(greatest(coalesce(_limit, 50), 1), 100);
  _off integer := greatest(coalesce(_offset, 0), 0);
BEGIN
  _sid := private.require_delivery_report_store(_store_id);
  SELECT * INTO _limits
  FROM private.delivery_report_period_limits(_sid, _period_type, _start_date, _end_date);

  IF _courier_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = _courier_id AND c.store_id = _sid) THEN
    RAISE EXCEPTION 'COURIER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)
  INTO _total
  FROM public.deliveries d
  JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
  WHERE d.store_id = _sid
    AND d.status = 'concluida'
    AND d.completed_at IS NOT NULL
    AND d.courier_id IS NOT NULL
    AND d.completed_at >= _limits.start_utc
    AND d.completed_at < _limits.end_utc
    AND o.fulfillment = 'entrega'
    AND o.status = 'entregue'
    AND (_courier_id IS NULL OR d.courier_id = _courier_id);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'deliveryId', x.delivery_id,
        'orderNumber', x.order_number,
        'courierId', x.courier_id,
        'courierName', x.courier_name,
        'completedAt', x.completed_at
      ) ORDER BY x.completed_at DESC, x.delivery_id DESC
    ),
    '[]'::jsonb
  )
  INTO _items
  FROM (
    SELECT
      d.id AS delivery_id,
      o.order_number,
      c.id AS courier_id,
      c.full_name AS courier_name,
      d.completed_at
    FROM public.deliveries d
    JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
    JOIN public.couriers c ON c.id = d.courier_id AND c.store_id = d.store_id
    WHERE d.store_id = _sid
      AND d.status = 'concluida'
      AND d.completed_at IS NOT NULL
      AND d.completed_at >= _limits.start_utc
      AND d.completed_at < _limits.end_utc
      AND o.fulfillment = 'entrega'
      AND o.status = 'entregue'
      AND (_courier_id IS NULL OR d.courier_id = _courier_id)
    ORDER BY d.completed_at DESC, d.id DESC
    LIMIT _lim OFFSET _off
  ) x;

  RETURN jsonb_build_object('items', _items, 'total', _total, 'timezone', _limits.store_tz);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_store_delivery_report_summary(uuid,text,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_store_delivery_report_series(uuid,text,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_store_delivery_report_by_courier(uuid,text,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_store_completed_deliveries(uuid,text,date,date,uuid,integer,integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_store_delivery_report_summary(uuid,text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_store_delivery_report_series(uuid,text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_store_delivery_report_by_courier(uuid,text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_store_completed_deliveries(uuid,text,date,date,uuid,integer,integer) TO authenticated;
