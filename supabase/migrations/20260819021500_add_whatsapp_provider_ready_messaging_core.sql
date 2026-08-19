create table if not exists public.store_message_templates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  name text not null,
  channel text not null default 'whatsapp',
  purpose text not null default 'transactional',
  body text not null,
  provider_template_name text,
  provider_language text not null default 'pt_BR',
  provider_status text not null default 'draft',
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_message_templates_code_format check (code ~ '^[a-z0-9_.-]+$'),
  constraint store_message_templates_channel check (channel in ('whatsapp')),
  constraint store_message_templates_purpose check (purpose in ('transactional','marketing')),
  constraint store_message_templates_provider_status check (provider_status in ('draft','pending','approved','rejected')),
  constraint store_message_templates_body_len check (char_length(body) between 1 and 4096),
  unique(store_id, code)
);

create index if not exists store_message_templates_store_idx
  on public.store_message_templates(store_id, is_active, updated_at desc);

alter table public.store_message_templates enable row level security;
revoke all on public.store_message_templates from anon;
revoke insert, update, delete on public.store_message_templates from authenticated;
grant select on public.store_message_templates to authenticated, service_role;

create table if not exists private.customer_channel_consents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null,
  purpose text not null,
  opted_in boolean not null default false,
  source text not null default 'unknown',
  captured_at timestamptz,
  revoked_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_channel_consents_channel check (channel in ('whatsapp','email','push')),
  constraint customer_channel_consents_purpose check (purpose in ('marketing')),
  unique(store_id, customer_id, channel, purpose)
);

create index if not exists customer_channel_consents_store_customer_idx
  on private.customer_channel_consents(store_id, customer_id);

create table if not exists private.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  campaign_id uuid references public.store_marketing_campaigns(id) on delete set null,
  template_id uuid references public.store_message_templates(id) on delete set null,
  automation_job_id uuid references private.automation_jobs(id) on delete set null,
  channel text not null default 'whatsapp',
  purpose text not null,
  recipient_e164 text not null,
  provider text not null,
  provider_message_id text,
  status text not null default 'queued',
  body_snapshot text,
  variables jsonb not null default '{}'::jsonb,
  idempotency_key text,
  provider_cost_micros bigint not null default 0,
  customer_charge_micros bigint not null default 0,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_messages_channel check (channel in ('whatsapp')),
  constraint outbound_messages_purpose check (purpose in ('transactional','marketing')),
  constraint outbound_messages_status check (status in ('queued','sending','sent','delivered','read','failed','cancelled','blocked')),
  constraint outbound_messages_phone check (recipient_e164 ~ '^[1-9][0-9]{9,14}$'),
  constraint outbound_messages_costs check (provider_cost_micros >= 0 and customer_charge_micros >= 0)
);

