-- Tighten the global admin authorization contract without broadening table RLS.
-- Platform RPCs remain SECURITY DEFINER because they intentionally expose
-- sanitized/transactional projections over tables that platform admins must
-- not access directly. Each RPC now names the specific platform permission it
-- requires instead of relying on a generic role-only check.

CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles r
    WHERE r.user_id = auth.uid()
      AND r.is_active
      AND r.role = 'admin_plataforma'
      AND r.store_id IS NULL
  )
$function$;

CREATE OR REPLACE FUNCTION private.has_permission(
  _permission public.app_permission,
  _target_store_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _roles public.app_role[];
  _name text := _permission::text;
BEGIN
  IF _uid IS NULL OR _permission IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id = _uid AND p.is_active
  ) THEN RETURN false; END IF;

  _roles := private.permission_roles(_permission);
  IF _roles IS NULL OR cardinality(_roles) = 0 THEN RETURN false; END IF;

  IF _name LIKE 'platform.%' THEN
    RETURN _target_store_id IS NULL AND EXISTS (
      SELECT 1
      FROM public.user_roles r
      WHERE r.user_id = _uid
        AND r.is_active
        AND r.role = 'admin_plataforma'
        AND r.store_id IS NULL
        AND r.role = ANY (_roles)
    );
  END IF;

  IF _name LIKE 'courier.%' THEN
    RETURN _target_store_id IS NOT NULL
       AND private.current_courier_id() IS NOT NULL
       AND private.current_courier_store_id() = _target_store_id;
  END IF;

  IF _target_store_id IS NULL THEN RETURN false; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles r
    WHERE r.user_id = _uid
      AND r.is_active
      AND r.store_id = _target_store_id
      AND r.role = ANY (_roles)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_platform_health_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.has_permission('platform.stores.view'::public.app_permission, NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'totalStores', (SELECT count(*) FROM public.stores),
    'activeStores', (SELECT count(*) FROM public.stores WHERE status = 'ativa'),
    'suspendedStores', (SELECT count(*) FROM public.stores WHERE status = 'suspensa'),
    'ordersLast24h', (SELECT count(*) FROM public.orders WHERE created_at >= now() - interval '24 hours'),
    'activeCouriers', (SELECT count(*) FROM public.couriers WHERE status = 'ativo' AND is_online),
    'generatedAt', now()
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_platform_billing_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.has_permission('platform.billing.view'::public.app_permission, NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'activeSubscriptions', count(*) FILTER (WHERE ss.status = 'ativa'),
    'courtesySubscriptions', count(*) FILTER (WHERE ss.status = 'cortesia'),
    'delinquentSubscriptions', count(*) FILTER (WHERE ss.status = 'inadimplente'),
    'suspendedSubscriptions', count(*) FILTER (WHERE ss.status = 'suspensa'),
    'monthlyRecurringRevenue', coalesce(sum(greatest(ss.monthly_price - ss.discount_amount, 0)) FILTER (WHERE ss.status = 'ativa'), 0),
    'paidCurrentMonth', coalesce((
      SELECT sum(sp.amount)
      FROM public.subscription_payments sp
      WHERE sp.status = 'pago'
        AND sp.reference_month = date_trunc('month', current_date)::date
    ), 0),
    'generatedAt', now()
  ) INTO result
  FROM public.store_subscriptions ss;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_platform_recent_errors(_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
  lim integer := least(greatest(coalesce(_limit, 20), 1), 100);
BEGIN
  IF NOT private.has_permission('platform.audit.view'::public.app_permission, NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'storeId', a.store_id,
        'message', a.context ->> 'message',
        'route', a.context ->> 'route',
        'source', a.context ->> 'source',
        'boundary', a.context ->> 'boundary',
        'createdAt', a.created_at
      ) ORDER BY a.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO result
  FROM (
    SELECT *
    FROM public.audit_logs
    WHERE action = 'app.error'
    ORDER BY created_at DESC
    LIMIT lim
  ) a;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_platform_stores(
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
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
  result jsonb;
  lim integer := least(greatest(coalesce(_limit, 50), 1), 200);
  off integer := greatest(coalesce(_offset, 0), 0);
BEGIN
  IF NOT private.has_permission('platform.stores.view'::public.app_permission, NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  WITH filtered AS (
    SELECT s.*
    FROM public.stores s
    WHERE (
      nullif(btrim(coalesce(_search, '')), '') IS NULL
      OR s.name ILIKE '%' || btrim(_search) || '%'
      OR s.slug ILIKE '%' || btrim(_search) || '%'
    )
      AND (
        nullif(btrim(coalesce(_status, '')), '') IS NULL
        OR s.status::text = _status
      )
  ), paged AS (
    SELECT
      f.id,
      f.name,
      f.slug,
      f.status::text AS status,
      f.created_at,
      (SELECT count(*) FROM public.orders o WHERE o.store_id = f.id) AS total_orders
    FROM filtered f
    ORDER BY f.created_at DESC, f.id
    LIMIT lim OFFSET off
  )
  SELECT jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM paged p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered)
  ) INTO result;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_suspend_store(_store_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  IF NOT private.has_permission('platform.stores.suspend'::public.app_permission, NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(coalesce(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.stores
  SET status = 'suspensa', updated_at = now()
  WHERE id = _store_id;

  INSERT INTO public.audit_logs(
    store_id, actor_user_id, actor_kind, action, entity, entity_id, context
  ) VALUES (
    _store_id,
    auth.uid(),
    'admin',
    'platform.store_suspended',
    'stores',
    _store_id,
    jsonb_build_object('reason', left(btrim(_reason), 500))
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reactivate_store(_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  IF NOT private.has_permission('platform.stores.reactivate'::public.app_permission, NULL) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.stores
  SET status = 'ativa', updated_at = now()
  WHERE id = _store_id;

  INSERT INTO public.audit_logs(
    store_id, actor_user_id, actor_kind, action, entity, entity_id, context
  ) VALUES (
    _store_id,
    auth.uid(),
    'admin',
    'platform.store_reactivated',
    'stores',
    _store_id,
    '{}'::jsonb
  );
END;
$function$;
