create or replace function public.create_product_from_template(
  _store_id uuid,
  _category_id uuid,
  _name text,
  _description text default null,
  _base_price numeric default 0,
  _allows_notes boolean default true,
  _is_active boolean default true,
  _is_featured boolean default false,
  _is_sold_out boolean default false,
  _template_type text default 'simple',
  _capabilities jsonb default '{}'::jsonb,
  _sale_mode text default 'unit',
  _measurement_unit text default 'unit',
  _minimum_quantity numeric default 1,
  _quantity_step numeric default 1,
  _variants jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _product jsonb;
  _product_id uuid;
  _variant jsonb;
  _created_variants jsonb := '[]'::jsonb;
  _variant_result jsonb;
  _mode text := lower(coalesce(_sale_mode,'unit'));
  _unit text := lower(coalesce(_measurement_unit,'unit'));
  _rules jsonb := '{}'::jsonb;
begin
  perform private.require_permission('catalog.create', private.resolve_store(_store_id));
  if jsonb_typeof(coalesce(_capabilities,'{}'::jsonb)) <> 'object' then raise exception 'INVALID_CAPABILITIES' using errcode='P0001'; end if;
  if jsonb_typeof(coalesce(_variants,'[]'::jsonb)) <> 'array' then raise exception 'INVALID_VARIANTS' using errcode='P0001'; end if;

  _product := public.create_simple_product(_store_id,_category_id,_name,_description,_base_price,_allows_notes,_is_active,_is_featured,_is_sold_out);
  _product_id := (_product->>'id')::uuid;

  if _mode = 'measured' then
    perform public.update_product_sale_mode(_store_id,_product_id,'measured',_unit,_minimum_quantity,_quantity_step,null);
    _rules := jsonb_build_object('price_reference_quantity',_minimum_quantity);
  elsif _mode = 'fixed_package' then
    perform public.update_product_sale_mode(_store_id,_product_id,'fixed_package',_unit,_minimum_quantity,_quantity_step,null);
  elsif _mode <> 'unit' then
    raise exception 'INVALID_SALE_MODE' using errcode='P0001';
  end if;

  if _mode='measured' and jsonb_array_length(coalesce(_variants,'[]'::jsonb))>0 then
    raise exception 'MEASURED_WITH_VARIANTS' using errcode='P0001';
  end if;

  for _variant in select value from jsonb_array_elements(coalesce(_variants,'[]'::jsonb))
  loop
    if nullif(btrim(coalesce(_variant->>'name','')),'') is null then raise exception 'INVALID_VARIANT_NAME' using errcode='P0001'; end if;
    _variant_result := public.create_product_variant(
      _store_id,
      _product_id,
      _variant->>'name',
      nullif(_variant->>'price','')::numeric,
      nullif(_variant->>'package_quantity','')::numeric,
      nullif(_variant->>'package_unit',''),
      coalesce((_variant->>'is_default')::boolean,false)
    );
    _created_variants := _created_variants || jsonb_build_array(_variant_result);
  end loop;

  perform public.update_product_engine_profile(
    _store_id,
    _product_id,
    lower(btrim(coalesce(_template_type,'simple'))),
    coalesce(_capabilities,'{}'::jsonb),
    _rules
  );

  select private.catalog_product_json(p) into _product from public.products p where p.id=_product_id and p.store_id=private.resolve_store(_store_id);
  return jsonb_build_object('ok',true,'product',_product,'product_id',_product_id,'variants',_created_variants);
end;
$function$;

grant execute on function public.create_product_from_template(uuid,uuid,text,text,numeric,boolean,boolean,boolean,boolean,text,jsonb,text,text,numeric,numeric,jsonb) to authenticated;
