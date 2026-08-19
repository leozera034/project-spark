-- Comandiva Sprint 0: add-ons, entitlements, provider accounts, usage metering and automation queue.
-- This migration does not activate paid providers or seed commercial prices.

create table public.addon_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null check (length(trim(name)) between 2 and 120),
  description text,
  category text not null check (category in ('automation','growth','operations','marketing','reputation','fiscal','payments')),
  billing_model text not null check (billing_model in ('flat','metered','hybrid')),
  availability_status text not null default 'planned' check (availability_status in ('planned','beta','available','retired')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.addon_catalog enable row level security;
alter table public.addon_catalog force row level security;
revoke all on public.addon_catalog from public, anon, authenticated;
grant all on public.addon_catalog to service_role;

create trigger set_updated_at_addon_catalog
before update on public.addon_catalog
for each row execute function public.set_updated_at();

create table public.addon_prices (
  id uuid primary key default gen_random_uuid(),
  addon_id uuid not null references public.addon_catalog(id) on delete cascade,
  billing_interval text not null check (billing_interval in ('monthly','annual')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  trial_days smallint not null default 0 check (trial_days between 0 and 365),
  metering_metric_code text check (metering_metric_code is null or metering_metric_code ~ '^[a-z0-9_.-]+$'),
  included_units numeric(18,6) check (included_units is null or included_units >= 0),
  overage_unit_amount_micros bigint check (overage_unit_amount_micros is null or overage_unit_amount_micros >= 0),
  hard_limit_units numeric(18,6) check (hard_limit_units is null or hard_limit_units >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (addon_id, billing_interval)
);

create index addon_prices_addon_id_idx on public.addon_prices(addon_id);

alter table public.addon_prices enable row level security;
alter table public.addon_prices force row level security;
revoke all on public.addon_prices from public, anon, authenticated;
grant all on public.addon_prices to service_role;

create trigger set_updated_at_addon_prices
before update on public.addon_prices
for each row execute function public.set_updated_at();

create table public.addon_entitlements (
  id uuid primary key default gen_random_uuid(),
  addon_id uuid not null references public.addon_catalog(id) on delete cascade,
  feature_code text not null check (feature_code ~ '^[a-z0-9_.-]+$'),
  default_limit numeric(18,6) check (default_limit is null or default_limit >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (addon_id, feature_code)
);

create index addon_entitlements_addon_id_idx on public.addon_entitlements(addon_id);
create index addon_entitlements_feature_code_idx on public.addon_entitlements(feature_code);

alter table public.addon_entitlements enable row level security;
alter table public.addon_entitlements force row level security;
revoke all on public.addon_entitlements from public, anon, authenticated;
grant all on public.addon_entitlements to service_role;

create table public.store_addon_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  addon_id uuid not null references public.addon_catalog(id) on delete restrict,
  addon_price_id uuid references public.addon_prices(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','trial','active','past_due','grace_period','suspended','cancelled','complimentary')),
  billing_interval text check (billing_interval is null or billing_interval in ('monthly','annual')),
  billing_provider text check (billing_provider is null or billing_provider ~ '^[a-z0-9_]+$'),
  provider_customer_id text,
  provider_subscription_id text,
  provider_item_id text,
  provider_status text,
  provider_synced_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean not null default false,
  complimentary_until timestamptz,
  complimentary_reason text,
  activated_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, addon_id),
  check (current_period_end is null or current_period_start is null or current_period_end >= current_period_start)
);

create index store_addon_subscriptions_store_id_idx on public.store_addon_subscriptions(store_id);
create index store_addon_subscriptions_addon_id_idx on public.store_addon_subscriptions(addon_id);
create index store_addon_subscriptions_addon_price_id_idx on public.store_addon_subscriptions(addon_price_id) where addon_price_id is not null;
create index store_addon_subscriptions_status_idx on public.store_addon_subscriptions(store_id,status);
create unique index store_addon_subscriptions_provider_uidx
  on public.store_addon_subscriptions(billing_provider,provider_subscription_id)
  where billing_provider is not null and provider_subscription_id is not null;

alter table public.store_addon_subscriptions enable row level security;
alter table public.store_addon_subscriptions force row level security;
revoke all on public.store_addon_subscriptions from public, anon, authenticated;
grant all on public.store_addon_subscriptions to service_role;

create trigger set_updated_at_store_addon_subscriptions
before update on public.store_addon_subscriptions
for each row execute function public.set_updated_at();

create table public.store_entitlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  feature_code text not null check (feature_code ~ '^[a-z0-9_.-]+$'),
  source_type text not null default 'manual' check (source_type in ('manual','system','promotion','migration')),
  source_key text not null default 'default' check (source_key ~ '^[a-z0-9_.:-]+$'),
  is_enabled boolean not null default true,
  limit_value numeric(18,6) check (limit_value is null or limit_value >= 0),
  config jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, feature_code, source_type, source_key),
  check (ends_at is null or ends_at > starts_at)
);

create index store_entitlements_store_id_idx on public.store_entitlements(store_id);
create index store_entitlements_feature_idx on public.store_entitlements(store_id,feature_code,is_enabled);
create index store_entitlements_granted_by_idx on public.store_entitlements(granted_by) where granted_by is not null;

alter table public.store_entitlements enable row level security;
alter table public.store_entitlements force row level security;
revoke all on public.store_entitlements from public, anon, authenticated;
grant all on public.store_entitlements to service_role;

create trigger set_updated_at_store_entitlements
before update on public.store_entitlements
for each row execute function public.set_updated_at();

create table private.integration_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_]+$'),
  connection_key text not null default 'default' check (connection_key ~ '^[a-z0-9_.:-]+$'),
  external_account_id text,
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','degraded','disabled')),
  credential_ref text,
  public_config jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  last_health_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index integration_provider_accounts_store_uidx
  on private.integration_provider_accounts(store_id,provider,connection_key)
  where store_id is not null;
