begin;

create or replace function private.catalog_product_json(_p public.products)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', _p.id,
    'category_id', _p.category_id,
    'category_name', (select c.name from public.categories c
                       where c.id = _p.category_id and c.store_id = _p.store_id),
    'name', _p.name,
    'description', _p.description,
    'image_path', _p.image_path,
    'base_price', _p.base_price,
    'pricing_unit', _p.pricing_unit,
    'minimum_quantity', _p.minimum_quantity,
    'quantity_step', _p.quantity_step,
    'allows_notes', _p.allows_notes,
    'is_active', _p.is_available,
    'is_featured', _p.is_featured,
    'is_sold_out', _p.is_sold_out,
    'is_archived', _p.is_archived,
    'has_variants', _p.has_variants,
    'available_from', _p.available_from,
    'available_to', _p.available_to,
    'available_weekdays', _p.available_weekdays,
    'max_quantity', _p.max_quantity,
    'stock_quantity', _p.stock_quantity,
    'low_stock_threshold', _p.low_stock_threshold,
    'runtime_available', private.product_runtime_available(_p.store_id, _p.id, now()),
    'sort_order', _p.sort_order,
    'updated_at', _p.updated_at
  )
$$;

create or replace function private.catalog_product_cost_json(_p public.products)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', _p.id,
    'base_price', _p.base_price,
    'unit_cost', _p.unit_cost,
    'cost_updated_at', _p.cost_updated_at,
    'has_variants', _p.has_variants,
    'updated_at', _p.updated_at
  )
$$;

create or replace function public.get_catalog_product_cost(
  _store_id uuid,
  _id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
  _row public.products;
begin
  perform private.require_permission('reports.view_operational', _sid);

  select * into _row
    from public.products p
   where p.id = _id and p.store_id = _sid;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  return private.catalog_product_cost_json(_row);
end;
$$;

revoke all on function public.get_catalog_product_cost(uuid,uuid) from public, anon;
grant execute on function public.get_catalog_product_cost(uuid,uuid) to authenticated;

create or replace function public.update_catalog_product_cost(
  _store_id uuid,
  _id uuid,
  _unit_cost numeric default null,
  _expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
  _row public.products;
begin
  perform private.require_permission('catalog.update', _sid);
  perform private.require_permission('reports.view_operational', _sid);

  if _unit_cost is not null and (_unit_cost < 0 or _unit_cost > 999999.99 or scale(_unit_cost) > 2) then
    raise exception 'INVALID_UNIT_COST' using errcode = 'P0001';
  end if;

  select * into _row
    from public.products p
   where p.id = _id and p.store_id = _sid
   for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if _row.is_archived then
    raise exception 'PRODUCT_ARCHIVED' using errcode = 'P0001';
  end if;

  perform private.assert_version(_expected_updated_at, _row.updated_at);

  update public.products p
     set unit_cost = _unit_cost,
         cost_updated_at = case when _unit_cost is distinct from p.unit_cost then now() else p.cost_updated_at end
   where p.id = _id and p.store_id = _sid
  returning * into _row;

  perform private.log_config_audit(
    _sid,
    'catalog.product.cost.updated',
    'products',
    _id,
    array['unit_cost']
  );

  return private.catalog_product_cost_json(_row);
end;
$$;

revoke all on function public.update_catalog_product_cost(uuid,uuid,numeric,timestamptz) from public, anon;
grant execute on function public.update_catalog_product_cost(uuid,uuid,numeric,timestamptz) to authenticated;

commit;
