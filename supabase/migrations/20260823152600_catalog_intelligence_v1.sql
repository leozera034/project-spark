begin;

alter table public.products
  add column if not exists unit_cost numeric(12,2),
  add column if not exists cost_updated_at timestamptz;

alter table public.products
  drop constraint if exists products_unit_cost_check;

alter table public.products
  add constraint products_unit_cost_check
  check (unit_cost is null or (unit_cost >= 0 and unit_cost <= 999999.99 and scale(unit_cost) <= 2));

comment on column public.products.unit_cost is
  'Custo estimado do produto na mesma base comercial usada no preço base. V1 não inclui custo separado de adicionais/ingredientes.';
comment on column public.products.cost_updated_at is
  'Momento da última atualização manual do custo estimado.';

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
    'unit_cost', _p.unit_cost,
    'cost_updated_at', _p.cost_updated_at,
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

  return private.catalog_product_json(_row);
end;
$$;

revoke all on function public.update_catalog_product_cost(uuid,uuid,numeric,timestamptz) from public, anon;
grant execute on function public.update_catalog_product_cost(uuid,uuid,numeric,timestamptz) to authenticated;

create or replace function public.get_catalog_menu_intelligence(
  _store_id uuid default null,
  _days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
  _period integer := coalesce(_days, 30);
  _result jsonb;
begin
  perform private.require_permission('reports.view_operational', _sid);

  if _period < 7 or _period > 365 then
    raise exception 'INVALID_PERIOD' using errcode = 'P0001';
  end if;

  with valid_orders as (
    select o.id
      from public.orders o
     where o.store_id = _sid
       and o.created_at >= now() - make_interval(days => _period)
       and o.status not in ('recusado','cancelado')
       and private.order_payment_operational_ready(o.payment_method_kind, o.payment_status)
  ),
  sales as (
    select
      oi.product_id,
      count(distinct oi.order_id)::integer as order_count,
      coalesce(sum(oi.quantity), 0)::numeric as sold_quantity,
      coalesce(sum(oi.line_total), 0)::numeric as revenue
    from public.order_items oi
    join valid_orders vo on vo.id = oi.order_id
    where oi.store_id = _sid
      and oi.product_id is not null
    group by oi.product_id
  ),
  rows as (
    select
      p.id,
      p.category_id,
      c.name as category_name,
      p.name,
      p.base_price,
      p.unit_cost,
      p.has_variants,
      p.is_available as is_active,
      p.is_sold_out,
      coalesce(s.order_count, 0) as order_count,
      coalesce(s.sold_quantity, 0)::numeric as sold_quantity,
      coalesce(s.revenue, 0)::numeric as revenue,
      case when p.unit_cost is null then null
           else round((coalesce(s.sold_quantity, 0) * p.unit_cost)::numeric, 2)
      end as estimated_cost,
      case when p.unit_cost is null then null
           else round((coalesce(s.revenue, 0) - (coalesce(s.sold_quantity, 0) * p.unit_cost))::numeric, 2)
      end as estimated_margin,
      case when p.unit_cost is null or coalesce(s.revenue, 0) <= 0 then null
           else round((((coalesce(s.revenue, 0) - (coalesce(s.sold_quantity, 0) * p.unit_cost)) / s.revenue) * 100)::numeric, 2)
      end as estimated_margin_percent
    from public.products p
    left join public.categories c
      on c.id = p.category_id and c.store_id = p.store_id
    left join sales s on s.product_id = p.id
    where p.store_id = _sid
      and not p.is_archived
  ),
  summary as (
    select
      (select count(*)::integer from valid_orders) as order_count,
      count(*)::integer as product_count,
      count(*) filter (where unit_cost is not null)::integer as configured_cost_products,
      count(*) filter (where unit_cost is null)::integer as products_without_cost,
      count(*) filter (where unit_cost is null and sold_quantity > 0)::integer as sold_products_without_cost,
      coalesce(sum(revenue), 0)::numeric as revenue,
      coalesce(sum(revenue) filter (where unit_cost is not null), 0)::numeric as revenue_with_cost,
      coalesce(sum(estimated_cost) filter (where unit_cost is not null), 0)::numeric as estimated_cost,
      coalesce(sum(estimated_margin) filter (where unit_cost is not null), 0)::numeric as estimated_margin
    from rows
  )
  select jsonb_build_object(
    'period_days', _period,
    'cost_scope', 'base_product_only',
    'summary', jsonb_build_object(
      'orders', s.order_count,
      'products', s.product_count,
      'configured_cost_products', s.configured_cost_products,
      'products_without_cost', s.products_without_cost,
      'sold_products_without_cost', s.sold_products_without_cost,
      'revenue', round(s.revenue, 2),
      'revenue_with_cost', round(s.revenue_with_cost, 2),
      'cost_coverage_percent', case when s.revenue <= 0 then 0 else round((s.revenue_with_cost / s.revenue) * 100, 2) end,
      'estimated_cost', round(s.estimated_cost, 2),
      'estimated_margin', round(s.estimated_margin, 2),
      'estimated_margin_percent', case when s.revenue_with_cost <= 0 then null else round((s.estimated_margin / s.revenue_with_cost) * 100, 2) end
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'category_id', r.category_id,
        'category_name', r.category_name,
        'name', r.name,
        'base_price', r.base_price,
        'unit_cost', r.unit_cost,
        'has_variants', r.has_variants,
        'is_active', r.is_active,
        'is_sold_out', r.is_sold_out,
        'orders', r.order_count,
        'sold_quantity', r.sold_quantity,
        'revenue', round(r.revenue, 2),
        'estimated_cost', r.estimated_cost,
        'estimated_margin', r.estimated_margin,
        'estimated_margin_percent', r.estimated_margin_percent
      ) order by r.revenue desc, r.sold_quantity desc, r.name, r.id)
      from rows r
    ), '[]'::jsonb)
  ) into _result
  from summary s;

  return _result;
end;
$$;

revoke all on function public.get_catalog_menu_intelligence(uuid,integer) from public, anon;
grant execute on function public.get_catalog_menu_intelligence(uuid,integer) to authenticated;

commit;
