create index if not exists billing_provider_plan_refs_plan_price_idx
  on private.billing_provider_plan_refs (plan_price_id);

create index if not exists store_subscriptions_plan_price_idx
  on public.store_subscriptions (plan_price_id)
  where plan_price_id is not null;

create index if not exists store_subscriptions_complimentary_granted_by_idx
  on public.store_subscriptions (complimentary_granted_by)
  where complimentary_granted_by is not null;