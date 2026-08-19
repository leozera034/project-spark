alter table public.store_message_templates
  add column if not exists provider_template_id text,
  add column if not exists provider_rejection_reason text,
  add column if not exists provider_status_updated_at timestamptz;

create table if not exists private.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'meta_whatsapp' check (provider = 'meta_whatsapp'),
  event_key text not null unique,
  event_type text not null,
  external_id text,
  processing_status text not null default 'processing' check (processing_status in ('processing','processed','ignored','failed')),
  payload_summary jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_webhook_events_received_idx
  on private.whatsapp_webhook_events(received_at desc);

create or replace function public.claim_whatsapp_automation_jobs(
  _worker_id text,
  _limit integer default 10
)
returns table(
  id uuid,
  store_id uuid,
  event_code text,
  action_code text,
  payload jsonb,
  attempt_count integer,
  max_attempts integer
)
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _worker text := left(nullif(btrim(_worker_id),''),120);
  _take integer := greatest(1,least(coalesce(_limit,10),50));
  _ambiguous_ids uuid[];
begin
  if _worker is null or _worker !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'INVALID_WORKER_ID' using errcode='P0001';
  end if;

  select array_agg(j.id)
  into _ambiguous_ids
  from private.automation_jobs j
  where j.action_code='send_whatsapp_template'
    and j.status='processing'
    and j.locked_at < now() - interval '10 minutes'
    and exists(
      select 1 from private.outbound_messages m
      where m.automation_job_id=j.id
        and m.status='sending'
        and m.provider_message_id is null
    );

  if coalesce(array_length(_ambiguous_ids,1),0) > 0 then
    update private.outbound_messages m
    set status='failed', failed_at=coalesce(m.failed_at,now()),
        error_code='AMBIGUOUS_DISPATCH',
        error_message='Worker lease expired after provider dispatch started; automatic retry blocked to avoid duplicate WhatsApp messages.',
        updated_at=now()
    where m.automation_job_id = any(_ambiguous_ids)
      and m.status='sending'
      and m.provider_message_id is null;

    update private.automation_jobs j
    set status='failed', locked_at=null, locked_by=null,
        last_error='AMBIGUOUS_DISPATCH', updated_at=now()
    where j.id = any(_ambiguous_ids);
  end if;

  update private.automation_jobs j
  set status = case when j.attempt_count < j.max_attempts then 'queued' else 'failed' end,
      available_at = case when j.attempt_count < j.max_attempts then now() else j.available_at end,
      locked_at=null,
      locked_by=null,
      last_error=case when j.attempt_count < j.max_attempts then 'WORKER_LEASE_EXPIRED' else 'MAX_ATTEMPTS_REACHED' end,
      updated_at=now()
  where j.action_code='send_whatsapp_template'
    and j.status='processing'
    and j.locked_at < now() - interval '10 minutes'
    and not (j.id = any(coalesce(_ambiguous_ids,array[]::uuid[])));

  return query
  with candidates as (
    select j.id
    from private.automation_jobs j
    where j.action_code='send_whatsapp_template'
      and j.status='queued'
      and j.available_at <= now()
      and j.attempt_count < j.max_attempts
    order by j.priority asc,j.available_at asc,j.created_at asc
    for update skip locked
    limit _take
  ), claimed as (
    update private.automation_jobs j
    set status='processing',
        locked_at=now(),
        locked_by=_worker,
        attempt_count=j.attempt_count+1,
        updated_at=now()
    from candidates c
    where j.id=c.id
    returning j.id,j.store_id,j.event_code,j.action_code,j.payload,j.attempt_count,j.max_attempts
  )
  select c.id,c.store_id,c.event_code,c.action_code,c.payload,c.attempt_count,c.max_attempts
  from claimed c;
end;
$function$;

revoke all on function public.claim_whatsapp_automation_jobs(text,integer) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_automation_jobs(text,integer) to service_role;

