-- ============================================================
-- Fase 19 — experiência operacional do entregador
-- ============================================================

-- 1. Marco de chegada à loja e política de aceite -------------
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS arrived_at_store_at timestamptz;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS courier_acceptance_required boolean NOT NULL DEFAULT false;

-- 2. Ocorrências de entrega ----------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_occurrences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL,
  courier_id uuid,
  code text NOT NULL,
  note text,
  requires_store_attention boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by_user_id uuid,
  resolution_note text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, store_id),
  CONSTRAINT delivery_occurrences_code_check CHECK (code IN (
    'customer_not_found','incorrect_address','customer_asked_to_wait',
    'order_problem','vehicle_problem','other'))
);

CREATE INDEX IF NOT EXISTS delivery_occurrences_open_idx
  ON public.delivery_occurrences (store_id, delivery_id)
  WHERE resolved_at IS NULL;

GRANT SELECT ON public.delivery_occurrences TO authenticated;
GRANT ALL ON public.delivery_occurrences TO service_role;
ALTER TABLE public.delivery_occurrences ENABLE ROW LEVEL SECURITY;

-- 3. Intenções idempotentes das ações do entregador -----------
CREATE TABLE IF NOT EXISTS public.courier_action_intents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL,
  delivery_id uuid,
  action text NOT NULL,
  idempotency_key text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courier_action_intents_key_unique UNIQUE (courier_id, idempotency_key)
);

GRANT ALL ON public.courier_action_intents TO service_role;
ALTER TABLE public.courier_action_intents ENABLE ROW LEVEL SECURITY;

-- 4. Presença derivada ---------------------------------------
CREATE OR REPLACE FUNCTION private.courier_presence_window()
RETURNS interval LANGUAGE sql IMMUTABLE AS $$ SELECT interval '150 seconds' $$;

CREATE OR REPLACE FUNCTION private.courier_presence_status(_is_online boolean, _last_seen timestamptz)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN NOT coalesce(_is_online, false) THEN 'offline'
    WHEN _last_seen IS NULL THEN 'sem_sinal'
    WHEN _last_seen < now() - private.courier_presence_window() THEN 'sem_sinal'
    ELSE 'online'
  END
$$;

