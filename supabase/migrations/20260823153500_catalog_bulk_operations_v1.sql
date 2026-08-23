begin;

create or replace function public.bulk_update_catalog_products(
  _store_id uuid,
  _product_ids uuid[],
  _action text,
  _value boolean default null,
  _category_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
  _id uuid;
  _count integer := 0;
  _ids uuid[];
begin
  perform private.require_permission('catalog.update', _sid);

  if _product_ids is null or cardinality(_product_ids) < 1 or cardinality(_product_ids) > 100 then
    raise exception 'INVALID_BULK_SELECTION' using errcode = 'P0001';
  end if;

  select array_agg(distinct value order by value)
    into _ids
    from unnest(_product_ids) as value;

  if _action not in ('set_sold_out', 'set_active', 'set_featured', 'move_category') then
    raise exception 'INVALID_BULK_ACTION' using errcode = 'P0001';
  end if;

  if _action in ('set_sold_out', 'set_active', 'set_featured') and _value is null then
    raise exception 'INVALID_BULK_VALUE' using errcode = 'P0001';
  end if;

  if _action = 'move_category' then
    if _category_id is null then
      raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0001';
    end if;
    perform private.assert_catalog_category_usable(_sid, _category_id);
  end if;

  foreach _id in array _ids loop
    case _action
      when 'set_sold_out' then
        perform private.set_product_flag(_sid, _id, 'is_sold_out', _value, null);
      when 'set_active' then
        perform private.set_product_flag(_sid, _id, 'is_available', _value, null);
      when 'set_featured' then
        perform private.set_product_flag(_sid, _id, 'is_featured', _value, null);
      when 'move_category' then
        perform public.move_product_to_category(_sid, _id, _category_id, null);
    end case;
    _count := _count + 1;
  end loop;

  return jsonb_build_object(
    'updated', _count,
    'action', _action,
    'product_ids', to_jsonb(_ids)
  );
end;
$$;

revoke all on function public.bulk_update_catalog_products(uuid,uuid[],text,boolean,uuid) from public, anon;
grant execute on function public.bulk_update_catalog_products(uuid,uuid[],text,boolean,uuid) to authenticated;

commit;
