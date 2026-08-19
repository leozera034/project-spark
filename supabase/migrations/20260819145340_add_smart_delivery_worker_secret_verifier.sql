create or replace function public.backend_verify_smart_delivery_worker_secret(_candidate text)
returns boolean
language sql
stable
security definer
set search_path='pg_catalog','vault'
as $$
  select coalesce(
    nullif(btrim(_candidate),'') is not null
    and exists(
      select 1
      from vault.decrypted_secrets s
      where s.name='comandiva_smart_delivery_worker_secret'
        and s.decrypted_secret=_candidate
    ),false
  );
$$;

revoke all on function public.backend_verify_smart_delivery_worker_secret(text) from public,anon,authenticated;
grant execute on function public.backend_verify_smart_delivery_worker_secret(text) to service_role;
