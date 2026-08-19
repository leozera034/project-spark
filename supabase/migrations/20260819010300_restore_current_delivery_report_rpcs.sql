-- Restore delivery report RPCs against the current production schema.
-- The historical Phase 20 migration targets an obsolete schema and must not be
-- replayed. These RPCs preserve the frontend contract while using the current
-- enum values, columns and centralized authorization model.

CREATE INDEX IF NOT EXISTS deliveries_completed_report_idx
  ON public.deliveries (store_id, completed_at DESC, courier_id)
  WHERE status = 'concluida' AND completed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION private.require_delivery_report_store()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _sid uuid;
BEGIN
  _sid := private.resolve_store(NULL);
  PERFORM private.require_permission('reports.view_operational'::public.app_permission, _sid);
  RETURN _sid;
END;
$function$;

CREATE OR REPLACE FUNCTION private.delivery_report_period_limits(
  _store_id uuid,
  _period_type text,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL
)
RETURNS TABLE(start_utc timestamptz, end_utc timestamptz, store_tz text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _tz text;
  _today date;
  _start_local date;
  _end_exclusive_local date;
BEGIN
  SELECT s.timezone INTO _tz
  FROM public.stores s
  WHERE s.id = _store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF _tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = _tz) THEN
    _tz := 'America/Sao_Paulo';
  END IF;

  _today := (now() AT TIME ZONE _tz)::date;

  CASE _period_type
    WHEN 'today' THEN
      _start_local := _today;
      _end_exclusive_local := _today + 1;
    WHEN 'week' THEN
      _start_local := date_trunc('week', _today::timestamp)::date;
      _end_exclusive_local := _start_local + 7;
    WHEN 'month' THEN
      _start_local := date_trunc('month', _today::timestamp)::date;
      _end_exclusive_local := (date_trunc('month', _today::timestamp) + interval '1 month')::date;
    WHEN 'custom' THEN
      IF _start_date IS NULL OR _end_date IS NULL THEN
        RAISE EXCEPTION 'START_AND_END_DATE_REQUIRED' USING ERRCODE = 'P0001';
      END IF;
      IF _end_date < _start_date THEN
        RAISE EXCEPTION 'INVALID_DATE_RANGE' USING ERRCODE = 'P0001';
      END IF;
      IF (_end_date - _start_date) > 366 THEN
        RAISE EXCEPTION 'PERIOD_TOO_LONG' USING ERRCODE = 'P0001';
      END IF;
      _start_local := _start_date;
      _end_exclusive_local := _end_date + 1;
    ELSE
      RAISE EXCEPTION 'INVALID_PERIOD_TYPE' USING ERRCODE = 'P0001';
  END CASE;

  RETURN QUERY
  SELECT
    _start_local::timestamp AT TIME ZONE _tz,
    _end_exclusive_local::timestamp AT TIME ZONE _tz,
    _tz;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_store_delivery_report_summary(
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
  _sid := private.require_delivery_report_store();
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
  _sid := private.require_delivery_report_store();
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
  _sid := private.require_delivery_report_store();
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
  _sid := private.require_delivery_report_store();
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

CREATE OR REPLACE FUNCTION public.get_my_courier_delivery_counter(
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
  _cid uuid;
  _sid uuid;
  _limits record;
  _today bigint := 0;
  _week bigint := 0;
  _month bigint := 0;
  _selected bigint := 0;
  _tz text;
BEGIN
  SELECT courier_id, store_id INTO _cid, _sid FROM private.require_current_courier();
  PERFORM private.require_permission('courier.view_self'::public.app_permission, _sid);

  SELECT * INTO _limits FROM private.delivery_report_period_limits(_sid, 'today', NULL, NULL);
  _tz := _limits.store_tz;
  SELECT count(*) INTO _today
  FROM public.deliveries d
  JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
  WHERE d.store_id = _sid AND d.courier_id = _cid
    AND d.status = 'concluida' AND d.completed_at IS NOT NULL
    AND d.completed_at >= _limits.start_utc AND d.completed_at < _limits.end_utc
    AND o.fulfillment = 'entrega' AND o.status = 'entregue';

  SELECT * INTO _limits FROM private.delivery_report_period_limits(_sid, 'week', NULL, NULL);
  SELECT count(*) INTO _week
  FROM public.deliveries d
  JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
  WHERE d.store_id = _sid AND d.courier_id = _cid
    AND d.status = 'concluida' AND d.completed_at IS NOT NULL
    AND d.completed_at >= _limits.start_utc AND d.completed_at < _limits.end_utc
    AND o.fulfillment = 'entrega' AND o.status = 'entregue';

  SELECT * INTO _limits FROM private.delivery_report_period_limits(_sid, 'month', NULL, NULL);
  SELECT count(*) INTO _month
  FROM public.deliveries d
  JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
  WHERE d.store_id = _sid AND d.courier_id = _cid
    AND d.status = 'concluida' AND d.completed_at IS NOT NULL
    AND d.completed_at >= _limits.start_utc AND d.completed_at < _limits.end_utc
    AND o.fulfillment = 'entrega' AND o.status = 'entregue';

  IF (_start_date IS NULL) <> (_end_date IS NULL) THEN
    RAISE EXCEPTION 'START_AND_END_DATE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF _start_date IS NOT NULL THEN
    SELECT * INTO _limits FROM private.delivery_report_period_limits(_sid, 'custom', _start_date, _end_date);
    SELECT count(*) INTO _selected
    FROM public.deliveries d
    JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
    WHERE d.store_id = _sid AND d.courier_id = _cid
      AND d.status = 'concluida' AND d.completed_at IS NOT NULL
      AND d.completed_at >= _limits.start_utc AND d.completed_at < _limits.end_utc
      AND o.fulfillment = 'entrega' AND o.status = 'entregue';
  END IF;

  RETURN jsonb_build_object(
    'today', coalesce(_today, 0),
    'currentWeek', coalesce(_week, 0),
    'currentMonth', coalesce(_month, 0),
    'selectedPeriod', coalesce(_selected, 0),
    'timezone', _tz,
    'generatedAt', now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_completed_deliveries(
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
  _cid uuid;
  _sid uuid;
  _items jsonb;
  _lim integer := least(greatest(coalesce(_limit, 50), 1), 100);
  _off integer := greatest(coalesce(_offset, 0), 0);
  _tz text;
BEGIN
  SELECT courier_id, store_id INTO _cid, _sid FROM private.require_current_courier();
  PERFORM private.require_permission('courier.view_self'::public.app_permission, _sid);
  SELECT s.timezone INTO _tz FROM public.stores s WHERE s.id = _sid;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'deliveryId', x.delivery_id,
        'orderNumber', x.order_number,
        'completedAt', x.completed_at
      ) ORDER BY x.completed_at DESC, x.delivery_id DESC
    ),
    '[]'::jsonb
  )
  INTO _items
  FROM (
    SELECT d.id AS delivery_id, o.order_number, d.completed_at
    FROM public.deliveries d
    JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
    WHERE d.store_id = _sid
      AND d.courier_id = _cid
      AND d.status = 'concluida'
      AND d.completed_at IS NOT NULL
      AND o.fulfillment = 'entrega'
      AND o.status = 'entregue'
    ORDER BY d.completed_at DESC, d.id DESC
    LIMIT _lim OFFSET _off
  ) x;

  RETURN jsonb_build_object(
    'items', _items,
    'timezone', coalesce(_tz, 'America/Sao_Paulo')
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.require_delivery_report_store() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.delivery_report_period_limits(uuid,text,date,date) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_my_store_delivery_report_summary(text,date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_store_delivery_report_series(text,date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_store_delivery_report_by_courier(text,date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_store_completed_deliveries(text,date,date,uuid,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_courier_delivery_counter(date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_completed_deliveries(integer,integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_store_delivery_report_summary(text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_store_delivery_report_series(text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_store_delivery_report_by_courier(text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_store_completed_deliveries(text,date,date,uuid,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_courier_delivery_counter(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_completed_deliveries(integer,integer) TO authenticated;
