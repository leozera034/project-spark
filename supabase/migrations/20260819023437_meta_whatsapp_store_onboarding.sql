create table if not exists private.whatsapp_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid not null,
  provider text not null default 'meta_whatsapp' check (provider = 'meta_whatsapp'),
  status text not null default 'created' check (status in ('created','exchanging','connected','failed','cancelled','expired')),
  waba_id text,
  phone_number_id text,
  business_id text,
  error_code text,
  error_message text,
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_onboarding_sessions_store_created_idx
  on private.whatsapp_onboarding_sessions(store_id, created_at desc);

alter table private.whatsapp_onboarding_sessions enable row level security;
revoke all on table private.whatsapp_onboarding_sessions from public, anon, authenticated;
grant select, insert, update, delete on table private.whatsapp_onboarding_sessions to service_role;

create or replace function public.begin_store_meta_whatsapp_onboarding(_store_id uuid)
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
  if not private.store_has_entitlement(_store_id,'whatsapp_automation') then
    raise exception 'WHATSAPP_AUTOMATION_ENTITLEMENT_REQUIRED' using errcode='P0001';
  end if;

  update private.whatsapp_onboarding_sessions
  set status='cancelled', updated_at=now()
  where store_id=_store_id
    and status in ('created','exchanging')
    and expires_at > now();

  insert into private.whatsapp_onboarding_sessions(store_id,actor_user_id)
  values(_store_id,_user_id)
  returning id,expires_at into _session_id,_expires_at;

  return jsonb_build_object('session_id',_session_id,'expires_at',_expires_at);
end;
$function$;

