-- Non-platform merchants must never access SaaS-wide support or payment exception queues.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_new_rpc_access_contract.sql

begin;

do $$
declare
  _manager uuid;
  _support_blocked boolean := false;
  _finance_blocked boolean := false;
begin
  select r.user_id into _manager
  from public.user_roles r
  join public.user_profiles p on p.id=r.user_id and p.is_active
  where r.is_active
    and r.store_id is not null
    and r.role in ('proprietario','gerente')
    and not private.is_platform_admin_user(r.user_id)
  order by r.created_at
  limit 1;

  if _manager is null then raise exception 'NO_NON_PLATFORM_MANAGER'; end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',_manager::text,'role','authenticated')::text,
    true
  );

  begin
    perform public.admin_list_store_support_tickets(null,10,0);
  exception when others then
    if sqlstate='42501' or sqlerrm='FORBIDDEN' then
      _support_blocked:=true;
    else
      raise;
    end if;
  end;

  begin
    perform public.admin_list_payment_exception_tasks(null,10,0);
  exception when others then
    if sqlstate='42501' or sqlerrm='FORBIDDEN' then
      _finance_blocked:=true;
    else
      raise;
    end if;
  end;

  if not _support_blocked then raise exception 'MERCHANT_CAN_READ_ADMIN_SUPPORT_QUEUE'; end if;
  if not _finance_blocked then raise exception 'MERCHANT_CAN_READ_ADMIN_PAYMENT_EXCEPTION_QUEUE'; end if;
end $$;

select 'admin_rpc_negative_access_contract_passed' as result;
rollback;
