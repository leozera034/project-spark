-- SHARK — fecha grant implícito via PUBLIC no writer legado de estoque.
-- Revogar apenas de authenticated/anon não basta quando PUBLIC ainda possui EXECUTE.

revoke execute on function public.update_product_inventory(uuid,uuid,boolean,numeric,numeric)
  from public, anon, authenticated;

grant execute on function public.update_product_inventory_v2(
  uuid,uuid,boolean,numeric,numeric,timestamptz
) to authenticated;

comment on function public.update_product_inventory(uuid,uuid,boolean,numeric,numeric) is
  'Legacy inventory writer. Browser execution fully revoked, including inherited PUBLIC grant; use update_product_inventory_v2.';
