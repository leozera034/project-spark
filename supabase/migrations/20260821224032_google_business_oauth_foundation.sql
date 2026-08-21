create table private.google_business_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid not null,
  state_hash text not null check (state_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'created' check (status in ('created','exchanging','connected','failed','cancelled','expired')),
  error_code text,
  error_message text,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index google_business_onboarding_state_uidx
  on private.google_business_onboarding_sessions(state_hash);
create index google_business_onboarding_store_created_idx
  on private.google_business_onboarding_sessions(store_id, created_at desc);

alter table private.google_business_onboarding_sessions enable row level security;
alter table private.google_business_onboarding_sessions force row level security;
revoke all on table private.google_business_onboarding_sessions from public, anon, authenticated;
grant all on table private.google_business_onboarding_sessions to service_role;

create trigger set_updated_at_google_business_onboarding_sessions
before update on private.google_business_onboarding_sessions
for each row execute function public.set_updated_at();

create or replace function public.begin_store_google_business_onboarding(_store_id uuid, _state_hash text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _user_id uuid := auth.uid();
  _session_id uuid;
  _expires_at timestamptz;
begin
  if _user_id is null or not private.is_store_manager(_store_id) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if coalesce(_state_hash,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'GOOGLE_BUSINESS_STATE_INVALID' using errcode='P0001';
  end if;

  update private.google_business_onboarding_sessions
  set status='cancelled', updated_at=now()
  where store_id=_store_id and status in ('created','exchanging') and expires_at > now();

  insert into private.google_business_onboarding_sessions(store_id, actor_user_id, state_hash)
  values(_store_id, _user_id, _state_hash)
  returning id, expires_at into _session_id, _expires_at;

  return jsonb_build_object('session_id', _session_id, 'expires_at', _expires_at);
end;
$function$;

create or replace function public.get_store_google_business_connection(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _account private.integration_provider_accounts%rowtype;
  _session private.google_business_onboarding_sessions%rowtype;
begin
  perform private.require_growth_access(_store_id);

  select * into _account
  from private.integration_provider_accounts a
  where a.store_id=_store_id and a.provider='google_business_profile' and a.connection_key='default'
  limit 1;

  select * into _session
  from private.google_business_onboarding_sessions s
  where s.store_id=_store_id
  order by s.created_at desc
  limit 1;

  return jsonb_build_object(
    'configured', _account.id is not null,
    'connected', coalesce(_account.status='connected', false),
    'status', coalesce(_account.status, 'disconnected'),
    'api_healthy', coalesce((_account.public_config->>'api_healthy')::boolean, false),
    'google_user_email', _account.public_config->>'google_user_email',
    'account_count', coalesce((_account.public_config->>'account_count')::integer, 0),
    'selected_account_name', _account.public_config->>'selected_account_name',
    'selected_location_name', _account.public_config->>'selected_location_name',
    'selected_location_title', _account.public_config->>'selected_location_title',
    'token_expires_at', _account.public_config->>'token_expires_at',
    'scopes', coalesce(_account.public_config->'scopes', '[]'::jsonb),
    'connected_at', _account.connected_at,
    'last_health_at', _account.last_health_at,
    'last_error', _account.last_error,
    'onboarding_session', case when _session.id is null then null else jsonb_build_object(
      'id', _session.id,
      'status', case when _session.status in ('created','exchanging') and _session.expires_at <= now() then 'expired' else _session.status end,
      'error_code', _session.error_code,
      'error_message', _session.error_message,
      'expires_at', _session.expires_at,
      'completed_at', _session.completed_at,
      'created_at', _session.created_at
    ) end
  );
exception when invalid_text_representation then
  return jsonb_build_object(
    'configured', _account.id is not null,
    'connected', false,
    'status', 'degraded',
    'api_healthy', false,
    'google_user_email', _account.public_config->>'google_user_email',
    'account_count', 0,
    'selected_account_name', null,
    'selected_location_name', null,
    'selected_location_title', null,
    'token_expires_at', null,
    'scopes', '[]'::jsonb,
    'connected_at', _account.connected_at,
    'last_health_at', _account.last_health_at,
    'last_error', 'google_business_public_config_invalid',
    'onboarding_session', null
  );
end;
$function$;

create or replace function public.claim_google_business_onboarding_session(_session_id uuid, _state_hash text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _session private.google_business_onboarding_sessions%rowtype;
begin
  select * into _session
  from private.google_business_onboarding_sessions s
  where s.id=_session_id and s.state_hash=_state_hash
  for update;

  if not found then raise exception 'GOOGLE_BUSINESS_ONBOARDING_NOT_FOUND' using errcode='P0001'; end if;
  if _session.expires_at <= now() then
    update private.google_business_onboarding_sessions set status='expired', updated_at=now() where id=_session.id;
    raise exception 'GOOGLE_BUSINESS_ONBOARDING_EXPIRED' using errcode='P0001';
  end if;
  if _session.status not in ('created','exchanging') then
    raise exception 'GOOGLE_BUSINESS_ONBOARDING_INVALID' using errcode='P0001';
  end if;

  update private.google_business_onboarding_sessions
  set status='exchanging', updated_at=now()
  where id=_session.id;

  return jsonb_build_object('session_id', _session.id, 'store_id', _session.store_id, 'actor_user_id', _session.actor_user_id);
end;
$function$;

create or replace function public.fail_google_business_onboarding_session(_session_id uuid, _error_code text, _error_message text)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  update private.google_business_onboarding_sessions
  set status='failed',
      error_code=left(coalesce(nullif(btrim(_error_code),''),'GOOGLE_BUSINESS_ONBOARDING_FAILED'),120),
      error_message=left(coalesce(nullif(btrim(_error_message),''),'Google Business onboarding failed.'),500),
      updated_at=now()
  where id=_session_id and status in ('created','exchanging');
  return found;
end;
$function$;

create or replace function public.complete_google_business_connection(
  _session_id uuid,
  _credential_json text,
  _token_expires_at timestamptz,
  _scopes text[],
  _google_user_email text,
  _api_healthy boolean,
  _api_error text,
  _account_count integer
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','vault','pg_temp'
as $function$
declare
  _session private.google_business_onboarding_sessions%rowtype;
  _account private.integration_provider_accounts%rowtype;
  _secret_id uuid;
  _config jsonb;
begin
  if coalesce(btrim(_credential_json),'')='' then raise exception 'GOOGLE_BUSINESS_CREDENTIAL_REQUIRED' using errcode='P0001'; end if;
  if _token_expires_at is null or _token_expires_at <= now() then raise exception 'GOOGLE_BUSINESS_TOKEN_EXPIRY_INVALID' using errcode='P0001'; end if;

  select * into _session
  from private.google_business_onboarding_sessions s
  where s.id=_session_id
  for update;
  if not found then raise exception 'GOOGLE_BUSINESS_ONBOARDING_NOT_FOUND' using errcode='P0001'; end if;
  if _session.status <> 'exchanging' or _session.expires_at <= now() then raise exception 'GOOGLE_BUSINESS_ONBOARDING_INVALID' using errcode='P0001'; end if;

  select * into _account
  from private.integration_provider_accounts a
  where a.store_id=_session.store_id and a.provider='google_business_profile' and a.connection_key='default'
  for update;

  if found and nullif(_account.credential_ref,'') is not null then
    begin _secret_id := _account.credential_ref::uuid; exception when others then _secret_id := null; end;
  end if;

  if _secret_id is not null and exists(select 1 from vault.secrets v where v.id=_secret_id) then
    perform vault.update_secret(_secret_id, _credential_json, null, 'Comandiva Google Business OAuth credential');
  else
    _secret_id := vault.create_secret(
      _credential_json,
      'comandiva_google_business_'||replace(_session.store_id::text,'-','')||'_'||replace(gen_random_uuid()::text,'-',''),
      'Comandiva Google Business OAuth credential'
    );
  end if;

  _config := jsonb_strip_nulls(jsonb_build_object(
    'google_user_email', nullif(btrim(_google_user_email),''),
    'token_expires_at', _token_expires_at,
    'scopes', to_jsonb(coalesce(_scopes, array[]::text[])),
    'account_count', greatest(coalesce(_account_count,0),0),
    'api_healthy', coalesce(_api_healthy,false),
    'selected_account_name', case when _account.id is not null then _account.public_config->>'selected_account_name' else null end,
    'selected_location_name', case when _account.id is not null then _account.public_config->>'selected_location_name' else null end,
    'selected_location_title', case when _account.id is not null then _account.public_config->>'selected_location_title' else null end
  ));

  insert into private.integration_provider_accounts(
    store_id, provider, connection_key, external_account_id, status, credential_ref, public_config, connected_at, last_health_at, last_error
  ) values(
    _session.store_id, 'google_business_profile', 'default', null,
    case when coalesce(_api_healthy,false) then 'connected' else 'degraded' end,
    _secret_id::text, _config, now(), now(), nullif(btrim(_api_error),'')
  )
  on conflict (store_id,provider,connection_key) where store_id is not null
  do update set
    status=excluded.status,
    credential_ref=excluded.credential_ref,
    public_config=excluded.public_config,
    connected_at=coalesce(private.integration_provider_accounts.connected_at, now()),
    last_health_at=now(),
    last_error=excluded.last_error,
    updated_at=now();

  update private.google_business_onboarding_sessions
  set status='connected', completed_at=now(), error_code=null, error_message=null, updated_at=now()
  where id=_session.id;

  return true;
end;
$function$;

create or replace function public.service_get_google_business_credential(_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','vault','pg_temp'
as $function$
declare
  _account private.integration_provider_accounts%rowtype;
  _secret_id uuid;
  _secret text;
begin
  select * into _account
  from private.integration_provider_accounts a
  where a.store_id=_store_id and a.provider='google_business_profile' and a.connection_key='default'
    and a.status in ('connected','degraded')
  limit 1;
  if not found or nullif(_account.credential_ref,'') is null then
    raise exception 'GOOGLE_BUSINESS_CREDENTIAL_NOT_FOUND' using errcode='P0001';
  end if;

  begin _secret_id := _account.credential_ref::uuid; exception when others then _secret_id := null; end;
  if _secret_id is null then raise exception 'GOOGLE_BUSINESS_CREDENTIAL_INVALID' using errcode='P0001'; end if;

  select ds.decrypted_secret into _secret from vault.decrypted_secrets ds where ds.id=_secret_id;
  if _secret is null or btrim(_secret)='' then raise exception 'GOOGLE_BUSINESS_SECRET_NOT_FOUND' using errcode='P0001'; end if;

  return jsonb_build_object('credential', _secret::jsonb, 'public_config', _account.public_config, 'status', _account.status);
exception when invalid_text_representation then
  raise exception 'GOOGLE_BUSINESS_CREDENTIAL_INVALID' using errcode='P0001';
end;
$function$;

create or replace function public.disconnect_store_google_business(_store_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','vault','pg_temp'
as $function$
declare
  _account private.integration_provider_accounts%rowtype;
  _secret_id uuid;
begin
  if auth.uid() is null or not private.is_store_manager(_store_id) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  select * into _account
  from private.integration_provider_accounts a
  where a.store_id=_store_id and a.provider='google_business_profile' and a.connection_key='default'
  for update;

  if found and nullif(_account.credential_ref,'') is not null then
    begin _secret_id := _account.credential_ref::uuid; exception when others then _secret_id := null; end;
    if _secret_id is not null then delete from vault.secrets where id=_secret_id; end if;
  end if;

  if found then
    update private.integration_provider_accounts
    set status='disconnected', credential_ref=null, external_account_id=null, public_config='{}'::jsonb,
        connected_at=null, last_health_at=now(), last_error=null, updated_at=now()
    where id=_account.id;
  end if;

  update private.google_business_onboarding_sessions
  set status='cancelled', updated_at=now()
  where store_id=_store_id and status in ('created','exchanging');

  return true;
end;
$function$;

revoke all on function public.begin_store_google_business_onboarding(uuid,text) from public, anon;
grant execute on function public.begin_store_google_business_onboarding(uuid,text) to authenticated;
revoke all on function public.get_store_google_business_connection(uuid) from public, anon;
grant execute on function public.get_store_google_business_connection(uuid) to authenticated;
revoke all on function public.disconnect_store_google_business(uuid) from public, anon;
grant execute on function public.disconnect_store_google_business(uuid) to authenticated;

revoke all on function public.claim_google_business_onboarding_session(uuid,text) from public, anon, authenticated;
revoke all on function public.fail_google_business_onboarding_session(uuid,text,text) from public, anon, authenticated;
revoke all on function public.complete_google_business_connection(uuid,text,timestamptz,text[],text,boolean,text,integer) from public, anon, authenticated;
revoke all on function public.service_get_google_business_credential(uuid) from public, anon, authenticated;
grant execute on function public.claim_google_business_onboarding_session(uuid,text) to service_role;
grant execute on function public.fail_google_business_onboarding_session(uuid,text,text) to service_role;
grant execute on function public.complete_google_business_connection(uuid,text,timestamptz,text[],text,boolean,text,integer) to service_role;
grant execute on function public.service_get_google_business_credential(uuid) to service_role;
