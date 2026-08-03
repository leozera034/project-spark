CREATE OR REPLACE FUNCTION public.provision_store_courier_admin(
  _actor_user_id uuid, _store_id uuid, _auth_user_id uuid, _full_name text, _phone text,
  _login_identifier text, _synthetic_email text, _can_accept_deliveries boolean,
  _is_active boolean, _idempotency_key text, _request_hash text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
  SELECT private.provision_store_courier(_actor_user_id, _store_id, _auth_user_id, _full_name,
    _phone, _login_identifier, _synthetic_email, _can_accept_deliveries, _is_active,
    _idempotency_key, _request_hash)
$$;

CREATE OR REPLACE FUNCTION public.resolve_courier_create_store_admin(_actor_user_id uuid, _store_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
  SELECT private.actor_store_for_courier_create(_actor_user_id, _store_id)
$$;

CREATE OR REPLACE FUNCTION public.fail_courier_provisioning_admin(_store_id uuid, _idempotency_key text)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public','private','pg_temp' AS $$
  SELECT private.fail_courier_provisioning(_store_id, _idempotency_key)
$$;

REVOKE ALL ON FUNCTION public.provision_store_courier_admin(uuid,uuid,uuid,text,text,text,text,boolean,boolean,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_courier_create_store_admin(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_courier_provisioning_admin(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_store_courier_admin(uuid,uuid,uuid,text,text,text,text,boolean,boolean,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_courier_create_store_admin(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_courier_provisioning_admin(uuid,text) TO service_role;