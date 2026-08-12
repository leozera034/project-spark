-- SHARK — preços visuais de opções por variação, server-only.
-- A cotação canônica continua sendo a autoridade financeira. Esta RPC existe
-- apenas para a UI trocar rótulos de acréscimo ao selecionar um tamanho.

create or replace function public.storefront_variant_option_prices(
  _slug text,
  _product_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp as $$
declare
  _slug_norm text:=public.storefront_normalize_slug(_slug);
  _store_id uuid;
begin
  if _slug_norm is null or _product_id is null then return '[]'::jsonb; end if;

  select s.id into _store_id
  from public.stores s
  where s.slug=_slug_norm and s.status='ativa'
  limit 1;

  if _store_id is null then return '[]'::jsonb; end if;

  if not exists(
    select 1
    from public.products p
    where p.id=_product_id and p.store_id=_store_id
      and p.is_available and not p.is_archived
  ) then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product_variant_id',vp.product_variant_id,
      'option_item_id',vp.option_item_id,
      'price',vp.price
    ) order by vp.product_variant_id,vp.option_item_id)
    from public.product_variant_option_item_prices vp
    join public.product_variants v
      on v.id=vp.product_variant_id and v.store_id=vp.store_id
    join public.option_items i
      on i.id=vp.option_item_id and i.store_id=vp.store_id
    where vp.store_id=_store_id
      and vp.product_id=_product_id
      and v.product_id=_product_id
      and v.is_available and not v.is_archived
      and i.is_available and not i.is_archived
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.storefront_variant_option_prices(text,uuid)
  from public,anon,authenticated;
grant execute on function public.storefront_variant_option_prices(text,uuid)
  to service_role;

comment on function public.storefront_variant_option_prices(text,uuid) is
  'Server-only minimal option price matrix for variant-aware storefront labels. Canonical pricing remains private.calculate_configured_product_price.';