create or replace function public.get_store_meta_whatsapp_connection(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _account private.integration_provider_accounts%rowtype;
  _session private.whatsapp_onboarding_sessions%rowtype;
begin
  perform private.require_growth_access(_store_id);

  select * into _account
  from private.integration_provider_accounts a
  where a.store_id=_store_id and a.provider='meta_whatsapp' and a.connection_key='default'
  limit 1;

  select * into _session
  from private.whatsapp_onboarding_sessions s
  where s.store_id=_store_id
  order by s.created_at desc
  limit 1;

  return jsonb_build_object(
    'configured', _account.id is not null,
    'connected', coalesce(_account.status='connected',false),
    'status', coalesce(_account.status,'disconnected'),
    'waba_id', coalesce(_account.public_config->>'waba_id',_account.external_account_id),
    'phone_number_id', _account.public_config->>'phone_number_id',
    'display_phone_number', _account.public_config->>'display_phone_number',
    'verified_name', _account.public_config->>'verified_name',
    'quality_rating', _account.public_config->>'quality_rating',
    'business_id', _account.public_config->>'business_id',
    'graph_api_version', _account.public_config->>'graph_api_version',
    'webhook_subscribed', coalesce((_account.public_config->>'webhook_subscribed')::boolean,false),
    'template_count', coalesce((_account.public_config->>'template_count')::integer,0),
    'templates_synced_at', _account.public_config->>'templates_synced_at',
    'token_expires_at', _account.public_config->>'token_expires_at',
    'connected_at', _account.connected_at,
    'last_health_at', _account.last_health_at,
    'last_error', _account.last_error,
    'onboarding_session', case when _session.id is null then null else jsonb_build_object(
      'id',_session.id,
      'status',case when _session.status in ('created','exchanging') and _session.expires_at <= now() then 'expired' else _session.status end,
      'error_code',_session.error_code,
      'error_message',_session.error_message,
      'expires_at',_session.expires_at,
      'completed_at',_session.completed_at,
      'created_at',_session.created_at
    ) end
  );
end;
$function$;

create or replace function public.claim_meta_whatsapp_onboarding_session(
  _session_id uuid,
  _store_id uuid,
  _actor_user_id uuid,
  _waba_id text,
  _phone_number_id text,
  _business_id text default null
)
returns text
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _session private.whatsapp_onboarding_sessions%rowtype;
begin
  select * into _session
  from private.whatsapp_onboarding_sessions s
  where s.id=_session_id and s.store_id=_store_id and s.actor_user_id=_actor_user_id
  for update;
  if not found then return 'invalid'; end if;
  if _session.status='connected' then return 'complete'; end if;
  if _session.expires_at <= now() then
    update private.whatsapp_onboarding_sessions set status='expired',updated_at=now() where id=_session.id;
    return 'expired';
  end if;
  if _session.status <> 'created' then return 'invalid'; end if;
  if coalesce(_waba_id,'') !~ '^[0-9]{5,40}$' or coalesce(_phone_number_id,'') !~ '^[0-9]{5,40}$' then
    return 'invalid';
  end if;

  update private.whatsapp_onboarding_sessions
  set status='exchanging',waba_id=_waba_id,phone_number_id=_phone_number_id,business_id=nullif(btrim(_business_id),''),updated_at=now()
  where id=_session.id;
  return 'process';
end;
$function$;

create or replace function public.fail_meta_whatsapp_onboarding_session(
  _session_id uuid,
  _store_id uuid,
  _actor_user_id uuid,
  _error_code text,
  _error_message text
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  update private.whatsapp_onboarding_sessions
  set status='failed',error_code=left(coalesce(_error_code,'ONBOARDING_FAILED'),120),
      error_message=left(coalesce(_error_message,'Meta onboarding failed.'),500),updated_at=now()
  where id=_session_id and store_id=_store_id and actor_user_id=_actor_user_id and status in ('created','exchanging');
  return found;
end;
$function$;

create or replace function public.complete_meta_whatsapp_connection(
  _session_id uuid,
  _store_id uuid,
  _actor_user_id uuid,
  _access_token text,
  _waba_id text,
  _phone_number_id text,
  _business_id text,
  _display_phone_number text,
  _verified_name text,
  _quality_rating text,
  _graph_api_version text,
  _webhook_subscribed boolean,
  _template_count integer,
  _token_expires_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','vault','pg_temp'
as $function$
declare
  _session private.whatsapp_onboarding_sessions%rowtype;
  _account private.integration_provider_accounts%rowtype;
  _secret_id uuid;
  _config jsonb;
begin
  if coalesce(btrim(_access_token),'')='' then raise exception 'META_ACCESS_TOKEN_REQUIRED' using errcode='P0001'; end if;
  if coalesce(_waba_id,'') !~ '^[0-9]{5,40}$' or coalesce(_phone_number_id,'') !~ '^[0-9]{5,40}$' then
    raise exception 'META_ASSET_ID_INVALID' using errcode='P0001';
  end if;
  if coalesce(_graph_api_version,'') !~ '^v[0-9]{1,3}\.[0-9]{1,2}$' then
    raise exception 'META_GRAPH_VERSION_INVALID' using errcode='P0001';
  end if;

  select * into _session
  from private.whatsapp_onboarding_sessions s
  where s.id=_session_id and s.store_id=_store_id and s.actor_user_id=_actor_user_id
  for update;
  if not found then raise exception 'META_ONBOARDING_SESSION_NOT_FOUND' using errcode='P0001'; end if;
  if _session.status='connected' then return true; end if;
  if _session.status <> 'exchanging' or _session.expires_at <= now() then
    raise exception 'META_ONBOARDING_SESSION_INVALID' using errcode='P0001';
  end if;
  if _session.waba_id is distinct from _waba_id or _session.phone_number_id is distinct from _phone_number_id then
    raise exception 'META_ONBOARDING_ASSET_MISMATCH' using errcode='P0001';
  end if;

  select * into _account
  from private.integration_provider_accounts a
  where a.store_id=_store_id and a.provider='meta_whatsapp' and a.connection_key='default'
  for update;

  if found and nullif(_account.credential_ref,'') is not null then
    begin _secret_id := _account.credential_ref::uuid; exception when others then _secret_id := null; end;
  end if;

  if _secret_id is not null and exists(select 1 from vault.secrets v where v.id=_secret_id) then
    perform vault.update_secret(_secret_id,_access_token,null,'Comandiva Meta WhatsApp access token');
  else
    _secret_id := vault.create_secret(
      _access_token,
      'comandiva_meta_whatsapp_'||replace(_store_id::text,'-','')||'_'||replace(gen_random_uuid()::text,'-',''),
      'Comandiva Meta WhatsApp access token'
    );
  end if;

  _config := jsonb_strip_nulls(jsonb_build_object(
    'waba_id',_waba_id,
    'phone_number_id',_phone_number_id,
    'business_id',nullif(btrim(_business_id),''),
    'display_phone_number',nullif(btrim(_display_phone_number),''),
    'verified_name',nullif(btrim(_verified_name),''),
    'quality_rating',nullif(btrim(_quality_rating),''),
    'graph_api_version',_graph_api_version,
    'webhook_subscribed',coalesce(_webhook_subscribed,false),
    'template_count',greatest(coalesce(_template_count,0),0),
    'templates_synced_at',now(),
    'token_expires_at',_token_expires_at
  ));

  insert into private.integration_provider_accounts(
    store_id,provider,connection_key,external_account_id,status,credential_ref,public_config,connected_at,last_health_at,last_error
  ) values(
    _store_id,'meta_whatsapp','default',_waba_id,'connected',_secret_id::text,_config,now(),now(),null
  )
  on conflict (store_id,provider,connection_key) where store_id is not null
  do update set
    external_account_id=excluded.external_account_id,
    status='connected',credential_ref=excluded.credential_ref,public_config=excluded.public_config,
    connected_at=now(),last_health_at=now(),last_error=null,updated_at=now();

  update private.whatsapp_onboarding_sessions
  set status='connected',business_id=nullif(btrim(_business_id),''),completed_at=now(),error_code=null,error_message=null,updated_at=now()
  where id=_session.id;

  return true;
end;
$function$;

create or replace function public.get_meta_whatsapp_access_token(_store_id uuid, _credential_ref text)
returns text
language plpgsql
security definer
set search_path to 'public','private','vault','pg_temp'
as $function$
declare
  _secret_id uuid;
  _token text;
  _expiry timestamptz;
begin
  select case
    when nullif(a.public_config->>'token_expires_at','') is null then null
    else (a.public_config->>'token_expires_at')::timestamptz
  end
  into _expiry
  from private.integration_provider_accounts a
  where a.store_id=_store_id
    and a.provider='meta_whatsapp'
    and a.status='connected'
    and a.credential_ref=_credential_ref;
  if not found then raise exception 'WHATSAPP_PROVIDER_CREDENTIAL_NOT_AUTHORIZED' using errcode='P0001'; end if;
  if _expiry is not null and _expiry <= now() then raise exception 'WHATSAPP_PROVIDER_TOKEN_EXPIRED' using errcode='P0001'; end if;

  begin _secret_id := _credential_ref::uuid; exception when others then _secret_id := null; end;
  if _secret_id is null then raise exception 'WHATSAPP_PROVIDER_CREDENTIAL_INVALID' using errcode='P0001'; end if;

  select ds.decrypted_secret into _token from vault.decrypted_secrets ds where ds.id=_secret_id;
  if _token is null or btrim(_token)='' then raise exception 'WHATSAPP_PROVIDER_SECRET_NOT_FOUND' using errcode='P0001'; end if;
  return _token;
exception when invalid_datetime_format then
  raise exception 'WHATSAPP_PROVIDER_TOKEN_EXPIRY_INVALID' using errcode='P0001';
end;
$function$;

revoke all on function public.claim_meta_whatsapp_onboarding_session(uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.fail_meta_whatsapp_onboarding_session(uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.complete_meta_whatsapp_connection(uuid,uuid,uuid,text,text,text,text,text,text,text,text,boolean,integer,timestamptz) from public, anon, authenticated;
revoke all on function public.get_meta_whatsapp_access_token(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_meta_whatsapp_onboarding_session(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.fail_meta_whatsapp_onboarding_session(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.complete_meta_whatsapp_connection(uuid,uuid,uuid,text,text,text,text,text,text,text,text,boolean,integer,timestamptz) to service_role;
grant execute on function public.get_meta_whatsapp_access_token(uuid,text) to service_role;

revoke all on function public.begin_store_meta_whatsapp_onboarding(uuid) from public, anon;
grant execute on function public.begin_store_meta_whatsapp_onboarding(uuid) to authenticated;
revoke all on function public.get_store_meta_whatsapp_connection(uuid) from public, anon;
grant execute on function public.get_store_meta_whatsapp_connection(uuid) to authenticated;
