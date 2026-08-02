-- Fase 18 — integracao com a cozinha/painel e provisionamento do entregador.

-- 1. Vinculo exclusivo do usuario entregador com uma unica loja (global).
CREATE UNIQUE INDEX IF NOT EXISTS couriers_user_global_unique
  ON public.couriers (user_id) WHERE user_id IS NOT NULL;

-- 2. Pedido de entrega pronto entra em aguardando_entregador e garante a entrega.
CREATE OR REPLACE FUNCTION private.transition_store_order(
  _store_id uuid, _order_id uuid, _action text, _expected_version integer,
  _reason_code text DEFAULT NULL, _internal_note text DEFAULT NULL, _customer_message text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _uid        uuid := auth.uid();
  _store      uuid;
  _perm       public.app_permission;
  _from       public.order_status;
  _to         public.order_status;
  _fulfil     public.fulfillment_type;
  _order      public.orders;
  _updated    public.orders;
  _needs_reason boolean := _action IN ('reject','cancel');
  _reason     public.order_transition_reasons;
  _note       text;
  _message    text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  _store := private.resolve_store(_store_id);

  _perm := CASE _action
    WHEN 'accept'            THEN 'orders.accept'
    WHEN 'reject'            THEN 'orders.reject'
    WHEN 'start_preparation' THEN 'orders.start_preparation'
    WHEN 'mark_ready'        THEN 'orders.mark_ready'
    WHEN 'complete_pickup'   THEN 'orders.complete_pickup'
    WHEN 'cancel'            THEN 'orders.cancel'
    ELSE NULL
  END::public.app_permission;

  IF _perm IS NULL THEN
    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = 'P0001';
  END IF;
  IF NOT private.has_permission(_perm, _store) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _order FROM public.orders o
   WHERE o.id = _order_id AND o.store_id = _store;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  _from   := _order.status;
  _fulfil := _order.fulfillment;

  IF _expected_version IS NULL OR _expected_version <> _order.version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  _to := CASE
    WHEN _action = 'accept'            AND _from = 'aguardando_confirmacao' THEN 'aceito'
    WHEN _action = 'reject'            AND _from = 'aguardando_confirmacao' THEN 'recusado'
    WHEN _action = 'start_preparation' AND _from = 'aceito'                 THEN 'em_preparo'
    WHEN _action = 'mark_ready'        AND _from = 'em_preparo' AND _fulfil = 'retirada' THEN 'aguardando_retirada'
    WHEN _action = 'mark_ready'        AND _from = 'em_preparo' AND _fulfil = 'entrega'  THEN 'aguardando_entregador'
    WHEN _action = 'complete_pickup'   AND _from = 'aguardando_retirada' AND _fulfil = 'retirada' THEN 'retirado'
    WHEN _action = 'cancel'            AND _from IN ('aguardando_confirmacao','aceito','em_preparo','pronto','aguardando_retirada','aguardando_entregador') THEN 'cancelado'
    ELSE NULL
  END::public.order_status;

  IF _to IS NULL THEN
    RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'P0001';
  END IF;

  IF _needs_reason THEN
    IF _reason_code IS NULL THEN
      RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO _reason FROM public.order_transition_reasons r
     WHERE r.code = _reason_code AND r.is_active
       AND ((_action = 'reject' AND r.applies_reject) OR (_action = 'cancel' AND r.applies_cancel));
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  _note := nullif(btrim(coalesce(_internal_note, '')), '');
  IF _note IS NOT NULL AND length(_note) > 500 THEN
    RAISE EXCEPTION 'INVALID_INTERNAL_NOTE' USING ERRCODE = 'P0001';
  END IF;

  _message := nullif(btrim(coalesce(_customer_message, '')), '');
  IF _message IS NOT NULL THEN
    IF length(_message) > 160 OR _message ~ '[<>]' THEN
      RAISE EXCEPTION 'INVALID_PUBLIC_MESSAGE' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF _needs_reason AND _message IS NULL THEN
    _message := _reason.public_message;
  END IF;

  UPDATE public.orders o
     SET status = _to,
         version = o.version + 1,
         updated_at = now(),
         reason_code = CASE WHEN _needs_reason THEN _reason_code ELSE o.reason_code END,
         internal_note = coalesce(_note, o.internal_note),
         customer_visible_message = CASE WHEN _needs_reason THEN _message ELSE o.customer_visible_message END,
         accepted_at = CASE WHEN _to = 'aceito' THEN now() ELSE o.accepted_at END,
         ready_at    = CASE WHEN _to IN ('pronto','aguardando_retirada','aguardando_entregador') THEN now() ELSE o.ready_at END,
         finished_at = CASE WHEN _to IN ('retirado','recusado','cancelado') THEN now() ELSE o.finished_at END,
         rejection_reason    = CASE WHEN _to = 'recusado'  THEN _reason_code ELSE o.rejection_reason END,
         cancellation_reason = CASE WHEN _to = 'cancelado' THEN _reason_code ELSE o.cancellation_reason END
   WHERE o.id = _order_id
     AND o.store_id = _store
     AND o.version = _expected_version
     AND o.status = _from
  RETURNING * INTO _updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.order_status_history
    (store_id, order_id, from_status, to_status, actor_kind, actor_user_id,
     reason, action, reason_code, internal_note, customer_visible_message)
  VALUES
    (_store, _order_id, _from, _to, 'loja', _uid,
     CASE WHEN _needs_reason THEN _reason_code ELSE NULL END,
     _action,
     CASE WHEN _needs_reason THEN _reason_code ELSE NULL END,
     _note,
     CASE WHEN _needs_reason THEN _message ELSE NULL END);

  INSERT INTO public.audit_logs
    (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES
    (_store, _uid, 'loja',
     CASE _action
       WHEN 'accept'            THEN 'order.accepted'
       WHEN 'reject'            THEN 'order.rejected'
       WHEN 'start_preparation' THEN 'order.preparation_started'
       WHEN 'mark_ready'        THEN 'order.marked_ready'
       WHEN 'complete_pickup'   THEN 'order.pickup_completed'
       WHEN 'cancel'            THEN 'order.canceled'
     END,
     'orders', _order_id,
     jsonb_build_object(
       'fromStatus', _from::text,
       'toStatus', _to::text,
       'reasonCode', CASE WHEN _needs_reason THEN _reason_code ELSE NULL END,
       'version', _updated.version
     ));

  -- Entrega garantida de forma idempotente; retirada nunca cria entrega.
  IF _to = 'aguardando_entregador' THEN
    PERFORM private.ensure_delivery_for_order(_store, _order_id);
  END IF;

  -- Pedido cancelado libera a entrega, preservando historico.
  IF _to = 'cancelado' AND _fulfil = 'entrega' THEN
    UPDATE public.deliveries d
       SET status = 'cancelada', cancelled_at = now(), version = d.version + 1, updated_at = now()
     WHERE d.store_id = _store AND d.order_id = _order_id
       AND d.status NOT IN ('concluida','cancelada');
  END IF;

  PERFORM private.emit_store_event(_store, 'order', _order_id, 'order.status_changed', _updated.version);

  RETURN jsonb_build_object(
    'ok', true,
    'orderId', _order_id,
    'status', _to::text,
    'version', _updated.version,
    'allowedActions', to_jsonb(private.order_allowed_actions(_to, _fulfil, _store))
  );
END;
$function$;

-- 3. Provisionamento transacional do entregador (chamado apenas pelo servidor).
CREATE OR REPLACE FUNCTION private.provision_store_courier(
  _actor_user_id uuid,
  _store_id uuid,
  _auth_user_id uuid,
  _full_name text,
  _phone text,
  _login_identifier text,
  _synthetic_email text,
  _can_accept_deliveries boolean,
  _is_active boolean,
  _idempotency_key text,
  _request_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE
  _intent public.courier_provisioning_intents;
  _courier public.couriers;
  _phone_digits text;
  _name text;
BEGIN
  IF _actor_user_id IS NULL OR _store_id IS NULL OR _auth_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  -- Ator: perfil ativo e papel com permissao de criar entregador na propria loja.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id = _actor_user_id AND p.is_active
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_roles r
     WHERE r.user_id = _actor_user_id AND r.is_active AND r.store_id = _store_id
       AND r.role = ANY (private.permission_roles('couriers.create'))
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  _name := nullif(btrim(coalesce(_full_name, '')), '');
  IF _name IS NULL OR length(_name) < 3 OR length(_name) > 80 THEN
    RAISE EXCEPTION 'INVALID_NAME' USING ERRCODE = 'P0001';
  END IF;
  _phone_digits := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  IF length(_phone_digits) < 10 OR length(_phone_digits) > 13 THEN
    RAISE EXCEPTION 'INVALID_PHONE' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotencia: mesma chave e mesmo conteudo devolve o entregador criado.
  SELECT * INTO _intent FROM public.courier_provisioning_intents i
   WHERE i.store_id = _store_id AND i.idempotency_key = _idempotency_key FOR UPDATE;

  IF FOUND THEN
    IF _intent.request_hash <> _request_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    IF _intent.status = 'concluida' AND _intent.courier_id IS NOT NULL THEN
      RETURN jsonb_build_object('courierId', _intent.courier_id, 'created', false);
    END IF;
  ELSE
    INSERT INTO public.courier_provisioning_intents (store_id, idempotency_key, request_hash)
    VALUES (_store_id, _idempotency_key, _request_hash)
    RETURNING * INTO _intent;
  END IF;

  -- Vinculo exclusivo: mensagem generica, sem revelar a outra loja.
  IF EXISTS (SELECT 1 FROM public.couriers c WHERE c.user_id = _auth_user_id)
     OR EXISTS (SELECT 1 FROM public.courier_auth_identities i WHERE i.login_identifier = _login_identifier)
     OR EXISTS (SELECT 1 FROM public.couriers c WHERE c.store_id = _store_id AND c.phone = _phone_digits) THEN
    UPDATE public.courier_provisioning_intents SET status = 'falha', updated_at = now() WHERE id = _intent.id;
    RAISE EXCEPTION 'COURIER_LINK_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.user_profiles (id, full_name, display_name, phone, is_active)
  VALUES (_auth_user_id, _name, split_part(_name, ' ', 1), _phone_digits, true)
  ON CONFLICT (id) DO UPDATE SET full_name = excluded.full_name, updated_at = now();

  INSERT INTO public.user_roles (user_id, store_id, role, is_active)
  VALUES (_auth_user_id, _store_id, 'entregador', coalesce(_is_active, true))
  ON CONFLICT (user_id, store_id, role) DO UPDATE SET is_active = excluded.is_active, updated_at = now();

  INSERT INTO public.couriers (store_id, user_id, full_name, phone, status, can_accept_deliveries)
  VALUES (_store_id, _auth_user_id, _name, _phone_digits,
          CASE WHEN coalesce(_is_active, true) THEN 'ativo' ELSE 'inativo' END::public.courier_status,
          coalesce(_can_accept_deliveries, true))
  RETURNING * INTO _courier;

  INSERT INTO public.courier_auth_identities
    (store_id, courier_id, auth_user_id, login_identifier, synthetic_email,
     requires_password_change, is_login_enabled, temporary_password_issued_at)
  VALUES (_store_id, _courier.id, _auth_user_id, _login_identifier, _synthetic_email,
          true, coalesce(_is_active, true), now());

  UPDATE public.courier_provisioning_intents
     SET status = 'concluida', courier_id = _courier.id, updated_at = now()
   WHERE id = _intent.id;

  INSERT INTO public.audit_logs (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES (_store_id, _actor_user_id, 'loja', 'courier.created', 'couriers', _courier.id,
          jsonb_build_object('fields', to_jsonb(ARRAY['full_name','phone','login_identifier','can_accept_deliveries','status'])));

  PERFORM private.emit_store_event(_store_id, 'courier', _courier.id, 'courier.created', _courier.version);

  RETURN jsonb_build_object('courierId', _courier.id, 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION private.provision_store_courier(uuid,uuid,uuid,text,text,text,text,boolean,boolean,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.provision_store_courier(uuid,uuid,uuid,text,text,text,text,boolean,boolean,text,text) TO service_role;

-- Rotina de rollback do provisionamento quando a conta Auth precisa ser desfeita.
CREATE OR REPLACE FUNCTION private.fail_courier_provisioning(_store_id uuid, _idempotency_key text)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
  UPDATE public.courier_provisioning_intents
     SET status = 'falha', updated_at = now()
   WHERE store_id = _store_id AND idempotency_key = _idempotency_key AND status <> 'concluida';
$$;
REVOKE ALL ON FUNCTION private.fail_courier_provisioning(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fail_courier_provisioning(uuid, text) TO service_role;

-- Resolucao da loja do ator para o endpoint de cadastro (sem confiar no navegador).
CREATE OR REPLACE FUNCTION private.actor_store_for_courier_create(_actor_user_id uuid, _store_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT r.store_id) INTO _ids
    FROM public.user_roles r
   WHERE r.user_id = _actor_user_id AND r.is_active AND r.store_id IS NOT NULL
     AND r.role = ANY (private.permission_roles('couriers.create'))
     AND (_store_id IS NULL OR r.store_id = _store_id);

  IF _ids IS NULL OR cardinality(_ids) = 0 THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;
  IF cardinality(_ids) > 1 THEN
    RAISE EXCEPTION 'STORE_SELECTION_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN _ids[1];
END;
$$;
REVOKE ALL ON FUNCTION private.actor_store_for_courier_create(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.actor_store_for_courier_create(uuid, uuid) TO service_role;