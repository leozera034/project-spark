-- Temporary QA-only extension for the Burger Lab Evolution API end-to-end test.
-- Fixed expiry keeps this non-production entitlement narrow and self-expiring.
update public.store_addon_subscriptions sas
set status = 'complimentary',
    complimentary_until = '2026-08-23 00:30:00+00'::timestamptz,
    complimentary_reason = 'Temporary Evolution API end-to-end QA extension 2026-08-22',
    updated_at = now()
from public.stores s,
     public.addon_catalog ac
where sas.store_id = s.id
  and sas.addon_id = ac.id
  and s.slug = 'comandiva-burger-lab'
  and ac.code = 'whatsapp_automation';
