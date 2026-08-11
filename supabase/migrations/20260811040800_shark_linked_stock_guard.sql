-- SHARK — estoque de produtos referenciados em etapas de combo.
create or replace function private.calculate_configured_product_price(
  _store_id uuid,_product_id uuid,_variant_id uuid,_quantity numeric,_selections jsonb default '[]'::jsonb
) returns jsonb
language plpgsql stable set search_path=public,pg_temp as $$
declare
  normalized jsonb;
  result jsonb;
  extra text[]:=array[]::text[];
  sel jsonb;
  item jsonb;
  oi public.option_items;
  lp public.products;
  q numeric;
  errors jsonb;
begin
  normalized:=private.normalize_configured_selections(_store_id,_selections);
  result:=private.calculate_configured_product_price_v2(_store_id,_product_id,_variant_id,_quantity,normalized);

  for sel in select value from jsonb_array_elements(normalized) t(value) loop
    for item in select value from jsonb_array_elements(coalesce(sel->'items','[]'::jsonb)) t(value) loop
      select * into oi from public.option_items
       where id=nullif(item->>'item_id','')::uuid and store_id=_store_id;
      continue when not found or oi.linked_product_id is null;
      select * into lp from public.products where id=oi.linked_product_id and store_id=_store_id;
      continue when not found or lp.stock_quantity is null;
      q:=coalesce(nullif(item->>'quantity','')::numeric,1) * coalesce(_quantity,1);
      if q>lp.stock_quantity then extra:=extra||'COMBO_ITEM_STOCK_INSUFFICIENT'; end if;
    end loop;
  end loop;

  if array_length(extra,1) is not null then
    select coalesce(jsonb_agg(distinct e),'[]'::jsonb)
      into errors
      from jsonb_array_elements_text(coalesce(result->'validation_errors','[]'::jsonb) || to_jsonb(extra)) e;
    result:=jsonb_set(result,'{validation_errors}',errors,true);
    result:=jsonb_set(result,'{final_total}','null'::jsonb,true);
  end if;
  return result;
end; $$;
