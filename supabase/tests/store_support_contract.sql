-- Tenant-safe two-way store support contract.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/store_support_contract.sql

begin;

do $$
declare
  _manager uuid;
  _store uuid;
  _other_store uuid;
  _admin uuid;
  _opened jsonb;
  _ticket uuid;
  _center jsonb;
  _detail jsonb;
  _forbidden boolean:=false;
begin
  select r.user_id,r.store_id into _manager,_store
  from public.user_roles r
  join public.user_profiles p on p.id=r.user_id and p.is_active
  where r.is_active and r.store_id is not null and r.role in ('proprietario','gerente')
    and not private.is_platform_admin_user(r.user_id)
  order by r.created_at limit 1;
  if _manager is null then raise exception 'NO_NON_PLATFORM_MANAGER_FOR_SUPPORT_TEST'; end if;

  select r.user_id into _admin from public.user_roles r where r.is_active and r.role='admin_plataforma' and r.store_id is null order by r.created_at limit 1;
  if _admin is null then raise exception 'NO_PLATFORM_ADMIN_FOR_SUPPORT_TEST'; end if;

  select s.id into _other_store from public.stores s where s.id<>_store and not private.is_store_manager_user(_manager,s.id) order by s.created_at limit 1;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',_manager::text,'role','authenticated')::text,true);
  _opened:=public.open_my_store_support_ticket(_store,'pedidos','Contrato de suporte','Mensagem inicial do contrato de suporte.');
  _ticket:=(_opened->>'id')::uuid;
  if _ticket is null then raise exception 'SUPPORT_TICKET_NOT_CREATED'; end if;

  _center:=public.get_my_store_support_center(_store,200,0);
  if not exists(select 1 from jsonb_array_elements(_center->'items') item where item->>'id'=_ticket::text) then raise exception 'SUPPORT_CENTER_MISSING_TICKET'; end if;

  if _other_store is not null then
    begin perform public.get_my_store_support_ticket(_other_store,_ticket);
    exception when insufficient_privilege then _forbidden:=true;
    when others then if sqlstate='42501' then _forbidden:=true; else raise; end if; end;
    if not _forbidden then raise exception 'CROSS_STORE_SUPPORT_READ_ALLOWED'; end if;
  end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',_admin::text,'role','authenticated')::text,true);
  if not exists(select 1 from jsonb_array_elements((public.admin_list_store_support_tickets(null,200,0))->'items') item where item->>'id'=_ticket::text) then raise exception 'ADMIN_SUPPORT_QUEUE_MISSING_TICKET'; end if;
  perform public.admin_reply_store_support_ticket(_ticket,'Resposta administrativa do contrato.','aguardando_loja');

  perform set_config('request.jwt.claims',jsonb_build_object('sub',_manager::text,'role','authenticated')::text,true);
  _detail:=public.get_my_store_support_ticket(_store,_ticket);
  if not exists(select 1 from jsonb_array_elements(_detail->'messages') m where m->>'authorKind'='admin' and m->>'body'='Resposta administrativa do contrato.') then raise exception 'MERCHANT_DID_NOT_RECEIVE_ADMIN_SUPPORT_REPLY'; end if;

  perform public.reply_my_store_support_ticket(_store,_ticket,'Resposta da loja no contrato.');
  _detail:=public.get_my_store_support_ticket(_store,_ticket);
  if _detail#>>'{ticket,status}' <> 'em_atendimento' then raise exception 'SUPPORT_STATUS_NOT_RESUMED_AFTER_MERCHANT_REPLY'; end if;

  perform public.close_my_store_support_ticket(_store,_ticket);
  _detail:=public.get_my_store_support_ticket(_store,_ticket);
  if _detail#>>'{ticket,status}' <> 'fechado' then raise exception 'SUPPORT_TICKET_NOT_CLOSED'; end if;
end $$;

select 'store_support_contract_passed' as result;
rollback;