create unique index integration_provider_accounts_platform_uidx
  on private.integration_provider_accounts(provider,connection_key)
  where store_id is null;
create index integration_provider_accounts_store_id_idx on private.integration_provider_accounts(store_id) where store_id is not null;

alter table private.integration_provider_accounts enable row level security;
alter table private.integration_provider_accounts force row level security;
revoke all on private.integration_provider_accounts from public, anon, authenticated;
grant all on private.integration_provider_accounts to service_role;

create trigger set_updated_at_integration_provider_accounts
before update on private.integration_provider_accounts
for each row execute function public.set_updated_at();

comment on column private.integration_provider_accounts.credential_ref is 'Opaque identifier for a secret stored outside application tables. Never store plaintext provider credentials here.';
comment on column private.integration_provider_accounts.public_config is 'Non-secret provider configuration only.';

create table private.integration_usage_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider_account_id uuid references private.integration_provider_accounts(id) on delete set null,
  provider text not null check (provider ~ '^[a-z0-9_]+$'),
  feature_code text not null check (feature_code ~ '^[a-z0-9_.-]+$'),
  metric_code text not null check (metric_code ~ '^[a-z0-9_.-]+$'),
  quantity numeric(18,6) not null default 1 check (quantity >= 0),
  provider_cost_micros bigint not null default 0 check (provider_cost_micros >= 0),
  customer_charge_micros bigint not null default 0 check (customer_charge_micros >= 0),
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index integration_usage_events_idempotency_uidx
  on private.integration_usage_events(store_id,provider,idempotency_key)
  where idempotency_key is not null;
create index integration_usage_events_store_time_idx on private.integration_usage_events(store_id,occurred_at desc);
create index integration_usage_events_provider_account_idx on private.integration_usage_events(provider_account_id) where provider_account_id is not null;
create index integration_usage_events_metric_idx on private.integration_usage_events(store_id,feature_code,metric_code,occurred_at desc);

alter table private.integration_usage_events enable row level security;
alter table private.integration_usage_events force row level security;
revoke all on private.integration_usage_events from public, anon, authenticated;
grant all on private.integration_usage_events to service_role;

