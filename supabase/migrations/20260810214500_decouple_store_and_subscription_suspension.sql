-- Keep administrative store suspension independent from billing lifecycle.
-- Reactivation must never revive a subscription that may be suspended for payment reasons.

CREATE OR REPLACE FUNCTION public.admin_suspend_store(_store_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
BEGIN
  IF NOT private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.stores
     SET status = 'suspensa', updated_at = now()
   WHERE id = _store_id;

  INSERT INTO public.audit_logs(store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES (_store_id, auth.uid(), 'admin', 'platform.store_suspended', 'stores', _store_id,
          jsonb_build_object('reason', left(btrim(_reason), 500)));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reactivate_store(_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
BEGIN
  IF NOT private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.stores
     SET status = 'ativa', updated_at = now()
   WHERE id = _store_id;

  INSERT INTO public.audit_logs(store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES (_store_id, auth.uid(), 'admin', 'platform.store_reactivated', 'stores', _store_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_suspend_store(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reactivate_store(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_store(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_store(uuid) TO authenticated, service_role;
