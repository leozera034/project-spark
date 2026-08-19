-- Comandiva financial core consolidation (Stripe-only)
-- Phase 2 foundation: canonical plan mappings, plan checkout intents,
-- auditable ledger, invoice/refund/dispute/payout projections and order payment state.

alter table private.billing_provider_plan_refs
  add column if not exists provider_product_id text;

-- Canonical Stripe Billing mapping. Resolve internal IDs by stable plan code + interval.
insert into private.billing_provider_plan_refs (
  plan_price_id, provider, provider_plan_id, provider_product_id, provider_status, metadata, updated_at
)
select pp.id, 'stripe', v.price_id, v.product_id, 'active',
       jsonb_build_object('environment','live','source','financial_core_phase2'), now()
from (values
  ('essencial','monthly','price_1U6I1uQYj7wiKEClLVDryVpz','prod_V6V1wwICY99glC'),
  ('essencial','annual','price_1U6I2PQYj7wiKEClnNfPXj7o','prod_V6V1wwICY99glC'),
  ('profissional','monthly','price_1U6I22QYj7wiKEClnTM29z1o','prod_V6V2fNoNkvqvVD'),
  ('profissional','annual','price_1U6I2YQYj7wiKEClHWxoBBSL','prod_V6V2fNoNkvqvVD'),
  ('avancado','monthly','price_1U6I2BQYj7wiKEClld2AGkVw','prod_V6V2I155hFxDfI'),
  ('avancado','annual','price_1U6I2hQYj7wiKEClJwbT1brd','prod_V6V2I155hFxDfI')
) as v(plan_code,billing_interval,price_id,product_id)
join public.plans p on p.code=v.plan_code
join public.plan_prices pp on pp.plan_id=p.id and pp.billing_interval=v.billing_interval
on conflict (plan_price_id, provider) do update set
  provider_plan_id=excluded.provider_plan_id,
  provider_product_id=excluded.provider_product_id,
  provider_status='active',
  metadata=private.billing_provider_plan_refs.metadata || excluded.metadata,
  updated_at=now();

alter table public.store_subscriptions
  add column if not exists current_period_start_at timestamptz,
  add column if not exists current_period_end_at timestamptz,
  add column if not exists provider_event_created bigint,
  add column if not exists default_payment_method_brand text,
  add column if not exists default_payment_method_last4 text,
  add column if not exists default_payment_method_exp_month smallint,
  add column if not exists default_payment_method_exp_year smallint;

alter table private.stripe_order_payment_intents
  add column if not exists last_event_created bigint,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists refunded_amount_cents integer not null default 0;

alter table public.orders
  add column if not exists payment_status text not null default 'not_applicable',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_provider text,
  add column if not exists paid_amount_cents integer;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check check (
  payment_status in ('not_applicable','pending','processing','paid','failed','partially_refunded','refunded','disputed','cancelled')
);

update public.orders o
set payment_status = case
  when spi.status='succeeded' then 'paid'
  when spi.status in ('processing','requires_action','requires_confirmation','requires_capture') then 'processing'
  when spi.status in ('canceled') then 'cancelled'
  else 'pending'
end,
payment_provider='stripe',
paid_amount_cents=case when spi.status='succeeded' then spi.amount_cents else o.paid_amount_cents end,
paid_at=case when spi.status='succeeded' then coalesce(spi.paid_at,o.paid_at) else o.paid_at end
from private.stripe_order_payment_intents spi
where spi.order_id=o.id;

update public.orders
set payment_status='pending', payment_provider='stripe'
where payment_method_kind='stripe_online' and payment_status='not_applicable';

create table if not exists private.plan_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  store_subscription_id uuid not null references public.store_subscriptions(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_plan_price_id uuid not null references public.plan_prices(id) on delete restrict,
  provider text not null default 'stripe' check (provider='stripe'),
  provider_price_id text not null,
  idempotency_key text not null,
  external_reference text not null,
  checkout_session_id text,
  checkout_url text,
  status text not null default 'created' check (status in ('created','checkout_open','completed','expired','failed','superseded')),
  failure_code text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,idempotency_key),
  unique(external_reference),
  unique(checkout_session_id)
);
alter table private.plan_checkout_attempts enable row level security;
revoke all on private.plan_checkout_attempts from anon, authenticated;
grant select,insert,update,delete on private.plan_checkout_attempts to service_role;

