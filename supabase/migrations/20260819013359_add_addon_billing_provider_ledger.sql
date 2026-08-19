-- Comandiva: provider mapping and payment ledger for paid add-ons.
-- No price or provider subscription is created by this migration.

create table private.billing_provider_addon_price_refs (
  id uuid primary key default gen_random_uuid(),
  addon_price_id uuid not null references public.addon_prices(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_]+$'),
  provider_plan_id text not null check (length(trim(provider_plan_id)) between 1 and 255),
  provider_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (addon_price_id, provider),
  unique (provider, provider_plan_id)
);

create index billing_provider_addon_price_refs_price_idx
  on private.billing_provider_addon_price_refs(addon_price_id);

alter table private.billing_provider_addon_price_refs enable row level security;
alter table private.billing_provider_addon_price_refs force row level security;
revoke all on private.billing_provider_addon_price_refs from public, anon, authenticated;
grant all on private.billing_provider_addon_price_refs to service_role;

create trigger set_updated_at_billing_provider_addon_price_refs
before update on private.billing_provider_addon_price_refs
for each row execute function public.set_updated_at();

create table public.addon_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  addon_subscription_id uuid not null references public.store_addon_subscriptions(id) on delete cascade,
  addon_price_id uuid references public.addon_prices(id) on delete set null,
  reference_month date not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected','refunded','cancelled')),
  provider text check (provider is null or provider ~ '^[a-z0-9_]+$'),
  provider_payment_id text,
  provider_invoice_id text,
  provider_event_key text,
  provider_status text,
  due_at timestamptz,
  paid_at timestamptz,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addon_subscription_payments_store_idx
  on public.addon_subscription_payments(store_id, reference_month desc);
create index addon_subscription_payments_subscription_idx
  on public.addon_subscription_payments(addon_subscription_id, reference_month desc);
create index addon_subscription_payments_price_idx
  on public.addon_subscription_payments(addon_price_id) where addon_price_id is not null;
