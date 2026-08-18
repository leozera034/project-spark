-- Comandiva billing foundation: provider-agnostic recurring billing.
-- No commercial prices are seeded by this migration.

create table if not exists public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  billing_interval text not null check (billing_interval in ('monthly', 'annual')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  trial_days smallint not null default 0 check (trial_days between 0 and 365),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, billing_interval)
);

alter table public.plan_prices enable row level security;
alter table public.plan_prices force row level security;
revoke all on public.plan_prices from public, anon, authenticated;
grant all on public.plan_prices to service_role;

create trigger set_updated_at_plan_prices
before update on public.plan_prices
for each row execute function public.set_updated_at();

alter table public.store_subscriptions
  add column if not exists plan_price_id uuid references public.plan_prices(id),
  add column if not exists billing_interval text check (billing_interval in ('monthly', 'annual')),
  add column if not exists billing_provider text,
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists provider_plan_id text,
  add column if not exists provider_status text,
  add column if not exists provider_synced_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists grace_until timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists complimentary_until timestamptz,
  add column if not exists complimentary_reason text,
  add column if not exists complimentary_granted_by uuid references auth.users(id),
  add column if not exists complimentary_granted_at timestamptz;

create unique index if not exists store_subscriptions_provider_subscription_uidx
  on public.store_subscriptions (billing_provider, provider_subscription_id)
  where billing_provider is not null and provider_subscription_id is not null;

create index if not exists store_subscriptions_provider_status_idx
  on public.store_subscriptions (billing_provider, provider_status)
  where billing_provider is not null;

create index if not exists store_subscriptions_grace_until_idx
  on public.store_subscriptions (grace_until)
  where grace_until is not null;

alter table public.subscription_payments
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_invoice_id text,
  add column if not exists provider_event_key text,
  add column if not exists provider_status text,
  add column if not exists amount_cents integer check (amount_cents is null or amount_cents >= 0),
  add column if not exists currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists billing_interval text check (billing_interval is null or billing_interval in ('monthly', 'annual')),
  add column if not exists due_at timestamptz,
  add column if not exists external_reference text;

create unique index if not exists subscription_payments_provider_payment_uidx
  on public.subscription_payments (provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;

create index if not exists subscription_payments_provider_status_idx
  on public.subscription_payments (provider, provider_status)
  where provider is not null;

create table if not exists private.billing_provider_plan_refs (
  id uuid primary key default gen_random_uuid(),
  plan_price_id uuid not null references public.plan_prices(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_]+$'),
  provider_plan_id text not null,
  provider_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, plan_price_id),
  unique (provider, provider_plan_id)
);

alter table private.billing_provider_plan_refs enable row level security;
alter table private.billing_provider_plan_refs force row level security;
revoke all on private.billing_provider_plan_refs from public, anon, authenticated;
grant all on private.billing_provider_plan_refs to service_role;

create table if not exists private.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z0-9_]+$'),
  provider_event_key text not null,
  event_type text not null,
  resource_id text,
  signature_valid boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  unique (provider, provider_event_key)
);

alter table private.billing_webhook_events enable row level security;
alter table private.billing_webhook_events force row level security;
revoke all on private.billing_webhook_events from public, anon, authenticated;
grant all on private.billing_webhook_events to service_role;

create index if not exists billing_webhook_events_processing_idx
  on private.billing_webhook_events (provider, processing_status, received_at);

comment on table public.plan_prices is 'Canonical Comandiva plan prices by billing interval; monetary values are stored in cents.';
comment on column public.store_subscriptions.billing_provider is 'Current external billing provider slug, e.g. mercado_pago. Null for free/manual/courtesy subscriptions.';
comment on table private.billing_webhook_events is 'Server-only idempotency and audit inbox for billing provider webhooks.';