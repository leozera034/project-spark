-- Ensure deactivating a user profile also revokes courier identity resolution.
-- Several courier RPCs depend on current_courier_id/current_courier_store_id
-- directly, so these helpers must enforce the same profile-active invariant as
-- private.has_permission().

CREATE OR REPLACE FUNCTION private.current_courier_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT i.courier_id
  FROM public.courier_auth_identities i
  JOIN public.couriers c
    ON c.id = i.courier_id
   AND c.store_id = i.store_id
  JOIN public.user_profiles p
    ON p.id = i.auth_user_id
   AND p.is_active
  WHERE i.auth_user_id = auth.uid()
    AND i.is_login_enabled
    AND NOT i.requires_password_change
    AND c.status = 'ativo'
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION private.current_courier_store_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT i.store_id
  FROM public.courier_auth_identities i
  JOIN public.couriers c
    ON c.id = i.courier_id
   AND c.store_id = i.store_id
  JOIN public.user_profiles p
    ON p.id = i.auth_user_id
   AND p.is_active
  WHERE i.auth_user_id = auth.uid()
    AND i.is_login_enabled
    AND NOT i.requires_password_change
    AND c.status = 'ativo'
  LIMIT 1
$function$;
