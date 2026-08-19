alter table public.device_push_tokens
  add column if not exists firebase_installation_id text,
  add column if not exists app_version text,
  add column if not exists app_build text,
  add column if not exists token_refreshed_at timestamptz not null default now(),
  add column if not exists deactivated_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_failure_at timestamptz;

alter table public.device_push_tokens
  drop constraint if exists device_push_tokens_token_length_check;
alter table public.device_push_tokens
  add constraint device_push_tokens_token_length_check
  check (char_length(btrim(token)) between 20 and 4096);

create unique index if not exists device_push_tokens_active_installation_uidx
  on public.device_push_tokens(courier_id, platform, firebase_installation_id)
  where is_active and courier_id is not null and firebase_installation_id is not null;
create index if not exists device_push_tokens_store_active_idx
  on public.device_push_tokens(store_id, courier_id, token_refreshed_at desc)
  where is_active and courier_id is not null;

alter table public.device_push_tokens enable row level security;
alter table public.device_push_tokens force row level security;
revoke all on public.device_push_tokens from public, anon, authenticated;
grant select, insert, update, delete on public.device_push_tokens to service_role;

create table if not exists private.push_provider_runtime_readiness (
  provider text not null,
  environment text not null default 'production',
  project_id text,
  credentials_configured boolean not null default false,
  cloud_messaging_api_enabled boolean not null default false,
  validate_only_verified boolean not null default false,
  last_health_at timestamptz,
  last_validate_only_at timestamptz,
  last_error_code text,
  last_error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, environment),
  constraint push_provider_runtime_provider_check check (provider ~ '^[a-z0-9_]+$'),
  constraint push_provider_runtime_environment_check check (environment in ('production','test','disabled'))
);

alter table private.push_provider_runtime_readiness enable row level security;
alter table private.push_provider_runtime_readiness force row level security;
revoke all on private.push_provider_runtime_readiness from public, anon, authenticated;
grant select, insert, update, delete on private.push_provider_runtime_readiness to service_role;

create table if not exists private.outbound_push_messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  courier_id uuid not null,
  token_id uuid not null references public.device_push_tokens(id) on delete cascade,
  provider text not null default 'fcm',
  event_code text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  provider_message_id text,
  idempotency_key text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  last_error_detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_push_courier_store_fk foreign key (courier_id, store_id)
    references public.couriers(id, store_id) on delete cascade,
  constraint outbound_push_provider_check check (provider ~ '^[a-z0-9_]+$'),
  constraint outbound_push_event_code_check check (event_code ~ '^[a-z0-9_.-]{2,120}$'),
  constraint outbound_push_status_check check (status in ('queued','sending','sent','failed','cancelled')),
  constraint outbound_push_title_check check (char_length(title) between 1 and 160),
  constraint outbound_push_body_check check (char_length(body) between 1 and 1000),
  constraint outbound_push_attempts_check check (attempt_count >= 0 and max_attempts between 1 and 12),
  constraint outbound_push_idempotency_check check (char_length(idempotency_key) between 8 and 220),
  constraint outbound_push_data_object_check check (jsonb_typeof(data) = 'object')
);

create unique index if not exists outbound_push_token_idempotency_uidx
  on private.outbound_push_messages(token_id, idempotency_key);
create unique index if not exists outbound_push_provider_message_uidx
  on private.outbound_push_messages(provider, provider_message_id)
  where provider_message_id is not null;
create index if not exists outbound_push_queue_idx
  on private.outbound_push_messages(provider, status, available_at, created_at)
  where status in ('queued','failed');
create index if not exists outbound_push_store_created_idx
  on private.outbound_push_messages(store_id, created_at desc);

alter table private.outbound_push_messages enable row level security;
alter table private.outbound_push_messages force row level security;
revoke all on private.outbound_push_messages from public, anon, authenticated;
grant select, insert, update, delete on private.outbound_push_messages to service_role;