create table private.integration_usage_counters (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_]+$'),
  feature_code text not null check (feature_code ~ '^[a-z0-9_.-]+$'),
  metric_code text not null check (metric_code ~ '^[a-z0-9_.-]+$'),
  period_start date not null,
  period_end date not null,
  quantity numeric(18,6) not null default 0 check (quantity >= 0),
  provider_cost_micros bigint not null default 0 check (provider_cost_micros >= 0),
  customer_charge_micros bigint not null default 0 check (customer_charge_micros >= 0),
  updated_at timestamptz not null default now(),
  unique (store_id,provider,feature_code,metric_code,period_start),
  check (period_end >= period_start)
);

create index integration_usage_counters_store_period_idx on private.integration_usage_counters(store_id,period_start,period_end);

alter table private.integration_usage_counters enable row level security;
alter table private.integration_usage_counters force row level security;
revoke all on private.integration_usage_counters from public, anon, authenticated;
grant all on private.integration_usage_counters to service_role;

create table private.integration_usage_limits (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null default '*' check (provider = '*' or provider ~ '^[a-z0-9_]+$'),
  feature_code text not null check (feature_code ~ '^[a-z0-9_.-]+$'),
  metric_code text not null check (metric_code ~ '^[a-z0-9_.-]+$'),
  included_units numeric(18,6) check (included_units is null or included_units >= 0),
  hard_limit_units numeric(18,6) check (hard_limit_units is null or hard_limit_units >= 0),
  warn_percent smallint not null default 70 check (warn_percent between 1 and 100),
  critical_percent smallint not null default 90 check (critical_percent between 1 and 100),
  limit_action text not null default 'block' check (limit_action in ('block','allow_overage','notify_only')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id,provider,feature_code,metric_code),
  check (critical_percent >= warn_percent),
  check (hard_limit_units is null or included_units is null or hard_limit_units >= included_units)
);

create index integration_usage_limits_store_id_idx on private.integration_usage_limits(store_id);

alter table private.integration_usage_limits enable row level security;
alter table private.integration_usage_limits force row level security;
revoke all on private.integration_usage_limits from public, anon, authenticated;
grant all on private.integration_usage_limits to service_role;

create trigger set_updated_at_integration_usage_limits
before update on private.integration_usage_limits
for each row execute function public.set_updated_at();

create table private.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  rule_id uuid references public.store_automation_rules(id) on delete set null,
  event_code text not null check (event_code ~ '^[a-z0-9_.-]+$'),
  action_code text not null check (action_code ~ '^[a-z0-9_.-]+$'),
  status text not null default 'queued' check (status in ('queued','processing','succeeded','failed','cancelled')),
  priority smallint not null default 100 check (priority between 0 and 1000),
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 50),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index automation_jobs_dedupe_uidx
  on private.automation_jobs(store_id,dedupe_key)
  where dedupe_key is not null;
create index automation_jobs_queue_idx on private.automation_jobs(status,available_at,priority,created_at);
create index automation_jobs_store_idx on private.automation_jobs(store_id,created_at desc);
create index automation_jobs_rule_id_idx on private.automation_jobs(rule_id) where rule_id is not null;

alter table private.automation_jobs enable row level security;
alter table private.automation_jobs force row level security;
revoke all on private.automation_jobs from public, anon, authenticated;
grant all on private.automation_jobs to service_role;

create trigger set_updated_at_automation_jobs
before update on private.automation_jobs
for each row execute function public.set_updated_at();

create table private.automation_job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references private.automation_jobs(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('started','succeeded','failed')),
  provider text check (provider is null or provider ~ '^[a-z0-9_]+$'),
  provider_request_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  unique (job_id,attempt_number),
  check (finished_at is null or finished_at >= started_at)
);

create index automation_job_attempts_job_id_idx on private.automation_job_attempts(job_id);

alter table private.automation_job_attempts enable row level security;
alter table private.automation_job_attempts force row level security;
revoke all on private.automation_job_attempts from public, anon, authenticated;
grant all on private.automation_job_attempts to service_role;