-- 5. Núcleo: entregador autenticado --------------------------
CREATE OR REPLACE FUNCTION private.require_current_courier()
RETURNS TABLE (courier_id uuid, store_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE _cid uuid; _sid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF;
  SELECT private.current_courier_id(), private.current_courier_store_id() INTO _cid, _sid;
  IF _cid IS NULL OR _sid IS NULL THEN
    RAISE EXCEPTION 'COURIER_ACCOUNT_UNAVAILABLE' USING ERRCODE='P0001';
  END IF;
  RETURN QUERY SELECT _cid, _sid;
END; $$;

-- 6. Projeção da entrega própria ------------------------------
CREATE OR REPLACE FUNCTION private.courier_delivery_projection(_store uuid, _courier uuid, _delivery_id uuid, _reduced boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE
  _d public.deliveries; _o public.orders; _s public.stores;
  _acceptance boolean; _occ jsonb; _blocking boolean; _actions text[]; _addr jsonb;
BEGIN
  SELECT * INTO _d FROM public.deliveries d
   WHERE d.id = _delivery_id AND d.store_id = _store AND d.courier_id = _courier;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO _o FROM public.orders o WHERE o.id = _d.order_id AND o.store_id = _store;
  SELECT * INTO _s FROM public.stores s WHERE s.id = _store;
  _acceptance := _s.courier_acceptance_required;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'occurrenceId', x.id, 'code', x.code, 'note', x.note,
           'requiresStoreAttention', x.requires_store_attention,
           'resolvedAt', x.resolved_at, 'createdAt', x.created_at,
           'version', x.version) ORDER BY x.created_at DESC), '[]'::jsonb)
    INTO _occ
    FROM public.delivery_occurrences x
   WHERE x.store_id = _store AND x.delivery_id = _d.id;

  SELECT EXISTS (
    SELECT 1 FROM public.delivery_occurrences x
     WHERE x.store_id = _store AND x.delivery_id = _d.id
       AND x.requires_store_attention AND x.resolved_at IS NULL) INTO _blocking;

  _actions := ARRAY[]::text[];
  IF _d.status = 'atribuida' AND _acceptance THEN
    _actions := ARRAY['accept','decline'];
  ELSIF _d.status IN ('atribuida','aceita') THEN
    IF _d.arrived_at_store_at IS NULL THEN
      _actions := ARRAY['confirm_arrival'];
    ELSE
      _actions := ARRAY['confirm_pickup'];
    END IF;
    _actions := _actions || ARRAY['report_occurrence'];
  ELSIF _d.status = 'coletada' THEN
    _actions := ARRAY['start_delivery','report_occurrence'];
  ELSIF _d.status = 'em_rota' THEN
    _actions := ARRAY['report_occurrence'];
    IF NOT _blocking THEN _actions := ARRAY['complete_delivery'] || _actions; END IF;
  END IF;

  IF _reduced THEN
    RETURN jsonb_build_object(
      'deliveryId', _d.id,
      'reduced', true,
      'status', _d.status::text,
      'version', _d.version,
      'assignedAt', _d.assigned_at,
      'orderNumber', _o.order_number,
      'storeName', _s.name,
      'neighborhood', _o.neighborhood_snapshot,
      'allowedActions', to_jsonb(_actions));
  END IF;

  _addr := coalesce(_o.address_snapshot, '{}'::jsonb);

  RETURN jsonb_build_object(
    'deliveryId', _d.id,
    'reduced', false,
    'status', _d.status::text,
    'version', _d.version,
    'orderId', _o.id,
    'orderNumber', _o.order_number,
    'orderStatus', _o.status::text,
    'orderVersion', _o.version,
    'acceptanceRequired', _acceptance,
    'assignedAt', _d.assigned_at,
    'acceptedAt', _d.accepted_at,
    'arrivedAtStoreAt', _d.arrived_at_store_at,
    'pickedUpAt', _d.picked_up_at,
    'startedAt', _d.started_at,
    'completedAt', _d.completed_at,
    'pickup', jsonb_build_object(
      'storeName', _s.name,
      'address', _s.address_line,
      'phone', _s.phone),
    'customer', jsonb_build_object(
      'firstName', split_part(coalesce(_o.customer_name,''), ' ', 1),
      'phone', _o.customer_phone,
      'neighborhood', _o.neighborhood_snapshot,
      'street', _addr->>'street',
      'number', _addr->>'number',
      'complement', _addr->>'complement',
      'reference', _addr->>'reference',
      'notes', _o.customer_notes),
    'payment', jsonb_build_object(
      'method', _o.payment_method_label,
      'kind', _o.payment_method_kind,
      'needsChange', coalesce(_o.payment_needs_change, false),
      'changeFor', _o.change_for,
      'orderAmount', _o.total_amount,
      'instructions', _o.payment_instructions),
    'occurrences', _occ,
    'requiresStoreAttention', _blocking,
    'allowedActions', to_jsonb(_actions));
END; $$;

-- 7. Contexto operacional -------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_courier_operational_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE
  _cid uuid; _sid uuid; _c public.couriers; _s public.stores;
  _d public.deliveries; _pending jsonb; _active jsonb; _acceptance boolean;
