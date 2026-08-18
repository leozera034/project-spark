create or replace function private.require_permission(_permission app_permission, _store_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _access jsonb;
  _permission_text text := _permission::text;
  _restricted_write boolean := false;
begin
  if not private.has_permission(_permission,_store_id) then
    raise exception 'FORBIDDEN' using errcode='P0001';
  end if;

  _restricted_write := _permission_text = any(array[
    'store.update_profile',
    'store.manage_settings',
    'store.manage_hours',
    'store.manage_neighborhoods',
    'store.manage_payment_methods',
    'catalog.create',
    'catalog.update',
    'catalog.archive',
    'team.invite',
    'team.change_role',
    'team.disable',
    'couriers.create',
    'couriers.update',
    'couriers.reset_access'
  ]);

  if _restricted_write then
    _access := public.get_store_billing_access(_store_id);
    if not coalesce((_access->>'can_manage_catalog')::boolean, true) then
      raise exception 'BILLING_RESTRICTED' using
        errcode='P0001',
        detail=jsonb_build_object('stage',_access->>'stage','capability','administrative_writes')::text;
    end if;
  end if;
end;
$function$;

create or replace function public.save_store_marketing_campaign(
  _store_id uuid,
  _id uuid,
  _name text,
  _audience text,
  _message text,
  _status text default 'rascunho'::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  result_id uuid;
  _access jsonb;
begin
  if not private.is_store_manager(_store_id) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  _access := public.get_store_billing_access(_store_id);
  if not coalesce((_access->>'can_use_growth')::boolean, true) then
    raise exception 'BILLING_RESTRICTED' using
      errcode='P0001',
      detail=jsonb_build_object('stage',_access->>'stage','capability','growth')::text;
  end if;

  if _audience not in ('todos','novos','recorrentes','vip','inativos') then raise exception 'invalid_audience'; end if;
  if _status not in ('rascunho','pronta','arquivada') then raise exception 'invalid_status'; end if;

  if _id is null then
    insert into public.store_marketing_campaigns(store_id,name,audience,message,status)
    values(_store_id,trim(_name),_audience,trim(_message),_status)
    returning id into result_id;
  else
    update public.store_marketing_campaigns
    set name=trim(_name),audience=_audience,message=trim(_message),status=_status,updated_at=now()
    where id=_id and store_id=_store_id
    returning id into result_id;
    if result_id is null then raise exception 'campaign_not_found'; end if;
  end if;
  return result_id;
end;
$function$;

create or replace function public.save_store_automation_rule(
  _store_id uuid,
  _id uuid,
  _event_code text,
  _name text,
  _enabled boolean,
  _config jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  result_id uuid;
  _access jsonb;
begin
  if not private.is_store_manager(_store_id) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  _access := public.get_store_billing_access(_store_id);
  if not coalesce((_access->>'can_use_growth')::boolean, true) then
    raise exception 'BILLING_RESTRICTED' using
      errcode='P0001',
      detail=jsonb_build_object('stage',_access->>'stage','capability','growth')::text;
  end if;

  if _event_code not in ('novo_cliente','pedido_concluido','cliente_inativo_30d','cliente_vip') then raise exception 'invalid_event'; end if;

  if _id is null then
    insert into public.store_automation_rules(store_id,event_code,name,is_enabled,config)
    values(_store_id,_event_code,trim(_name),coalesce(_enabled,true),coalesce(_config,'{}'::jsonb))
    returning id into result_id;
  else
    update public.store_automation_rules
    set event_code=_event_code,name=trim(_name),is_enabled=coalesce(_enabled,true),config=coalesce(_config,'{}'::jsonb),updated_at=now()
    where id=_id and store_id=_store_id
    returning id into result_id;
    if result_id is null then raise exception 'rule_not_found'; end if;
  end if;
  return result_id;
end;
$function$;