create or replace function public.prepare_whatsapp_automation_job(_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','vault','pg_temp'
as $function$
declare
  _job private.automation_jobs%rowtype;
  _template public.store_message_templates%rowtype;
  _customer_id uuid;
  _template_id uuid;
  _campaign_id uuid;
  _message_id uuid;
  _message private.outbound_messages%rowtype;
  _account private.integration_provider_accounts%rowtype;
  _variables jsonb := '{}'::jsonb;
  _phone_number_id text;
  _waba_id text;
  _graph_version text;
begin
  select * into _job from private.automation_jobs j where j.id=_job_id for update;
  if not found then raise exception 'AUTOMATION_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if _job.status <> 'processing' or _job.action_code <> 'send_whatsapp_template' then
    raise exception 'AUTOMATION_JOB_NOT_PROCESSING' using errcode='P0001';
  end if;

  begin _customer_id := (_job.payload->>'customer_id')::uuid; exception when others then _customer_id := null; end;
  begin _template_id := (_job.payload->'rule_config'->>'template_id')::uuid; exception when others then _template_id := null; end;
  begin _campaign_id := nullif(_job.payload->>'campaign_id','')::uuid; exception when others then _campaign_id := null; end;

  if _customer_id is null then raise exception 'CUSTOMER_REQUIRED' using errcode='P0001'; end if;
  if _template_id is null then raise exception 'MESSAGE_TEMPLATE_REQUIRED' using errcode='P0001'; end if;

  select * into _template
  from public.store_message_templates t
  where t.id=_template_id and t.store_id=_job.store_id and t.channel='whatsapp' and t.is_active;
  if not found then raise exception 'MESSAGE_TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;

  if jsonb_typeof(_job.payload->'rule_config'->'variables')='object' then
    _variables := _job.payload->'rule_config'->'variables';
  end if;

  _message_id := private.queue_whatsapp_dispatch(
    _job.store_id,
    _customer_id,
    _template.purpose,
    _template.id,
    _campaign_id,
    _job.id,
    _variables,
    'automation-job:'||_job.id::text
  );

  select * into _message from private.outbound_messages m where m.id=_message_id for update;
  if not found then raise exception 'OUTBOUND_MESSAGE_NOT_FOUND' using errcode='P0001'; end if;
  if _message.provider <> 'meta_whatsapp' then
    raise exception 'WHATSAPP_PROVIDER_NOT_SUPPORTED_BY_META_WORKER' using errcode='P0001';
  end if;

  select * into _account
  from private.integration_provider_accounts a
  where a.store_id=_job.store_id
    and a.provider='meta_whatsapp'
    and a.status='connected'
  order by a.connected_at desc nulls last,a.created_at desc
  limit 1;
  if not found then raise exception 'WHATSAPP_PROVIDER_NOT_CONNECTED' using errcode='P0001'; end if;
  if _account.credential_ref is null or btrim(_account.credential_ref)='' then
    raise exception 'WHATSAPP_PROVIDER_CREDENTIAL_MISSING' using errcode='P0001';
  end if;

  _phone_number_id := nullif(btrim(_account.public_config->>'phone_number_id'),'');
  _waba_id := nullif(btrim(coalesce(_account.public_config->>'waba_id',_account.external_account_id)),'');
  _graph_version := nullif(btrim(_account.public_config->>'graph_api_version'),'');

  if _phone_number_id is null or _phone_number_id !~ '^[0-9]{5,30}$' then
    raise exception 'WHATSAPP_PHONE_NUMBER_ID_MISSING' using errcode='P0001';
  end if;
  if _graph_version is null or _graph_version !~ '^v[0-9]{1,3}\.[0-9]{1,2}$' then
    raise exception 'WHATSAPP_GRAPH_VERSION_MISSING' using errcode='P0001';
  end if;

  update private.outbound_messages
  set status='sending',error_code=null,error_message=null,updated_at=now()
  where id=_message.id and status in ('queued','sending');

  return jsonb_build_object(
    'job_id',_job.id,
    'store_id',_job.store_id,
    'message_id',_message.id,
    'recipient_e164',_message.recipient_e164,
    'provider',_message.provider,
    'purpose',_message.purpose,
    'template_id',_template.id,
    'template_name',_template.provider_template_name,
    'template_language',_template.provider_language,
    'variables',coalesce(_message.variables,'{}'::jsonb),
    'credential_ref',_account.credential_ref,
    'phone_number_id',_phone_number_id,
    'waba_id',_waba_id,
    'graph_api_version',_graph_version,
    'attempt_count',_job.attempt_count,
    'max_attempts',_job.max_attempts
  );
end;
$function$;

revoke all on function public.prepare_whatsapp_automation_job(uuid) from public,anon,authenticated;
grant execute on function public.prepare_whatsapp_automation_job(uuid) to service_role;

create or replace function public.get_meta_whatsapp_access_token(_store_id uuid,_credential_ref text)
returns text
language plpgsql
security definer
set search_path to 'public','private','vault','pg_temp'
as $function$
declare
  _secret_id uuid;
  _token text;
begin
  if not exists(
    select 1 from private.integration_provider_accounts a
    where a.store_id=_store_id
      and a.provider='meta_whatsapp'
      and a.status='connected'
      and a.credential_ref=_credential_ref
  ) then
    raise exception 'WHATSAPP_PROVIDER_CREDENTIAL_NOT_AUTHORIZED' using errcode='P0001';
  end if;

  begin _secret_id := _credential_ref::uuid; exception when others then _secret_id := null; end;
  if _secret_id is null then raise exception 'WHATSAPP_PROVIDER_CREDENTIAL_INVALID' using errcode='P0001'; end if;

  select ds.decrypted_secret into _token
  from vault.decrypted_secrets ds
  where ds.id=_secret_id;

  if _token is null or btrim(_token)='' then raise exception 'WHATSAPP_PROVIDER_SECRET_NOT_FOUND' using errcode='P0001'; end if;
  return _token;
end;
$function$;

revoke all on function public.get_meta_whatsapp_access_token(uuid,text) from public,anon,authenticated;
grant execute on function public.get_meta_whatsapp_access_token(uuid,text) to service_role;

create or replace function public.complete_whatsapp_automation_job(
  _job_id uuid,
  _message_id uuid,
  _provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _job private.automation_jobs%rowtype;
  _message private.outbound_messages%rowtype;
begin
  if _provider_message_id is null or length(btrim(_provider_message_id)) < 6 or length(_provider_message_id) > 512 then
    raise exception 'INVALID_PROVIDER_MESSAGE_ID' using errcode='P0001';
  end if;

  select * into _job from private.automation_jobs j where j.id=_job_id for update;
  if not found then raise exception 'AUTOMATION_JOB_NOT_FOUND' using errcode='P0001'; end if;
  select * into _message from private.outbound_messages m where m.id=_message_id and m.automation_job_id=_job_id for update;
  if not found then raise exception 'OUTBOUND_MESSAGE_NOT_FOUND' using errcode='P0001'; end if;

  if _message.provider_message_id is not null and _message.provider_message_id <> _provider_message_id then
    raise exception 'PROVIDER_MESSAGE_ID_CONFLICT' using errcode='P0001';
  end if;

  update private.outbound_messages
  set provider_message_id=_provider_message_id,
      status=case when status in ('delivered','read') then status else 'sent' end,
      sent_at=coalesce(sent_at,now()),
      error_code=null,error_message=null,updated_at=now()
  where id=_message_id;

  perform private.record_integration_usage(
    _message.store_id,_message.provider,'whatsapp_automation','messages',1,0,0,
    'whatsapp:accepted:'||_message.id::text,now(),
    jsonb_build_object('message_id',_message.id,'provider_message_id',_provider_message_id)
  );

  update private.automation_jobs
  set status='succeeded',locked_at=null,locked_by=null,last_error=null,updated_at=now()
  where id=_job_id;

  return true;
end;
$function$;

revoke all on function public.complete_whatsapp_automation_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_whatsapp_automation_job(uuid,uuid,text) to service_role;

create or replace function public.fail_whatsapp_automation_job(
  _job_id uuid,
  _message_id uuid default null,
  _error_code text default 'WORKER_ERROR',
  _error_message text default null,
  _retryable boolean default false
)
returns text
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _job private.automation_jobs%rowtype;
  _retry boolean;
  _delay_seconds integer;
  _safe_code text := left(coalesce(nullif(btrim(_error_code),''),'WORKER_ERROR'),120);
  _safe_message text := left(coalesce(_error_message,''),500);
begin
  select * into _job from private.automation_jobs j where j.id=_job_id for update;
  if not found then raise exception 'AUTOMATION_JOB_NOT_FOUND' using errcode='P0001'; end if;

  _retry := coalesce(_retryable,false) and _job.attempt_count < _job.max_attempts;
  _delay_seconds := least(3600,30 * (2 ^ greatest(_job.attempt_count-1,0))::integer);

  if _message_id is not null then
    if _retry then
      update private.outbound_messages m
      set status='queued',error_code=_safe_code,error_message=_safe_message,updated_at=now()
      where m.id=_message_id and m.automation_job_id=_job_id and m.provider_message_id is null;
    else
      update private.outbound_messages m
      set status=case when m.provider_message_id is null then 'failed' else m.status end,
          failed_at=case when m.provider_message_id is null then coalesce(m.failed_at,now()) else m.failed_at end,
          error_code=_safe_code,error_message=_safe_message,updated_at=now()
      where m.id=_message_id and m.automation_job_id=_job_id;
    end if;
  end if;

  if _retry then
    update private.automation_jobs
    set status='queued',available_at=now()+make_interval(secs=>_delay_seconds),
        locked_at=null,locked_by=null,last_error=_safe_code||case when _safe_message<>'' then ': '||_safe_message else '' end,updated_at=now()
    where id=_job_id;
    return 'queued';
  end if;

  update private.automation_jobs
  set status='failed',locked_at=null,locked_by=null,
      last_error=_safe_code||case when _safe_message<>'' then ': '||_safe_message else '' end,updated_at=now()
  where id=_job_id;
  return 'failed';
end;
$function$;

revoke all on function public.fail_whatsapp_automation_job(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.fail_whatsapp_automation_job(uuid,uuid,text,text,boolean) to service_role;

create or replace function public.claim_meta_whatsapp_webhook_event(
  _event_key text,
  _event_type text,
  _external_id text default null,
  _payload_summary jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _existing private.whatsapp_webhook_events%rowtype;
  _key text := left(nullif(btrim(_event_key),''),512);
  _type text := left(coalesce(nullif(btrim(_event_type),''),'unknown'),120);
begin
  if _key is null then raise exception 'INVALID_WEBHOOK_EVENT_KEY' using errcode='P0001'; end if;

  insert into private.whatsapp_webhook_events(provider,event_key,event_type,external_id,processing_status,payload_summary)
  values('meta_whatsapp',_key,_type,left(_external_id,512),'processing',coalesce(_payload_summary,'{}'::jsonb))
  on conflict(event_key) do nothing;

  if found then return 'process'; end if;

  select * into _existing from private.whatsapp_webhook_events e where e.event_key=_key for update;
  if _existing.processing_status in ('processed','ignored') then return 'duplicate'; end if;
  if _existing.processing_status='processing' and _existing.updated_at > now()-interval '5 minutes' then return 'busy'; end if;

  update private.whatsapp_webhook_events
  set processing_status='processing',last_error=null,payload_summary=coalesce(_payload_summary,'{}'::jsonb),updated_at=now()
  where event_key=_key;
  return 'process';
end;
$function$;

revoke all on function public.claim_meta_whatsapp_webhook_event(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_meta_whatsapp_webhook_event(text,text,text,jsonb) to service_role;

create or replace function public.finalize_meta_whatsapp_webhook_event(
  _event_key text,
  _status text,
  _last_error text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  if _status not in ('processed','ignored','failed') then raise exception 'INVALID_WEBHOOK_STATUS' using errcode='P0001'; end if;
  update private.whatsapp_webhook_events
  set processing_status=_status,
      processed_at=case when _status in ('processed','ignored') then now() else processed_at end,
      last_error=left(_last_error,500),updated_at=now()
  where event_key=_event_key;
  return found;
end;
$function$;

revoke all on function public.finalize_meta_whatsapp_webhook_event(text,text,text) from public,anon,authenticated;
grant execute on function public.finalize_meta_whatsapp_webhook_event(text,text,text) to service_role;

create or replace function public.apply_meta_whatsapp_message_status(
  _provider_message_id text,
  _status text,
  _event_at timestamptz,
  _error_code text default null,
  _error_message text default null,
  _metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _message private.outbound_messages%rowtype;
  _incoming text := lower(coalesce(_status,''));
  _at timestamptz := coalesce(_event_at,now());
  _next text;
begin
  if _incoming not in ('sent','delivered','read','failed') then return false; end if;
  select * into _message
  from private.outbound_messages m
  where m.provider='meta_whatsapp' and m.provider_message_id=_provider_message_id
  for update;
  if not found then return false; end if;

  _next := _message.status;
  if _incoming='read' then _next := 'read';
  elsif _incoming='delivered' and _message.status not in ('read') then _next := 'delivered';
  elsif _incoming='sent' and _message.status in ('queued','sending','sent') then _next := 'sent';
  elsif _incoming='failed' and _message.status not in ('delivered','read') then _next := 'failed';
  end if;

  update private.outbound_messages
  set status=_next,
      sent_at=case when _incoming in ('sent','delivered','read') then coalesce(sent_at,_at) else sent_at end,
      delivered_at=case when _incoming in ('delivered','read') then coalesce(delivered_at,_at) else delivered_at end,
      read_at=case when _incoming='read' then coalesce(read_at,_at) else read_at end,
      failed_at=case when _incoming='failed' and _next='failed' then coalesce(failed_at,_at) else failed_at end,
      error_code=case when _incoming='failed' then left(_error_code,120) else error_code end,
      error_message=case when _incoming='failed' then left(_error_message,500) else error_message end,
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('last_meta_status',_incoming,'last_meta_status_at',_at) || coalesce(_metadata,'{}'::jsonb),
      updated_at=now()
  where id=_message.id;
  return true;
end;
$function$;

revoke all on function public.apply_meta_whatsapp_message_status(text,text,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_meta_whatsapp_message_status(text,text,timestamptz,text,text,jsonb) to service_role;

create or replace function public.apply_meta_whatsapp_template_status(
  _waba_id text,
  _provider_template_id text,
  _template_name text,
  _language text,
  _event text,
  _reason text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _store_id uuid;
  _mapped_status text;
  _count integer;
begin
  select a.store_id into _store_id
  from private.integration_provider_accounts a
  where a.provider='meta_whatsapp'
    and a.status='connected'
    and a.store_id is not null
    and (a.external_account_id=_waba_id or a.public_config->>'waba_id'=_waba_id)
  order by a.connected_at desc nulls last,a.created_at desc
  limit 1;
  if _store_id is null then return 0; end if;

  _mapped_status := case upper(coalesce(_event,''))
    when 'APPROVED' then 'approved'
    when 'REINSTATED' then 'approved'
    when 'PENDING' then 'pending'
    when 'IN_APPEAL' then 'pending'
    else 'rejected'
  end;

  update public.store_message_templates t
  set provider_status=_mapped_status,
      provider_template_id=coalesce(nullif(btrim(_provider_template_id),''),t.provider_template_id),
      provider_rejection_reason=case when _mapped_status='rejected' then left(_reason,500) else null end,
      provider_status_updated_at=now(),
      updated_at=now()
  where t.store_id=_store_id
    and t.channel='whatsapp'
    and t.provider_template_name=_template_name
    and replace(lower(t.provider_language),'-','_')=replace(lower(_language),'-','_');

  get diagnostics _count = row_count;
  return _count;
end;
$function$;

revoke all on function public.apply_meta_whatsapp_template_status(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_meta_whatsapp_template_status(text,text,text,text,text,text) to service_role;