BEGIN
  SELECT courier_id, store_id INTO _cid, _sid FROM private.require_current_courier();
  SELECT * INTO _c FROM public.couriers c WHERE c.id = _cid AND c.store_id = _sid;
  SELECT * INTO _s FROM public.stores s WHERE s.id = _sid;
  _acceptance := _s.courier_acceptance_required;

  SELECT * INTO _d FROM public.deliveries d
   WHERE d.store_id = _sid AND d.courier_id = _cid
     AND d.status IN ('atribuida','aceita','coletada','em_rota')
   ORDER BY d.assigned_at DESC LIMIT 1;

  IF _d.id IS NOT NULL AND _d.status = 'atribuida' AND _acceptance THEN
    _pending := private.courier_delivery_projection(_sid, _cid, _d.id, true);
    _active := NULL;
  ELSIF _d.id IS NOT NULL THEN
    _pending := NULL;
    _active := private.courier_delivery_projection(_sid, _cid, _d.id, false);
  ELSE
    _pending := NULL; _active := NULL;
  END IF;

  RETURN jsonb_build_object(
    'courierId', _c.id,
    'displayName', _c.full_name,
    'storeName', _s.name,
    'storePublicAddress', _s.address_line,
    'storePhone', _s.phone,
    'accountStatus', _c.status::text,
    'canAcceptDeliveries', _c.can_accept_deliveries,
    'acceptanceRequired', _acceptance,
    'onlineIntent', _c.is_online,
    'presenceStatus', private.courier_presence_status(_c.is_online, _c.last_seen_at),
    'lastSeenAt', _c.last_seen_at,
    'pendingAssignment', _pending,
    'activeDelivery', _active,
    'serverNow', now(),
    'version', _c.version);
END; $$;

