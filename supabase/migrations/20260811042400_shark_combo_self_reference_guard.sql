-- SHARK — integridade de combo: a UI não é autoridade.
-- Impede que um combo aponte para ele mesmo por chamada direta à RPC.

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
  _owner_product uuid;
begin
  perform private.require_permission('catalog.create',_sid);

  select * into _g
  from public.option_groups
  where id=_group_id and store_id=_sid and not is_archived
  for update;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if _g.role<>'combo_step' then raise exception 'GROUP_NOT_COMBO_STEP'; end if;

  select pog.product_id into _owner_product
  from public.product_option_groups pog
  where pog.store_id=_sid
    and pog.option_group_id=_group_id
    and pog.is_active and not pog.is_archived
  order by pog.sort_order,pog.id
  limit 1;

  if _owner_product is null then raise exception 'COMBO_STEP_NOT_LINKED'; end if;
  if _linked_product_id=_owner_product then raise exception 'COMBO_SELF_REFERENCE'; end if;

  perform private.assert_meaningful_name(_name_clean,1,80,'INVALID_ITEM_NAME');
  if _price_difference is null or _price_difference<0 or scale(_price_difference)>2 then
    raise exception 'INVALID_PRICE';
  end if;

  if not exists(
    select 1 from public.products p
    where p.id=_linked_product_id and p.store_id=_sid and not p.is_archived
  ) then raise exception 'LINKED_PRODUCT_INVALID'; end if;

  if _linked_variant_id is not null and not exists(
    select 1 from public.product_variants v
    where v.id=_linked_variant_id
      and v.product_id=_linked_product_id
      and v.store_id=_sid
      and not v.is_archived
  ) then raise exception 'LINKED_VARIANT_INVALID'; end if;

  insert into public.option_items(
    store_id,option_group_id,name,additional_price,max_quantity,is_available,sort_order,
    linked_product_id,linked_variant_id,metadata
  ) values(
    _sid,_group_id,_name_clean,_price_difference,1,true,
    coalesce((select max(sort_order)+1 from public.option_items where store_id=_sid and option_group_id=_group_id),0),
    _linked_product_id,_linked_variant_id,
    jsonb_build_object('combo_choice',true)
  ) returning * into _row;

  perform private.log_config_audit(
    _sid,'catalog.combo.choice.created','option_items',_row.id,
    array['name','additional_price','linked_product_id','linked_variant_id']
  );
  return private.catalog_option_item_json(_row);
end;
$$;

grant execute on function public.create_combo_choice(uuid,uuid,text,uuid,uuid,numeric) to authenticated;
revoke all on function public.create_combo_choice(uuid,uuid,text,uuid,uuid,numeric) from anon;
