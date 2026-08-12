-- SHARK — integridade forte dos preços de opção por variação.
-- Garante que product_id, product_variant_id e option_item_id representem a
-- mesma configuração de produto, mesmo em escrita direta/service role.

create or replace function private.validate_shark_variant_option_price()
returns trigger
language plpgsql
set search_path=public,private,pg_temp
as $$
declare
  _variant_product uuid;
  _item_group uuid;
begin
  select v.product_id into _variant_product
  from public.product_variants v
  where v.id=new.product_variant_id
    and v.store_id=new.store_id
    and not v.is_archived;

  if _variant_product is null or _variant_product<>new.product_id then
    raise exception 'VARIANT_OPTION_PRICE_PRODUCT_MISMATCH';
  end if;

  select i.option_group_id into _item_group
  from public.option_items i
  where i.id=new.option_item_id
    and i.store_id=new.store_id
    and not i.is_archived;

  if _item_group is null then
    raise exception 'VARIANT_OPTION_PRICE_ITEM_INVALID';
  end if;

  if not exists(
    select 1
    from public.product_option_groups pog
    join public.option_groups og
      on og.id=pog.option_group_id and og.store_id=pog.store_id
    where pog.store_id=new.store_id
      and pog.product_id=new.product_id
      and pog.option_group_id=_item_group
      and not pog.is_archived
      and not og.is_archived
  ) then
    raise exception 'VARIANT_OPTION_PRICE_ITEM_PRODUCT_MISMATCH';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_shark_variant_option_price()
  from public,anon,authenticated;

drop trigger if exists trg_shark_variant_option_price_integrity
  on public.product_variant_option_item_prices;
create trigger trg_shark_variant_option_price_integrity
before insert or update of store_id,product_id,product_variant_id,option_item_id
on public.product_variant_option_item_prices
for each row execute function private.validate_shark_variant_option_price();

-- Falha cedo se houver dado legado incompatível antes de habilitar a projeção final.
do $$
begin
  if exists(
    select 1
    from public.product_variant_option_item_prices vp
    join public.product_variants v
      on v.id=vp.product_variant_id and v.store_id=vp.store_id
    where v.product_id<>vp.product_id
  ) then
    raise exception 'SHARK_EXISTING_VARIANT_OPTION_PRICE_PRODUCT_MISMATCH';
  end if;

  if exists(
    select 1
    from public.product_variant_option_item_prices vp
    join public.option_items i
      on i.id=vp.option_item_id and i.store_id=vp.store_id
    where not exists(
      select 1
      from public.product_option_groups pog
      where pog.store_id=vp.store_id
        and pog.product_id=vp.product_id
        and pog.option_group_id=i.option_group_id
        and not pog.is_archived
    )
  ) then
    raise exception 'SHARK_EXISTING_VARIANT_OPTION_PRICE_ITEM_PRODUCT_MISMATCH';
  end if;
end;
$$;

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
      'product_variant_id',vp.product_variant_id,
      'option_item_id',vp.option_item_id,
      'price',vp.price
    ) order by vp.product_variant_id,vp.option_item_id)
    from public.product_variant_option_item_prices vp
    join public.product_variants v
      on v.id=vp.product_variant_id
     and v.store_id=vp.store_id
     and v.product_id=vp.product_id
    join public.option_items i
      on i.id=vp.option_item_id and i.store_id=vp.store_id
    where vp.store_id=_store_id
      and vp.product_id=_product_id
      and v.is_available and not v.is_archived
      and i.is_available and not i.is_archived
      and exists(
        select 1
        from public.product_option_groups pog
        join public.option_groups og
          on og.id=pog.option_group_id and og.store_id=pog.store_id
        where pog.store_id=vp.store_id
          and pog.product_id=vp.product_id
          and pog.option_group_id=i.option_group_id
          and pog.is_active and not pog.is_archived
          and og.is_active and not og.is_archived
      )
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.storefront_variant_option_prices(text,uuid)
  from public,anon,authenticated;
grant execute on function public.storefront_variant_option_prices(text,uuid)
  to service_role;

comment on function private.validate_shark_variant_option_price() is
  'Garante coerência produto-variação-opção para preços específicos por variação.';