-- 8. Presença --------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_courier_presence(_online boolean, _touch boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE _cid uuid; _sid uuid; _c public.couriers; _active uuid;
BEGIN
  SELECT courier_id, store_id INTO _cid, _sid FROM private.require_current_courier();

  UPDATE public.couriers c
     SET is_online = coalesce(_online, c.is_online),
         last_seen_at = CASE WHEN _touch OR coalesce(_online,false) THEN now() ELSE c.last_seen_at END,
         version = c.version + 1,
         updated_at = now()
   WHERE c.id = _cid AND c.store_id = _sid AND c.status = 'ativo'
  RETURNING * INTO _c;
  IF NOT FOUND THEN RAISE EXCEPTION 'COURIER_ACCOUNT_UNAVAILABLE' USING ERRCODE='P0001'; END IF;

  _active := private.courier_active_delivery_id(_cid, _sid);
  PERFORM private.emit_store_event(_sid, 'courier', _cid, 'courier.presence_changed', _c.version);

  RETURN jsonb_build_object(
    'courierId', _cid,
    'onlineIntent', _c.is_online,
    'presenceStatus', private.courier_presence_status(_c.is_online, _c.last_seen_at),
    'lastSeenAt', _c.last_seen_at,
    'hasActiveDelivery', (_active IS NOT NULL),
    'version', _c.version);
END; $$;

CREATE OR REPLACE FUNCTION public.set_my_courier_online()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$ SELECT private.set_courier_presence(true, true) $$;

CREATE OR REPLACE FUNCTION public.set_my_courier_offline()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$ SELECT private.set_courier_presence(false, false) $$;

CREATE OR REPLACE FUNCTION public.heartbeat_my_courier_presence()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$ SELECT private.set_courier_presence(NULL, true) $$;

-- 9. Núcleo transacional das ações operacionais ----------------
CREATE OR REPLACE FUNCTION private.courier_delivery_action(
  _action text, _delivery_id uuid, _expected_version integer,
  _idempotency_key text, _reason_code text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE
  _uid uuid := auth.uid();
  _cid uuid; _sid uuid; _key text;
  _d public.deliveries; _u public.deliveries; _o public.orders; _s public.stores;
  _acceptance boolean; _next public.delivery_status; _kind public.delivery_event_type;
  _existing jsonb; _blocking boolean; _order_from public.order_status;
  _order_to public.order_status; _clean_note text; _result jsonb; _occ_id uuid;
BEGIN
  SELECT courier_id, store_id INTO _cid, _sid FROM private.require_current_courier();

  _key := nullif(btrim(coalesce(_idempotency_key,'')), '');
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 120 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='P0001';
  END IF;

  SELECT i.result INTO _existing FROM public.courier_action_intents i
   WHERE i.courier_id = _cid AND i.idempotency_key = _key;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  _clean_note := nullif(btrim(coalesce(_note,'')), '');
  IF _clean_note IS NOT NULL THEN
    IF length(_clean_note) > 300 THEN RAISE EXCEPTION 'INVALID_NOTE' USING ERRCODE='P0001'; END IF;
    IF _clean_note ~ '[<>]' THEN RAISE EXCEPTION 'INVALID_NOTE' USING ERRCODE='P0001'; END IF;
  END IF;

  SELECT * INTO _d FROM public.deliveries d
   WHERE d.id = _delivery_id AND d.store_id = _sid FOR UPDATE;
  IF NOT FOUND OR _d.courier_id IS DISTINCT FROM _cid THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0001';
  END IF;
  IF _expected_version IS NULL OR _expected_version <> _d.version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO _s FROM public.stores s WHERE s.id = _sid;
  _acceptance := _s.courier_acceptance_required;
  SELECT * INTO _o FROM public.orders o WHERE o.id = _d.order_id AND o.store_id = _sid FOR UPDATE;
  IF _o.status = 'cancelado' THEN RAISE EXCEPTION 'ORDER_CANCELLED' USING ERRCODE='P0001'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.delivery_occurrences x
     WHERE x.store_id = _sid AND x.delivery_id = _d.id
       AND x.requires_store_attention AND x.resolved_at IS NULL) INTO _blocking;

  -- Ocorrência: evento, nunca estado do pedido.
  IF _action = 'report_occurrence' THEN
    IF _d.status NOT IN ('atribuida','aceita','coletada','em_rota') THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='P0001';
    END IF;
    IF _reason_code IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='P0001'; END IF;

    INSERT INTO public.delivery_occurrences
      (store_id, delivery_id, courier_id, code, note, requires_store_attention)
    VALUES (_sid, _d.id, _cid, _reason_code, _clean_note,
            _reason_code <> 'customer_asked_to_wait')
    RETURNING id INTO _occ_id;

    UPDATE public.deliveries d SET version = d.version + 1, updated_at = now()
     WHERE d.id = _d.id AND d.store_id = _sid AND d.version = _expected_version
    RETURNING * INTO _u;
    IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='P0001'; END IF;

    INSERT INTO public.delivery_events
      (store_id, delivery_id, courier_id, kind, description, actor_user_id, reason_code, delivery_version)
    VALUES (_sid, _d.id, _cid, 'ocorrencia', NULL, _uid, _reason_code, _u.version);

    INSERT INTO public.audit_logs (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
    VALUES (_sid, _uid, 'entregador', 'delivery.occurrence_reported', 'delivery_occurrences', _occ_id,
            jsonb_build_object('deliveryId', _d.id, 'code', _reason_code));

    PERFORM private.emit_store_event(_sid, 'delivery', _d.id, 'delivery.occurrence_reported', _u.version);

    _result := jsonb_build_object('ok', true, 'deliveryId', _d.id, 'version', _u.version,
                                  'occurrenceId', _occ_id);
    INSERT INTO public.courier_action_intents (store_id, courier_id, delivery_id, action, idempotency_key, result)
    VALUES (_sid, _cid, _d.id, _action, _key, _result);
    RETURN _result;
  END IF;

  -- Recusa: libera a responsabilidade, preserva a entrega.
  IF _action = 'decline' THEN
    IF NOT _acceptance OR _d.status <> 'atribuida' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='P0001';
    END IF;
    IF _reason_code IS NULL OR _reason_code NOT IN
       ('unavailable','vehicle_problem','cannot_reach_store','personal_issue','other') THEN
      RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE='P0001';
    END IF;

    UPDATE public.deliveries d
       SET courier_id = NULL, status = 'pendente', assigned_at = NULL, accepted_at = NULL,
           arrived_at_store_at = NULL, reason_code = _reason_code,
           version = d.version + 1, updated_at = now()
     WHERE d.id = _d.id AND d.store_id = _sid AND d.version = _expected_version
    RETURNING * INTO _u;
    IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='P0001'; END IF;

    INSERT INTO public.delivery_events
      (store_id, delivery_id, courier_id, previous_courier_id, kind, actor_user_id, reason_code, delivery_version)
    VALUES (_sid, _d.id, NULL, _cid, 'ocorrencia', _uid, _reason_code, _u.version);

    INSERT INTO public.audit_logs (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
    VALUES (_sid, _uid, 'entregador', 'delivery.declined', 'deliveries', _d.id,
            jsonb_build_object('reasonCode', _reason_code, 'version', _u.version));

    PERFORM private.emit_store_event(_sid, 'delivery', _d.id, 'delivery.declined', _u.version);

    _result := jsonb_build_object('ok', true, 'deliveryId', _d.id, 'version', _u.version, 'released', true);
    INSERT INTO public.courier_action_intents (store_id, courier_id, delivery_id, action, idempotency_key, result)
    VALUES (_sid, _cid, _d.id, _action, _key, _result);
    RETURN _result;
  END IF;

  -- Marcos operacionais
  IF _action = 'accept' THEN
    IF NOT _acceptance OR _d.status <> 'atribuida' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='P0001'; END IF;
    _next := 'aceita'; _kind := 'aceita';
  ELSIF _action = 'confirm_arrival' THEN
    IF _d.status NOT IN ('atribuida','aceita') THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='P0001'; END IF;
    IF _d.status = 'atribuida' AND _acceptance THEN
      RAISE EXCEPTION 'ACCEPTANCE_REQUIRED' USING ERRCODE='P0001'; END IF;
    IF _d.arrived_at_store_at IS NOT NULL THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='P0001'; END IF;
    _next := _d.status; _kind := 'chegada_loja';
  ELSIF _action = 'confirm_pickup' THEN
    IF _d.status NOT IN ('atribuida','aceita') OR _d.arrived_at_store_at IS NULL THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='P0001'; END IF;
    IF _d.status = 'atribuida' AND _acceptance THEN
      RAISE EXCEPTION 'ACCEPTANCE_REQUIRED' USING ERRCODE='P0001'; END IF;
    _next := 'coletada'; _kind := 'coleta';
  ELSIF _action = 'start_delivery' THEN
    IF _d.status <> 'coletada' THEN RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='P0001'; END IF;
    IF _o.status <> 'aguardando_entregador' THEN
      RAISE EXCEPTION 'ORDER_STATE_NOT_ALLOWED' USING ERRCODE='P0001'; END IF;
    _next := 'em_rota'; _kind := 'inicio_entrega';
    _order_from := _o.status; _order_to := 'saiu_para_entrega';
  ELSIF _action = 'complete_delivery' THEN
    IF _d.status <> 'em_rota' THEN RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='P0001'; END IF;
    IF _blocking THEN RAISE EXCEPTION 'OCCURRENCE_OPEN' USING ERRCODE='P0001'; END IF;
    IF _o.status <> 'saiu_para_entrega' THEN
      RAISE EXCEPTION 'ORDER_STATE_NOT_ALLOWED' USING ERRCODE='P0001'; END IF;
    _next := 'concluida'; _kind := 'concluida';
    _order_from := _o.status; _order_to := 'entregue';
  ELSE
    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='P0001';
  END IF;

  UPDATE public.deliveries d
     SET status = _next,
         accepted_at = CASE WHEN _action = 'accept' THEN now() ELSE d.accepted_at END,
         arrived_at_store_at = CASE WHEN _action = 'confirm_arrival' THEN now() ELSE d.arrived_at_store_at END,
         picked_up_at = CASE WHEN _action = 'confirm_pickup' THEN now() ELSE d.picked_up_at END,
         started_at = CASE WHEN _action = 'start_delivery' THEN now() ELSE d.started_at END,
         completed_at = CASE WHEN _action = 'complete_delivery' THEN now() ELSE d.completed_at END,
         version = d.version + 1,
         updated_at = now()
   WHERE d.id = _d.id AND d.store_id = _sid AND d.version = _expected_version AND d.courier_id = _cid
  RETURNING * INTO _u;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.delivery_events
    (store_id, delivery_id, courier_id, kind, actor_user_id, delivery_version)
  VALUES (_sid, _d.id, _cid, _kind, _uid, _u.version);

  IF _order_to IS NOT NULL THEN
    UPDATE public.orders o
       SET status = _order_to,
           version = o.version + 1,
           finished_at = CASE WHEN _order_to = 'entregue' THEN now() ELSE o.finished_at END,
           updated_at = now()
     WHERE o.id = _o.id AND o.store_id = _sid AND o.status = _order_from AND o.version = _o.version;
    IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='P0001'; END IF;

    INSERT INTO public.order_status_history
      (store_id, order_id, from_status, to_status, actor_kind, actor_user_id, actor_courier_id, action)
    VALUES (_sid, _o.id, _order_from, _order_to, 'entregador', _uid, _cid, _action);

    PERFORM private.emit_store_event(_sid, 'order', _o.id, 'order.status_changed', _o.version + 1);
  END IF;

  INSERT INTO public.audit_logs (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES (_sid, _uid, 'entregador', 'delivery.' || _action, 'deliveries', _d.id,
          jsonb_build_object('status', _u.status::text, 'version', _u.version));

  PERFORM private.emit_store_event(_sid, 'delivery', _d.id, 'delivery.' || _action, _u.version);

  _result := jsonb_build_object('ok', true, 'deliveryId', _d.id,
                                'status', _u.status::text, 'version', _u.version);
  INSERT INTO public.courier_action_intents (store_id, courier_id, delivery_id, action, idempotency_key, result)
  VALUES (_sid, _cid, _d.id, _action, _key, _result);
  RETURN _result;
END; $$;

-- 10. Ações específicas (o cliente nunca envia status de destino)
CREATE OR REPLACE FUNCTION public.accept_my_delivery_assignment(_delivery_id uuid, _expected_version integer, _idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp'
AS $$ SELECT private.courier_delivery_action('accept', _delivery_id, _expected_version, _idempotency_key) $$;

CREATE OR REPLACE FUNCTION public.decline_my_delivery_assignment(_delivery_id uuid, _expected_version integer, _reason_code text, _idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp'
AS $$ SELECT private.courier_delivery_action('decline', _delivery_id, _expected_version, _idempotency_key, _reason_code) $$;

CREATE OR REPLACE FUNCTION public.confirm_my_arrival_at_store(_delivery_id uuid, _expected_version integer, _idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp'
AS $$ SELECT private.courier_delivery_action('confirm_arrival', _delivery_id, _expected_version, _idempotency_key) $$;

CREATE OR REPLACE FUNCTION public.confirm_my_order_pickup(_delivery_id uuid, _expected_version integer, _idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp'
AS $$ SELECT private.courier_delivery_action('confirm_pickup', _delivery_id, _expected_version, _idempotency_key) $$;

CREATE OR REPLACE FUNCTION public.start_my_delivery(_delivery_id uuid, _expected_version integer, _idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp'
AS $$ SELECT private.courier_delivery_action('start_delivery', _delivery_id, _expected_version, _idempotency_key) $$;

CREATE OR REPLACE FUNCTION public.complete_my_delivery(_delivery_id uuid, _expected_version integer, _idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp'
AS $$ SELECT private.courier_delivery_action('complete_delivery', _delivery_id, _expected_version, _idempotency_key) $$;

CREATE OR REPLACE FUNCTION public.report_my_delivery_occurrence(_delivery_id uuid, _code text, _note text, _expected_version integer, _idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp'
AS $$ SELECT private.courier_delivery_action('report_occurrence', _delivery_id, _expected_version, _idempotency_key, _code, _note) $$;

CREATE OR REPLACE FUNCTION public.get_my_delivery_detail(_delivery_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE _cid uuid; _sid uuid; _out jsonb;
BEGIN
  SELECT courier_id, store_id INTO _cid, _sid FROM private.require_current_courier();
  _out := private.courier_delivery_projection(_sid, _cid, _delivery_id, false);
  IF _out IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0001'; END IF;
  RETURN _out;
END; $$;

-- 11. Resolução da ocorrência pela loja ------------------------
CREATE OR REPLACE FUNCTION public.list_store_delivery_occurrences(_store_id uuid, _order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE _store uuid; _rows jsonb;
BEGIN
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.view', _store);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'occurrenceId', x.id, 'code', x.code, 'note', x.note,
           'requiresStoreAttention', x.requires_store_attention,
           'courierName', (SELECT c.full_name FROM public.couriers c
                            WHERE c.id = x.courier_id AND c.store_id = _store),
           'createdAt', x.created_at, 'resolvedAt', x.resolved_at,
           'version', x.version) ORDER BY x.created_at DESC), '[]'::jsonb) INTO _rows
    FROM public.delivery_occurrences x
    JOIN public.deliveries d ON d.id = x.delivery_id AND d.store_id = x.store_id
   WHERE x.store_id = _store AND d.order_id = _order_id;

  RETURN jsonb_build_object('storeId', _store, 'orderId', _order_id, 'occurrences', _rows);
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_store_delivery_occurrence(
  _store_id uuid, _occurrence_id uuid, _expected_version integer, _resolution_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
DECLARE _store uuid; _uid uuid := auth.uid(); _x public.delivery_occurrences; _note text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF;
  _store := private.resolve_store(_store_id);
  PERFORM private.require_permission('couriers.assign', _store);

  _note := nullif(btrim(coalesce(_resolution_note,'')), '');
  IF _note IS NOT NULL AND (length(_note) > 300 OR _note ~ '[<>]') THEN
    RAISE EXCEPTION 'INVALID_NOTE' USING ERRCODE='P0001';
  END IF;

  UPDATE public.delivery_occurrences x
     SET resolved_at = now(), resolved_by_user_id = _uid, resolution_note = _note,
         version = x.version + 1, updated_at = now()
   WHERE x.id = _occurrence_id AND x.store_id = _store
     AND x.version = _expected_version AND x.resolved_at IS NULL
  RETURNING * INTO _x;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.delivery_events
    (store_id, delivery_id, courier_id, kind, actor_user_id, reason_code, delivery_version)
  VALUES (_store, _x.delivery_id, _x.courier_id, 'ocorrencia', _uid, 'resolved', _x.version);

  INSERT INTO public.audit_logs (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES (_store, _uid, 'loja', 'delivery.occurrence_resolved', 'delivery_occurrences', _x.id,
          jsonb_build_object('deliveryId', _x.delivery_id, 'code', _x.code));

  PERFORM private.emit_store_event(_store, 'delivery', _x.delivery_id, 'delivery.occurrence_resolved', _x.version);

  RETURN jsonb_build_object('ok', true, 'occurrenceId', _x.id, 'version', _x.version);
END; $$;

-- 12. Superfície de execução ----------------------------------
DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'public.get_my_courier_operational_context()',
    'public.set_my_courier_online()',
    'public.set_my_courier_offline()',
    'public.heartbeat_my_courier_presence()',
    'public.accept_my_delivery_assignment(uuid,integer,text)',
    'public.decline_my_delivery_assignment(uuid,integer,text,text)',
    'public.confirm_my_arrival_at_store(uuid,integer,text)',
    'public.confirm_my_order_pickup(uuid,integer,text)',
    'public.start_my_delivery(uuid,integer,text)',
    'public.complete_my_delivery(uuid,integer,text)',
    'public.report_my_delivery_occurrence(uuid,text,text,integer,text)',
    'public.get_my_delivery_detail(uuid)',
    'public.list_store_delivery_occurrences(uuid,uuid)',
    'public.resolve_store_delivery_occurrence(uuid,uuid,integer,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _fn);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION private.courier_delivery_action(text,uuid,integer,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.set_courier_presence(boolean,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.courier_delivery_projection(uuid,uuid,uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.require_current_courier() FROM PUBLIC;