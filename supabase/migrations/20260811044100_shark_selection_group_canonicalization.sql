-- SHARK — canonicalização final das escolhas por grupo.
-- Um mesmo group_id enviado mais de uma vez deixa de produzir comportamento
-- dependente da ordem do JSON. Todas as entradas do grupo são fundidas e os itens
-- seguem a ordem canônica do catálogo. Duplicidade de item continua sendo rejeitada
-- pelo pricing engine com OPTION_DUPLICATED.

create or replace function private.normalize_configured_selections(
  _store_id uuid,
  _selections jsonb
) returns jsonb
language sql stable set search_path=public,pg_temp as $$
  with raw_groups as (
    select
      nullif(value->>'group_id','')::uuid as group_id,
      value as raw
    from jsonb_array_elements(
      case
        when jsonb_typeof(coalesce(_selections,'[]'::jsonb))='array'
          then coalesce(_selections,'[]'::jsonb)
        else '[]'::jsonb
      end
    )
  ), distinct_groups as (
    select distinct group_id
    from raw_groups
    where group_id is not null
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'group_id',g.group_id,
        'items',coalesce((
          select jsonb_agg(
            item.value
            order by oi.sort_order nulls last, oi.name nulls last, item.value->>'item_id'
          )
          from raw_groups rg
          cross join lateral jsonb_array_elements(
            case
              when jsonb_typeof(coalesce(rg.raw->'items','[]'::jsonb))='array'
                then coalesce(rg.raw->'items','[]'::jsonb)
              else '[]'::jsonb
            end
          ) item(value)
          left join public.option_items oi
            on oi.id=nullif(item.value->>'item_id','')::uuid
           and oi.store_id=_store_id
          where rg.group_id=g.group_id
        ),'[]'::jsonb)
      )
      order by og.sort_order nulls last,g.group_id
    ),
    '[]'::jsonb
  )
  from distinct_groups g
  left join public.option_groups og
    on og.id=g.group_id
   and og.store_id=_store_id;
$$;

comment on function private.normalize_configured_selections(uuid,jsonb) is
  'Canonicaliza seleções SHARK: funde group_id repetido e ordena itens pelo catálogo antes do pricing engine.';