create unique index if not exists outbound_messages_dedupe_uidx
  on private.outbound_messages(store_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists outbound_messages_provider_message_uidx
  on private.outbound_messages(provider, provider_message_id)
  where provider_message_id is not null;
create index if not exists outbound_messages_queue_idx
  on private.outbound_messages(status, queued_at)
  where status in ('queued','sending');
create index if not exists outbound_messages_store_idx
  on private.outbound_messages(store_id, created_at desc);

create table if not exists private.automation_event_failures (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  event_code text not null,
  source_table text,
  source_id uuid,
  error_code text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists automation_event_failures_store_idx
  on private.automation_event_failures(store_id, created_at desc);

create or replace function private.normalize_whatsapp_e164(_phone text)
returns text
language plpgsql
immutable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare _digits text;
begin
  _digits := regexp_replace(coalesce(_phone,''),'[^0-9]','','g');
  if length(_digits) in (10,11) then _digits := '55' || _digits; end if;
  if length(_digits) not between 12 and 15 or _digits !~ '^[1-9][0-9]+$' then
    raise exception 'INVALID_WHATSAPP_PHONE' using errcode='P0001';
  end if;
  return _digits;
end;
$function$;

create or replace function private.resolve_whatsapp_provider(_store_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
  select a.provider
  from private.integration_provider_accounts a
  where a.store_id = _store_id
    and a.status = 'connected'
    and a.provider in ('meta_whatsapp','360dialog_whatsapp','twilio_whatsapp')
  order by case a.provider when 'meta_whatsapp' then 0 when '360dialog_whatsapp' then 1 else 2 end,
           a.connected_at desc nulls last
  limit 1
$function$;

create or replace function public.get_store_whatsapp_readiness(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _provider text;
  _entitled boolean;
  _approved_templates integer;
  _total_templates integer;
begin
  perform private.require_growth_access(_store_id);
  _provider := private.resolve_whatsapp_provider(_store_id);
  _entitled := private.store_has_entitlement(_store_id,'whatsapp_automation');
  select count(*), count(*) filter (where t.provider_status='approved' and t.is_active)
  into _total_templates, _approved_templates
  from public.store_message_templates t
  where t.store_id=_store_id and t.channel='whatsapp';
  return jsonb_build_object(
    'assisted_available', true,
    'automatic_entitled', _entitled,
    'provider_connected', _provider is not null,
    'provider', _provider,
    'templates_total', coalesce(_total_templates,0),
    'templates_approved', coalesce(_approved_templates,0),
    'ready_for_automatic', (_entitled and _provider is not null and coalesce(_approved_templates,0) > 0)
  );
end;
$function$;

create or replace function public.list_store_message_templates(_store_id uuid)
returns table(id uuid, code text, name text, channel text, purpose text, body text, provider_template_name text, provider_language text, provider_status text, is_active boolean, created_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  perform private.require_growth_access(_store_id);
  return query
  select t.id,t.code,t.name,t.channel,t.purpose,t.body,t.provider_template_name,t.provider_language,t.provider_status,t.is_active,t.created_at,t.updated_at
  from public.store_message_templates t
  where t.store_id=_store_id
  order by t.updated_at desc;
end;
$function$;

create or replace function public.save_store_message_template(
  _store_id uuid, _id uuid, _code text, _name text, _purpose text, _body text,
  _provider_template_name text default null, _provider_language text default 'pt_BR',
  _provider_status text default 'draft', _is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare _result uuid; _code_n text; _name_n text; _body_n text;
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  _code_n := lower(btrim(coalesce(_code,'')));
  _name_n := btrim(coalesce(_name,''));
  _body_n := btrim(coalesce(_body,''));
  if _code_n !~ '^[a-z0-9_.-]+$' then raise exception 'INVALID_TEMPLATE_CODE' using errcode='P0001'; end if;
  if char_length(_name_n) not between 2 and 120 then raise exception 'INVALID_TEMPLATE_NAME' using errcode='P0001'; end if;
  if char_length(_body_n) not between 1 and 4096 then raise exception 'INVALID_TEMPLATE_BODY' using errcode='P0001'; end if;
  if _purpose not in ('transactional','marketing') then raise exception 'INVALID_TEMPLATE_PURPOSE' using errcode='P0001'; end if;
  if _provider_status not in ('draft','pending','approved','rejected') then raise exception 'INVALID_TEMPLATE_STATUS' using errcode='P0001'; end if;
  if _id is null then
    insert into public.store_message_templates(store_id,code,name,purpose,body,provider_template_name,provider_language,provider_status,is_active)
    values(_store_id,_code_n,_name_n,_purpose,_body_n,nullif(btrim(coalesce(_provider_template_name,'')),''),coalesce(nullif(btrim(_provider_language),''),'pt_BR'),_provider_status,coalesce(_is_active,true))
    returning id into _result;
  else
    update public.store_message_templates
    set code=_code_n,name=_name_n,purpose=_purpose,body=_body_n,
        provider_template_name=nullif(btrim(coalesce(_provider_template_name,'')),''),
        provider_language=coalesce(nullif(btrim(_provider_language),''),'pt_BR'),
        provider_status=_provider_status,is_active=coalesce(_is_active,true),updated_at=now()
    where id=_id and store_id=_store_id
    returning id into _result;
    if _result is null then raise exception 'TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;
  end if;
  return _result;
end;
$function$;

create or replace function public.set_customer_whatsapp_marketing_consent(_store_id uuid, _customer_id uuid, _opted_in boolean, _source text default 'manual')
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.customers c where c.id=_customer_id and c.store_id=_store_id) then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0001'; end if;
  insert into private.customer_channel_consents(store_id,customer_id,channel,purpose,opted_in,source,captured_at,revoked_at)
  values(_store_id,_customer_id,'whatsapp','marketing',coalesce(_opted_in,false),left(coalesce(nullif(btrim(_source),''),'manual'),80),case when coalesce(_opted_in,false) then now() end,case when not coalesce(_opted_in,false) then now() end)
  on conflict(store_id,customer_id,channel,purpose)
  do update set opted_in=excluded.opted_in,source=excluded.source,
    captured_at=case when excluded.opted_in then now() else private.customer_channel_consents.captured_at end,
    revoked_at=case when not excluded.opted_in then now() else null end,updated_at=now();
  return true;
end;
$function$;

create or replace function private.queue_whatsapp_dispatch(
  _store_id uuid, _customer_id uuid, _purpose text, _template_id uuid,
  _campaign_id uuid default null, _automation_job_id uuid default null,
  _variables jsonb default '{}'::jsonb, _idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _customer public.customers%rowtype;
  _template public.store_message_templates%rowtype;
  _provider text;
  _phone text;
  _message_id uuid;
begin
  perform private.require_store_entitlement(_store_id,'whatsapp_automation');
  if _purpose not in ('transactional','marketing') then raise exception 'INVALID_MESSAGE_PURPOSE' using errcode='P0001'; end if;
  select * into _customer from public.customers c where c.id=_customer_id and c.store_id=_store_id;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0001'; end if;
  _phone := private.normalize_whatsapp_e164(_customer.phone);
  select * into _template from public.store_message_templates t where t.id=_template_id and t.store_id=_store_id and t.channel='whatsapp' and t.is_active;
  if not found then raise exception 'MESSAGE_TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;
  if _template.purpose <> _purpose then raise exception 'MESSAGE_TEMPLATE_PURPOSE_MISMATCH' using errcode='P0001'; end if;
  if _template.provider_status <> 'approved' or _template.provider_template_name is null then raise exception 'MESSAGE_TEMPLATE_NOT_PROVIDER_APPROVED' using errcode='P0001'; end if;
  if _purpose='marketing' and not exists(
    select 1 from private.customer_channel_consents c
    where c.store_id=_store_id and c.customer_id=_customer_id and c.channel='whatsapp' and c.purpose='marketing' and c.opted_in
  ) then raise exception 'WHATSAPP_MARKETING_OPT_IN_REQUIRED' using errcode='P0001'; end if;
  _provider := private.resolve_whatsapp_provider(_store_id);
  if _provider is null then raise exception 'WHATSAPP_PROVIDER_NOT_CONNECTED' using errcode='P0001'; end if;
  if not private.is_store_usage_allowed(_store_id,_provider,'whatsapp_automation','messages',1) then raise exception 'WHATSAPP_USAGE_LIMIT_REACHED' using errcode='P0001'; end if;
  if _idempotency_key is not null then
    select m.id into _message_id from private.outbound_messages m where m.store_id=_store_id and m.idempotency_key=_idempotency_key;
    if found then return _message_id; end if;
  end if;
  insert into private.outbound_messages(store_id,customer_id,campaign_id,template_id,automation_job_id,channel,purpose,recipient_e164,provider,status,body_snapshot,variables,idempotency_key)
  values(_store_id,_customer_id,_campaign_id,_template_id,_automation_job_id,'whatsapp',_purpose,_phone,_provider,'queued',_template.body,coalesce(_variables,'{}'::jsonb),_idempotency_key)
  returning id into _message_id;
  return _message_id;
exception when unique_violation then
  if _idempotency_key is not null then
    select m.id into _message_id from private.outbound_messages m where m.store_id=_store_id and m.idempotency_key=_idempotency_key;
    if _message_id is not null then return _message_id; end if;
  end if;
  raise;
end;
$function$;

create or replace function private.emit_store_automation_event(_store_id uuid, _event_code text, _payload jsonb default '{}'::jsonb, _dedupe_key text default null)
returns integer
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare _rule record; _count integer := 0; _job_dedupe text;
begin
  for _rule in select r.id,r.action_code,r.config from public.store_automation_rules r where r.store_id=_store_id and r.event_code=_event_code and r.is_enabled loop
    _job_dedupe := case when _dedupe_key is null then null else _dedupe_key || ':rule:' || _rule.id::text end;
    perform private.enqueue_automation_job(_store_id,_rule.id,_event_code,_rule.action_code,coalesce(_payload,'{}'::jsonb) || jsonb_build_object('rule_config',coalesce(_rule.config,'{}'::jsonb)),_job_dedupe,now(),5);
    _count := _count + 1;
  end loop;
  return _count;
end;
$function$;

create or replace function private.capture_customer_created_automation()
returns trigger language plpgsql security definer set search_path to 'public','private','pg_temp'
as $function$
begin
  begin
    perform private.emit_store_automation_event(new.store_id,'novo_cliente',jsonb_build_object('customer_id',new.id),'customer:'||new.id::text||':novo_cliente');
  exception when others then
    insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
    values(new.store_id,'novo_cliente','customers',new.id,sqlstate,left(sqlerrm,500),jsonb_build_object('customer_id',new.id));
  end;
  return new;
end;
$function$;

create or replace function private.capture_order_completed_automation()
returns trigger language plpgsql security definer set search_path to 'public','private','pg_temp'
as $function$
begin
  if new.status in ('entregue'::public.order_status,'retirado'::public.order_status)
     and old.status is distinct from new.status
     and old.status not in ('entregue'::public.order_status,'retirado'::public.order_status) then
    begin
      perform private.emit_store_automation_event(new.store_id,'pedido_concluido',jsonb_build_object('order_id',new.id,'customer_id',new.customer_id,'status',new.status::text),'order:'||new.id::text||':pedido_concluido');
    exception when others then
      insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
      values(new.store_id,'pedido_concluido','orders',new.id,sqlstate,left(sqlerrm,500),jsonb_build_object('order_id',new.id,'customer_id',new.customer_id,'status',new.status::text));
    end;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_customer_created_automation on public.customers;
create trigger trg_customer_created_automation after insert on public.customers for each row execute function private.capture_customer_created_automation();
drop trigger if exists trg_order_completed_automation on public.orders;
create trigger trg_order_completed_automation after update of status on public.orders for each row execute function private.capture_order_completed_automation();

create or replace function public.save_store_automation_rule(_store_id uuid, _id uuid, _event_code text, _name text, _enabled boolean, _config jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare result_id uuid; _access jsonb; _mode text; _action_code text; _template_id uuid;
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  _access := public.get_store_billing_access(_store_id);
  if not coalesce((_access->>'can_use_growth')::boolean, true) then raise exception 'BILLING_RESTRICTED' using errcode='P0001', detail=jsonb_build_object('stage',_access->>'stage','capability','growth')::text; end if;
  if _event_code not in ('novo_cliente','pedido_concluido','cliente_inativo_30d','cliente_vip') then raise exception 'invalid_event'; end if;
  _mode := coalesce(nullif(_config->>'mode',''),'assisted');
  if _mode not in ('assisted','automatic') then raise exception 'INVALID_AUTOMATION_MODE' using errcode='P0001'; end if;
  _action_code := case when _mode='automatic' then 'send_whatsapp_template' else 'sugerir_whatsapp' end;
  if _mode='automatic' then
    perform private.require_store_entitlement(_store_id,'whatsapp_automation');
    begin _template_id := (_config->>'template_id')::uuid; exception when others then _template_id := null; end;
    if _template_id is null or not exists(select 1 from public.store_message_templates t where t.id=_template_id and t.store_id=_store_id and t.channel='whatsapp' and t.is_active) then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;
  end if;
  if _id is null then
    insert into public.store_automation_rules(store_id,event_code,action_code,name,is_enabled,config)
    values(_store_id,_event_code,_action_code,trim(_name),coalesce(_enabled,true),coalesce(_config,'{}'::jsonb)) returning id into result_id;
  else
    update public.store_automation_rules set event_code=_event_code,action_code=_action_code,name=trim(_name),is_enabled=coalesce(_enabled,true),config=coalesce(_config,'{}'::jsonb),updated_at=now()
    where id=_id and store_id=_store_id returning id into result_id;
    if result_id is null then raise exception 'rule_not_found'; end if;
  end if;
  return result_id;
end;
$function$;

revoke all on function public.get_store_whatsapp_readiness(uuid) from public, anon;
grant execute on function public.get_store_whatsapp_readiness(uuid) to authenticated, service_role;
revoke all on function public.list_store_message_templates(uuid) from public, anon;
grant execute on function public.list_store_message_templates(uuid) to authenticated, service_role;
revoke all on function public.save_store_message_template(uuid,uuid,text,text,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.save_store_message_template(uuid,uuid,text,text,text,text,text,text,text,boolean) to authenticated, service_role;
revoke all on function public.set_customer_whatsapp_marketing_consent(uuid,uuid,boolean,text) from public, anon;
grant execute on function public.set_customer_whatsapp_marketing_consent(uuid,uuid,boolean,text) to authenticated, service_role;
revoke all on function private.normalize_whatsapp_e164(text) from public, anon, authenticated;
revoke all on function private.resolve_whatsapp_provider(uuid) from public, anon, authenticated;
revoke all on function private.queue_whatsapp_dispatch(uuid,uuid,text,uuid,uuid,uuid,jsonb,text) from public, anon, authenticated;
revoke all on function private.emit_store_automation_event(uuid,text,jsonb,text) from public, anon, authenticated;
revoke all on function private.capture_customer_created_automation() from public, anon, authenticated;
revoke all on function private.capture_order_completed_automation() from public, anon, authenticated;