create table if not exists private.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete restrict,
  domain text not null check (domain in ('saas_billing','order_payment','platform_fee','refund','dispute','transfer','payout','adjustment')),
  provider text not null default 'stripe' check (provider='stripe'),
  source_type text not null,
  source_id text not null,
  provider_event_id text,
  idempotency_key text not null unique,
  currency text not null default 'BRL' check (currency=upper(currency) and length(currency)=3),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table private.financial_transactions enable row level security;
revoke all on private.financial_transactions from anon, authenticated;
grant select,insert,update,delete on private.financial_transactions to service_role;
create index if not exists financial_transactions_store_occurred_idx on private.financial_transactions(store_id,occurred_at desc);
create index if not exists financial_transactions_provider_event_idx on private.financial_transactions(provider_event_id) where provider_event_id is not null;

create table if not exists private.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references private.financial_transactions(id) on delete restrict,
  store_id uuid references public.stores(id) on delete restrict,
  account_code text not null,
  economic_owner text not null check (economic_owner in ('platform','store','processor','customer')),
  direction text not null check (direction in ('debit','credit')),
  amount_cents bigint not null check (amount_cents>0),
  currency text not null default 'BRL' check (currency=upper(currency) and length(currency)=3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table private.financial_ledger_entries enable row level security;
revoke all on private.financial_ledger_entries from anon, authenticated;
grant select,insert,update,delete on private.financial_ledger_entries to service_role;
create index if not exists financial_ledger_entries_transaction_idx on private.financial_ledger_entries(transaction_id);
create index if not exists financial_ledger_entries_store_account_idx on private.financial_ledger_entries(store_id,account_code,created_at desc);

create table if not exists private.financial_invoices (
  stripe_invoice_id text primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  store_subscription_id uuid references public.store_subscriptions(id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null,
  currency text not null default 'BRL',
  amount_due_cents bigint not null default 0,
  amount_paid_cents bigint not null default 0,
  amount_remaining_cents bigint not null default 0,
  hosted_invoice_url text,
  invoice_pdf text,
  due_at timestamptz,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  provider_event_created bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.financial_invoices enable row level security;
revoke all on private.financial_invoices from anon, authenticated;
grant select,insert,update,delete on private.financial_invoices to service_role;
create index if not exists financial_invoices_store_idx on private.financial_invoices(store_id,created_at desc);

create table if not exists private.financial_refunds (
  stripe_refund_id text primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  stripe_payment_intent_id text,
  amount_cents bigint not null check (amount_cents>0),
  currency text not null default 'BRL',
  status text not null,
  reason text,
  provider_event_created bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.financial_refunds enable row level security;
revoke all on private.financial_refunds from anon, authenticated;
grant select,insert,update,delete on private.financial_refunds to service_role;

create table if not exists private.financial_disputes (
  stripe_dispute_id text primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  stripe_payment_intent_id text,
  amount_cents bigint not null check (amount_cents>0),
  currency text not null default 'BRL',
  status text not null,
  reason text,
  evidence_due_by timestamptz,
  provider_event_created bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.financial_disputes enable row level security;
revoke all on private.financial_disputes from anon, authenticated;
grant select,insert,update,delete on private.financial_disputes to service_role;

create table if not exists private.financial_payouts (
  stripe_payout_id text primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  stripe_account_id text not null,
  amount_cents bigint not null check (amount_cents>0),
  currency text not null default 'BRL',
  speed text not null default 'standard' check (speed in ('standard','daily','fast','instant')),
  status text not null,
  platform_speed_fee_cents bigint not null default 0 check (platform_speed_fee_cents>=0),
  provider_payout_fee_cents bigint not null default 0 check (provider_payout_fee_cents>=0),
  arrival_at timestamptz,
  failure_code text,
  failure_message text,
  provider_event_created bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.financial_payouts enable row level security;
revoke all on private.financial_payouts from anon, authenticated;
grant select,insert,update,delete on private.financial_payouts to service_role;
create index if not exists financial_payouts_store_idx on private.financial_payouts(store_id,created_at desc);

create table if not exists private.financial_pricing_policies (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  payment_method text not null,
  platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 10000),
  platform_fixed_fee_cents integer not null default 0 check (platform_fixed_fee_cents>=0),
  estimated_processor_fee_bps integer not null default 0 check (estimated_processor_fee_bps between 0 and 10000),
  estimated_processor_fixed_fee_cents integer not null default 0 check (estimated_processor_fixed_fee_cents>=0),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(code,effective_from)
);
alter table private.financial_pricing_policies enable row level security;
revoke all on private.financial_pricing_policies from anon, authenticated;
grant select,insert,update,delete on private.financial_pricing_policies to service_role;

create table if not exists private.financial_payout_speed_policies (
  speed text primary key check (speed in ('standard','daily','fast','instant')),
  platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 10000),
  platform_fixed_fee_cents integer not null default 0 check (platform_fixed_fee_cents>=0),
  estimated_provider_fee_bps integer not null default 0 check (estimated_provider_fee_bps between 0 and 10000),
  estimated_provider_fixed_fee_cents integer not null default 0 check (estimated_provider_fixed_fee_cents>=0),
  enabled boolean not null default false,
  requires_provider_eligibility boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table private.financial_payout_speed_policies enable row level security;
revoke all on private.financial_payout_speed_policies from anon, authenticated;
grant select,insert,update,delete on private.financial_payout_speed_policies to service_role;
insert into private.financial_payout_speed_policies(speed,platform_fee_bps,enabled,requires_provider_eligibility)
values ('standard',0,true,false),('daily',49,false,true),('fast',99,false,true),('instant',199,false,true)
on conflict(speed) do nothing;

create table if not exists private.financial_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  store_id uuid references public.stores(id) on delete restrict,
  provider text not null default 'stripe',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','succeeded','partial','failed')),
  checked_count integer not null default 0,
  mismatch_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_error text
);
alter table private.financial_reconciliation_runs enable row level security;
revoke all on private.financial_reconciliation_runs from anon, authenticated;
grant select,insert,update,delete on private.financial_reconciliation_runs to service_role;

create table if not exists private.financial_reconciliation_issues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.financial_reconciliation_runs(id) on delete cascade,
  store_id uuid references public.stores(id) on delete restrict,
  entity_type text not null,
  entity_id text not null,
  issue_code text not null,
  expected jsonb,
  actual jsonb,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);
alter table private.financial_reconciliation_issues enable row level security;
revoke all on private.financial_reconciliation_issues from anon, authenticated;
grant select,insert,update,delete on private.financial_reconciliation_issues to service_role;

create or replace function private.post_financial_transaction(
  _store_id uuid,
  _domain text,
  _source_type text,
  _source_id text,
  _provider_event_id text,
  _idempotency_key text,
  _currency text,
  _occurred_at timestamptz,
  _entries jsonb,
  _metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer
set search_path='pg_catalog','private','public'
as $$
declare
  tx_id uuid;
  e jsonb;
  debits bigint:=0;
  credits bigint:=0;
  amount bigint;
  dir text;
begin
  if _domain not in ('saas_billing','order_payment','platform_fee','refund','dispute','transfer','payout','adjustment') then
    raise exception 'INVALID_FINANCIAL_DOMAIN';
  end if;
  if nullif(btrim(_idempotency_key),'') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if jsonb_typeof(_entries) <> 'array' or jsonb_array_length(_entries) < 2 then raise exception 'LEDGER_ENTRIES_INVALID'; end if;
  for e in select value from jsonb_array_elements(_entries) loop
    amount := (e->>'amount_cents')::bigint;
    dir := e->>'direction';
    if amount <= 0 or dir not in ('debit','credit') then raise exception 'LEDGER_ENTRY_INVALID'; end if;
    if dir='debit' then debits:=debits+amount; else credits:=credits+amount; end if;
  end loop;
  if debits<>credits then raise exception 'LEDGER_UNBALANCED'; end if;

  insert into private.financial_transactions(store_id,domain,source_type,source_id,provider_event_id,idempotency_key,currency,occurred_at,metadata)
  values(_store_id,_domain,_source_type,_source_id,_provider_event_id,btrim(_idempotency_key),upper(_currency),coalesce(_occurred_at,now()),coalesce(_metadata,'{}'::jsonb))
  on conflict(idempotency_key) do nothing returning id into tx_id;
  if tx_id is null then select id into tx_id from private.financial_transactions where idempotency_key=btrim(_idempotency_key); return tx_id; end if;

  for e in select value from jsonb_array_elements(_entries) loop
    insert into private.financial_ledger_entries(transaction_id,store_id,account_code,economic_owner,direction,amount_cents,currency,metadata)
    values(tx_id,_store_id,e->>'account_code',e->>'economic_owner',e->>'direction',(e->>'amount_cents')::bigint,upper(_currency),coalesce(e->'metadata','{}'::jsonb));
  end loop;
  return tx_id;
end $$;
revoke all on function private.post_financial_transaction(uuid,text,text,text,text,text,text,timestamptz,jsonb,jsonb) from public, anon, authenticated;
grant execute on function private.post_financial_transaction(uuid,text,text,text,text,text,text,timestamptz,jsonb,jsonb) to service_role;

create or replace function public.billing_begin_plan_checkout(
  _actor_user_id uuid,
  _store_id uuid,
  _plan_code text,
  _billing_interval text,
  _idempotency_key text
) returns jsonb
language plpgsql security definer
set search_path='pg_catalog','public','private'
as $$
declare
  sub public.store_subscriptions%rowtype;
  pp public.plan_prices%rowtype;
  p public.plans%rowtype;
  pref private.billing_provider_plan_refs%rowtype;
  attempt private.plan_checkout_attempts%rowtype;
  ext text;
begin
  if not private.is_store_manager_user(_actor_user_id,_store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if _billing_interval not in ('monthly','annual') then raise exception 'INVALID_BILLING_INTERVAL'; end if;
  if nullif(btrim(_idempotency_key),'') is null or length(btrim(_idempotency_key)) not between 8 and 160 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;

  select a.* into attempt from private.plan_checkout_attempts a where a.store_id=_store_id and a.idempotency_key=btrim(_idempotency_key);
  if found then
    return jsonb_build_object('reused',true,'attempt_id',attempt.id,'checkout_url',attempt.checkout_url,'external_reference',attempt.external_reference,'provider_price_id',attempt.provider_price_id,'status',attempt.status);
  end if;

  select * into p from public.plans where code=_plan_code and is_active;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;
  select * into pp from public.plan_prices where plan_id=p.id and billing_interval=_billing_interval and is_active limit 1;
  if not found then raise exception 'PLAN_PRICE_NOT_FOUND'; end if;
  if pp.amount_cents<=0 then raise exception 'FREE_PLAN_DOES_NOT_REQUIRE_CHECKOUT'; end if;
  select * into pref from private.billing_provider_plan_refs where plan_price_id=pp.id and provider='stripe' and provider_status='active';
  if not found then raise exception 'STRIPE_PRICE_NOT_READY'; end if;

  select * into sub from public.store_subscriptions where store_id=_store_id for update;
  if not found then raise exception 'STORE_SUBSCRIPTION_MISSING'; end if;
  if sub.provider_subscription_id is not null and coalesce(sub.provider_status,'') in ('active','trialing','past_due','unpaid','incomplete') then
    raise exception 'EXISTING_STRIPE_SUBSCRIPTION' using detail=sub.provider_subscription_id;
  end if;

  ext := 'comandiva:plan:' || sub.id::text;
  insert into private.plan_checkout_attempts(store_id,store_subscription_id,actor_user_id,target_plan_price_id,provider_price_id,idempotency_key,external_reference)
  values(_store_id,sub.id,_actor_user_id,pp.id,pref.provider_plan_id,btrim(_idempotency_key),ext)
  returning * into attempt;

  return jsonb_build_object('reused',false,'attempt_id',attempt.id,'subscription_id',sub.id,'plan_code',p.code,'plan_name',p.name,'plan_price_id',pp.id,'amount_cents',pp.amount_cents,'currency',pp.currency,'billing_interval',pp.billing_interval,'trial_days',pp.trial_days,'provider','stripe','provider_price_id',pref.provider_plan_id,'provider_product_id',pref.provider_product_id,'external_reference',ext);
end $$;
revoke all on function public.billing_begin_plan_checkout(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.billing_begin_plan_checkout(uuid,uuid,text,text,text) to service_role;

create or replace function public.billing_reconcile_stripe_plan_subscription(
  _provider_subscription_id text,
  _provider_customer_id text,
  _provider_item_id text,
  _provider_status text,
  _external_reference text,
  _provider_price_id text,
  _current_period_start timestamptz,
  _current_period_end timestamptz,
  _trial_start timestamptz,
  _trial_end timestamptz,
  _cancel_at_period_end boolean,
  _canceled_at timestamptz,
  _event_created bigint
) returns jsonb
language plpgsql security definer
set search_path='pg_catalog','public','private'
as $$
declare
  sid uuid;
  sub public.store_subscriptions%rowtype;
  pref private.billing_provider_plan_refs%rowtype;
  pp public.plan_prices%rowtype;
  p public.plans%rowtype;
  mapped public.subscription_status;
  grace integer:=5;
begin
  if _external_reference !~ '^comandiva:plan:[0-9a-f-]{36}$' then raise exception 'EXTERNAL_REFERENCE_INVALID'; end if;
  sid:=split_part(_external_reference,':',3)::uuid;
  select * into sub from public.store_subscriptions where id=sid for update;
  if not found then raise exception 'STORE_SUBSCRIPTION_NOT_FOUND'; end if;
  if sub.provider_event_created is not null and _event_created is not null and _event_created < sub.provider_event_created then
    return jsonb_build_object('ignored',true,'reason','stale_event','subscription_id',sub.id);
  end if;
  select * into pref from private.billing_provider_plan_refs where provider='stripe' and provider_plan_id=_provider_price_id and provider_status='active';
  if not found then raise exception 'STRIPE_PRICE_MISMATCH'; end if;
  select * into pp from public.plan_prices where id=pref.plan_price_id;
  select * into p from public.plans where id=pp.plan_id;
  select payment_grace_days into grace from public.billing_policy where policy_key='default';
  grace:=coalesce(grace,5);
  mapped:=case lower(coalesce(_provider_status,''))
    when 'active' then 'ativa'::public.subscription_status
    when 'trialing' then 'ativa'::public.subscription_status
    when 'past_due' then 'inadimplente'::public.subscription_status
    when 'unpaid' then 'inadimplente'::public.subscription_status
    when 'paused' then 'suspensa'::public.subscription_status
    when 'canceled' then 'cancelada'::public.subscription_status
    when 'incomplete_expired' then 'cancelada'::public.subscription_status
    else sub.status
  end;

  update public.store_subscriptions set
    plan_id=p.id,
    plan_price_id=pp.id,
    monthly_price=case when pp.billing_interval='monthly' then pp.amount_cents::numeric/100 else round((pp.amount_cents::numeric/12)/100,2) end,
    discount_amount=0,
    billing_interval=pp.billing_interval,
    billing_provider='stripe',
    provider_customer_id=nullif(btrim(_provider_customer_id),''),
    provider_subscription_id=btrim(_provider_subscription_id),
    provider_item_id=nullif(btrim(_provider_item_id),''),
    provider_plan_id=_provider_price_id,
    provider_status=_provider_status,
    provider_synced_at=now(),
    provider_event_created=coalesce(_event_created,provider_event_created),
    status=mapped,
    current_period_start_at=_current_period_start,
    current_period_end_at=_current_period_end,
    current_period_end=_current_period_end::date,
    trial_ends_at=_trial_end,
    grace_until=case when mapped='inadimplente' then coalesce(grace_until,now()+make_interval(days=>grace)) else null end,
    delinquent_since=case when mapped='inadimplente' then coalesce(delinquent_since,now()) else null end,
    cancel_at_period_end=coalesce(_cancel_at_period_end,false),
    cancelled_at=case when mapped='cancelada' then coalesce(_canceled_at,now()) else null end,
    updated_at=now()
  where id=sub.id
  returning * into sub;

  update private.plan_checkout_attempts set status='completed',updated_at=now()
  where store_subscription_id=sub.id and target_plan_price_id=pp.id and status in ('created','checkout_open');

  return jsonb_build_object('subscription_id',sub.id,'store_id',sub.store_id,'plan_code',p.code,'status',sub.status,'provider_status',sub.provider_status,'current_period_end',sub.current_period_end_at);
end $$;
revoke all on function public.billing_reconcile_stripe_plan_subscription(text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,boolean,timestamptz,bigint) from public, anon, authenticated;
grant execute on function public.billing_reconcile_stripe_plan_subscription(text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,boolean,timestamptz,bigint) to service_role;

create or replace function public.backend_record_stripe_plan_checkout_session(
  _attempt_id uuid,
  _session_id text,
  _checkout_url text
) returns void
language plpgsql security definer
set search_path='pg_catalog','private'
as $$
begin
 update private.plan_checkout_attempts
 set checkout_session_id=btrim(_session_id),checkout_url=_checkout_url,status='checkout_open',updated_at=now()
 where id=_attempt_id and status='created';
 if not found then raise exception 'PLAN_CHECKOUT_ATTEMPT_NOT_WRITABLE'; end if;
end $$;
revoke all on function public.backend_record_stripe_plan_checkout_session(uuid,text,text) from public, anon, authenticated;
grant execute on function public.backend_record_stripe_plan_checkout_session(uuid,text,text) to service_role;

create or replace function public.backend_record_stripe_invoice(
  _invoice_id text,
  _store_id uuid,
  _subscription_id uuid,
  _stripe_customer_id text,
  _stripe_subscription_id text,
  _status text,
  _currency text,
  _amount_due_cents bigint,
  _amount_paid_cents bigint,
  _amount_remaining_cents bigint,
  _hosted_invoice_url text,
  _invoice_pdf text,
  _due_at timestamptz,
  _paid_at timestamptz,
  _period_start timestamptz,
  _period_end timestamptz,
  _event_created bigint,
  _metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer
set search_path='pg_catalog','private','public'
as $$
begin
 insert into private.financial_invoices(stripe_invoice_id,store_id,store_subscription_id,stripe_customer_id,stripe_subscription_id,status,currency,amount_due_cents,amount_paid_cents,amount_remaining_cents,hosted_invoice_url,invoice_pdf,due_at,paid_at,period_start,period_end,provider_event_created,metadata,updated_at)
 values(_invoice_id,_store_id,_subscription_id,_stripe_customer_id,_stripe_subscription_id,_status,upper(_currency),greatest(_amount_due_cents,0),greatest(_amount_paid_cents,0),greatest(_amount_remaining_cents,0),_hosted_invoice_url,_invoice_pdf,_due_at,_paid_at,_period_start,_period_end,_event_created,coalesce(_metadata,'{}'::jsonb),now())
 on conflict(stripe_invoice_id) do update set
   status=excluded.status,currency=excluded.currency,amount_due_cents=excluded.amount_due_cents,amount_paid_cents=excluded.amount_paid_cents,amount_remaining_cents=excluded.amount_remaining_cents,hosted_invoice_url=excluded.hosted_invoice_url,invoice_pdf=excluded.invoice_pdf,due_at=excluded.due_at,paid_at=excluded.paid_at,period_start=excluded.period_start,period_end=excluded.period_end,provider_event_created=greatest(coalesce(private.financial_invoices.provider_event_created,0),coalesce(excluded.provider_event_created,0)),metadata=private.financial_invoices.metadata||excluded.metadata,updated_at=now()
 where private.financial_invoices.provider_event_created is null or excluded.provider_event_created is null or excluded.provider_event_created>=private.financial_invoices.provider_event_created;
 update public.store_subscriptions set last_invoice_id=_invoice_id,last_invoice_status=_status,last_payment_failure_at=case when _status in ('open','uncollectible') and _amount_remaining_cents>0 then coalesce(last_payment_failure_at,now()) when _amount_remaining_cents=0 then null else last_payment_failure_at end,updated_at=now() where id=_subscription_id;
end $$;
revoke all on function public.backend_record_stripe_invoice(text,uuid,uuid,text,text,text,text,bigint,bigint,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.backend_record_stripe_invoice(text,uuid,uuid,text,text,text,text,bigint,bigint,bigint,text,text,timestamptz,timestamptz,timestamptz,timestamptz,bigint,jsonb) to service_role;

create or replace function public.get_my_store_financial_summary(_store_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path='pg_catalog','public','private'
as $$
declare r jsonb;
begin
 if not private.is_store_member(_store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select jsonb_build_object(
   'currency','BRL',
   'grossSalesCents',coalesce(sum(case when t.domain='order_payment' then e.amount_cents else 0 end) filter(where e.account_code='store_sales_gross' and e.direction='credit'),0),
   'platformFeesCents',coalesce(sum(e.amount_cents) filter(where e.account_code='platform_processing_revenue' and e.direction='credit'),0),
   'refundsCents',coalesce(sum(e.amount_cents) filter(where e.account_code='store_refunds' and e.direction='debit'),0),
   'payoutFeesCents',coalesce(sum(e.amount_cents) filter(where e.account_code='platform_payout_revenue' and e.direction='credit'),0),
   'generatedAt',now()
 ) into r
 from private.financial_ledger_entries e
 join private.financial_transactions t on t.id=e.transaction_id
 where e.store_id=_store_id;
 return r;
end $$;
revoke all on function public.get_my_store_financial_summary(uuid) from public, anon;
grant execute on function public.get_my_store_financial_summary(uuid) to authenticated, service_role;

comment on table private.financial_transactions is 'Canonical immutable financial transaction groups. Amounts are integer cents.';
comment on table private.financial_ledger_entries is 'Double-entry ledger entries; all amounts are positive integer cents and transaction groups must be balanced by writer function.';
comment on table private.plan_checkout_attempts is 'Idempotent acquisition attempts for Comandiva SaaS plans; separate from add-on checkout attempts.';