create or replace function private.store_has_entitlement(_store_id uuid, _feature_code text)
returns boolean
language sql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
  select
    _store_id is not null
    and _feature_code is not null
    and (
      exists (
        select 1
        from public.store_entitlements e
        where e.store_id = _store_id
          and e.feature_code = _feature_code
          and e.is_enabled
          and e.starts_at <= now()
          and (e.ends_at is null or e.ends_at > now())
      )
      or exists (
        select 1
        from public.store_addon_subscriptions s
        join public.addon_entitlements ae on ae.addon_id = s.addon_id
        where s.store_id = _store_id
          and ae.feature_code = _feature_code
          and s.status in ('active','trial','grace_period','complimentary')
          and (s.status <> 'trial' or s.trial_ends_at is null or s.trial_ends_at > now())
          and (s.status <> 'grace_period' or s.grace_until is null or s.grace_until > now())
          and (s.status <> 'complimentary' or s.complimentary_until is null or s.complimentary_until > now())
          and (s.current_period_end is null or s.current_period_end > now() or s.status in ('grace_period','complimentary'))
      )
    )
$function$;

revoke all on function private.store_has_entitlement(uuid,text) from public, anon, authenticated;
grant execute on function private.store_has_entitlement(uuid,text) to service_role;

create or replace function private.require_store_entitlement(_store_id uuid, _feature_code text)
returns void
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  if not private.store_has_entitlement(_store_id,_feature_code) then
    raise exception 'ADDON_REQUIRED' using
      errcode='P0001',
      detail=jsonb_build_object('feature_code',_feature_code)::text;
  end if;
end;
$function$;

revoke all on function private.require_store_entitlement(uuid,text) from public, anon, authenticated;
grant execute on function private.require_store_entitlement(uuid,text) to service_role;

