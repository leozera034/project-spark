-- SHARK — canonicalização de escolhas.
-- Evita que a ordem arbitrária do JSON enviado pelo cliente determine quais itens
-- ficam dentro da franquia de escolhas incluídas. A ordem é sempre a do catálogo.

create or replace function private.normalize_configured_selections(
  _store_id uuid,
  _selections jsonb
) returns jsonb
language sql stable set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'group_id', grp.group_id,
      'items', coalesce((
        select jsonb_agg(item.value order by oi.sort_order nulls last, oi.name nulls last, item.value->>'item_id')
        from jsonb_array_elements(coalesce(grp.raw->'items','[]'::jsonb)) item(value)
        left join public.option_items oi
          on oi.id = nullif(item.value->>'item_id','')::uuid
         and oi.store_id = _store_id
      ),'[]'::jsonb)
    ) order by og.sort_order nulls last, grp.group_id
  ),'[]'::jsonb)
  from (
    select value as raw, nullif(value->>'group_id','')::uuid as group_id
    from jsonb_array_elements(case when jsonb_typeof(coalesce(_selections,'[]'::jsonb))='array' then coalesce(_selections,'[]'::jsonb) else '[]'::jsonb end)
  ) grp
  left join public.option_groups og on og.id=grp.group_id and og.store_id=_store_id;
$$;

create or replace function private.calculate_configured_product_price(
  _store_id uuid,_product_id uuid,_variant_id uuid,_quantity numeric,_selections jsonb default '[]'::jsonb
) returns jsonb language sql stable set search_path=public,pg_temp as $$
  select private.calculate_configured_product_price_v2(
    _store_id,
    _product_id,
    _variant_id,
    _quantity,
    private.normalize_configured_selections(_store_id,_selections)
  )
$$;
