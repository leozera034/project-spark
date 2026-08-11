-- SHARK — cálculo canônico v2.
-- Mantém a assinatura legado usada por carrinho/checkout, mas acrescenta:
-- itens incluídos grátis, estoque de opção/produto, grupos sem efeito de preço,
-- e política multi-sabor configurada no PRODUTO (não na categoria).

create or replace function private.calculate_configured_product_price_v2(
  _store_id uuid,
  _product_id uuid,
  _variant_id uuid,
  _quantity numeric,
  _selections jsonb default '[]'::jsonb
) returns jsonb
language plpgsql stable set search_path=public,pg_temp as $$
declare
  _p public.products;
  _v public.product_variants;
  _qty numeric := coalesce(_quantity,1);
  _errors text[] := array[]::text[];
  _base_unit numeric := 0;
  _base_total numeric := 0;
  _replace_tot numeric;
  _additive_tot numeric := 0;
  _final_unit numeric := 0;
  _final_total numeric := 0;
  _breakdown jsonb := '[]'::jsonb;
  _sel jsonb; _link record; _items jsonb; _item jsonb; _it public.option_items;
  _iqty numeric; _price numeric; _charge_qty numeric; _free_left numeric;
  _count_items int; _sum_qty numeric;
  _weighted_num numeric; _weighted_den numeric; _plain_sum numeric; _max_price numeric;
  _charge_num numeric; _charge_den numeric; _charge_max numeric;
  _group_value numeric; _seen uuid[];
  _has_variants boolean; _replace_seen boolean := false;
  _flavor_rule text; _effective_effect text; _price_mode text;
