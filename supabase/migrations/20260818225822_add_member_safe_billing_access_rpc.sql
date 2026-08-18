create or replace function public.get_my_store_billing_access(_store_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
begin
  if not private.is_store_member(_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  perform public.reconcile_store_billing(_store_id);
  return public.get_store_billing_access(_store_id);
end;
$function$;

revoke all on function public.get_my_store_billing_access(uuid) from public, anon;
grant execute on function public.get_my_store_billing_access(uuid) to authenticated, service_role;
