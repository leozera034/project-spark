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
  ON CONFLICT (user_id, store_id, role) WHERE store_id IS NOT NULL
  DO UPDATE SET is_active = excluded.is_active, updated_at = now();

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