CREATE OR REPLACE FUNCTION public.resolve_courier_create_store_admin(_actor_user_id uuid, _store_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.actor_store_for_courier_create(_actor_user_id, _store_id)
$$;

REVOKE ALL ON FUNCTION public.resolve_courier_create_store_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_courier_create_store_admin(uuid, uuid) TO service_role;