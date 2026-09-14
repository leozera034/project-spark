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

  _remaining:=greatest(0,5-_attempts);
  IF length(_clean_code)<>6 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_PROOF','attemptsRemaining',_remaining,'retryAfterSeconds',0);
  END IF;
  IF _expected_code IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','PROOF_UNAVAILABLE','attemptsRemaining',_remaining,'retryAfterSeconds',0);
  END IF;

  IF _clean_code<>_expected_code THEN
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
