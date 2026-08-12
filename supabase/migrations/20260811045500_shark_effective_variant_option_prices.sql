-- SHARK — matriz efetiva de preços visuais por variação.
-- Para cada variação/opção ativa do produto, retorna o preço que a UI deve exibir:
-- override específico quando existir; caso contrário, additional_price base.
-- A cotação canônica continua sendo a autoridade financeira.

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
    select 1 from public.products p
    where p.id=_product_id and p.store_id=_store_id
      and p.is_available and not p.is_archived
  ) then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product_variant_id',v.id,
      'option_item_id',i.id,
      'price',coalesce(vp.price,i.additional_price)
    ) order by v.sort_order,v.id,pog.sort_order,og.sort_order,i.sort_order,i.id)
    from public.product_variants v
    join public.product_option_groups pog
      on pog.store_id=v.store_id
     and pog.product_id=v.product_id
     and pog.is_active and not pog.is_archived
    join public.option_groups og
      on og.id=pog.option_group_id
     and og.store_id=pog.store_id
     and og.is_active and not og.is_archived
    join public.option_items i
      on i.option_group_id=og.id
     and i.store_id=og.store_id
     and i.is_available and not i.is_archived
    left join public.product_variant_option_item_prices vp
      on vp.store_id=v.store_id
     and vp.product_id=v.product_id
     and vp.product_variant_id=v.id
     and vp.option_item_id=i.id
    where v.store_id=_store_id
      and v.product_id=_product_id
      and v.is_available and not v.is_archived
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.storefront_variant_option_prices(text,uuid)
  from public,anon,authenticated;
grant execute on function public.storefront_variant_option_prices(text,uuid)
  to service_role;

comment on function public.storefront_variant_option_prices(text,uuid) is
  'Server-only effective option price matrix by variant. Uses override when present and base additional_price otherwise; canonical quote remains authoritative.';
