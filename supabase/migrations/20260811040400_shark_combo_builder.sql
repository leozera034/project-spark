-- SHARK — construtor estruturado de combos e correção de FKs compostas.

-- ON DELETE SET NULL em FK composta também tentaria zerar store_id (NOT NULL).
-- Como o catálogo usa arquivamento, manter referência forte é mais seguro.
alter table public.option_items drop constraint if exists option_items_linked_product_same_store_fk;
alter table public.option_items drop constraint if exists option_items_linked_variant_same_store_fk;
alter table public.option_items add constraint option_items_linked_product_same_store_fk
  foreign key (linked_product_id, store_id) references public.products(id, store_id) on delete restrict;
alter table public.option_items add constraint option_items_linked_variant_same_store_fk
  foreign key (linked_variant_id, store_id) references public.product_variants(id, store_id) on delete restrict;

create or replace function public.list_combo_catalog_candidates(_store_id uuid, _exclude_product_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare _sid uuid:=private.resolve_store(_store_id);
begin
  perform private.require_permission('catalog.view',_sid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.name,'base_price',p.base_price,'has_variants',p.has_variants,
      'is_available',p.is_available,'is_sold_out',p.is_sold_out,
      'variants',coalesce((select jsonb_agg(jsonb_build_object(
        'id',v.id,'name',v.name,'price',v.price,'is_default',v.is_default
      ) order by v.sort_order,v.name) from public.product_variants v
      where v.store_id=_sid and v.product_id=p.id and v.is_available and not v.is_archived),'[]'::jsonb)
    ) order by p.name)
    from public.products p
    where p.store_id=_sid and not p.is_archived and p.id is distinct from _exclude_product_id
  ),'[]'::jsonb);
end; $$;

create or replace function public.create_combo_choice(
  _store_id uuid,
  _group_id uuid,
  _name text,
  _linked_product_id uuid,
  _linked_variant_id uuid default null,
  _price_difference numeric default 0
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _g public.option_groups;
  _row public.option_items;
  _name_clean text:=private.clean_text(_name);
begin
  perform private.require_permission('catalog.create',_sid);
  select * into _g from public.option_groups where id=_group_id and store_id=_sid and not is_archived for update;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if _g.role<>'combo_step' then raise exception 'GROUP_NOT_COMBO_STEP'; end if;
  perform private.assert_meaningful_name(_name_clean,1,80,'INVALID_ITEM_NAME');
  if _price_difference is null or _price_difference<0 or scale(_price_difference)>2 then raise exception 'INVALID_PRICE'; end if;
  if not exists(select 1 from public.products p where p.id=_linked_product_id and p.store_id=_sid and not p.is_archived) then raise exception 'LINKED_PRODUCT_INVALID'; end if;
  if _linked_variant_id is not null and not exists(select 1 from public.product_variants v where v.id=_linked_variant_id and v.product_id=_linked_product_id and v.store_id=_sid and not v.is_archived) then raise exception 'LINKED_VARIANT_INVALID'; end if;

  insert into public.option_items(
    store_id,option_group_id,name,additional_price,max_quantity,is_available,sort_order,
    linked_product_id,linked_variant_id,metadata
  ) values(
    _sid,_group_id,_name_clean,_price_difference,1,true,
    coalesce((select max(sort_order)+1 from public.option_items where store_id=_sid and option_group_id=_group_id),0),
    _linked_product_id,_linked_variant_id,
    jsonb_build_object('combo_choice',true)
  ) returning * into _row;

  perform private.log_config_audit(_sid,'catalog.combo.choice.created','option_items',_row.id,
    array['name','additional_price','linked_product_id','linked_variant_id']);
  return private.catalog_option_item_json(_row);
end; $$;

grant execute on function public.list_combo_catalog_candidates(uuid,uuid) to authenticated;
grant execute on function public.create_combo_choice(uuid,uuid,text,uuid,uuid,numeric) to authenticated;
revoke all on function public.list_combo_catalog_candidates(uuid,uuid) from anon;
revoke all on function public.create_combo_choice(uuid,uuid,text,uuid,uuid,numeric) from anon;
