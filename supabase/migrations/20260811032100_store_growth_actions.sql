-- Acoes controladas do Centro de Crescimento.

create or replace function public.list_store_marketing_campaigns(_store_id uuid)
returns table(id uuid, name text, audience text, channel text, message text, status text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not private.is_store_member(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  return query
  select c.id,c.name,c.audience,c.channel,c.message,c.status,c.created_at,c.updated_at
  from public.store_marketing_campaigns c
  where c.store_id=_store_id
  order by c.updated_at desc;
end; $$;

create or replace function public.save_store_marketing_campaign(
  _store_id uuid, _id uuid, _name text, _audience text, _message text, _status text default 'rascunho'
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare result_id uuid;
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if _audience not in ('todos','novos','recorrentes','vip','inativos') then raise exception 'invalid_audience'; end if;
  if _status not in ('rascunho','pronta','arquivada') then raise exception 'invalid_status'; end if;
  if _id is null then
    insert into public.store_marketing_campaigns(store_id,name,audience,message,status)
    values(_store_id,trim(_name),_audience,trim(_message),_status) returning id into result_id;
  else
    update public.store_marketing_campaigns
    set name=trim(_name),audience=_audience,message=trim(_message),status=_status,updated_at=now()
    where id=_id and store_id=_store_id returning id into result_id;
    if result_id is null then raise exception 'campaign_not_found'; end if;
  end if;
  return result_id;
end; $$;

create or replace function public.list_store_automation_rules(_store_id uuid)
returns table(id uuid, event_code text, action_code text, name text, is_enabled boolean, config jsonb, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not private.is_store_member(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  return query
  select r.id,r.event_code,r.action_code,r.name,r.is_enabled,r.config,r.created_at,r.updated_at
  from public.store_automation_rules r where r.store_id=_store_id order by r.created_at;
end; $$;

create or replace function public.save_store_automation_rule(
  _store_id uuid, _id uuid, _event_code text, _name text, _enabled boolean, _config jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare result_id uuid;
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if _event_code not in ('novo_cliente','pedido_concluido','cliente_inativo_30d','cliente_vip') then raise exception 'invalid_event'; end if;
  if _id is null then
    insert into public.store_automation_rules(store_id,event_code,name,is_enabled,config)
    values(_store_id,_event_code,trim(_name),coalesce(_enabled,true),coalesce(_config,'{}'::jsonb)) returning id into result_id;
  else
    update public.store_automation_rules
    set event_code=_event_code,name=trim(_name),is_enabled=coalesce(_enabled,true),config=coalesce(_config,'{}'::jsonb),updated_at=now()
    where id=_id and store_id=_store_id returning id into result_id;
    if result_id is null then raise exception 'rule_not_found'; end if;
  end if;
  return result_id;
end; $$;

grant execute on function public.list_store_marketing_campaigns(uuid) to authenticated;
grant execute on function public.save_store_marketing_campaign(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.list_store_automation_rules(uuid) to authenticated;
grant execute on function public.save_store_automation_rule(uuid,uuid,text,text,boolean,jsonb) to authenticated;

revoke all on function public.list_store_marketing_campaigns(uuid) from anon;
revoke all on function public.save_store_marketing_campaign(uuid,uuid,text,text,text,text) from anon;
revoke all on function public.list_store_automation_rules(uuid) from anon;
revoke all on function public.save_store_automation_rule(uuid,uuid,text,text,boolean,jsonb) from anon;
