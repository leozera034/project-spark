-- Migration: Phase 23 - Operational Alerts and Notifications
-- Implements sanitized projections for store and courier alerts.

-- Store Operational Alerts Projection
CREATE OR REPLACE FUNCTION private.get_my_store_operational_alerts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _store_id uuid;
    _unanswered_orders json;
    _no_courier_alerts json;
BEGIN
    _store_id := private.current_store_id();
    IF _store_id IS NULL THEN RETURN '{"unanswered_orders": [], "no_courier_alerts": []}'::json; END IF;

    -- 1. Unanswered Orders (> 60s in 'pendente' without answer)
    SELECT json_agg(t) INTO _unanswered_orders
    FROM (
        SELECT 
            id as entity_id,
            'unanswered_order' as type,
            'critical' as severity,
            created_at,
            version
        FROM public.orders
        WHERE store_id = _store_id
          AND status = 'pendente'
          AND created_at < (now() - interval '60 seconds')
    ) t;

    -- 2. Ready Orders without assigned Delivery (> 5 min)
    SELECT json_agg(t) INTO _no_courier_alerts
    FROM (
        SELECT 
            o.id as entity_id,
            'no_courier_assigned' as type,
            'warning' as severity,
            o.created_at,
            o.version
        FROM public.orders o
        LEFT JOIN public.deliveries d ON d.order_id = o.id
        WHERE o.store_id = _store_id
          AND o.status = 'pronto'
          AND (d.id IS NULL OR d.status = 'pendente')
          AND o.updated_at < (now() - interval '300 seconds')
    ) t;

    RETURN json_build_object(
        'unanswered_orders', COALESCE(_unanswered_orders, '[]'::json),
        'no_courier_alerts', COALESCE(_no_courier_alerts, '[]'::json)
    );
END;
$$;

-- Courier Assignments Alert
CREATE OR REPLACE FUNCTION private.get_my_courier_alerts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _courier_id uuid;
    _new_assignments json;
BEGIN
    SELECT id INTO _courier_id FROM public.couriers WHERE user_id = auth.uid() LIMIT 1;
    IF _courier_id IS NULL THEN RETURN '{"new_assignments": []}'::json; END IF;

    SELECT json_agg(t) INTO _new_assignments
    FROM (
        SELECT 
            id as delivery_id,
            'new_assignment' as type,
            'critical' as severity,
            created_at,
            version
        FROM public.deliveries
        WHERE courier_id = _courier_id
          AND status = 'pendente'
    ) t;

    RETURN json_build_object(
        'new_assignments', COALESCE(_new_assignments, '[]'::json)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION private.get_my_store_operational_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_my_courier_alerts TO authenticated;
