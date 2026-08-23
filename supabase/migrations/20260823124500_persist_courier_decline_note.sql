-- Preserve the optional courier note when declining an assignment.
-- Keep the original four-argument RPC for backward compatibility and add a
-- five-argument overload used by the current client. The new overload has no
-- default for _note so four-argument calls remain unambiguous in PostgREST.

CREATE OR REPLACE FUNCTION public.decline_my_delivery_assignment(
  _delivery_id uuid,
  _expected_version integer,
  _reason_code text,
  _idempotency_key text,
  _note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private','pg_temp'
AS $$
DECLARE
  _result jsonb;
  _clean_note text;
  _cid uuid;
  _sid uuid;
  _delivery_version integer;
BEGIN
  SELECT courier_id, store_id
    INTO _cid, _sid
    FROM private.require_current_courier();

  _clean_note := nullif(btrim(coalesce(_note, '')), '');
  IF _clean_note IS NOT NULL THEN
    IF length(_clean_note) > 300 OR _clean_note ~ '[<>]' THEN
      RAISE EXCEPTION 'INVALID_NOTE' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  _result := private.courier_delivery_action(
    'decline',
    _delivery_id,
    _expected_version,
    _idempotency_key,
    _reason_code,
    _clean_note
  );

  _delivery_version := nullif(_result ->> 'version', '')::integer;

  -- courier_delivery_action already records a versioned event for the decline.
  -- Attach the sanitized note to that exact event instead of introducing a
  -- second source of truth or storing it on the delivery itself.
  IF _clean_note IS NOT NULL AND _delivery_version IS NOT NULL THEN
    UPDATE public.delivery_events e
       SET description = _clean_note
     WHERE e.store_id = _sid
       AND e.delivery_id = _delivery_id
       AND e.previous_courier_id = _cid
       AND e.kind = 'ocorrencia'
       AND e.reason_code = _reason_code
       AND e.delivery_version = _delivery_version;
  END IF;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.decline_my_delivery_assignment(uuid,integer,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_my_delivery_assignment(uuid,integer,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.decline_my_delivery_assignment(uuid,integer,text,text,text) TO authenticated;

COMMENT ON FUNCTION public.decline_my_delivery_assignment(uuid,integer,text,text,text)
IS 'Declines the authenticated courier assignment and persists an optional sanitized operational note on the versioned delivery event.';