create unique index addon_subscription_payments_provider_payment_uidx
  on public.addon_subscription_payments(provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;
create unique index addon_subscription_payments_provider_event_uidx
  on public.addon_subscription_payments(provider, provider_event_key)
  where provider is not null and provider_event_key is not null;

alter table public.addon_subscription_payments enable row level security;
alter table public.addon_subscription_payments force row level security;
revoke all on public.addon_subscription_payments from public, anon, authenticated;
grant all on public.addon_subscription_payments to service_role;

create trigger set_updated_at_addon_subscription_payments
before update on public.addon_subscription_payments
for each row execute function public.set_updated_at();

create or replace function private.addon_billing_external_reference(_subscription_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
  select case
    when exists (select 1 from public.store_addon_subscriptions s where s.id = _subscription_id)
      then 'comandiva:addon:' || _subscription_id::text
    else null
  end
$function$;

revoke all on function private.addon_billing_external_reference(uuid) from public, anon, authenticated;
grant execute on function private.addon_billing_external_reference(uuid) to service_role;

create or replace function private.attach_addon_provider_subscription(
  _subscription_id uuid,
  _provider text,
  _provider_subscription_id text,
  _provider_customer_id text default null,
  _provider_status text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _updated integer;
begin
  if _provider !~ '^[a-z0-9_]+$'
     or nullif(trim(_provider_subscription_id),'') is null then
    raise exception 'INVALID_PROVIDER_REFERENCE' using errcode='P0001';
  end if;

  update public.store_addon_subscriptions s
  set billing_provider = _provider,
      provider_subscription_id = trim(_provider_subscription_id),
      provider_customer_id = nullif(trim(coalesce(_provider_customer_id,'')),''),
      provider_status = nullif(trim(coalesce(_provider_status,'')),''),
      provider_synced_at = now(),
      updated_at = now()
  where s.id = _subscription_id
    and s.status in ('pending','trial','active','past_due','grace_period');

  get diagnostics _updated = row_count;
  if _updated <> 1 then
    raise exception 'ADDON_SUBSCRIPTION_NOT_ATTACHABLE' using errcode='P0001';
  end if;

  return true;
end;
$function$;

revoke all on function private.attach_addon_provider_subscription(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function private.attach_addon_provider_subscription(uuid,text,text,text,text) to service_role;

create or replace function private.apply_addon_provider_subscription_state(
  _provider text,
  _provider_subscription_id text,
  _provider_status text,
  _canonical_status text,
  _current_period_start timestamptz default null,
  _current_period_end timestamptz default null,
  _trial_ends_at timestamptz default null,
  _grace_until timestamptz default null,
  _cancel_at_period_end boolean default false
)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _updated integer;
begin
  if _canonical_status not in ('pending','trial','active','past_due','grace_period','suspended','cancelled') then
    raise exception 'INVALID_ADDON_SUBSCRIPTION_STATUS' using errcode='P0001';
  end if;
  if _provider !~ '^[a-z0-9_]+$' or nullif(trim(_provider_subscription_id),'') is null then
    raise exception 'INVALID_PROVIDER_REFERENCE' using errcode='P0001';
  end if;
  if _current_period_end is not null and _current_period_start is not null and _current_period_end < _current_period_start then
    raise exception 'INVALID_BILLING_PERIOD' using errcode='P0001';
  end if;

  update public.store_addon_subscriptions s
  set status = _canonical_status,
      provider_status = nullif(trim(coalesce(_provider_status,'')),''),
      provider_synced_at = now(),
      current_period_start = coalesce(_current_period_start,s.current_period_start),
      current_period_end = coalesce(_current_period_end,s.current_period_end),
      trial_ends_at = case when _canonical_status='trial' then coalesce(_trial_ends_at,s.trial_ends_at) else s.trial_ends_at end,
      grace_until = case when _canonical_status='grace_period' then coalesce(_grace_until,s.grace_until) else s.grace_until end,
      cancel_at_period_end = coalesce(_cancel_at_period_end,false),
      activated_at = case when _canonical_status in ('active','trial') then coalesce(s.activated_at,now()) else s.activated_at end,
      cancelled_at = case when _canonical_status='cancelled' then coalesce(s.cancelled_at,now()) else s.cancelled_at end,
      updated_at = now()
  where s.billing_provider = _provider
    and s.provider_subscription_id = trim(_provider_subscription_id);

  get diagnostics _updated = row_count;
  if _updated <> 1 then
    raise exception 'ADDON_PROVIDER_SUBSCRIPTION_NOT_FOUND' using errcode='P0001';
  end if;

  return true;
end;
$function$;

revoke all on function private.apply_addon_provider_subscription_state(text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,boolean) from public, anon, authenticated;
grant execute on function private.apply_addon_provider_subscription_state(text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,boolean) to service_role;

create or replace function private.record_addon_provider_payment(
  _addon_subscription_id uuid,
  _provider text,
  _provider_payment_id text,
  _provider_event_key text,
  _provider_status text,
  _status text,
  _amount_cents integer,
  _currency text default 'BRL',
  _paid_at timestamptz default null,
  _due_at timestamptz default null,
  _provider_invoice_id text default null,
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _subscription public.store_addon_subscriptions%rowtype;
  _payment_id uuid;
  _reference_month date;
  _timezone text;
begin
  if _status not in ('pending','approved','rejected','refunded','cancelled') then
    raise exception 'INVALID_ADDON_PAYMENT_STATUS' using errcode='P0001';
  end if;
  if _provider !~ '^[a-z0-9_]+$' or nullif(trim(_provider_payment_id),'') is null then
    raise exception 'INVALID_PROVIDER_PAYMENT_REFERENCE' using errcode='P0001';
  end if;
  if coalesce(_amount_cents,-1) < 0 or _currency !~ '^[A-Z]{3}$' then
    raise exception 'INVALID_PAYMENT_AMOUNT' using errcode='P0001';
  end if;

  select s.* into _subscription
  from public.store_addon_subscriptions s
  where s.id = _addon_subscription_id;
  if not found then
    raise exception 'ADDON_SUBSCRIPTION_NOT_FOUND' using errcode='P0001';
  end if;
  if _subscription.billing_provider is not null and _subscription.billing_provider <> _provider then
    raise exception 'ADDON_PROVIDER_MISMATCH' using errcode='P0001';
  end if;

  select coalesce(st.timezone,'America/Sao_Paulo') into _timezone
  from public.stores st where st.id=_subscription.store_id;
  _reference_month := date_trunc('month', coalesce(_paid_at,_due_at,now()) at time zone _timezone)::date;

  select p.id into _payment_id
  from public.addon_subscription_payments p
  where p.provider=_provider and p.provider_payment_id=trim(_provider_payment_id);

  if found then
    update public.addon_subscription_payments p
    set provider_event_key = coalesce(nullif(trim(coalesce(_provider_event_key,'')),''),p.provider_event_key),
        provider_status = nullif(trim(coalesce(_provider_status,'')),''),
        status = _status,
        amount_cents = _amount_cents,
        currency = _currency,
        paid_at = coalesce(_paid_at,p.paid_at),
        due_at = coalesce(_due_at,p.due_at),
        provider_invoice_id = coalesce(nullif(trim(coalesce(_provider_invoice_id,'')),''),p.provider_invoice_id),
        metadata = coalesce(_metadata,'{}'::jsonb),
        updated_at = now()
    where p.id=_payment_id;
    return _payment_id;
  end if;

  insert into public.addon_subscription_payments(
    store_id,addon_subscription_id,addon_price_id,reference_month,amount_cents,currency,status,
    provider,provider_payment_id,provider_invoice_id,provider_event_key,provider_status,due_at,paid_at,
    external_reference,metadata
  ) values (
    _subscription.store_id,_subscription.id,_subscription.addon_price_id,_reference_month,_amount_cents,_currency,_status,
    _provider,trim(_provider_payment_id),nullif(trim(coalesce(_provider_invoice_id,'')),''),
    nullif(trim(coalesce(_provider_event_key,'')),''),nullif(trim(coalesce(_provider_status,'')),''),_due_at,_paid_at,
    private.addon_billing_external_reference(_subscription.id),coalesce(_metadata,'{}'::jsonb)
  ) returning id into _payment_id;

  return _payment_id;
exception
  when unique_violation then
    select p.id into _payment_id
    from public.addon_subscription_payments p
    where p.provider=_provider and p.provider_payment_id=trim(_provider_payment_id);
    if _payment_id is not null then return _payment_id; end if;
    raise;
end;
$function$;

revoke all on function private.record_addon_provider_payment(uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz,text,jsonb) from public, anon, authenticated;
grant execute on function private.record_addon_provider_payment(uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz,text,jsonb) to service_role;

comment on table private.billing_provider_addon_price_refs is 'Maps canonical Comandiva add-on prices to external recurring-plan IDs. No provider ID is a source of truth for pricing.';
comment on table public.addon_subscription_payments is 'Service-managed payment ledger for add-on subscriptions. Store users do not receive direct table access.';
comment on function private.apply_addon_provider_subscription_state(text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,boolean) is 'Internal canonical-state transition target for verified provider snapshots. Provider webhooks must fetch the upstream resource before calling this function.';
