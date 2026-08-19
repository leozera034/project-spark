create or replace function public.save_store_message_template(
  _store_id uuid,
  _id uuid,
  _code text,
  _name text,
  _purpose text,
  _body text,
  _provider_template_name text default null,
  _provider_language text default 'pt_BR',
  _provider_status text default 'draft',
  _is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _result uuid;
  _code_n text;
  _name_n text;
  _body_n text;
  _existing public.store_message_templates%rowtype;
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  _code_n := lower(btrim(coalesce(_code,'')));
  _name_n := btrim(coalesce(_name,''));
  _body_n := btrim(coalesce(_body,''));
  if _code_n !~ '^[a-z0-9_.-]+$' then raise exception 'INVALID_TEMPLATE_CODE' using errcode='P0001'; end if;
  if char_length(_name_n) not between 2 and 120 then raise exception 'INVALID_TEMPLATE_NAME' using errcode='P0001'; end if;
  if char_length(_body_n) not between 1 and 4096 then raise exception 'INVALID_TEMPLATE_BODY' using errcode='P0001'; end if;
  if _purpose not in ('transactional','marketing') then raise exception 'INVALID_TEMPLATE_PURPOSE' using errcode='P0001'; end if;
  if coalesce(_provider_status,'draft') <> 'draft' then raise exception 'PROVIDER_STATUS_BACKEND_ONLY' using errcode='P0001'; end if;

  if _id is null then
    insert into public.store_message_templates(store_id,code,name,purpose,body,provider_template_name,provider_language,provider_status,is_active)
    values(_store_id,_code_n,_name_n,_purpose,_body_n,nullif(btrim(coalesce(_provider_template_name,'')),''),coalesce(nullif(btrim(_provider_language),''),'pt_BR'),'draft',coalesce(_is_active,true))
    returning id into _result;
  else
    select * into _existing from public.store_message_templates t where t.id=_id and t.store_id=_store_id for update;
    if not found then raise exception 'TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;
    update public.store_message_templates
    set code=_code_n,name=_name_n,purpose=_purpose,body=_body_n,
        provider_template_name=nullif(btrim(coalesce(_provider_template_name,'')),''),
        provider_language=coalesce(nullif(btrim(_provider_language),''),'pt_BR'),
        provider_status=case
          when _existing.body is distinct from _body_n
            or _existing.purpose is distinct from _purpose
            or _existing.provider_template_name is distinct from nullif(btrim(coalesce(_provider_template_name,'')),'')
            or _existing.provider_language is distinct from coalesce(nullif(btrim(_provider_language),''),'pt_BR')
          then 'draft'
          else _existing.provider_status
        end,
        is_active=coalesce(_is_active,true),updated_at=now()
    where id=_id and store_id=_store_id
    returning id into _result;
  end if;
  return _result;
end;
$function$;

create or replace function private.set_message_template_provider_status(
  _store_id uuid,_template_id uuid,_provider_template_name text,_provider_language text,_status text
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  if _status not in ('pending','approved','rejected') then raise exception 'INVALID_TEMPLATE_PROVIDER_STATUS' using errcode='P0001'; end if;
  update public.store_message_templates
  set provider_template_name=nullif(btrim(coalesce(_provider_template_name,'')),''),
      provider_language=coalesce(nullif(btrim(coalesce(_provider_language,'')),''),'pt_BR'),
      provider_status=_status,updated_at=now()
  where id=_template_id and store_id=_store_id;
  if not found then raise exception 'TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;
  return true;
end;
$function$;

create or replace function private.capture_customer_created_automation()
returns trigger language plpgsql security definer set search_path to 'public','private','pg_temp'
as $function$
begin
  begin
    perform private.emit_store_automation_event(new.store_id,'novo_cliente',jsonb_build_object('customer_id',new.id),'customer:'||new.id::text||':novo_cliente');
  exception when others then
    begin
      insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
      values(new.store_id,'novo_cliente','customers',new.id,sqlstate,left(sqlerrm,500),jsonb_build_object('customer_id',new.id));
    exception when others then null; end;
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
      begin
        insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
        values(new.store_id,'pedido_concluido','orders',new.id,sqlstate,left(sqlerrm,500),jsonb_build_object('order_id',new.id,'customer_id',new.customer_id,'status',new.status::text));
      exception when others then null; end;
    end;
  end if;
  return new;
end;
$function$;

create or replace function private.queue_whatsapp_dispatch(
  _store_id uuid,_customer_id uuid,_purpose text,_template_id uuid,
  _campaign_id uuid default null,_automation_job_id uuid default null,
  _variables jsonb default '{}'::jsonb,_idempotency_key text default null
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
  if _campaign_id is not null and not exists(select 1 from public.store_marketing_campaigns c where c.id=_campaign_id and c.store_id=_store_id) then raise exception 'CAMPAIGN_NOT_FOUND' using errcode='P0001'; end if;
  if _automation_job_id is not null and not exists(select 1 from private.automation_jobs j where j.id=_automation_job_id and j.store_id=_store_id) then raise exception 'AUTOMATION_JOB_NOT_FOUND' using errcode='P0001'; end if;
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

create or replace function public.save_store_automation_rule(
  _store_id uuid,_id uuid,_event_code text,_name text,_enabled boolean,_config jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  result_id uuid;
  _access jsonb;
  _mode text;
  _action_code text;
  _template_id uuid;
  _template public.store_message_templates%rowtype;
  _provider text;
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
    if _template_id is null then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;
    select * into _template from public.store_message_templates t where t.id=_template_id and t.store_id=_store_id and t.channel='whatsapp' and t.is_active;
    if not found then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;
    if coalesce(_enabled,true) then
      if _template.provider_status <> 'approved' or _template.provider_template_name is null then raise exception 'MESSAGE_TEMPLATE_NOT_PROVIDER_APPROVED' using errcode='P0001'; end if;
      _provider := private.resolve_whatsapp_provider(_store_id);
      if _provider is null then raise exception 'WHATSAPP_PROVIDER_NOT_CONNECTED' using errcode='P0001'; end if;
    end if;
  end if;
  if _id is null then
    insert into public.store_automation_rules(store_id,event_code,action_code,name,is_enabled,config)
    values(_store_id,_event_code,_action_code,trim(_name),coalesce(_enabled,true),coalesce(_config,'{}'::jsonb)) returning id into result_id;
  else
    update public.store_automation_rules
    set event_code=_event_code,action_code=_action_code,name=trim(_name),is_enabled=coalesce(_enabled,true),config=coalesce(_config,'{}'::jsonb),updated_at=now()
    where id=_id and store_id=_store_id returning id into result_id;
    if result_id is null then raise exception 'rule_not_found'; end if;
  end if;
  return result_id;
end;
$function$;

revoke all on function private.set_message_template_provider_status(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function private.set_message_template_provider_status(uuid,uuid,text,text,text) to service_role;
