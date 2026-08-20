-- Fix measured-sale pricing reference quantities and impossible pizza flavor validation.
-- Production incident: Açaí por Peso stores R$ 7,90 per 100 g, but the pricing
-- engine multiplied the reference price directly by grams. Pizza Lab also required
-- 4/8 flavor parts while the storefront only allowed 1-2 flavor selections.

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
as $$
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
         greatest(coalesce(nullif(p.pricing_rules->>'price_reference_quantity','')::numeric, 1), 0.000001)
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
$$;

create or replace function private.calculate_configured_product_price(
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
as $$
declare
  _normalized jsonb;
  _result jsonb;
  _max_flavors integer;
  _parts integer;
  _flavor_group uuid;
  _distinct integer:=0;
  _selected_parts integer:=0;
  _entry jsonb;
  _errors jsonb;
begin
  _normalized:=private.normalize_configured_selections(_store_id,_selections);
  _result:=private.calculate_configured_product_price_v3(_store_id,_product_id,_variant_id,_quantity,_normalized);
  if _variant_id is null then return _result; end if;

  select max_flavors,flavor_parts into _max_flavors,_parts
    from public.product_variants
   where id=_variant_id and product_id=_product_id and store_id=_store_id and is_available and not is_archived;

  if _max_flavors is null and _parts is null then return _result; end if;

  select og.id into _flavor_group
    from public.product_option_groups pog
    join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
   where pog.store_id=_store_id and pog.product_id=_product_id
     and pog.is_active and not pog.is_archived
     and og.is_active and not og.is_archived and og.role='flavor'
   order by pog.sort_order,og.sort_order
   limit 1;

  if _flavor_group is null then return _result; end if;

  for _entry in select value from jsonb_array_elements(_normalized) t(value) loop
    if nullif(_entry->>'group_id','')::uuid=_flavor_group then
      select count(*),coalesce(sum(coalesce(nullif(item->>'quantity','')::integer,1)),0)::integer
        into _distinct,_selected_parts
        from jsonb_array_elements(coalesce(_entry->'items','[]'::jsonb)) item;
      exit;
    end if;
  end loop;

  _errors:=coalesce(_result->'validation_errors','[]'::jsonb);
  if jsonb_typeof(_errors)<>'array' then _errors:='[]'::jsonb; end if;

  if _max_flavors is not null and _distinct>_max_flavors then
    _errors:=_errors||jsonb_build_array('VARIANT_FLAVOR_LIMIT_EXCEEDED');
  end if;
  if _parts is not null and _selected_parts<>_parts then
    _errors:=_errors||jsonb_build_array('VARIANT_FLAVOR_PARTS_INCOMPLETE');
  end if;
  if jsonb_array_length(_errors)>0 then
    _result:=jsonb_set(_result,'{validation_errors}',_errors,true);
    _result:=jsonb_set(_result,'{final_total}','null'::jsonb,true);
  end if;
  return _result;
end;
$$;

-- The storefront selects flavors, not abstract pizza slices. Keep max_flavors as
-- the business rule and remove the incompatible flavor_parts requirement.
update public.option_groups og
set portion_count = null,
    price_effect = 'replace_base',
    configuration = coalesce(configuration,'{}'::jsonb)
      || jsonb_build_object('fractional', false, 'price_basis', 'highest_absolute_price'),
    updated_at = now()
from public.product_option_groups pog
join public.products p on p.id = pog.product_id and p.store_id = pog.store_id
where pog.option_group_id = og.id
  and p.name = 'Pizza Lab'
  and og.role = 'flavor';

update public.product_variants v
set flavor_parts = null,
    updated_at = now()
from public.products p
where p.id = v.product_id
  and p.store_id = v.store_id
  and p.name = 'Pizza Lab';
