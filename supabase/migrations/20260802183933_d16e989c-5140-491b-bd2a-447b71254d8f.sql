-- Fase 18 — RPCs de leitura e escrita da gestao de entregadores e entregas.

-- Motivos controlados de troca.
CREATE OR REPLACE FUNCTION private.is_valid_reassignment_reason(_code text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public','pg_temp'
AS $$ SELECT _code IN ('courier_unavailable','courier_offline','courier_declined','vehicle_problem','operational_adjustment','other') $$;

-- Acoes administrativas permitidas para um entregador, decididas no servidor.
CREATE OR REPLACE FUNCTION private.courier_allowed_actions(_store_id uuid, _status public.courier_status)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
  SELECT coalesce(array_agg(a ORDER BY ord), '{}'::text[])
  FROM (VALUES
    ('update',       1, private.has_permission('couriers.update', _store_id)),
    ('deactivate',   2, _status = 'ativo'   AND private.has_permission('couriers.update', _store_id)),
    ('activate',     3, _status = 'inativo' AND private.has_permission('couriers.update', _store_id)),
    ('reset_access', 4, private.has_permission('couriers.reset_access', _store_id))
  ) AS t(a, ord, ok) WHERE ok
$$;
REVOKE ALL ON FUNCTION private.courier_allowed_actions(uuid, public.courier_status) FROM PUBLIC;

-- Projecao de lista (telefone mascarado, sem e-mail sintetico, sem financeiro).
CREATE OR REPLACE FUNCTION public.list_my_store_couriers(
  _store_id uuid,
  _account text DEFAULT NULL,      -- ativo | inativo
  _presence text DEFAULT NULL,     -- online | offline
  _availability text DEFAULT NULL  -- disponivel | ocupado
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _store uuid; _rows jsonb;
BEGIN
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.view', _store);

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'displayName'), '[]'::jsonb) INTO _rows
  FROM (
    SELECT jsonb_build_object(
      'courierId', c.id,
      'displayName', c.full_name,
      'phoneMasked', private.mask_phone(c.phone),
      'isActive', (c.status = 'ativo'),
      'canAcceptDeliveries', c.can_accept_deliveries,
      'presenceStatus', CASE WHEN c.is_online THEN 'online' ELSE 'offline' END,
      'lastSeenAt', c.last_seen_at,
      'currentAssignment', CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
          'deliveryId', d.id, 'orderNumber', o.order_number, 'deliveryStatus', d.status::text) END,
      'createdAt', c.created_at,
      'updatedAt', c.updated_at,
      'version', c.version,
      'allowedActions', to_jsonb(private.courier_allowed_actions(_store, c.status))
    ) AS x
    FROM public.couriers c
    LEFT JOIN public.deliveries d
      ON d.store_id = c.store_id AND d.courier_id = c.id
     AND d.status IN ('atribuida','aceita','coletada','em_rota')
    LEFT JOIN public.orders o ON o.id = d.order_id AND o.store_id = d.store_id
   WHERE c.store_id = _store
     AND (_account IS NULL OR c.status::text = _account)
     AND (_presence IS NULL OR (_presence = 'online') = c.is_online)
     AND (_availability IS NULL OR (_availability = 'ocupado') = (d.id IS NOT NULL))
  ) s;

  RETURN jsonb_build_object('storeId', _store, 'serverNow', now(), 'couriers', _rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_courier_management_counts(_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _store uuid; _out jsonb;
BEGIN
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.view', _store);

  SELECT jsonb_build_object(
    'active',   count(*) FILTER (WHERE c.status = 'ativo'),
    'inactive', count(*) FILTER (WHERE c.status = 'inativo'),
    'online',   count(*) FILTER (WHERE c.status = 'ativo' AND c.is_online),
    'busy',     count(*) FILTER (WHERE private.courier_active_delivery_id(c.id, _store) IS NOT NULL),
    'unassignedDeliveries', (
      SELECT count(*) FROM public.deliveries d
       WHERE d.store_id = _store AND d.status = 'pendente')
  ) INTO _out
  FROM public.couriers c WHERE c.store_id = _store;

  RETURN jsonb_build_object('storeId', _store, 'counts', _out);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_store_courier_detail(_store_id uuid, _courier_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _store uuid; _c public.couriers; _identity public.courier_auth_identities; _d public.deliveries; _hist jsonb;
BEGIN
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.view', _store);

  SELECT * INTO _c FROM public.couriers c WHERE c.id = _courier_id AND c.store_id = _store;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO _identity FROM public.courier_auth_identities i
   WHERE i.courier_id = _c.id AND i.store_id = _store;

  SELECT * INTO _d FROM public.deliveries d
   WHERE d.store_id = _store AND d.courier_id = _c.id
     AND d.status IN ('atribuida','aceita','coletada','em_rota') LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'occurredAt', a.created_at,
           'action', a.action,
           'fields', a.context->'fields',
           'reasonCode', a.context->>'reasonCode'
         ) ORDER BY a.created_at DESC), '[]'::jsonb) INTO _hist
    FROM public.audit_logs a
   WHERE a.store_id = _store AND a.entity = 'couriers' AND a.entity_id = _c.id
   LIMIT 50;

  RETURN jsonb_build_object(
    'courierId', _c.id,
    'displayName', _c.full_name,
    'phone', _c.phone,
    'loginIdentifier', _identity.login_identifier,
    'loginEnabled', coalesce(_identity.is_login_enabled, false),
    'requiresPasswordChange', coalesce(_identity.requires_password_change, false),
    'isActive', (_c.status = 'ativo'),
    'canAcceptDeliveries', _c.can_accept_deliveries,
    'presenceStatus', CASE WHEN _c.is_online THEN 'online' ELSE 'offline' END,
    'lastSeenAt', _c.last_seen_at,
    'currentAssignment', CASE WHEN _d.id IS NULL THEN NULL ELSE jsonb_build_object(
        'deliveryId', _d.id,
        'deliveryStatus', _d.status::text,
        'orderNumber', (SELECT o.order_number FROM public.orders o WHERE o.id = _d.order_id AND o.store_id = _store),
        'assignedAt', _d.assigned_at) END,
    'createdAt', _c.created_at,
    'updatedAt', _c.updated_at,
    'version', _c.version,
    'history', _hist,
    'allowedActions', to_jsonb(private.courier_allowed_actions(_store, _c.status))
  );
