create table if not exists private.email_provider_runtime_readiness (
  provider text not null,
  environment text not null default 'production',
  api_key_configured boolean not null default false,
  sending_domain text,
  domain_verified boolean not null default false,
  webhook_secret_configured boolean not null default false,
  webhook_delivery_verified boolean not null default false,
  last_health_at timestamptz,
  last_valid_webhook_at timestamptz,
  last_valid_webhook_event_type text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, environment),
  constraint email_provider_runtime_readiness_provider_check check (provider ~ '^[a-z0-9_]+$'),
  constraint email_provider_runtime_readiness_environment_check check (environment in ('production','test','disabled'))
);

alter table private.email_provider_runtime_readiness enable row level security;
alter table private.email_provider_runtime_readiness force row level security;
revoke all on private.email_provider_runtime_readiness from public, anon, authenticated;
grant select, insert, update, delete on private.email_provider_runtime_readiness to service_role;

create table if not exists private.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null default 'resend',
  email text not null,
  reason text not null,
  source text not null default 'provider_webhook',
  provider_event_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_suppressions_provider_check check (provider ~ '^[a-z0-9_]+$'),
  constraint email_suppressions_reason_check check (reason in ('bounce','complaint','suppressed','manual','invalid')),
  constraint email_suppressions_email_lower_check check (email = lower(email) and email = btrim(email))
);

create unique index if not exists email_suppressions_store_provider_email_uidx
  on private.email_suppressions(store_id, provider, email);
create index if not exists email_suppressions_active_idx
  on private.email_suppressions(store_id, provider, email)
  where active;

alter table private.email_suppressions enable row level security;
alter table private.email_suppressions force row level security;
revoke all on private.email_suppressions from public, anon, authenticated;
grant select, insert, update, delete on private.email_suppressions to service_role;

create table if not exists private.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null default 'resend',
  purpose text not null default 'transactional',
  template_code text not null,
  recipient_email text not null,
  recipient_name text,
  subject text not null,
  variables jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  provider_email_id text,
  idempotency_key text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  failed_at timestamptz,
  provider_cost_micros bigint not null default 0,
  last_error_code text,
  last_error_detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_emails_provider_check check (provider ~ '^[a-z0-9_]+$'),
  constraint outbound_emails_purpose_check check (purpose in ('transactional','marketing')),
  constraint outbound_emails_status_check check (status in ('queued','sending','sent','delivered','bounced','complained','failed','suppressed','cancelled')),
  constraint outbound_emails_attempts_check check (attempt_count >= 0 and max_attempts between 1 and 12),
  constraint outbound_emails_recipient_lower_check check (recipient_email = lower(recipient_email) and recipient_email = btrim(recipient_email)),
  constraint outbound_emails_idempotency_length_check check (char_length(idempotency_key) between 8 and 200)
);

create unique index if not exists outbound_emails_store_idempotency_uidx
  on private.outbound_emails(store_id, idempotency_key);
create unique index if not exists outbound_emails_provider_email_uidx
  on private.outbound_emails(provider, provider_email_id)
  where provider_email_id is not null;
create index if not exists outbound_emails_queue_idx
  on private.outbound_emails(provider, status, available_at, created_at)
  where status in ('queued','failed');
create index if not exists outbound_emails_store_created_idx
  on private.outbound_emails(store_id, created_at desc);

alter table private.outbound_emails enable row level security;
alter table private.outbound_emails force row level security;
revoke all on private.outbound_emails from public, anon, authenticated;
grant select, insert, update, delete on private.outbound_emails to service_role;

create table if not exists private.email_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend',
  provider_event_id text not null,
  event_type text not null,
  provider_email_id text,
  signature_valid boolean not null default false,
  processing_status text not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  constraint email_webhook_events_provider_check check (provider ~ '^[a-z0-9_]+$'),
  constraint email_webhook_events_status_check check (processing_status in ('received','processed','ignored','failed'))
);

