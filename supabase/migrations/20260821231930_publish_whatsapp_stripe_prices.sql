with price_rows as (
  select p.id as addon_price_id,a.code
  from public.addon_prices p
  join public.addon_catalog a on a.id=p.addon_id
  where p.billing_interval='monthly'
    and a.code in ('whatsapp_manual','whatsapp_automation')
)
insert into private.billing_provider_addon_price_refs(
  addon_price_id,provider,provider_plan_id,provider_status,metadata
)
select
  pr.addon_price_id,
  'stripe',
  case pr.code
    when 'whatsapp_manual' then 'price_1U71h8QYj7wiKEClmIvpb3bC'
    when 'whatsapp_automation' then 'price_1U71hMQYj7wiKEClCVxWvszY'
  end,
  'active',
  case pr.code
    when 'whatsapp_manual' then jsonb_build_object('stripe_product_id','prod_V7GDC2uHGmzoaT','synced_at',now())
    when 'whatsapp_automation' then jsonb_build_object('stripe_product_id','prod_V7GDoSVTO4JULj','synced_at',now())
  end
from price_rows pr
on conflict (addon_price_id,provider) do update set
  provider_plan_id=excluded.provider_plan_id,
  provider_status=excluded.provider_status,
  metadata=private.billing_provider_addon_price_refs.metadata || excluded.metadata,
  updated_at=now();

update public.addon_catalog
set availability_status='available',updated_at=now()
where code in ('whatsapp_manual','whatsapp_automation');