begin
  select * into _p from public.products p
   where p.id=_product_id and p.store_id=_store_id and not p.is_archived;
  if not found then return jsonb_build_object('validation_errors',to_jsonb(array['PRODUCT_NOT_FOUND'])); end if;

  if not _p.is_available or _p.is_sold_out then _errors := _errors || 'PRODUCT_UNAVAILABLE'; end if;
  if _p.stock_quantity is not null and _qty > _p.stock_quantity then _errors := _errors || 'PRODUCT_STOCK_INSUFFICIENT'; end if;
  if _selections is null or jsonb_typeof(_selections)<>'array' then _selections:='[]'::jsonb; end if;

  select exists(select 1 from public.product_variants pv where pv.product_id=_p.id and pv.store_id=_store_id and pv.is_available and not pv.is_archived) into _has_variants;
  if _variant_id is not null then
    select * into _v from public.product_variants pv where pv.id=_variant_id and pv.store_id=_store_id and pv.product_id=_p.id and pv.is_available and not pv.is_archived;
    if not found then _errors:=_errors||'VARIANT_INVALID'; end if;
  elsif _has_variants then
    select * into _v from public.product_variants pv where pv.product_id=_p.id and pv.store_id=_store_id and pv.is_available and not pv.is_archived and pv.is_default limit 1;
    if not found then _errors:=_errors||'VARIANT_REQUIRED'; end if;
  end if;

  if _qty<=0 then _errors:=_errors||'QUANTITY_INVALID'; _qty:=coalesce(_p.minimum_quantity,1); end if;
  if _qty < coalesce(_p.minimum_quantity,1) then _errors:=_errors||'QUANTITY_BELOW_MINIMUM'; end if;
  if _p.quantity_step>0 and mod(_qty-_p.minimum_quantity,_p.quantity_step)<>0 then _errors:=_errors||'QUANTITY_STEP_INVALID'; end if;

  if _p.sale_mode='measured' then _base_unit:=_p.base_price; _base_total:=private.money(_base_unit*_qty);
  else _base_unit:=coalesce(_v.price,_p.base_price); _base_total:=private.money(_base_unit*_qty); end if;

  _flavor_rule := coalesce(_p.pricing_rules->>'multi_flavor_pricing','');

  for _link in
    select pog.*,og.name,og.selection_type,og.is_required,og.pricing_strategy,og.price_effect,og.portion_count,
           og.min_selections g_min,og.max_selections g_max,og.included_selections,og.role,og.configuration
    from public.product_option_groups pog join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
    where pog.product_id=_p.id and pog.store_id=_store_id and pog.is_active and not pog.is_archived and og.is_active and not og.is_archived
    order by pog.sort_order,og.name,og.id
  loop
    _sel:=null;
    select s into _sel from jsonb_array_elements(_selections) s where (s->>'group_id')::text=_link.option_group_id::text limit 1;
    _items:=coalesce(_sel->'items','[]'::jsonb); if jsonb_typeof(_items)<>'array' then _items:='[]'::jsonb; end if;
    _count_items:=0; _sum_qty:=0; _weighted_num:=0; _weighted_den:=0; _plain_sum:=0; _max_price:=null;
    _charge_num:=0; _charge_den:=0; _charge_max:=null; _seen:=array[]::uuid[]; _free_left:=coalesce(_link.included_selections,0); _group_value:=0;

    for _item in select value from jsonb_array_elements(_items) t(value) loop
      if (_item->>'item_id') is null then _errors:=_errors||'OPTION_INVALID'; continue; end if;
      select * into _it from public.option_items oi where oi.id=(_item->>'item_id')::uuid and oi.store_id=_store_id and oi.option_group_id=_link.option_group_id and oi.is_available and not oi.is_archived;
      if not found then _errors:=_errors||'OPTION_INVALID'; continue; end if;
      if _it.id=any(_seen) then _errors:=_errors||'OPTION_DUPLICATED'; continue; end if; _seen:=_seen||_it.id;
      _iqty:=coalesce(nullif(_item->>'quantity','')::numeric,1);
      if _iqty<=0 or scale(_iqty)>0 then _errors:=_errors||'OPTION_QUANTITY_INVALID'; continue; end if;
      if _link.selection_type<>'quantidade' and _link.portion_count is null and _iqty<>1 then _errors:=_errors||'OPTION_QUANTITY_INVALID'; _iqty:=1; end if;
      if _iqty>_it.max_quantity and (_link.selection_type='quantidade' or _link.portion_count is not null) then _errors:=_errors||'OPTION_QUANTITY_ABOVE_MAX'; end if;
      if _it.inventory_quantity is not null and _iqty>_it.inventory_quantity then _errors:=_errors||'OPTION_STOCK_INSUFFICIENT'; end if;
      if _it.linked_variant_id is not null and not exists(select 1 from public.product_variants pv where pv.id=_it.linked_variant_id and pv.product_id=_it.linked_product_id and pv.store_id=_store_id and pv.is_available and not pv.is_archived) then _errors:=_errors||'COMBO_ITEM_UNAVAILABLE'; end if;
      if _it.linked_product_id is not null and not exists(select 1 from public.products lp where lp.id=_it.linked_product_id and lp.store_id=_store_id and lp.is_available and not lp.is_sold_out and not lp.is_archived) then _errors:=_errors||'COMBO_ITEM_UNAVAILABLE'; end if;

      _price:=null;
      if _v.id is not null then select pp.price into _price from public.product_variant_option_item_prices pp where pp.store_id=_store_id and pp.product_variant_id=_v.id and pp.option_item_id=_it.id; end if;
      _price:=coalesce(_price,_it.additional_price);

      _count_items:=_count_items+1; _sum_qty:=_sum_qty+_iqty;
      _weighted_num:=_weighted_num+(_price*_iqty); _weighted_den:=_weighted_den+_iqty; _plain_sum:=_plain_sum+_price; _max_price:=greatest(coalesce(_max_price,_price),_price);
      _charge_qty:=greatest(_iqty-_free_left,0); _free_left:=greatest(_free_left-_iqty,0);
      if _charge_qty>0 then _charge_num:=_charge_num+(_price*_charge_qty); _charge_den:=_charge_den+_charge_qty; _charge_max:=greatest(coalesce(_charge_max,_price),_price); end if;
    end loop;

    if _link.portion_count is not null and _count_items>0 and _sum_qty<>_link.portion_count then _errors:=_errors||'PORTIONS_INCOMPLETE'; end if;
    if _link.selection_type='quantidade' then
      if _sum_qty<coalesce(_link.min_selections,_link.g_min) and (_link.is_required or _sum_qty>0) then _errors:=_errors||'SELECTION_BELOW_MINIMUM'; end if;
      if _sum_qty>coalesce(_link.max_selections,_link.g_max) then _errors:=_errors||'SELECTION_ABOVE_MAXIMUM'; end if;
    else
      if _count_items<coalesce(_link.min_selections,_link.g_min) and (_link.is_required or _count_items>0) then _errors:=_errors||'SELECTION_BELOW_MINIMUM'; end if;
      if _count_items>coalesce(_link.max_selections,_link.g_max) then _errors:=_errors||'SELECTION_ABOVE_MAXIMUM'; end if;
    end if;
    if _count_items=0 then continue; end if;

    _price_mode:=coalesce(_link.configuration->>'price_mode','');
    _effective_effect:=_link.price_effect::text;

    -- Regra específica é configuração do PRODUTO. role só identifica semântica do grupo.
    if _link.role='flavor' and coalesce((_p.capabilities->>'multi_flavor')::boolean,false) and _flavor_rule<>'' then
      case _flavor_rule
        when 'highest' then _group_value:=coalesce(_max_price,0);
        when 'average' then _group_value:=case when _count_items>0 then _plain_sum/_count_items else 0 end;
        when 'proportional' then _group_value:=case when _weighted_den>0 then _weighted_num/_weighted_den else 0 end;
        when 'fixed_size' then _group_value:=0; _effective_effect:='additive';
        else _group_value:=_weighted_num;
      end case;
    elsif _price_mode='none' then
      _group_value:=0; _effective_effect:='additive';
    else
      -- Quando há escolhas incluídas, só o excedente é cobrado.
      case _link.pricing_strategy::text
        when 'highest_price' then _group_value:=coalesce(_charge_max,0);
        when 'average_price' then _group_value:=case when _charge_den>0 then _charge_num/_charge_den else 0 end;
        else _group_value:=_charge_num;
      end case;
    end if;
    _group_value:=private.money(_group_value);

    if _effective_effect='replace_base' then
      if _replace_seen then _errors:=_errors||'MULTIPLE_REPLACE_BASE'; else _replace_seen:=true; _replace_tot:=_group_value; end if;
    else _additive_tot:=_additive_tot+_group_value; end if;

    _breakdown:=_breakdown||jsonb_build_object('group_id',_link.option_group_id,'group_name',_link.name,'role',_link.role,'pricing_strategy',_link.pricing_strategy,'price_effect',_effective_effect,'included_selections',_link.included_selections,'selected_items',_count_items,'selected_quantity',_sum_qty,'value',_group_value);
  end loop;

  if _p.sale_mode='measured' then _final_unit:=coalesce(_replace_tot,_base_unit); _base_total:=private.money(_final_unit*_qty); _final_total:=private.money(_base_total+_additive_tot);
  else _final_unit:=private.money(coalesce(_replace_tot,_base_unit)+_additive_tot); _base_total:=private.money(coalesce(_replace_tot,_base_unit)*_qty); _final_total:=private.money(_final_unit*_qty); end if;

  return jsonb_build_object('product_id',_p.id,'product_type',_p.product_type,'engine_version',_p.engine_version,'variant_id',_v.id,'sale_mode',_p.sale_mode,'measurement_unit',_p.measurement_unit,'quantity',_qty,'base_price',_base_unit,'base_total',_base_total,'replacement_group_total',_replace_tot,'additive_groups_total',private.money(_additive_tot),'final_unit_price',_final_unit,'final_total',case when array_length(_errors,1) is null then _final_total else null end,'breakdown',_breakdown,'validation_errors',to_jsonb(_errors));
end; $$;

-- Compatibilidade total: todos os chamadores antigos (prévia, storefront, carrinho e checkout)
-- continuam chamando o mesmo nome e passam automaticamente pelo motor v2.
create or replace function private.calculate_configured_product_price(
  _store_id uuid,_product_id uuid,_variant_id uuid,_quantity numeric,_selections jsonb default '[]'::jsonb
) returns jsonb language sql stable set search_path=public,pg_temp as $$
  select private.calculate_configured_product_price_v2(_store_id,_product_id,_variant_id,_quantity,_selections)
$$;