create unique index if not exists email_webhook_events_provider_event_uidx
  on private.email_webhook_events(provider, provider_event_id);
create index if not exists email_webhook_events_email_idx
  on private.email_webhook_events(provider, provider_email_id, received_at desc)
  where provider_email_id is not null;

alter table private.email_webhook_events enable row level security;
alter table private.email_webhook_events force row level security;
revoke all on private.email_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on private.email_webhook_events to service_role;

create or replace function private.normalize_email_address(_email text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when _email is null then null
    when lower(btrim(_email)) ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
      then lower(btrim(_email))
    else null
  end;
$$;

create or replace function private.is_email_suppressed(
  _store_id uuid,
  _provider text,
  _email text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select exists (
    select 1
    from private.email_suppressions s
    where s.store_id = _store_id
      and s.provider = lower(btrim(_provider))
      and s.email = private.normalize_email_address(_email)
      and s.active
  );
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
    from private.email_provider_runtime_readiness r
    where r.provider = lower(btrim(_provider))
      and r.environment = lower(btrim(_environment))
  ), false);
$$;

create or replace function private.queue_transactional_email(
  _store_id uuid,
  _recipient_email text,
  _recipient_name text,
  _template_code text,
  _subject text,
  _variables jsonb,
  _idempotency_key text,
  _metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_email text := private.normalize_email_address(_recipient_email);
  v_existing private.outbound_emails%rowtype;
  v_row private.outbound_emails%rowtype;
  v_suppressed boolean;
begin
  if _store_id is null or not exists (
    select 1 from public.stores s where s.id = _store_id and s.status = 'ativa'
  ) then
    raise exception 'STORE_NOT_ACTIVE' using errcode = '22023';
  end if;

  if v_email is null then
    raise exception 'INVALID_EMAIL' using errcode = '22023';
  end if;
  if nullif(btrim(_template_code), '') is null or char_length(btrim(_template_code)) > 120 then
    raise exception 'INVALID_TEMPLATE_CODE' using errcode = '22023';
  end if;
  if nullif(btrim(_subject), '') is null or char_length(btrim(_subject)) > 240 then
    raise exception 'INVALID_EMAIL_SUBJECT' using errcode = '22023';
  end if;
  if nullif(btrim(_idempotency_key), '') is null or char_length(btrim(_idempotency_key)) not between 8 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select * into v_existing
  from private.outbound_emails e
  where e.store_id = _store_id
    and e.idempotency_key = btrim(_idempotency_key);

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'status', v_existing.status,
      'reused', true,
      'suppressed', v_existing.status = 'suppressed'
    );
  end if;

  v_suppressed := private.is_email_suppressed(_store_id, 'resend', v_email);

  insert into private.outbound_emails (
    store_id, provider, purpose, template_code, recipient_email, recipient_name,
    subject, variables, status, idempotency_key, metadata
  ) values (
    _store_id, 'resend', 'transactional', lower(btrim(_template_code)), v_email,
    nullif(btrim(_recipient_name), ''), btrim(_subject), coalesce(_variables, '{}'::jsonb),
    case when v_suppressed then 'suppressed' else 'queued' end,
    btrim(_idempotency_key), coalesce(_metadata, '{}'::jsonb)
  )
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'reused', false,
    'suppressed', v_suppressed
  );
end;
$$;

create or replace function private.claim_next_transactional_email(
  _provider text default 'resend'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_row private.outbound_emails%rowtype;
begin
  if not private.is_email_provider_ready(_provider, 'production') then
    return null;
  end if;

  select * into v_row
  from private.outbound_emails e
  where e.provider = lower(btrim(_provider))
    and e.purpose = 'transactional'
    and e.status in ('queued','failed')
    and e.attempt_count < e.max_attempts
    and e.available_at <= now()
  order by e.available_at, e.created_at
  for update skip locked
  limit 1;

  if not found then return null; end if;

  update private.outbound_emails
  set status = 'sending',
      attempt_count = attempt_count + 1,
      locked_at = now(),
      updated_at = now(),
      last_error_code = null,
      last_error_detail = null
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'store_id', v_row.store_id,
    'provider', v_row.provider,
    'template_code', v_row.template_code,
    'recipient_email', v_row.recipient_email,
    'recipient_name', v_row.recipient_name,
    'subject', v_row.subject,
    'variables', v_row.variables,
    'idempotency_key', v_row.idempotency_key,
    'attempt_count', v_row.attempt_count,
    'max_attempts', v_row.max_attempts,
    'metadata', v_row.metadata
  );