create or replace function private.is_push_provider_ready(
  _provider text default 'fcm',
  _environment text default 'production'
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce((
    select r.credentials_configured
       and r.project_id is not null
       and r.cloud_messaging_api_enabled
       and r.validate_only_verified
    from private.push_provider_runtime_readiness r
    where r.provider = lower(btrim(_provider))
      and r.environment = lower(btrim(_environment))
  ), false);
$$;

create or replace function private.record_push_provider_runtime_health(
  _provider text,
  _environment text,
  _project_id text,
  _credentials_configured boolean,
  _cloud_messaging_api_enabled boolean,
  _validate_only_verified boolean,
  _error_code text default null,
  _error_detail text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_provider text := lower(btrim(_provider));
  v_environment text := lower(btrim(_environment));
  v_project_id text := nullif(btrim(_project_id), '');
  v_row private.push_provider_runtime_readiness%rowtype;
begin
  if v_provider !~ '^[a-z0-9_]+$' then
    raise exception 'INVALID_PROVIDER' using errcode='22023';
  end if;
  if v_environment not in ('production','test','disabled') then
    raise exception 'INVALID_ENVIRONMENT' using errcode='22023';
  end if;

  insert into private.push_provider_runtime_readiness (
    provider, environment, project_id, credentials_configured,
    cloud_messaging_api_enabled, validate_only_verified,
    last_health_at, last_validate_only_at, last_error_code, last_error_detail, updated_at
  ) values (
    v_provider, v_environment, v_project_id, coalesce(_credentials_configured,false),
    coalesce(_cloud_messaging_api_enabled,false), coalesce(_validate_only_verified,false),
    now(), case when coalesce(_validate_only_verified,false) then now() else null end,
    left(nullif(btrim(_error_code),''),120), left(nullif(btrim(_error_detail),''),500), now()
  )
  on conflict (provider, environment) do update
  set project_id = excluded.project_id,
      credentials_configured = excluded.credentials_configured,
      cloud_messaging_api_enabled = excluded.cloud_messaging_api_enabled,
      validate_only_verified = excluded.validate_only_verified,
      last_health_at = now(),
      last_validate_only_at = case
        when excluded.validate_only_verified then now()
        else private.push_provider_runtime_readiness.last_validate_only_at
      end,
      last_error_code = excluded.last_error_code,
      last_error_detail = excluded.last_error_detail,
      updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'provider', v_row.provider,
    'environment', v_row.environment,
    'project_id', v_row.project_id,
    'credentials_configured', v_row.credentials_configured,
    'cloud_messaging_api_enabled', v_row.cloud_messaging_api_enabled,
    'validate_only_verified', v_row.validate_only_verified,
    'last_health_at', v_row.last_health_at,
    'last_validate_only_at', v_row.last_validate_only_at,
    'last_error_code', v_row.last_error_code,
    'ready_for_send', v_row.credentials_configured
      and v_row.project_id is not null
      and v_row.cloud_messaging_api_enabled
      and v_row.validate_only_verified
  );
end;
$$;

create or replace function public.register_my_courier_push_token(
  _store_id uuid,
  _token text,
  _platform text default 'android',
  _firebase_installation_id text default null,
  _app_version text default null,
  _app_build text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_courier_id uuid;
  v_courier_store_id uuid;
  v_token text := nullif(btrim(_token),'');
  v_platform text := lower(btrim(coalesce(_platform,'android')));
  v_installation text := nullif(btrim(_firebase_installation_id),'');
  v_existing public.device_push_tokens%rowtype;
  v_row public.device_push_tokens%rowtype;
begin
  select courier_id, store_id into v_courier_id, v_courier_store_id
  from private.require_current_courier();

  if _store_id is null or _store_id <> v_courier_store_id then
    raise exception 'COURIER_STORE_MISMATCH' using errcode='42501';
  end if;
  if v_token is null or char_length(v_token) not between 20 and 4096 then
    raise exception 'INVALID_PUSH_TOKEN' using errcode='22023';
  end if;
  if v_platform not in ('android','ios','web') then
    raise exception 'INVALID_PUSH_PLATFORM' using errcode='22023';
  end if;
  if v_installation is not null and char_length(v_installation) > 256 then
    raise exception 'INVALID_FIREBASE_INSTALLATION_ID' using errcode='22023';
  end if;

  select * into v_existing
  from public.device_push_tokens t
  where t.token = v_token
  for update;

  if found and (v_existing.store_id is distinct from _store_id or v_existing.courier_id is distinct from v_courier_id) then
    raise exception 'PUSH_TOKEN_OWNERSHIP_CONFLICT' using errcode='42501';
  end if;

  if v_installation is not null then
    update public.device_push_tokens
    set is_active=false,
        deactivated_at=coalesce(deactivated_at,now()),
        updated_at=now()
    where courier_id=v_courier_id
      and store_id=_store_id
      and platform=v_platform
      and firebase_installation_id=v_installation
      and token <> v_token
      and is_active;
  end if;

  if found then
    update public.device_push_tokens
    set platform=v_platform,
        is_active=true,
        last_seen_at=now(),
        token_refreshed_at=now(),
        firebase_installation_id=v_installation,
        app_version=left(nullif(btrim(_app_version),''),80),
        app_build=left(nullif(btrim(_app_build),''),80),
        deactivated_at=null,
        last_error_code=null,
        last_failure_at=null,
        updated_at=now()
    where id=v_existing.id
    returning * into v_row;
  else
    insert into public.device_push_tokens(
      store_id,user_id,courier_id,token,platform,is_active,last_seen_at,
      firebase_installation_id,app_version,app_build,token_refreshed_at
    ) values (
      _store_id,null,v_courier_id,v_token,v_platform,true,now(),
      v_installation,left(nullif(btrim(_app_version),''),80),left(nullif(btrim(_app_build),''),80),now()
    ) returning * into v_row;
  end if;

  return jsonb_build_object(
    'id',v_row.id,
    'platform',v_row.platform,
    'is_active',v_row.is_active,
    'firebase_installation_id',v_row.firebase_installation_id,
    'token_refreshed_at',v_row.token_refreshed_at
  );
end;
$$;

create or replace function public.deactivate_my_courier_push_token(
  _store_id uuid,
  _token text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_courier_id uuid;
  v_courier_store_id uuid;
begin
  select courier_id, store_id into v_courier_id, v_courier_store_id
  from private.require_current_courier();
  if _store_id is null or _store_id <> v_courier_store_id then
    raise exception 'COURIER_STORE_MISMATCH' using errcode='42501';
  end if;

  update public.device_push_tokens
  set is_active=false,
      deactivated_at=coalesce(deactivated_at,now()),
      updated_at=now()
  where store_id=_store_id
    and courier_id=v_courier_id
    and token=nullif(btrim(_token),'')
    and is_active;
  return found;
end;
$$;

create or replace function private.queue_courier_push_message(
  _store_id uuid,
  _courier_id uuid,
  _event_code text,
  _title text,
  _body text,
  _data jsonb,
  _idempotency_key text,
  _metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_inserted integer := 0;
  v_active integer := 0;
  v_event text := lower(btrim(_event_code));
  v_key text := btrim(_idempotency_key);
begin
  if not private.is_push_provider_ready('fcm','production') then
    return jsonb_build_object('queued',0,'active_tokens',0,'reason','provider_not_ready');
  end if;
  if not exists(select 1 from public.couriers c where c.id=_courier_id and c.store_id=_store_id and c.status='ativo') then
    raise exception 'COURIER_NOT_ACTIVE' using errcode='22023';
  end if;
  if v_event !~ '^[a-z0-9_.-]{2,120}$' then
    raise exception 'INVALID_PUSH_EVENT_CODE' using errcode='22023';
  end if;
  if nullif(btrim(_title),'') is null or char_length(btrim(_title)) > 160 then
    raise exception 'INVALID_PUSH_TITLE' using errcode='22023';
  end if;
  if nullif(btrim(_body),'') is null or char_length(btrim(_body)) > 1000 then
    raise exception 'INVALID_PUSH_BODY' using errcode='22023';
  end if;
  if nullif(v_key,'') is null or char_length(v_key) not between 8 and 220 then
    raise exception 'INVALID_PUSH_IDEMPOTENCY_KEY' using errcode='22023';
  end if;
  if jsonb_typeof(coalesce(_data,'{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_PUSH_DATA' using errcode='22023';
  end if;

  select count(*) into v_active
  from public.device_push_tokens t
  where t.store_id=_store_id
    and t.courier_id=_courier_id
    and t.is_active
    and t.token_refreshed_at >= now() - interval '45 days';

  insert into private.outbound_push_messages(
    store_id,courier_id,token_id,provider,event_code,title,body,data,status,
    idempotency_key,metadata
  )
  select _store_id,_courier_id,t.id,'fcm',v_event,btrim(_title),btrim(_body),
         coalesce(_data,'{}'::jsonb),'queued',v_key,coalesce(_metadata,'{}'::jsonb)
  from public.device_push_tokens t
  where t.store_id=_store_id
    and t.courier_id=_courier_id
    and t.is_active
    and t.token_refreshed_at >= now() - interval '45 days'
  on conflict (token_id,idempotency_key) do nothing;

  get diagnostics v_inserted = row_count;
  return jsonb_build_object(
    'queued',v_inserted,
    'active_tokens',v_active,
    'reason',case when v_active=0 then 'no_fresh_token' else null end
  );
end;
$$;

create or replace function private.claim_next_push_message(_provider text default 'fcm')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row private.outbound_push_messages%rowtype;
  v_token public.device_push_tokens%rowtype;
begin
  if not private.is_push_provider_ready(_provider,'production') then return null; end if;

  select p.* into v_row
  from private.outbound_push_messages p
  join public.device_push_tokens t on t.id=p.token_id
  where p.provider=lower(btrim(_provider))
    and p.status in ('queued','failed')
    and p.attempt_count < p.max_attempts
    and p.available_at <= now()
    and t.is_active
    and t.token_refreshed_at >= now() - interval '45 days'
  order by p.available_at,p.created_at
  for update of p skip locked
  limit 1;

  if not found then return null; end if;

  select * into v_token from public.device_push_tokens where id=v_row.token_id;
  update private.outbound_push_messages
  set status='sending',attempt_count=attempt_count+1,locked_at=now(),
      last_error_code=null,last_error_detail=null,updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'id',v_row.id,
    'store_id',v_row.store_id,
    'courier_id',v_row.courier_id,
    'token_id',v_row.token_id,
    'registration_token',v_token.token,
    'platform',v_token.platform,
    'event_code',v_row.event_code,
    'title',v_row.title,
    'body',v_row.body,
    'data',v_row.data,
    'idempotency_key',v_row.idempotency_key,
    'attempt_count',v_row.attempt_count,
    'max_attempts',v_row.max_attempts
  );
end;
$$;

create or replace function private.complete_push_message(
  _message_id uuid,
  _provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  update private.outbound_push_messages
  set status='sent',provider_message_id=nullif(btrim(_provider_message_id),''),
      sent_at=coalesce(sent_at,now()),locked_at=null,updated_at=now()
  where id=_message_id and status='sending';
  return found;
end;
$$;

create or replace function private.fail_push_message(
  _message_id uuid,
  _error_code text,
  _error_detail text,
  _retryable boolean default true,
  _retry_after_seconds integer default null,
  _deactivate_token boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row private.outbound_push_messages%rowtype;
  v_delay integer;
begin
  select * into v_row from private.outbound_push_messages
  where id=_message_id and status='sending'
  for update;
  if not found then return false; end if;

  if coalesce(_deactivate_token,false) then
    update public.device_push_tokens
    set is_active=false,deactivated_at=coalesce(deactivated_at,now()),
        last_error_code=left(coalesce(nullif(btrim(_error_code),''),'FCM_INVALID_TOKEN'),120),
        last_failure_at=now(),updated_at=now()
    where id=v_row.token_id;
  else
    update public.device_push_tokens
    set last_error_code=left(coalesce(nullif(btrim(_error_code),''),'FCM_ERROR'),120),
        last_failure_at=now(),updated_at=now()
    where id=v_row.token_id;
  end if;

  v_delay := case
    when _retry_after_seconds is not null then greatest(30,least(_retry_after_seconds,86400))
    else least(3600,greatest(30,(power(2,least(v_row.attempt_count,6))*30)::int))
  end;

  update private.outbound_push_messages
  set status=case
        when coalesce(_retryable,true) and not coalesce(_deactivate_token,false) and attempt_count<max_attempts then 'failed'
        else 'cancelled'
      end,
      available_at=case
        when coalesce(_retryable,true) and not coalesce(_deactivate_token,false) and attempt_count<max_attempts
          then now()+make_interval(secs=>v_delay)
        else available_at
      end,
      failed_at=case
        when not coalesce(_retryable,true) or coalesce(_deactivate_token,false) or attempt_count>=max_attempts then now()
        else failed_at
      end,
      locked_at=null,
      last_error_code=left(coalesce(nullif(btrim(_error_code),''),'FCM_ERROR'),120),
      last_error_detail=left(coalesce(_error_detail,''),500),
      updated_at=now()
  where id=_message_id;
  return true;
end;
$$;

create or replace function private.prune_stale_push_tokens(_stale_after interval default interval '45 days')
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  if _stale_after < interval '30 days' then
    raise exception 'STALE_WINDOW_TOO_SHORT' using errcode='22023';
  end if;
  update public.device_push_tokens
  set is_active=false,deactivated_at=coalesce(deactivated_at,now()),
      last_error_code=coalesce(last_error_code,'STALE_TOKEN'),updated_at=now()
  where is_active and token_refreshed_at < now()-_stale_after;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

create or replace function public.get_my_store_push_readiness(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row private.push_provider_runtime_readiness%rowtype;
begin
  if auth.uid() is null or not private.is_store_member(_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select * into v_row from private.push_provider_runtime_readiness
  where provider='fcm' and environment='production';
  return jsonb_build_object(
    'provider','fcm',
    'push_core_ready',true,
    'project_id',v_row.project_id,
    'credentials_configured',coalesce(v_row.credentials_configured,false),
    'cloud_messaging_api_enabled',coalesce(v_row.cloud_messaging_api_enabled,false),
    'validate_only_verified',coalesce(v_row.validate_only_verified,false),
    'ready_for_send',coalesce(v_row.credentials_configured and v_row.project_id is not null and v_row.cloud_messaging_api_enabled and v_row.validate_only_verified,false),
    'active_tokens',(select count(*) from public.device_push_tokens t where t.store_id=_store_id and t.is_active),
    'fresh_tokens',(select count(*) from public.device_push_tokens t where t.store_id=_store_id and t.is_active and t.token_refreshed_at>=now()-interval '45 days'),
    'last_health_at',v_row.last_health_at,
    'last_validate_only_at',v_row.last_validate_only_at,
    'last_error_code',v_row.last_error_code
  );
end;
$$;

create or replace function public.backend_record_push_provider_runtime_health(
  _provider text,
  _environment text,
  _project_id text,
  _credentials_configured boolean,
  _cloud_messaging_api_enabled boolean,
  _validate_only_verified boolean,
  _error_code text default null,
  _error_detail text default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, private
as $$
  select private.record_push_provider_runtime_health(_provider,_environment,_project_id,_credentials_configured,_cloud_messaging_api_enabled,_validate_only_verified,_error_code,_error_detail);
$$;

create or replace function public.backend_claim_next_push_message(_provider text default 'fcm')
returns jsonb
language sql
security definer
set search_path = pg_catalog, private
as $$ select private.claim_next_push_message(_provider); $$;

create or replace function public.backend_complete_push_message(_message_id uuid,_provider_message_id text)
returns boolean
language sql
security definer
set search_path = pg_catalog, private
as $$ select private.complete_push_message(_message_id,_provider_message_id); $$;

create or replace function public.backend_fail_push_message(
  _message_id uuid,_error_code text,_error_detail text,_retryable boolean default true,
  _retry_after_seconds integer default null,_deactivate_token boolean default false
)
returns boolean
language sql
security definer
set search_path = pg_catalog, private
as $$ select private.fail_push_message(_message_id,_error_code,_error_detail,_retryable,_retry_after_seconds,_deactivate_token); $$;

create or replace function private.delivery_assignment_push_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_order_number bigint;
  v_result jsonb;
begin
  if new.courier_id is null or new.status <> 'atribuida' then return new; end if;
  if tg_op='UPDATE'
     and old.courier_id is not distinct from new.courier_id
     and old.status is not distinct from new.status
     and old.assigned_at is not distinct from new.assigned_at then
    return new;
  end if;

  select o.order_number into v_order_number from public.orders o
  where o.id=new.order_id and o.store_id=new.store_id;

  begin
    v_result := private.queue_courier_push_message(
      new.store_id,
      new.courier_id,
      'delivery.assigned',
      'Nova entrega atribuída',
      case when v_order_number is null then 'Você recebeu uma nova entrega.' else 'Pedido #'||v_order_number::text||' foi atribuído a você.' end,
      jsonb_build_object('delivery_id',new.id::text,'order_id',new.order_id::text,'event','delivery.assigned'),
      'delivery-assigned:'||new.id::text||':'||new.courier_id::text||':'||new.version::text,
      jsonb_build_object('source','delivery_trigger')
    );
  exception when others then
    begin
      insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
      values(new.store_id,'push.delivery.assigned','deliveries',new.id,sqlstate,left(sqlerrm,500),jsonb_build_object('courier_id',new.courier_id,'order_id',new.order_id));
    exception when others then null;
    end;
  end;
  return new;
end;
$$;

drop trigger if exists trg_comandiva_delivery_assignment_push on public.deliveries;
create trigger trg_comandiva_delivery_assignment_push
after insert or update of courier_id,status,assigned_at
on public.deliveries
for each row execute function private.delivery_assignment_push_trigger();

revoke all on function private.is_push_provider_ready(text,text) from public,anon,authenticated;
revoke all on function private.record_push_provider_runtime_health(text,text,text,boolean,boolean,boolean,text,text) from public,anon,authenticated;
revoke all on function private.queue_courier_push_message(uuid,uuid,text,text,text,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function private.claim_next_push_message(text) from public,anon,authenticated;
revoke all on function private.complete_push_message(uuid,text) from public,anon,authenticated;
revoke all on function private.fail_push_message(uuid,text,text,boolean,integer,boolean) from public,anon,authenticated;
revoke all on function private.prune_stale_push_tokens(interval) from public,anon,authenticated;
revoke all on function private.delivery_assignment_push_trigger() from public,anon,authenticated;

grant execute on function private.is_push_provider_ready(text,text) to service_role;
grant execute on function private.record_push_provider_runtime_health(text,text,text,boolean,boolean,boolean,text,text) to service_role;
grant execute on function private.queue_courier_push_message(uuid,uuid,text,text,text,jsonb,text,jsonb) to service_role;
grant execute on function private.claim_next_push_message(text) to service_role;
grant execute on function private.complete_push_message(uuid,text) to service_role;
grant execute on function private.fail_push_message(uuid,text,text,boolean,integer,boolean) to service_role;
grant execute on function private.prune_stale_push_tokens(interval) to service_role;

revoke all on function public.register_my_courier_push_token(uuid,text,text,text,text,text) from public,anon;
revoke all on function public.deactivate_my_courier_push_token(uuid,text) from public,anon;
revoke all on function public.get_my_store_push_readiness(uuid) from public,anon;
grant execute on function public.register_my_courier_push_token(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.deactivate_my_courier_push_token(uuid,text) to authenticated;
grant execute on function public.get_my_store_push_readiness(uuid) to authenticated;

revoke all on function public.backend_record_push_provider_runtime_health(text,text,text,boolean,boolean,boolean,text,text) from public,anon,authenticated;
revoke all on function public.backend_claim_next_push_message(text) from public,anon,authenticated;
revoke all on function public.backend_complete_push_message(uuid,text) from public,anon,authenticated;
revoke all on function public.backend_fail_push_message(uuid,text,text,boolean,integer,boolean) from public,anon,authenticated;
grant execute on function public.backend_record_push_provider_runtime_health(text,text,text,boolean,boolean,boolean,text,text) to service_role;
grant execute on function public.backend_claim_next_push_message(text) to service_role;
grant execute on function public.backend_complete_push_message(uuid,text) to service_role;
grant execute on function public.backend_fail_push_message(uuid,text,text,boolean,integer,boolean) to service_role;

select cron.unschedule(jobid) from cron.job where jobname='comandiva-push-token-prune';
select cron.schedule('comandiva-push-token-prune','37 4 * * *',$$select private.prune_stale_push_tokens(interval '45 days');$$);
