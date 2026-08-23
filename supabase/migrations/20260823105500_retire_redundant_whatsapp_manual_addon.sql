update public.addon_catalog
set availability_status='retired', updated_at=now()
where code='whatsapp_manual'
  and not exists (
    select 1
    from public.store_addon_subscriptions s
    where s.addon_id=addon_catalog.id
      and s.status in ('active','trial','grace_period','complimentary')
  );

update public.addon_prices p
set is_active=false, updated_at=now()
from public.addon_catalog c
where p.addon_id=c.id
  and c.code='whatsapp_manual'
  and c.availability_status='retired';