create or replace function private.is_store_usage_allowed(
  _store_id uuid,
  _provider text,
  _feature_code text,
  _metric_code text,
  _requested_quantity numeric default 1
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _limit private.integration_usage_limits%rowtype;
  _period_start date := date_trunc('month', current_date)::date;
  _used numeric(18,6) := 0;
begin
  if _store_id is null or _requested_quantity is null or _requested_quantity < 0 then
    return false;
  end if;

  select l.* into _limit
  from private.integration_usage_limits l
  where l.store_id = _store_id
    and l.feature_code = _feature_code
    and l.metric_code = _metric_code
    and l.provider in (coalesce(_provider,''),'*')
  order by case when l.provider = _provider then 0 else 1 end
  limit 1;

  if not found or _limit.hard_limit_units is null or _limit.limit_action <> 'block' then
    return true;
  end if;

  select coalesce(sum(c.quantity),0) into _used
  from private.integration_usage_counters c
  where c.store_id = _store_id
    and c.feature_code = _feature_code
    and c.metric_code = _metric_code
    and c.period_start = _period_start
    and (_limit.provider = '*' or c.provider = _limit.provider);

  return (_used + _requested_quantity) <= _limit.hard_limit_units;
end;
$function$;

revoke all on function private.is_store_usage_allowed(uuid,text,text,text,numeric) from public, anon, authenticated;
grant execute on function private.is_store_usage_allowed(uuid,text,text,text,numeric) to service_role;

create or replace function private.record_integration_usage(
  _store_id uuid,
  _provider text,
  _feature_code text,
  _metric_code text,
  _quantity numeric default 1,
  _provider_cost_micros bigint default 0,
  _customer_charge_micros bigint default 0,
  _idempotency_key text default null,
  _occurred_at timestamptz default now(),
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _event_id uuid;
  _timezone text;
  _period_start date;
  _period_end date;
begin
  if not exists (select 1 from public.stores s where s.id = _store_id) then
    raise exception 'STORE_NOT_FOUND' using errcode='P0001';
  end if;
  if _provider !~ '^[a-z0-9_]+$' or _feature_code !~ '^[a-z0-9_.-]+$' or _metric_code !~ '^[a-z0-9_.-]+$' then
    raise exception 'INVALID_USAGE_DIMENSION' using errcode='P0001';
  end if;
  if coalesce(_quantity,-1) < 0 or coalesce(_provider_cost_micros,-1) < 0 or coalesce(_customer_charge_micros,-1) < 0 then
    raise exception 'INVALID_USAGE_AMOUNT' using errcode='P0001';
  end if;

  if _idempotency_key is not null then
    select e.id into _event_id
    from private.integration_usage_events e
    where e.store_id = _store_id
      and e.provider = _provider
      and e.idempotency_key = _idempotency_key;
    if found then return _event_id; end if;
  end if;

  select coalesce(s.timezone,'America/Sao_Paulo') into _timezone
  from public.stores s where s.id = _store_id;

  _period_start := date_trunc('month', _occurred_at at time zone _timezone)::date;
  _period_end := (_period_start + interval '1 month - 1 day')::date;

  insert into private.integration_usage_events(
    store_id,provider,feature_code,metric_code,quantity,provider_cost_micros,
    customer_charge_micros,idempotency_key,occurred_at,metadata
  ) values (
    _store_id,_provider,_feature_code,_metric_code,_quantity,_provider_cost_micros,
    _customer_charge_micros,_idempotency_key,_occurred_at,coalesce(_metadata,'{}'::jsonb)
  )
  returning id into _event_id;

  insert into private.integration_usage_counters(
    store_id,provider,feature_code,metric_code,period_start,period_end,quantity,
    provider_cost_micros,customer_charge_micros
  ) values (
    _store_id,_provider,_feature_code,_metric_code,_period_start,_period_end,_quantity,
    _provider_cost_micros,_customer_charge_micros
  )
  on conflict (store_id,provider,feature_code,metric_code,period_start)
  do update set
    quantity = private.integration_usage_counters.quantity + excluded.quantity,
    provider_cost_micros = private.integration_usage_counters.provider_cost_micros + excluded.provider_cost_micros,
    customer_charge_micros = private.integration_usage_counters.customer_charge_micros + excluded.customer_charge_micros,
    period_end = excluded.period_end,
    updated_at = now();

  return _event_id;
exception
  when unique_violation then
    if _idempotency_key is not null then
      select e.id into _event_id
      from private.integration_usage_events e
      where e.store_id = _store_id
        and e.provider = _provider
        and e.idempotency_key = _idempotency_key;
      if _event_id is not null then return _event_id; end if;
    end if;
    raise;
end;
$function$;

revoke all on function private.record_integration_usage(uuid,text,text,text,numeric,bigint,bigint,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function private.record_integration_usage(uuid,text,text,text,numeric,bigint,bigint,text,timestamptz,jsonb) to service_role;

create or replace function private.enqueue_automation_job(
  _store_id uuid,
  _rule_id uuid,
  _event_code text,
  _action_code text,
  _payload jsonb default '{}'::jsonb,
  _dedupe_key text default null,
  _available_at timestamptz default now(),
  _max_attempts integer default 5
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _job_id uuid;
begin
  if not exists (select 1 from public.stores s where s.id = _store_id) then
    raise exception 'STORE_NOT_FOUND' using errcode='P0001';
  end if;
  if _rule_id is not null and not exists (
    select 1 from public.store_automation_rules r where r.id = _rule_id and r.store_id = _store_id
  ) then
    raise exception 'AUTOMATION_RULE_NOT_FOUND' using errcode='P0001';
  end if;
  if _event_code !~ '^[a-z0-9_.-]+$' or _action_code !~ '^[a-z0-9_.-]+$' then
    raise exception 'INVALID_AUTOMATION_CODE' using errcode='P0001';
  end if;

  if _dedupe_key is not null then
    select j.id into _job_id
    from private.automation_jobs j
    where j.store_id = _store_id and j.dedupe_key = _dedupe_key;
    if found then return _job_id; end if;
  end if;

  insert into private.automation_jobs(store_id,rule_id,event_code,action_code,payload,dedupe_key,available_at,max_attempts)
  values(_store_id,_rule_id,_event_code,_action_code,coalesce(_payload,'{}'::jsonb),_dedupe_key,coalesce(_available_at,now()),greatest(1,least(coalesce(_max_attempts,5),50)))
  returning id into _job_id;

  return _job_id;
exception
  when unique_violation then
    if _dedupe_key is not null then
      select j.id into _job_id from private.automation_jobs j where j.store_id=_store_id and j.dedupe_key=_dedupe_key;
      if _job_id is not null then return _job_id; end if;
    end if;
    raise;
end;
$function$;

revoke all on function private.enqueue_automation_job(uuid,uuid,text,text,jsonb,text,timestamptz,integer) from public, anon, authenticated;
grant execute on function private.enqueue_automation_job(uuid,uuid,text,text,jsonb,text,timestamptz,integer) to service_role;

create or replace function public.get_my_store_addons(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _items jsonb;
begin
  if not private.is_store_member(_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(item order by (item->>'sort_order')::integer,item->>'name'),'[]'::jsonb)
  into _items
  from (
    select jsonb_build_object(
      'code',a.code,
      'name',a.name,
      'description',a.description,
      'category',a.category,
      'billing_model',a.billing_model,
      'availability_status',a.availability_status,
      'sort_order',a.sort_order,
      'features',coalesce((select jsonb_agg(ae.feature_code order by ae.feature_code) from public.addon_entitlements ae where ae.addon_id=a.id),'[]'::jsonb),
      'monthly_price',case when p.id is null then null else jsonb_build_object(
        'amount_cents',p.amount_cents,
        'currency',p.currency,
        'included_units',p.included_units,
        'metering_metric_code',p.metering_metric_code,
        'hard_limit_units',p.hard_limit_units
      ) end,
      'subscription',case when s.id is null then null else jsonb_build_object(
        'status',s.status,
        'current_period_end',s.current_period_end,
        'trial_ends_at',s.trial_ends_at,
        'grace_until',s.grace_until,
        'cancel_at_period_end',s.cancel_at_period_end,
        'complimentary_until',s.complimentary_until
      ) end
    ) as item
    from public.addon_catalog a
    left join lateral (
      select ap.* from public.addon_prices ap
      where ap.addon_id=a.id and ap.billing_interval='monthly' and ap.is_active
      order by ap.created_at desc limit 1
    ) p on true
    left join public.store_addon_subscriptions s on s.store_id=_store_id and s.addon_id=a.id
    where a.is_active
  ) q;

  return jsonb_build_object('items',_items);
end;
$function$;

revoke all on function public.get_my_store_addons(uuid) from public, anon;
grant execute on function public.get_my_store_addons(uuid) to authenticated, service_role;

create or replace function public.get_my_store_entitlements(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _items jsonb;
begin
  if not private.is_store_member(_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  with feature_codes as (
    select e.feature_code
    from public.store_entitlements e
    where e.store_id=_store_id and e.is_enabled and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
    union
    select ae.feature_code
    from public.store_addon_subscriptions s
    join public.addon_entitlements ae on ae.addon_id=s.addon_id
    where s.store_id=_store_id
      and private.store_has_entitlement(_store_id,ae.feature_code)
  )
  select coalesce(jsonb_agg(feature_code order by feature_code),'[]'::jsonb) into _items from feature_codes;

  return jsonb_build_object('features',_items);
end;
$function$;

revoke all on function public.get_my_store_entitlements(uuid) from public, anon;
grant execute on function public.get_my_store_entitlements(uuid) to authenticated, service_role;

create or replace function public.get_my_store_usage_summary(_store_id uuid, _period_start date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _start date := coalesce(_period_start,date_trunc('month',current_date)::date);
  _items jsonb;
begin
  if not private.is_store_manager(_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'provider',c.provider,
    'feature_code',c.feature_code,
    'metric_code',c.metric_code,
    'period_start',c.period_start,
    'period_end',c.period_end,
    'quantity',c.quantity,
    'included_units',coalesce(ls.included_units,lw.included_units),
    'hard_limit_units',coalesce(ls.hard_limit_units,lw.hard_limit_units),
    'warn_percent',coalesce(ls.warn_percent,lw.warn_percent),
    'critical_percent',coalesce(ls.critical_percent,lw.critical_percent),
    'limit_action',coalesce(ls.limit_action,lw.limit_action)
  ) order by c.feature_code,c.metric_code,c.provider),'[]'::jsonb)
  into _items
  from private.integration_usage_counters c
  left join private.integration_usage_limits ls
    on ls.store_id=c.store_id and ls.provider=c.provider and ls.feature_code=c.feature_code and ls.metric_code=c.metric_code
  left join private.integration_usage_limits lw
    on lw.store_id=c.store_id and lw.provider='*' and lw.feature_code=c.feature_code and lw.metric_code=c.metric_code
  where c.store_id=_store_id and c.period_start=_start;

  return jsonb_build_object('period_start',_start,'items',_items);
end;
$function$;

revoke all on function public.get_my_store_usage_summary(uuid,date) from public, anon;
grant execute on function public.get_my_store_usage_summary(uuid,date) to authenticated, service_role;

insert into public.addon_catalog(code,name,description,category,billing_model,availability_status,sort_order)
values
  ('whatsapp_automation','WhatsApp Automático','Atualizações de pedido, recuperação e campanhas automáticas via WhatsApp oficial.','automation','hybrid','planned',10),
  ('ai_assistant','Atendente IA','Atendimento assistido por IA com ferramentas seguras do Comandiva.','automation','hybrid','planned',20),
  ('growth_pro','Growth Pro','Segmentação avançada, recuperação, recorrência e inteligência de crescimento.','growth','flat','planned',30),
  ('smart_delivery','Entrega Inteligente','Validação de endereço, distância, rota e recursos avançados de entrega.','operations','hybrid','planned',40),
  ('reputation','Reputação','Automação de pós-venda e gestão de reputação online.','reputation','flat','planned',50),
  ('fiscal','Fiscal','Emissão fiscal automatizada por provedor homologado.','fiscal','hybrid','planned',60),
  ('payments','Pagamentos','Automação de confirmação e conciliação de pagamentos do estabelecimento.','payments','flat','planned',70),
  ('marketing_pro','Marketing Pro','Campanhas multicanal, segmentação e atribuição de receita.','marketing','hybrid','planned',80),
  ('ads','Ads','Integração de mídia paga e atribuição de pedidos e receita.','marketing','flat','planned',90)
on conflict(code) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  billing_model=excluded.billing_model,
  sort_order=excluded.sort_order,
  updated_at=now();

insert into public.addon_entitlements(addon_id,feature_code)
select a.id,x.feature_code
from public.addon_catalog a
join (values
  ('whatsapp_automation','messaging.whatsapp.automation'),
  ('ai_assistant','ai.assistant'),
  ('growth_pro','growth.pro'),
  ('smart_delivery','delivery.smart'),
  ('reputation','reputation.google'),
  ('fiscal','fiscal.automation'),
  ('payments','payments.automation'),
  ('marketing_pro','marketing.pro'),
  ('ads','marketing.ads')
) as x(addon_code,feature_code) on x.addon_code=a.code
on conflict(addon_id,feature_code) do nothing;

comment on table public.addon_catalog is 'Comandiva add-on catalog. Commercial prices are stored separately in addon_prices.';
comment on table public.store_addon_subscriptions is 'Per-store add-on subscription state independent from the base Comandiva plan subscription.';
comment on table public.store_entitlements is 'Explicit time-bounded feature grants. Paid add-on entitlements are also derived dynamically from active store_addon_subscriptions.';
comment on table private.integration_usage_events is 'Immutable provider usage ledger per store. Costs use BRL micros (1 BRL = 1,000,000 micros).';
comment on table private.integration_usage_limits is 'Per-store usage guardrails used before calling variable-cost providers.';
comment on table private.automation_jobs is 'Server-only durable queue foundation for Comandiva automation actions.';
