-- Opt-in proof of delivery by PIN.
-- Existing stores and deliveries remain on `none`; the PIN is never stored in
-- plaintext and is never exposed to the courier projection.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS delivery_proof_mode text NOT NULL DEFAULT 'none';
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_delivery_proof_mode_check;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_delivery_proof_mode_check CHECK (delivery_proof_mode IN ('none','pin'));

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS proof_mode text NOT NULL DEFAULT 'none';
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_proof_mode_check;
ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_proof_mode_check CHECK (proof_mode IN ('none','pin'));
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS proof_failed_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_proof_failed_attempts_check;
ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_proof_failed_attempts_check CHECK (proof_failed_attempts >= 0);
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS proof_attempt_window_started_at timestamptz;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS proof_verified_at timestamptz;

CREATE OR REPLACE FUNCTION private.delivery_proof_pin(_tracking_token_hash text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path TO 'pg_catalog'
AS $$
DECLARE _value bigint;
BEGIN
  IF _tracking_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  _value := (('x' || substr(_tracking_token_hash, 1, 12))::bit(48)::bigint % 900000) + 100000;
  RETURN lpad(_value::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_store_delivery_proof_settings(_store_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _mode text;
BEGIN
  PERFORM private.require_permission('store.view_basic', _sid);
  SELECT delivery_proof_mode INTO _mode FROM public.stores WHERE id=_sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('mode',_mode,'canEdit',private.has_permission('store.manage_settings',_sid));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_store_delivery_proof_mode(_store_id uuid, _mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _normalized text := lower(btrim(coalesce(_mode,'')));
BEGIN
  PERFORM private.require_permission('store.manage_settings', _sid);
  IF _normalized NOT IN ('none','pin') THEN RAISE EXCEPTION 'INVALID_PROOF_MODE' USING ERRCODE='P0001'; END IF;
  UPDATE public.stores SET delivery_proof_mode=_normalized, updated_at=now() WHERE id=_sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0001'; END IF;
  PERFORM private.log_config_audit(_sid,'store.delivery_proof.updated','stores',_sid,ARRAY['delivery_proof_mode']);
  RETURN jsonb_build_object('mode',_normalized,'canEdit',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_delivery_proof_requirement(_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _cid uuid; _sid uuid; _d public.deliveries; _attempts integer; _retry integer := 0;
BEGIN
  SELECT courier_id,store_id INTO _cid,_sid FROM private.require_current_courier();
  SELECT * INTO _d FROM public.deliveries d
   WHERE d.id=_delivery_id AND d.store_id=_sid AND d.courier_id=_cid;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0001'; END IF;
  IF _d.proof_attempt_window_started_at IS NOT NULL
     AND _d.proof_attempt_window_started_at > now()-interval '10 minutes' THEN
    _attempts := _d.proof_failed_attempts;
    IF _attempts >= 5 THEN
      _retry := greatest(1,ceil(extract(epoch FROM ((_d.proof_attempt_window_started_at + interval '10 minutes')-now())))::integer);
    END IF;
  ELSE
    _attempts := 0;
  END IF;
  RETURN jsonb_build_object(
    'mode',_d.proof_mode,
    'attemptsRemaining',greatest(0,5-_attempts),
    'retryAfterSeconds',_retry,
    'verifiedAt',_d.proof_verified_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.storefront_delivery_proof(_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _o public.orders; _d public.deliveries; _pin text;
BEGIN
  IF _token_hash IS NULL OR _token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('mode','none','code',NULL);
  END IF;
  SELECT * INTO _o FROM public.orders o WHERE o.tracking_token_hash=_token_hash LIMIT 1;
  IF NOT FOUND OR _o.fulfillment::text <> 'entrega' THEN
    RETURN jsonb_build_object('mode','none','code',NULL);
  END IF;
  SELECT * INTO _d FROM public.deliveries d
   WHERE d.store_id=_o.store_id AND d.order_id=_o.id LIMIT 1;
  IF NOT FOUND OR _d.proof_mode <> 'pin' OR _d.status <> 'em_rota' THEN
    RETURN jsonb_build_object('mode',coalesce(_d.proof_mode,'none'),'code',NULL);
  END IF;
  _pin := private.delivery_proof_pin(_o.tracking_token_hash);
  RETURN jsonb_build_object('mode','pin','code',_pin);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_my_delivery(_delivery_id uuid,_expected_version integer,_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _cid uuid; _sid uuid; _mode text;
BEGIN
  SELECT courier_id,store_id INTO _cid,_sid FROM private.require_current_courier();
  SELECT delivery_proof_mode INTO _mode FROM public.stores WHERE id=_sid;
  UPDATE public.deliveries d
     SET proof_mode=coalesce(_mode,'none'),
         proof_failed_attempts=0,
         proof_attempt_window_started_at=NULL,
         proof_verified_at=NULL
   WHERE d.id=_delivery_id AND d.store_id=_sid AND d.courier_id=_cid
     AND d.status='coletada' AND d.version=_expected_version;
  RETURN private.courier_delivery_action('start_delivery',_delivery_id,_expected_version,_idempotency_key);
END;
$$;

-- Legacy clients cannot bypass PIN proof: the old signature remains available,
-- but refuses completion when the delivery snapshot requires a PIN.
CREATE OR REPLACE FUNCTION public.complete_my_delivery(_delivery_id uuid,_expected_version integer,_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE _cid uuid; _sid uuid; _mode text;
BEGIN
  SELECT courier_id,store_id INTO _cid,_sid FROM private.require_current_courier();
  SELECT d.proof_mode INTO _mode FROM public.deliveries d
   WHERE d.id=_delivery_id AND d.store_id=_sid AND d.courier_id=_cid;
  IF _mode='pin' THEN RAISE EXCEPTION 'PROOF_REQUIRED' USING ERRCODE='P0001'; END IF;
  RETURN private.courier_delivery_action('complete_delivery',_delivery_id,_expected_version,_idempotency_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_my_delivery(
  _delivery_id uuid,_expected_version integer,_idempotency_key text,_proof_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE
  _cid uuid; _sid uuid; _d public.deliveries; _o public.orders; _key text; _existing jsonb;
  _clean_code text; _expected_code text; _attempts integer; _window timestamptz;
  _remaining integer; _retry integer;
BEGIN
  SELECT courier_id,store_id INTO _cid,_sid FROM private.require_current_courier();
  _key:=nullif(btrim(coalesce(_idempotency_key,'')),'');
  IF _key IS NULL OR length(_key)<8 OR length(_key)>120 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='P0001';
  END IF;
  SELECT i.result INTO _existing FROM public.courier_action_intents i
   WHERE i.courier_id=_cid AND i.idempotency_key=_key;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  SELECT * INTO _d FROM public.deliveries d
   WHERE d.id=_delivery_id AND d.store_id=_sid AND d.courier_id=_cid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0001'; END IF;
  IF _expected_version IS NULL OR _expected_version<>_d.version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='P0001';
  END IF;
  IF _d.proof_mode<>'pin' OR _d.status<>'em_rota' THEN
    RETURN private.courier_delivery_action('complete_delivery',_delivery_id,_expected_version,_idempotency_key);
  END IF;

  SELECT * INTO _o FROM public.orders o WHERE o.id=_d.order_id AND o.store_id=_sid;
  _clean_code:=regexp_replace(coalesce(_proof_code,''),'\D','','g');
  _expected_code:=private.delivery_proof_pin(_o.tracking_token_hash);
  _window:=_d.proof_attempt_window_started_at;
  IF _window IS NULL OR _window<=now()-interval '10 minutes' THEN
    _attempts:=0; _window:=now();
  ELSE
    _attempts:=_d.proof_failed_attempts;
  END IF;

  IF _attempts>=5 THEN
    _retry:=greatest(1,ceil(extract(epoch FROM ((_window+interval '10 minutes')-now())))::integer);
    RETURN jsonb_build_object('ok',false,'error','PROOF_RATE_LIMITED','attemptsRemaining',0,'retryAfterSeconds',_retry);
  END IF;

  IF length(_clean_code)<>6 OR _expected_code IS NULL OR _clean_code<>_expected_code THEN
    _attempts:=_attempts+1;
    _remaining:=greatest(0,5-_attempts);
    UPDATE public.deliveries
       SET proof_failed_attempts=_attempts,proof_attempt_window_started_at=_window
     WHERE id=_d.id AND store_id=_sid;
    RETURN jsonb_build_object(
      'ok',false,'error','INVALID_PROOF','attemptsRemaining',_remaining,
      'retryAfterSeconds',CASE WHEN _remaining=0 THEN 600 ELSE 0 END
    );
  END IF;

  UPDATE public.deliveries
     SET proof_verified_at=now(),proof_failed_attempts=0,proof_attempt_window_started_at=NULL
   WHERE id=_d.id AND store_id=_sid;
  RETURN private.courier_delivery_action('complete_delivery',_delivery_id,_expected_version,_idempotency_key);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_store_delivery_proof_settings(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_store_delivery_proof_settings(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.set_my_store_delivery_proof_mode(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_my_store_delivery_proof_mode(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_delivery_proof_requirement(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_delivery_proof_requirement(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.storefront_delivery_proof(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_delivery_proof(text) TO service_role;
REVOKE ALL ON FUNCTION public.complete_my_delivery(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_my_delivery(uuid,integer,text,text) TO authenticated;
