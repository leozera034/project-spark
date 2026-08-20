create or replace function private.calculate_configured_product_price_v3(
  _store_id uuid,
  _product_id uuid,
  _variant_id uuid,
  _quantity numeric,
  _selections jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
stable
set search_path to 'public','private','pg_temp'
as $function$
declare
  _result jsonb;
  _sale_mode text;
  _reference_qty numeric := 1;
  _base_total numeric := 0;
  _additive_total numeric := 0;
  _replacement_total numeric;
  _effective_unit numeric := 0;
  _effective_total numeric := 0;
begin
  _result := private.calculate_configured_product_price_v2(
    _store_id,
    _product_id,
    _variant_id,
    _quantity,
    _selections
  );

  select p.sale_mode::text,
         greatest(
           coalesce(
             nullif(p.pricing_rules->>'price_reference_quantity','')::numeric,
             case when p.sale_mode = 'measured' then nullif(p.minimum_quantity,0) else 1 end,
             1
           ),
           0.000001
         )
    into _sale_mode, _reference_qty
    from public.products p
   where p.id = _product_id
     and p.store_id = _store_id;

  if _sale_mode <> 'measured' or _reference_qty = 1 then
    return _result;
  end if;

  _base_total := coalesce((_result->>'base_total')::numeric, 0) / _reference_qty;
  _additive_total := coalesce((_result->>'additive_groups_total')::numeric, 0);
  _replacement_total := nullif(_result->>'replacement_group_total','')::numeric;

  if _replacement_total is not null then
    _effective_unit := _replacement_total / _reference_qty;
    _base_total := private.money(_effective_unit * coalesce(_quantity, 1));
  else
    _effective_unit := coalesce((_result->>'base_price')::numeric, 0) / _reference_qty;
    _base_total := private.money(_effective_unit * coalesce(_quantity, 1));
  end if;

  _effective_total := private.money(_base_total + _additive_total);

  _result := jsonb_set(_result, '{base_total}', to_jsonb(private.money(_base_total)), true);
  _result := jsonb_set(_result, '{final_unit_price}', to_jsonb(private.money(_effective_unit)), true);
  _result := jsonb_set(
    _result,
    '{final_total}',
    case
      when jsonb_array_length(coalesce(_result->'validation_errors','[]'::jsonb)) = 0
        then to_jsonb(_effective_total)
      else 'null'::jsonb
    end,
    true
  );

  return _result;
end;
$function$;

create or replace function public.update_product_sale_mode(
  _store_id uuid,
  _product_id uuid,
  _sale_mode text,
  _measurement_unit text default 'unit',
  _minimum_quantity numeric default 1,
  _quantity_step numeric default 1,
  _expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _sid uuid := private.resolve_store(_store_id);
  _row public.products;
  _mode public.product_sale_mode;
  _unit public.measurement_unit;
  _rules jsonb;
begin
  perform private.require_permission('catalog.update',_sid);
  if _sale_mode not in ('unit','measured','fixed_package') then raise exception 'INVALID_SALE_MODE' using errcode='P0001'; end if;
  if _measurement_unit not in ('unit','kg','g','l','ml') then raise exception 'INVALID_MEASUREMENT_UNIT' using errcode='P0001'; end if;
  _mode := _sale_mode::public.product_sale_mode;
  _unit := _measurement_unit::public.measurement_unit;

  select * into _row from public.products p where p.id=_product_id and p.store_id=_sid for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _row.is_archived then raise exception 'PRODUCT_ARCHIVED' using errcode='P0001'; end if;
  perform private.assert_version(_expected_updated_at,_row.updated_at);

  _rules := coalesce(_row.pricing_rules,'{}'::jsonb);

  if _mode='measured' then
    if _unit='unit' then raise exception 'INVALID_MEASUREMENT_UNIT' using errcode='P0001'; end if;
    if coalesce(_minimum_quantity,0)<=0 or coalesce(_quantity_step,0)<=0 then raise exception 'INVALID_QUANTITY_RULES' using errcode='P0001'; end if;
    if exists(select 1 from public.product_variants pv where pv.product_id=_product_id and pv.store_id=_sid and pv.is_available and not pv.is_archived) then raise exception 'MEASURED_WITH_VARIANTS' using errcode='P0001'; end if;
    _rules := jsonb_set(_rules,'{price_reference_quantity}',to_jsonb(_minimum_quantity),true);
  else
    _minimum_quantity := coalesce(nullif(_minimum_quantity,0),1);
    _quantity_step := coalesce(nullif(_quantity_step,0),1);
    if _mode='unit' then _unit:='unit'; end if;
    _rules := _rules - 'price_reference_quantity';
  end if;

  update public.products
     set sale_mode=_mode,
         measurement_unit=_unit,
         minimum_quantity=_minimum_quantity,
         quantity_step=_quantity_step,
         pricing_rules=_rules,
         has_variants=(_mode='fixed_package') or has_variants
   where id=_product_id and store_id=_sid
   returning * into _row;

  perform private.log_config_audit(_sid,'catalog.product.sale_mode.updated','products',_product_id,array['sale_mode','measurement_unit','minimum_quantity','quantity_step','pricing_rules']);
  return private.catalog_product_json(_row);
end;
$function$;