end;
$$;

create or replace function private.complete_transactional_email_send(
  _email_id uuid,
  _provider_email_id text,
  _provider_cost_micros bigint default 0
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  update private.outbound_emails
  set status = 'sent',
      provider_email_id = btrim(_provider_email_id),
      provider_cost_micros = greatest(coalesce(_provider_cost_micros, 0), 0),
      sent_at = coalesce(sent_at, now()),
      locked_at = null,
      updated_at = now()
  where id = _email_id
    and status = 'sending'
    and nullif(btrim(_provider_email_id), '') is not null;
  return found;
end;
$$;

create or replace function private.fail_transactional_email_send(
  _email_id uuid,
  _error_code text,
  _error_detail text,
  _retryable boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_attempt integer;
  v_max integer;
begin
  select attempt_count, max_attempts into v_attempt, v_max
  from private.outbound_emails
  where id = _email_id and status = 'sending'
  for update;

  if not found then return false; end if;

  update private.outbound_emails
  set status = case when coalesce(_retryable, true) and v_attempt < v_max then 'failed' else 'cancelled' end,
      available_at = case
        when coalesce(_retryable, true) and v_attempt < v_max
          then now() + make_interval(secs => least(3600, greatest(30, (power(2, least(v_attempt, 6)) * 30)::int)))
        else available_at
      end,
      failed_at = case when not coalesce(_retryable, true) or v_attempt >= v_max then now() else failed_at end,
      locked_at = null,
      last_error_code = left(coalesce(nullif(btrim(_error_code), ''), 'provider_error'), 120),
      last_error_detail = left(coalesce(_error_detail, ''), 500),
      updated_at = now()
  where id = _email_id;

  return true;
end;
$$;

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
    'ready_for_send', coalesce(v_row.api_key_configured and v_row.domain_verified and v_row.webhook_secret_configured, false),
    'last_health_at', v_row.last_health_at,
    'last_valid_webhook_at', v_row.last_valid_webhook_at,
    'last_error', v_row.last_error
  );
end;
$$;

revoke all on function private.normalize_email_address(text) from public, anon, authenticated;
revoke all on function private.is_email_suppressed(uuid,text,text) from public, anon, authenticated;
revoke all on function private.is_email_provider_ready(text,text) from public, anon, authenticated;
revoke all on function private.queue_transactional_email(uuid,text,text,text,text,jsonb,text,jsonb) from public, anon, authenticated;
revoke all on function private.claim_next_transactional_email(text) from public, anon, authenticated;
revoke all on function private.complete_transactional_email_send(uuid,text,bigint) from public, anon, authenticated;
revoke all on function private.fail_transactional_email_send(uuid,text,text,boolean) from public, anon, authenticated;

grant execute on function private.normalize_email_address(text) to service_role;
grant execute on function private.is_email_suppressed(uuid,text,text) to service_role;
grant execute on function private.is_email_provider_ready(text,text) to service_role;
grant execute on function private.queue_transactional_email(uuid,text,text,text,text,jsonb,text,jsonb) to service_role;
grant execute on function private.claim_next_transactional_email(text) to service_role;
grant execute on function private.complete_transactional_email_send(uuid,text,bigint) to service_role;
grant execute on function private.fail_transactional_email_send(uuid,text,text,boolean) to service_role;

revoke all on function public.get_my_store_email_readiness(uuid) from public, anon;
grant execute on function public.get_my_store_email_readiness(uuid) to authenticated;
