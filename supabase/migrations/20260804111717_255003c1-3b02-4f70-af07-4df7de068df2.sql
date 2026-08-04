CREATE OR REPLACE FUNCTION private.log_config_audit(_store_id uuid, _action text, _entity text, _entity_id uuid, _fields text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _roles text;
BEGIN
  SELECT string_agg(DISTINCT r.role::text, ',') INTO _roles
    FROM public.user_roles r
   WHERE r.user_id = auth.uid() AND r.is_active AND r.store_id = _store_id;

  INSERT INTO public.audit_logs (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES (
    _store_id, auth.uid(), 'loja', _action, _entity, _entity_id,
    jsonb_build_object('roles', coalesce(_roles, ''), 'fields', to_jsonb(coalesce(_fields, ARRAY[]::text[])))
  );
END;
$$;