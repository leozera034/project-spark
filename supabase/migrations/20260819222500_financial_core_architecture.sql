begin;

-- Central financial core for Stripe Billing + Connect + order payments.
-- Reuses existing plans, plan_prices, store_subscriptions, subscription_payments,
-- addon_* tables and existing Stripe mapping tables. No parallel subscriptions_v2 model.

alter table public.store_subscriptions
  add column if not exists provider_item_id text,
  add column if not exists provider_schedule_id text,
  add column if not exists pending_plan_id uuid references public.plans(id),
  add column if not exists pending_plan_price_id uuid references public.plan_prices(id),
  add column if not exists plan_change_effective_at timestamptz,
  add column if not exists last_invoice_id text,
  add column if not exists last_invoice_status text,
  add column if not exists last_payment_failure_at timestamptz;

create unique index if not exists store_subscriptions_provider_subscription_uidx
  on public.store_subscriptions (billing_provider, provider_subscription_id)
  where provider_subscription_id is not null;

create index if not exists store_subscriptions_pending_plan_idx
  on public.store_subscriptions (store_id, plan_change_effective_at)
  where pending_plan_id is not null;

-- Normalize subscription payments around integer minor units while preserving legacy amount.
update public.subscription_payments
set amount_cents = round(amount * 100)::integer
where amount_cents is null;

alter table public.subscription_payments
  alter column amount_cents set default 0;

alter table public.subscription_payments
  add constraint subscription_payments_amount_cents_nonnegative
  check (amount_cents is null or amount_cents >= 0) not valid;

alter table public.subscription_payments
  validate constraint subscription_payments_amount_cents_nonnegative;

create unique index if not exists subscription_payments_provider_invoice_uidx
  on public.subscription_payments (provider, provider_invoice_id)
  where provider is not null and provider_invoice_id is not null;

create unique index if not exists subscription_payments_provider_payment_uidx
  on public.subscription_payments (provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;

-- SaaS plan checkout attempts. Separate from addon_checkout_attempts because a plan
-- changes the store's primary entitlement contract rather than adding an optional module.
create table if not exists private.plan_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  plan_price_id uuid not null references public.plan_prices(id),
  billing_interval text not null check (billing_interval in ('monthly','annual')),
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_price_id text,
  provider_checkout_id text,
  provider_subscription_id text,
  provider_status text,
  idempotency_key text not null,
  external_reference text not null,
  checkout_url text,
  status text not null default 'created' check (status in ('created','provider_creating','checkout_open','completed','cancelled','failed','expired')),
  failure_code text,
  last_error text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, idempotency_key),
  unique (external_reference)
);

create unique index if not exists plan_checkout_attempts_provider_checkout_uidx
  on private.plan_checkout_attempts(provider, provider_checkout_id)
  where provider_checkout_id is not null;

create index if not exists plan_checkout_attempts_store_recent_idx
  on private.plan_checkout_attempts(store_id, created_at desc);

revoke all on private.plan_checkout_attempts from anon, authenticated;
grant select, insert, update, delete on private.plan_checkout_attempts to service_role;

-- Canonical double-entry ledger. Stripe remains the financial source of truth;
-- this ledger is an auditable internal projection for reconciliation/reporting.
create table if not exists private.financial_journals (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  source_system text not null check (source_system in ('stripe','comandiva','manual_adjustment')),
  source_object_id text,
  store_id uuid references public.stores(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  currency text not null default 'BRL' check (char_length(currency) = 3),
  status text not null default 'draft' check (status in ('draft','posted','reversed')),
  occurred_at timestamptz not null default now(),
  posted_at timestamptz,
  reversed_journal_id uuid references private.financial_journals(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_journals_store_occurred_idx
  on private.financial_journals(store_id, occurred_at desc);
create index if not exists financial_journals_order_idx
  on private.financial_journals(order_id)
  where order_id is not null;
create index if not exists financial_journals_source_idx
  on private.financial_journals(source_system, source_object_id)
  where source_object_id is not null;

create table if not exists private.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references private.financial_journals(id) on delete restrict,
  account_code text not null,
  owner_type text not null check (owner_type in ('platform','store','stripe','customer','clearing')),
  owner_store_id uuid references public.stores(id) on delete set null,
  direction text not null check (direction in ('debit','credit')),
  component_type text not null check (component_type in (
    'gross_payment','stripe_processing_fee','platform_processing_fee','store_payable',
    'payout','payout_fee','refund','dispute','chargeback','adjustment','subscription_revenue',
    'addon_revenue','tax','reserve','reversal'
  )),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'BRL' check (char_length(currency) = 3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_ledger_entries_journal_idx
  on private.financial_ledger_entries(journal_id);
create index if not exists financial_ledger_entries_store_idx
  on private.financial_ledger_entries(owner_store_id, created_at desc)
  where owner_store_id is not null;
create index if not exists financial_ledger_entries_component_idx
  on private.financial_ledger_entries(component_type, created_at desc);

revoke all on private.financial_journals, private.financial_ledger_entries from anon, authenticated;
grant select, insert, update on private.financial_journals, private.financial_ledger_entries to service_role;

-- A journal can only become posted if debits and credits balance exactly in minor units.
create or replace function private.post_financial_journal(_journal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  _debits bigint;
  _credits bigint;
  _status text;
begin
  select status into _status
  from private.financial_journals
  where id = _journal_id
  for update;

  if _status is null then
    raise exception 'financial_journal_not_found';
  end if;
  if _status = 'posted' then
    return true;
  end if;
  if _status <> 'draft' then
    raise exception 'financial_journal_not_postable';
  end if;

  select
    coalesce(sum(amount_cents) filter (where direction='debit'),0),
    coalesce(sum(amount_cents) filter (where direction='credit'),0)
  into _debits, _credits
  from private.financial_ledger_entries
  where journal_id = _journal_id;

  if _debits <= 0 or _debits <> _credits then
    raise exception 'financial_journal_unbalanced';
  end if;

  update private.financial_journals
  set status='posted', posted_at=now()
  where id=_journal_id;
  return true;
end;
$$;

revoke all on function private.post_financial_journal(uuid) from public, anon, authenticated;
grant execute on function private.post_financial_journal(uuid) to service_role;

-- Configurable platform fee policy. This stores commercial configuration only;
-- actual Stripe fee/cost is reconciled from Stripe balance transactions, not hardcoded.
create table if not exists private.financial_fee_policy (
  policy_key text primary key,
  order_application_fee_bps integer not null default 100 check (order_application_fee_bps between 0 and 10000),
  payout_standard_fee_bps integer not null default 0 check (payout_standard_fee_bps between 0 and 10000),
  payout_daily_fee_bps integer not null default 49 check (payout_daily_fee_bps between 0 and 10000),
  payout_fast_fee_bps integer not null default 99 check (payout_fast_fee_bps between 0 and 10000),
  payout_instant_fee_bps integer not null default 199 check (payout_instant_fee_bps between 0 and 10000),
  currency text not null default 'BRL' check (char_length(currency)=3),
  allow_negative_margin boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into private.financial_fee_policy(policy_key)
values ('default')
on conflict (policy_key) do nothing;

revoke all on private.financial_fee_policy from anon, authenticated;
grant select, insert, update, delete on private.financial_fee_policy to service_role;

-- Existing addon checkout table was inherited from an older provider. Stripe is now the
-- only supported billing provider, so remove the obsolete default without deleting history.
alter table private.addon_checkout_attempts
  alter column provider set default 'stripe';

commit;
