-- SHARK — contrato único de escrita de estoque.
-- A função legada permanece definida para histórico/migrations, mas clientes
-- autenticados só podem alterar estoque pelo endpoint com controle de versão.

revoke execute on function public.update_product_inventory(uuid,uuid,boolean,numeric,numeric) from authenticated;
revoke execute on function public.update_product_inventory(uuid,uuid,boolean,numeric,numeric) from anon;

grant execute on function public.update_product_inventory_v2(uuid,uuid,boolean,numeric,numeric,timestamptz) to authenticated;

comment on function public.update_product_inventory(uuid,uuid,boolean,numeric,numeric) is
  'Legacy inventory writer. Client execution revoked; use update_product_inventory_v2 with expected_updated_at.';
