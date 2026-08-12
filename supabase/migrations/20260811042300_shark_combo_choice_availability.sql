-- SHARK — disponibilidade canônica das escolhas de combo.
-- Não expõe catálogo nem estoque; devolve apenas os IDs das opções que estão
-- realmente selecionáveis no momento, segundo produto/variação vinculados.

create or replace function public.storefront_combo_available_choices(
  _slug text,
  _product_id uuid
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  _normalized_slug text:=public.storefront_normalize_slug(_slug);
  _store_id uuid;
begin
  if _normalized_slug is null or _product_id is null then return '[]'::jsonb; end if;

  select s.id into _store_id
  from public.stores s
  where s.slug=_normalized_slug and s.status='ativa'
  limit 1;
  if _store_id is null then return '[]'::jsonb; end if;

  if not exists(
    select 1 from public.products p
    where p.id=_product_id and p.store_id=_store_id
      and p.is_available and not p.is_sold_out and not p.is_archived
  ) then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(i.id order by pog.sort_order,og.sort_order,i.sort_order,i.name)
    from public.product_option_groups pog
    join public.option_groups og
      on og.id=pog.option_group_id and og.store_id=pog.store_id
    join public.option_items i
      on i.option_group_id=og.id and i.store_id=og.store_id
    where pog.store_id=_store_id
      and pog.product_id=_product_id
      and pog.is_active and not pog.is_archived
      and og.is_active and not og.is_archived
      and og.role='combo_step'
      and i.is_available and not i.is_archived
      and i.linked_product_id is not null
      and exists(
        select 1 from public.products lp
        where lp.id=i.linked_product_id and lp.store_id=_store_id
          and lp.is_available and not lp.is_sold_out and not lp.is_archived
          and (lp.stock_quantity is null or lp.stock_quantity>0)
      )
      and (
        i.linked_variant_id is null
        or exists(
          select 1 from public.product_variants lv
          where lv.id=i.linked_variant_id
            and lv.product_id=i.linked_product_id
            and lv.store_id=_store_id
            and lv.is_available and not lv.is_archived
        )
      )
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.storefront_combo_available_choices(text,uuid) from public,anon,authenticated;
grant execute on function public.storefront_combo_available_choices(text,uuid) to service_role;
