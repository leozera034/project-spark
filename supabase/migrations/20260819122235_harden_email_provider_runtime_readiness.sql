alter table private.email_provider_runtime_readiness
  add column if not exists webhook_secret_fingerprint text;

create or replace function private.record_email_provider_runtime_health(
  _provider text,
  _environment text,
  _api_key_configured boolean,
  _sending_domain text,
  _domain_verified boolean,
  _webhook_secret_configured boolean,
  _webhook_secret_fingerprint text,
  _last_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_provider text := lower(btrim(_provider));
  v_environment text := lower(btrim(_environment));
  v_domain text := nullif(lower(btrim(_sending_domain)), '');
  v_existing private.email_provider_runtime_readiness%rowtype;
  v_row private.email_provider_runtime_readiness%rowtype;
  v_reset_webhook boolean := false;
begin
  if v_provider !~ '^[a-z0-9_]+$' then
    raise exception 'INVALID_PROVIDER' using errcode = '22023';
  end if;
  if v_environment not in ('production','test','disabled') then
    raise exception 'INVALID_ENVIRONMENT' using errcode = '22023';
  end if;

  select * into v_existing
  from private.email_provider_runtime_readiness r
  where r.provider = v_provider and r.environment = v_environment
  for update;

  if found then
    v_reset_webhook :=
      v_existing.sending_domain is distinct from v_domain
      or v_existing.webhook_secret_fingerprint is distinct from nullif(btrim(_webhook_secret_fingerprint), '')
      or not coalesce(_webhook_secret_configured, false);
  end if;

  insert into private.email_provider_runtime_readiness (
    provider,
    environment,
    api_key_configured,
    sending_domain,
    domain_verified,
    webhook_secret_configured,
    webhook_secret_fingerprint,
    webhook_delivery_verified,
    last_health_at,
    last_valid_webhook_at,
    last_valid_webhook_event_type,
    last_error,
    updated_at
  ) values (
    v_provider,
    v_environment,
    coalesce(_api_key_configured, false),
    v_domain,
    coalesce(_domain_verified, false),
    coalesce(_webhook_secret_configured, false),
    nullif(btrim(_webhook_secret_fingerprint), ''),
    false,
    now(),
    null,
    null,
    left(nullif(btrim(_last_error), ''), 500),
    now()
  )
  on conflict (provider, environment) do update
  set api_key_configured = excluded.api_key_configured,
      sending_domain = excluded.sending_domain,
      domain_verified = excluded.domain_verified,
      webhook_secret_configured = excluded.webhook_secret_configured,
      webhook_secret_fingerprint = excluded.webhook_secret_fingerprint,
      webhook_delivery_verified = case
        when v_reset_webhook then false
        else private.email_provider_runtime_readiness.webhook_delivery_verified
      end,
      last_valid_webhook_at = case
        when v_reset_webhook then null
        else private.email_provider_runtime_readiness.last_valid_webhook_at
      end,
      last_valid_webhook_event_type = case
        when v_reset_webhook then null
        else private.email_provider_runtime_readiness.last_valid_webhook_event_type
      end,
      last_health_at = now(),
      last_error = excluded.last_error,
      updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'provider', v_row.provider,
    'environment', v_row.environment,
    'api_key_configured', v_row.api_key_configured,
    'sending_domain', v_row.sending_domain,
    'domain_verified', v_row.domain_verified,
    'webhook_secret_configured', v_row.webhook_secret_configured,
    'webhook_delivery_verified', v_row.webhook_delivery_verified,
    'last_health_at', v_row.last_health_at,
    'last_valid_webhook_at', v_row.last_valid_webhook_at,
    'last_error', v_row.last_error,
    'ready_for_send', v_row.api_key_configured
      and v_row.domain_verified
      and v_row.webhook_secret_configured
      and v_row.webhook_delivery_verified
  );
end;
$$;

create or replace function private.is_email_provider_ready(
  _provider text default 'resend',
  _environment text default 'production'
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce((
    select r.api_key_configured
       and r.domain_verified
       and r.webhook_secret_configured
       and r.webhook_delivery_verified
    from private.email_provider_runtime_readiness r
    where r.provider = lower(btrim(_provider))
      and r.environment = lower(btrim(_environment))
  ), false);
$$;

create or replace function private.email_webhook_readiness_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if new.provider = 'resend'
     and new.signature_valid
     and new.processing_status = 'processed' then
    update private.email_provider_runtime_readiness r
    set webhook_delivery_verified = true,
        last_valid_webhook_at = coalesce(new.processed_at, now()),
        last_valid_webhook_event_type = left(new.event_type, 160),
        last_error = null,
        updated_at = now()
    where r.provider = 'resend'
      and r.environment = 'production'
      and r.api_key_configured
      and r.domain_verified
      and r.webhook_secret_configured;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_email_webhook_runtime_readiness on private.email_webhook_events;
create trigger trg_email_webhook_runtime_readiness
after insert or update of signature_valid, processing_status, processed_at
on private.email_webhook_events
for each row
execute function private.email_webhook_readiness_trigger();

create or replace function public.get_my_store_email_readiness(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row private.email_provider_runtime_readiness%rowtype;
begin
  if auth.uid() is null or not private.is_store_member(_store_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_row
  from private.email_provider_runtime_readiness r
  where r.provider = 'resend' and r.environment = 'production';

  return jsonb_build_object(
    'provider', 'resend',
    'transactional_core_ready', true,
    'api_key_configured', coalesce(v_row.api_key_configured, false),
    'sending_domain', v_row.sending_domain,
    'domain_verified', coalesce(v_row.domain_verified, false),
    'webhook_secret_configured', coalesce(v_row.webhook_secret_configured, false),
    'webhook_delivery_verified', coalesce(v_row.webhook_delivery_verified, false),
    'ready_for_send', coalesce(
      v_row.api_key_configured
      and v_row.domain_verified
      and v_row.webhook_secret_configured
      and v_row.webhook_delivery_verified,
      false
    ),
    'last_health_at', v_row.last_health_at,
    'last_valid_webhook_at', v_row.last_valid_webhook_at,
    'last_error', v_row.last_error
  );
end;
$$;

revoke all on function private.record_email_provider_runtime_health(text,text,boolean,text,boolean,boolean,text,text) from public, anon, authenticated;
revoke all on function private.email_webhook_readiness_trigger() from public, anon, authenticated;
revoke all on function private.is_email_provider_ready(text,text) from public, anon, authenticated;
grant execute on function private.record_email_provider_runtime_health(text,text,boolean,text,boolean,boolean,text,text) to service_role;
grant execute on function private.is_email_provider_ready(text,text) to service_role;
