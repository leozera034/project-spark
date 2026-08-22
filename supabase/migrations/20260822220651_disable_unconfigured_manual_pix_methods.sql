-- Legacy stores could have Pix enabled without any configured destination key.
-- Fail closed: manual Pix only becomes available again through set_my_store_manual_pix.
update public.payment_methods pm
set is_active=false,
    label=case when pm.label='Pix' then 'Pix direto para a loja' else pm.label end,
    updated_at=now()
from public.store_settings ss
where ss.store_id=pm.store_id
  and pm.kind='pix'::public.payment_method_kind
  and pm.is_active
  and nullif(btrim(coalesce(ss.manual_pix_key,'')),'') is null;
