-- Bind each courier idempotency key to the request that first consumed it.
--
-- Before this migration, private.courier_delivery_action replayed any existing
-- result found by (courier_id, idempotency_key) before checking the requested
-- action or delivery_id. A legitimate replay worked, but reusing the same key
-- for a different action/target silently returned stale success data.
--
-- The table already stores action + delivery_id, so no schema expansion is
-- needed. A transaction-scoped advisory lock serializes concurrent requests
-- using the same courier/key pair; after the lock is acquired, an existing
-- intent must match both action and delivery or the request is rejected with
-- IDEMPOTENCY_CONFLICT. Legitimate same-request replays still flow to the
-- existing core and return its stored result.

CREATE OR REPLACE FUNCTION private.assert_courier_idempotency_request(
  _action text,
  _delivery_id uuid,
  _idempotency_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _cid uuid;
  _sid uuid;
  _key text;
  _existing public.courier_action_intents;
BEGIN
  SELECT courier_id, store_id
    INTO _cid, _sid
    FROM private.require_current_courier();

  _key := nullif(btrim(coalesce(_idempotency_key, '')), '');
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 120 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF _action IS NULL OR _delivery_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = 'P0001';
  END IF;

  -- Same courier + same key is one serializable idempotency lane. This closes
  -- the race where two different requests arrive concurrently before either
  -- has inserted courier_action_intents.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_cid::text || ':' || _key, 0)
  );

  SELECT i.*
    INTO _existing
    FROM public.courier_action_intents i
   WHERE i.courier_id = _cid
     AND i.idempotency_key = _key;

  IF FOUND AND (
    _existing.action IS DISTINCT FROM _action
    OR _existing.delivery_id IS DISTINCT FROM _delivery_id
  ) THEN
    RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION private.assert_courier_idempotency_request(text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.assert_courier_idempotency_request(text,uuid,text) FROM anon;
REVOKE ALL ON FUNCTION private.assert_courier_idempotency_request(text,uuid,text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.accept_my_delivery_assignment(
  _delivery_id uuid,
  _expected_version integer,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  PERFORM private.assert_courier_idempotency_request('accept', _delivery_id, _idempotency_key);
  RETURN private.courier_delivery_action('accept', _delivery_id, _expected_version, _idempotency_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_my_delivery_assignment(
  _delivery_id uuid,
  _expected_version integer,
  _reason_code text,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  PERFORM private.assert_courier_idempotency_request('decline', _delivery_id, _idempotency_key);
  RETURN private.courier_delivery_action(
    'decline', _delivery_id, _expected_version, _idempotency_key, _reason_code
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_my_arrival_at_store(
  _delivery_id uuid,
  _expected_version integer,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  PERFORM private.assert_courier_idempotency_request('confirm_arrival', _delivery_id, _idempotency_key);
  RETURN private.courier_delivery_action(
    'confirm_arrival', _delivery_id, _expected_version, _idempotency_key
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_my_order_pickup(
  _delivery_id uuid,
  _expected_version integer,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  PERFORM private.assert_courier_idempotency_request('confirm_pickup', _delivery_id, _idempotency_key);
  RETURN private.courier_delivery_action(
    'confirm_pickup', _delivery_id, _expected_version, _idempotency_key
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_my_delivery(
  _delivery_id uuid,
  _expected_version integer,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  PERFORM private.assert_courier_idempotency_request('start_delivery', _delivery_id, _idempotency_key);
  RETURN private.courier_delivery_action(
    'start_delivery', _delivery_id, _expected_version, _idempotency_key
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_my_delivery(
  _delivery_id uuid,
  _expected_version integer,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  PERFORM private.assert_courier_idempotency_request('complete_delivery', _delivery_id, _idempotency_key);
  RETURN private.courier_delivery_action(
    'complete_delivery', _delivery_id, _expected_version, _idempotency_key
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_my_delivery_occurrence(
  _delivery_id uuid,
  _code text,
  _note text,
  _expected_version integer,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  PERFORM private.assert_courier_idempotency_request('report_occurrence', _delivery_id, _idempotency_key);
  RETURN private.courier_delivery_action(
    'report_occurrence', _delivery_id, _expected_version, _idempotency_key, _code, _note
  );
END;
$function$;

-- Preserve the Phase 19 execution surface explicitly after replacing wrappers.
DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'public.accept_my_delivery_assignment(uuid,integer,text)',
    'public.decline_my_delivery_assignment(uuid,integer,text,text)',
    'public.confirm_my_arrival_at_store(uuid,integer,text)',
    'public.confirm_my_order_pickup(uuid,integer,text)',
    'public.start_my_delivery(uuid,integer,text)',
    'public.complete_my_delivery(uuid,integer,text)',
    'public.report_my_delivery_occurrence(uuid,text,text,integer,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _fn);
  END LOOP;
END $$;