END;
$$;

-- Edicao administrativa: somente nome, telefone e permissao de aceite.
CREATE OR REPLACE FUNCTION public.update_store_courier(
  _store_id uuid, _courier_id uuid, _expected_version integer,
  _full_name text, _phone text, _can_accept_deliveries boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _store uuid; _c public.couriers; _u public.couriers; _name text; _phone_digits text; _fields text[] := '{}';
BEGIN
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.update', _store);

  SELECT * INTO _c FROM public.couriers c WHERE c.id = _courier_id AND c.store_id = _store;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _expected_version IS NULL OR _expected_version <> _c.version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  _name := nullif(btrim(coalesce(_full_name, '')), '');
  IF _name IS NULL OR length(_name) < 3 OR length(_name) > 80 THEN
    RAISE EXCEPTION 'INVALID_NAME' USING ERRCODE = 'P0001';
  END IF;

  _phone_digits := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  IF length(_phone_digits) < 10 OR length(_phone_digits) > 13 THEN
    RAISE EXCEPTION 'INVALID_PHONE' USING ERRCODE = 'P0001';
  END IF;

  IF _name <> _c.full_name THEN _fields := _fields || 'full_name'; END IF;
  IF _phone_digits <> _c.phone THEN _fields := _fields || 'phone'; END IF;
  IF coalesce(_can_accept_deliveries, _c.can_accept_deliveries) <> _c.can_accept_deliveries
    THEN _fields := _fields || 'can_accept_deliveries'; END IF;

  UPDATE public.couriers c
     SET full_name = _name,
         phone = _phone_digits,
         can_accept_deliveries = coalesce(_can_accept_deliveries, c.can_accept_deliveries),
         version = c.version + 1,
         updated_at = now()
   WHERE c.id = _courier_id AND c.store_id = _store AND c.version = _expected_version
  RETURNING * INTO _u;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;

  PERFORM private.log_config_audit(_store, 'courier.updated', 'couriers', _courier_id, _fields);
  PERFORM private.emit_store_event(_store, 'courier', _courier_id, 'courier.updated', _u.version);
  RETURN public.get_my_store_courier_detail(_store, _courier_id);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'PHONE_ALREADY_USED' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_store_courier(
  _store_id uuid, _courier_id uuid, _expected_version integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _store uuid; _c public.couriers; _u public.couriers;
BEGIN
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.update', _store);

  SELECT * INTO _c FROM public.couriers c WHERE c.id = _courier_id AND c.store_id = _store FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _expected_version IS NULL OR _expected_version <> _c.version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  IF _c.status = 'inativo' THEN RETURN public.get_my_store_courier_detail(_store, _courier_id); END IF;

  IF private.courier_active_delivery_id(_courier_id, _store) IS NOT NULL THEN
    RAISE EXCEPTION 'COURIER_HAS_ACTIVE_DELIVERY' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.couriers c
     SET status = 'inativo', is_online = false, deactivated_at = now(),
         version = c.version + 1, updated_at = now()
   WHERE c.id = _courier_id AND c.store_id = _store AND c.version = _expected_version
  RETURNING * INTO _u;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.courier_auth_identities i SET is_login_enabled = false, updated_at = now()
   WHERE i.courier_id = _courier_id AND i.store_id = _store;
  UPDATE public.user_roles r SET is_active = false
   WHERE r.store_id = _store AND r.role = 'entregador' AND r.user_id = _c.user_id;

  PERFORM private.log_config_audit(_store, 'courier.deactivated', 'couriers', _courier_id, ARRAY['status']);
  PERFORM private.emit_store_event(_store, 'courier', _courier_id, 'courier.deactivated', _u.version);
  RETURN public.get_my_store_courier_detail(_store, _courier_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_store_courier(
  _store_id uuid, _courier_id uuid, _expected_version integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _store uuid; _c public.couriers; _u public.couriers;
BEGIN
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.update', _store);

  SELECT * INTO _c FROM public.couriers c WHERE c.id = _courier_id AND c.store_id = _store FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _expected_version IS NULL OR _expected_version <> _c.version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  IF _c.status = 'ativo' THEN RETURN public.get_my_store_courier_detail(_store, _courier_id); END IF;

  UPDATE public.couriers c
     SET status = 'ativo', is_online = false, deactivated_at = NULL,
         version = c.version + 1, updated_at = now()
   WHERE c.id = _courier_id AND c.store_id = _store AND c.version = _expected_version
  RETURNING * INTO _u;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.courier_auth_identities i SET is_login_enabled = true, updated_at = now()
   WHERE i.courier_id = _courier_id AND i.store_id = _store;
  UPDATE public.user_roles r SET is_active = true
   WHERE r.store_id = _store AND r.role = 'entregador' AND r.user_id = _c.user_id;

  PERFORM private.log_config_audit(_store, 'courier.activated', 'couriers', _courier_id, ARRAY['status']);
  PERFORM private.emit_store_event(_store, 'courier', _courier_id, 'courier.activated', _u.version);
  RETURN public.get_my_store_courier_detail(_store, _courier_id);
END;
$$;

-- Entrega do pedido, para o painel.
CREATE OR REPLACE FUNCTION public.get_store_delivery_assignment(_store_id uuid, _order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _store uuid; _o public.orders; _d public.deliveries; _c public.couriers; _events jsonb;
BEGIN
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.view', _store);

  SELECT * INTO _o FROM public.orders o WHERE o.id = _order_id AND o.store_id = _store;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _o.fulfillment <> 'entrega' THEN
    RETURN jsonb_build_object('applicable', false);
  END IF;

  SELECT * INTO _d FROM public.deliveries d WHERE d.store_id = _store AND d.order_id = _order_id;
  IF _d.courier_id IS NOT NULL THEN
    SELECT * INTO _c FROM public.couriers c WHERE c.id = _d.courier_id AND c.store_id = _store;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'occurredAt', e.created_at,
           'kind', e.kind::text,
           'reasonCode', e.reason_code,
           'courierName', (SELECT cc.full_name FROM public.couriers cc WHERE cc.id = e.courier_id AND cc.store_id = _store),
           'previousCourierName', (SELECT pc.full_name FROM public.couriers pc WHERE pc.id = e.previous_courier_id AND pc.store_id = _store),
           'version', e.delivery_version
         ) ORDER BY e.created_at DESC), '[]'::jsonb) INTO _events
    FROM public.delivery_events e
   WHERE e.store_id = _store AND e.delivery_id = _d.id;

  RETURN jsonb_build_object(
    'applicable', true,
    'orderStatus', _o.status::text,
    'delivery', CASE WHEN _d.id IS NULL THEN NULL ELSE jsonb_build_object(
      'deliveryId', _d.id,
      'status', _d.status::text,
      'version', _d.version,
      'assignedAt', _d.assigned_at,
      'courier', CASE WHEN _c.id IS NULL THEN NULL ELSE jsonb_build_object(
        'courierId', _c.id, 'displayName', _c.full_name,
        'presenceStatus', CASE WHEN _c.is_online THEN 'online' ELSE 'offline' END,
        'isActive', (_c.status = 'ativo')) END,
      'history', _events) END,
    'canAssign', private.has_permission('couriers.assign', _store)
  );
END;
$$;

-- Elegiveis: mesma loja, conta ativa, papel ativo, sem entrega ativa.
CREATE OR REPLACE FUNCTION public.list_eligible_couriers_for_delivery(_store_id uuid, _order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _store uuid; _o public.orders; _rows jsonb;
BEGIN
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.assign', _store);

  SELECT * INTO _o FROM public.orders o WHERE o.id = _order_id AND o.store_id = _store;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _o.fulfillment <> 'entrega' THEN RAISE EXCEPTION 'NOT_A_DELIVERY_ORDER' USING ERRCODE = 'P0001'; END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'displayName'), '[]'::jsonb) INTO _rows
  FROM (
    SELECT jsonb_build_object(
      'courierId', c.id,
      'displayName', c.full_name,
      'presenceStatus', CASE WHEN c.is_online THEN 'online' ELSE 'offline' END,
      'lastSeenAt', c.last_seen_at,
      'canAcceptDeliveries', c.can_accept_deliveries,
      'hasActiveDelivery', (private.courier_active_delivery_id(c.id, _store) IS NOT NULL),
      'eligibility', CASE
        WHEN c.status <> 'ativo' THEN 'blocked'
        WHEN NOT c.can_accept_deliveries THEN 'blocked'
        WHEN private.courier_active_delivery_id(c.id, _store) IS NOT NULL THEN 'blocked'
        WHEN NOT c.is_online THEN 'confirm'
        ELSE 'eligible' END,
      'blockingReason', CASE
        WHEN c.status <> 'ativo' THEN 'conta_inativa'
        WHEN NOT c.can_accept_deliveries THEN 'sem_permissao_de_aceite'
        WHEN private.courier_active_delivery_id(c.id, _store) IS NOT NULL THEN 'entrega_ativa'
        WHEN NOT c.is_online THEN 'offline'
        ELSE NULL END,
      'version', c.version
    ) AS x
    FROM public.couriers c
   WHERE c.store_id = _store
  ) s;

  RETURN jsonb_build_object('storeId', _store, 'orderId', _order_id, 'couriers', _rows);
END;
$$;

-- Nucleo comum de atribuicao e troca.
CREATE OR REPLACE FUNCTION private.set_delivery_courier(
  _store_id uuid, _order_id uuid, _courier_id uuid, _expected_delivery_version integer,
  _reason_code text, _internal_note text, _is_reassignment boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _store uuid; _o public.orders; _d public.deliveries; _u public.deliveries;
  _c public.couriers; _previous uuid; _note text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001'; END IF;
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.assign', _store);

  SELECT * INTO _o FROM public.orders o WHERE o.id = _order_id AND o.store_id = _store;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _o.fulfillment <> 'entrega' THEN RAISE EXCEPTION 'NOT_A_DELIVERY_ORDER' USING ERRCODE = 'P0001'; END IF;
  IF _o.status NOT IN ('pronto','aguardando_entregador') THEN
    RAISE EXCEPTION 'ORDER_STATE_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.ensure_delivery_for_order(_store, _order_id);

  SELECT * INTO _d FROM public.deliveries d
   WHERE d.store_id = _store AND d.order_id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;

  IF _expected_delivery_version IS NULL OR _expected_delivery_version <> _d.version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  IF _d.status NOT IN ('pendente','atribuida','aceita') THEN
    RAISE EXCEPTION 'DELIVERY_STATE_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;

  IF _is_reassignment THEN
    IF _d.courier_id IS NULL THEN RAISE EXCEPTION 'NO_CURRENT_COURIER' USING ERRCODE = 'P0001'; END IF;
    IF _d.courier_id = _courier_id THEN RAISE EXCEPTION 'SAME_COURIER' USING ERRCODE = 'P0001'; END IF;
    IF _reason_code IS NULL OR NOT private.is_valid_reassignment_reason(_reason_code) THEN
      RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF _d.courier_id IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_ASSIGNED' USING ERRCODE = 'P0001'; END IF;
  END IF;

  SELECT * INTO _c FROM public.couriers c WHERE c.id = _courier_id AND c.store_id = _store;
  IF NOT FOUND THEN RAISE EXCEPTION 'COURIER_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _c.status <> 'ativo' THEN RAISE EXCEPTION 'COURIER_INACTIVE' USING ERRCODE = 'P0001'; END IF;
  IF NOT _c.can_accept_deliveries THEN RAISE EXCEPTION 'COURIER_CANNOT_ACCEPT' USING ERRCODE = 'P0001'; END IF;
  IF private.courier_active_delivery_id(_courier_id, _store) IS NOT NULL THEN
    RAISE EXCEPTION 'COURIER_HAS_ACTIVE_DELIVERY' USING ERRCODE = 'P0001';
  END IF;

  _note := nullif(btrim(coalesce(_internal_note, '')), '');
  IF _note IS NOT NULL AND length(_note) > 300 THEN
    RAISE EXCEPTION 'INVALID_INTERNAL_NOTE' USING ERRCODE = 'P0001';
  END IF;

  _previous := _d.courier_id;

  UPDATE public.deliveries d
     SET courier_id = _courier_id,
         status = 'atribuida',
         assigned_at = now(),
         accepted_at = NULL,
         assigned_by_user_id = _uid,
         reason_code = CASE WHEN _is_reassignment THEN _reason_code ELSE d.reason_code END,
         notes = coalesce(_note, d.notes),
         version = d.version + 1,
         updated_at = now()
   WHERE d.id = _d.id AND d.store_id = _store AND d.version = _expected_delivery_version
     AND d.courier_id IS NOT DISTINCT FROM _previous
  RETURNING * INTO _u;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;

  -- Historico: codigo canonico existente, com responsavel anterior preservado.
  INSERT INTO public.delivery_events
    (store_id, delivery_id, courier_id, kind, previous_courier_id, actor_user_id, reason_code, delivery_version)
  VALUES (_store, _u.id, _courier_id, 'atribuida', _previous, _uid,
          CASE WHEN _is_reassignment THEN _reason_code ELSE NULL END, _u.version);

  INSERT INTO public.audit_logs (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES (_store, _uid, 'loja',
          CASE WHEN _is_reassignment THEN 'delivery.courier_reassigned' ELSE 'delivery.courier_assigned' END,
          'deliveries', _u.id,
          jsonb_build_object('orderId', _order_id, 'courierId', _courier_id,
                             'previousCourierId', _previous,
                             'reasonCode', CASE WHEN _is_reassignment THEN _reason_code ELSE NULL END,
                             'version', _u.version));

  PERFORM private.emit_store_event(_store, 'delivery', _u.id,
    CASE WHEN _is_reassignment THEN 'delivery.courier_reassigned' ELSE 'delivery.courier_assigned' END,
    _u.version);

  -- O pedido nao avanca: continua aguardando entregador (D-079).
  RETURN public.get_store_delivery_assignment(_store, _order_id);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'COURIER_HAS_ACTIVE_DELIVERY' USING ERRCODE = 'P0001';
END;
$$;
REVOKE ALL ON FUNCTION private.set_delivery_courier(uuid, uuid, uuid, integer, text, text, boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.assign_delivery_courier(
  _store_id uuid, _order_id uuid, _courier_id uuid, _expected_delivery_version integer,
  _internal_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$ SELECT private.set_delivery_courier(_store_id, _order_id, _courier_id, _expected_delivery_version, NULL, _internal_note, false) $$;

CREATE OR REPLACE FUNCTION public.reassign_delivery_courier(
  _store_id uuid, _order_id uuid, _courier_id uuid, _expected_delivery_version integer,
  _reason_code text, _internal_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$ SELECT private.set_delivery_courier(_store_id, _order_id, _courier_id, _expected_delivery_version, _reason_code, _internal_note, true) $$;

-- Grants: apenas usuarios autenticados; anon nunca.
REVOKE ALL ON FUNCTION public.list_my_store_couriers(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_courier_management_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_store_courier_detail(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_store_courier(uuid, uuid, integer, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_store_courier(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_store_courier(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_store_delivery_assignment(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_eligible_couriers_for_delivery(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_delivery_courier(uuid, uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reassign_delivery_courier(uuid, uuid, uuid, integer, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_my_store_couriers(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_courier_management_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_store_courier_detail(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_courier(uuid, uuid, integer, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_store_courier(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_store_courier(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_delivery_assignment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_eligible_couriers_for_delivery(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_delivery_courier(uuid, uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_delivery_courier(uuid, uuid, uuid, integer, text, text) TO authenticated;