create or replace function private.resolve_whatsapp_provider(_store_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
  select a.provider
  from private.integration_provider_accounts a
  where a.store_id = _store_id
    and a.status = 'connected'
    and a.provider in ('evolution_api','meta_whatsapp','360dialog_whatsapp','twilio_whatsapp')
  order by case a.provider
             when 'evolution_api' then 0
             when 'meta_whatsapp' then 1
             when '360dialog_whatsapp' then 2
             else 3
           end,
           a.connected_at desc nulls last
  limit 1
$$;

create or replace function private.queue_whatsapp_dispatch(
  _store_id uuid,
  _customer_id uuid,
  _purpose text,
  _template_id uuid,
  _campaign_id uuid default null,
  _automation_job_id uuid default null,
  _variables jsonb default '{}'::jsonb,
  _idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
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

  select * into _template
  from public.store_message_templates t
  where t.id=_template_id and t.store_id=_store_id and t.channel='whatsapp' and t.is_active;
  if not found then raise exception 'MESSAGE_TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;
  if _template.purpose <> _purpose then raise exception 'MESSAGE_TEMPLATE_PURPOSE_MISMATCH' using errcode='P0001'; end if;

  if _campaign_id is not null and not exists(
    select 1 from public.store_marketing_campaigns c where c.id=_campaign_id and c.store_id=_store_id
  ) then raise exception 'CAMPAIGN_NOT_FOUND' using errcode='P0001'; end if;

  if _automation_job_id is not null and not exists(
    select 1 from private.automation_jobs j where j.id=_automation_job_id and j.store_id=_store_id
  ) then raise exception 'AUTOMATION_JOB_NOT_FOUND' using errcode='P0001'; end if;

  if _purpose='marketing' and not exists(
    select 1 from private.customer_channel_consents c
    where c.store_id=_store_id and c.customer_id=_customer_id
      and c.channel='whatsapp' and c.purpose='marketing' and c.opted_in
  ) then raise exception 'WHATSAPP_MARKETING_OPT_IN_REQUIRED' using errcode='P0001'; end if;

  _provider := private.resolve_whatsapp_provider(_store_id);
  if _provider is null then raise exception 'WHATSAPP_PROVIDER_NOT_CONNECTED' using errcode='P0001'; end if;

  if _provider <> 'evolution_api' and (
    _template.provider_status <> 'approved' or _template.provider_template_name is null
  ) then
    raise exception 'MESSAGE_TEMPLATE_NOT_PROVIDER_APPROVED' using errcode='P0001';
  end if;

  if not private.is_store_usage_allowed(_store_id,_provider,'whatsapp_automation','messages',1) then
    raise exception 'WHATSAPP_USAGE_LIMIT_REACHED' using errcode='P0001';
  end if;

  if _idempotency_key is not null then
    select m.id into _message_id
    from private.outbound_messages m
    where m.store_id=_store_id and m.idempotency_key=_idempotency_key;
    if found then return _message_id; end if;
  end if;

  insert into private.outbound_messages(
    store_id,customer_id,campaign_id,template_id,automation_job_id,channel,purpose,
    recipient_e164,provider,status,body_snapshot,variables,idempotency_key
  ) values(
    _store_id,_customer_id,_campaign_id,_template_id,_automation_job_id,'whatsapp',_purpose,
    _phone,_provider,'queued',_template.body,coalesce(_variables,'{}'::jsonb),_idempotency_key
  ) returning id into _message_id;

  return _message_id;
exception when unique_violation then
  if _idempotency_key is not null then
    select m.id into _message_id
    from private.outbound_messages m
    where m.store_id=_store_id and m.idempotency_key=_idempotency_key;
    if _message_id is not null then return _message_id; end if;
  end if;
  raise;
end;
$$;

create or replace function public.prepare_whatsapp_automation_job(_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','vault','pg_temp'
as $$
declare
  _job private.automation_jobs%rowtype;
  _template public.store_message_templates%rowtype;
  _customer_id uuid;
  _template_id uuid;
  _campaign_id uuid;
  _message_id uuid;
  _message private.outbound_messages%rowtype;
  _account private.integration_provider_accounts%rowtype;
  _context jsonb;
  _variables jsonb := '{}'::jsonb;
  _phone_number_id text;
  _waba_id text;
  _graph_version text;
  _instance_name text;
begin
  select * into _job from private.automation_jobs j where j.id=_job_id for update;
  if not found then raise exception 'AUTOMATION_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if _job.status <> 'processing' or _job.action_code <> 'send_whatsapp_template' then raise exception 'AUTOMATION_JOB_NOT_PROCESSING' using errcode='P0001'; end if;

  begin _template_id := (_job.payload->'rule_config'->>'template_id')::uuid; exception when others then _template_id := null; end;
  begin _campaign_id := nullif(_job.payload->>'campaign_id','')::uuid; exception when others then _campaign_id := null; end;
  if _template_id is null then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;

  select * into _template from public.store_message_templates t
  where t.id=_template_id and t.store_id=_job.store_id and t.channel='whatsapp' and t.is_active;
  if not found then raise exception 'MESSAGE_TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;

  _context := private.resolve_whatsapp_automation_context(
    _job.store_id,_job.event_code,coalesce(_job.payload,'{}'::jsonb),
    coalesce(_job.payload->'rule_config','{}'::jsonb),_template.body
  );
  begin _customer_id := (_context->>'customer_id')::uuid; exception when others then _customer_id := null; end;
  if _customer_id is null then raise exception 'CUSTOMER_REQUIRED' using errcode='P0001'; end if;
  _variables := coalesce(_context->'variables','{}'::jsonb);

  _message_id := private.queue_whatsapp_dispatch(
    _job.store_id,_customer_id,_template.purpose,_template.id,_campaign_id,_job.id,_variables,
    'automation-job:'||_job.id::text
  );

  select * into _message from private.outbound_messages m where m.id=_message_id for update;
  if not found then raise exception 'OUTBOUND_MESSAGE_NOT_FOUND' using errcode='P0001'; end if;
  if _message.provider not in ('meta_whatsapp','evolution_api') then
    raise exception 'WHATSAPP_PROVIDER_NOT_SUPPORTED_BY_WORKER' using errcode='P0001';
  end if;

  select * into _account from private.integration_provider_accounts a
  where a.store_id=_job.store_id and a.provider=_message.provider and a.status='connected'
  order by a.connected_at desc nulls last,a.created_at desc limit 1;
  if not found then raise exception 'WHATSAPP_PROVIDER_NOT_CONNECTED' using errcode='P0001'; end if;

  if _message.provider='meta_whatsapp' then
    if _account.credential_ref is null or btrim(_account.credential_ref)='' then raise exception 'WHATSAPP_PROVIDER_CREDENTIAL_MISSING' using errcode='P0001'; end if;
    _phone_number_id := nullif(btrim(_account.public_config->>'phone_number_id'),'');
    _waba_id := nullif(btrim(coalesce(_account.public_config->>'waba_id',_account.external_account_id)),'');
    _graph_version := nullif(btrim(_account.public_config->>'graph_api_version'),'');
    if _phone_number_id is null or _phone_number_id !~ '^[0-9]{5,30}$' then raise exception 'WHATSAPP_PHONE_NUMBER_ID_MISSING' using errcode='P0001'; end if;
    if _graph_version is null or _graph_version !~ '^v[0-9]{1,3}\.[0-9]{1,2}$' then raise exception 'WHATSAPP_GRAPH_VERSION_MISSING' using errcode='P0001'; end if;
  else
    _instance_name := nullif(btrim(coalesce(_account.public_config->>'instance_name',_account.external_account_id)),'');
    if _instance_name is null or _instance_name !~ '^[A-Za-z0-9_.:-]{1,80}$' then
      raise exception 'EVOLUTION_INSTANCE_NAME_MISSING' using errcode='P0001';
    end if;
  end if;

  update private.outbound_messages set status='sending',error_code=null,error_message=null,updated_at=now()
  where id=_message.id and status in ('queued','sending');

  return jsonb_build_object(
    'job_id',_job.id,'store_id',_job.store_id,'message_id',_message.id,
    'recipient_e164',_message.recipient_e164,'provider',_message.provider,'purpose',_message.purpose,
    'template_id',_template.id,'template_name',_template.provider_template_name,
    'template_language',_template.provider_language,'template_body',_message.body_snapshot,
    'variables',coalesce(_message.variables,'{}'::jsonb),
    'credential_ref',_account.credential_ref,'phone_number_id',_phone_number_id,'waba_id',_waba_id,
    'graph_api_version',_graph_version,'instance_name',_instance_name,
    'attempt_count',_job.attempt_count,'max_attempts',_job.max_attempts
  );
end;
$$;

create or replace function public.get_store_whatsapp_readiness(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _provider text;
  _entitled boolean;
  _approved_templates integer;
  _active_templates integer;
  _total_templates integer;
  _ready_templates integer;
begin
  perform private.require_growth_access(_store_id);
  _provider := private.resolve_whatsapp_provider(_store_id);
  _entitled := private.store_has_entitlement(_store_id,'whatsapp_automation');

  select count(*),
         count(*) filter (where t.provider_status='approved' and t.is_active),
         count(*) filter (where t.is_active)
  into _total_templates,_approved_templates,_active_templates
  from public.store_message_templates t
  where t.store_id=_store_id and t.channel='whatsapp';

  _ready_templates := case when _provider='evolution_api' then coalesce(_active_templates,0) else coalesce(_approved_templates,0) end;

  return jsonb_build_object(
    'assisted_available', true,
    'automatic_entitled', _entitled,
    'provider_connected', _provider is not null,
    'provider', _provider,
    'templates_total', coalesce(_total_templates,0),
    'templates_approved', coalesce(_approved_templates,0),
    'templates_ready', _ready_templates,
    'requires_provider_template_approval', coalesce(_provider <> 'evolution_api',true),
    'ready_for_automatic', (_entitled and _provider is not null and _ready_templates > 0)
  );
end;
$$;

create or replace function public.backend_upsert_evolution_whatsapp_account(
  _store_id uuid,
  _instance_name text,
  _status text,
  _display_phone_number text default null,
  _last_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_instance text := btrim(coalesce(_instance_name,''));
  v_status text := lower(btrim(coalesce(_status,'')));
  v_account private.integration_provider_accounts%rowtype;
begin
  if not exists(select 1 from public.stores s where s.id=_store_id) then
    raise exception 'STORE_NOT_FOUND' using errcode='22023';
  end if;
  if v_instance !~ '^[A-Za-z0-9_.:-]{1,80}$' then
    raise exception 'INVALID_EVOLUTION_INSTANCE_NAME' using errcode='22023';
  end if;
  if v_status not in ('disconnected','pending','connected','degraded','disabled') then
    raise exception 'INVALID_PROVIDER_STATUS' using errcode='22023';
  end if;

  insert into private.integration_provider_accounts(
    store_id,provider,connection_key,external_account_id,status,credential_ref,public_config,
    connected_at,last_health_at,last_error,updated_at
  ) values(
    _store_id,'evolution_api','whatsapp_primary',v_instance,v_status,null,
    jsonb_strip_nulls(jsonb_build_object(
      'instance_name',v_instance,
      'display_phone_number',nullif(btrim(coalesce(_display_phone_number,'')),''),
      'connection_type','WHATSAPP-BAILEYS',
      'license_tier','community'
    )),
    case when v_status='connected' then now() else null end,
    now(),nullif(left(coalesce(_last_error,''),500),''),now()
  )
  on conflict (store_id,provider,connection_key) where store_id is not null do update
  set external_account_id=excluded.external_account_id,
      status=excluded.status,
      credential_ref=null,
      public_config=excluded.public_config,
      connected_at=case
        when excluded.status='connected' then coalesce(private.integration_provider_accounts.connected_at,now())
        else private.integration_provider_accounts.connected_at
      end,
      last_health_at=now(),
      last_error=excluded.last_error,
      updated_at=now()
  returning * into v_account;

  return jsonb_build_object(
    'store_id',v_account.store_id,
    'provider',v_account.provider,
    'instance_name',v_account.external_account_id,
    'status',v_account.status,
    'connected_at',v_account.connected_at,
    'last_health_at',v_account.last_health_at,
    'last_error',v_account.last_error
  );
end;
$$;

revoke all on function public.backend_upsert_evolution_whatsapp_account(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.backend_upsert_evolution_whatsapp_account(uuid,text,text,text,text) to service_role;
