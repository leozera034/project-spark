begin;

-- Comandiva: parity de operação com apps de delivery maduros.
-- 1) O lojista passa a controlar agenda, estoque e limite por pedido pela UI.
-- 2) O cardápio público recebe um sinal de "mais pedido" calculado por vendas reais
--    dos últimos 30 dias, sem expor contagens sensíveis.

create index if not exists order_items_store_product_created_idx
  on public.order_items (store_id, product_id, created_at desc)
  where product_id is not null;

create or replace function private.catalog_product_json(_p public.products)
returns jsonb
language sql
stable
set search_path = 'public','private','pg_temp'
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

create or replace function public.update_catalog_product_availability(
  _store_id uuid,
  _id uuid,
  _available_weekdays smallint[] default null,
  _available_from time default null,
  _available_to time default null,
  _max_quantity integer default null,
  _stock_quantity numeric default null,
  _low_stock_threshold numeric default 5,
  _expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public','private','pg_temp'
as $$
declare
  _sid uuid := private.resolve_store(_store_id);
  _row public.products;
  _days smallint[] := _available_weekdays;
begin
  perform private.require_permission('catalog.update', _sid);

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

  if _days is not null then
    if cardinality(_days) = 0 then
      raise exception 'INVALID_AVAILABILITY_DAYS' using errcode = 'P0001';
    end if;
    if exists (select 1 from unnest(_days) d where d < 0 or d > 6) then
      raise exception 'INVALID_AVAILABILITY_DAYS' using errcode = 'P0001';
    end if;
    if cardinality(_days) <> (select count(distinct d) from unnest(_days) d) then
      raise exception 'INVALID_AVAILABILITY_DAYS' using errcode = 'P0001';
    end if;
    select array_agg(d order by d) into _days from unnest(_days) d;
  end if;

  if _max_quantity is not null and _max_quantity <= 0 then
    raise exception 'INVALID_MAX_QUANTITY' using errcode = 'P0001';
  end if;
  if _stock_quantity is not null and _stock_quantity < 0 then
    raise exception 'INVALID_STOCK' using errcode = 'P0001';
  end if;
  if _low_stock_threshold is null or _low_stock_threshold < 0 then
    raise exception 'INVALID_LOW_STOCK_THRESHOLD' using errcode = 'P0001';
  end if;

  update public.products
     set available_weekdays = _days,
         available_from = _available_from,
         available_to = _available_to,
         max_quantity = _max_quantity,
         stock_quantity = _stock_quantity,
         low_stock_threshold = _low_stock_threshold
   where id = _id and store_id = _sid
  returning * into _row;

  perform private.log_config_audit(
    _sid,
    'catalog.product.availability.updated',
    'products',
    _id,
    array[
      'available_weekdays','available_from','available_to',
      'max_quantity','stock_quantity','low_stock_threshold'
    ]
  );

  return private.catalog_product_json(_row);
end;
$$;

revoke all on function public.update_catalog_product_availability(uuid,uuid,smallint[],time,time,integer,numeric,numeric,timestamptz) from public, anon;
grant execute on function public.update_catalog_product_availability(uuid,uuid,smallint[],time,time,integer,numeric,numeric,timestamptz) to authenticated;

create or replace function public.storefront_catalog(_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_slug text:=public.storefront_normalize_slug(_slug);
  v_store uuid;
  v_best_sellers uuid[] := '{}'::uuid[];
begin
  if v_slug is null then return null; end if;
  select st.id into v_store from public.stores st where st.slug=v_slug and st.status='ativa' limit 1;
  if v_store is null then return null; end if;

  select coalesce(array_agg(r.product_id order by r.sold_quantity desc, r.product_id), '{}'::uuid[])
    into v_best_sellers
    from (
      select oi.product_id, sum(oi.quantity) as sold_quantity
        from public.order_items oi
        join public.orders o
          on o.id=oi.order_id and o.store_id=oi.store_id
       where oi.store_id=v_store
         and oi.product_id is not null
         and o.created_at >= now() - interval '30 days'
         and o.status not in ('recusado','cancelado')
       group by oi.product_id
       order by sold_quantity desc, oi.product_id
       limit 5
    ) r;

  return jsonb_build_object(
    'categories',coalesce((
      select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'image_path',c.image_path,'sort_order',c.sort_order) order by c.sort_order,c.name)
      from public.categories c
      where c.store_id=v_store and c.is_active and not c.is_archived
        and exists(
          select 1 from public.products p
          where p.store_id=v_store and p.category_id=c.id
            and private.product_runtime_available(v_store,p.id,now())
        )
    ),'[]'::jsonb),
    'products',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'category_id',p.category_id,'name',p.name,'description',p.description,'image_path',p.image_path,
        'base_price',p.base_price,
        'from_price',case when p.has_variants then (
          select min(v.price) from public.product_variants v
          where v.product_id=p.id and v.store_id=v_store and v.is_available and not v.is_archived
        ) else p.base_price end,
        'sale_mode',p.sale_mode,'measurement_unit',p.measurement_unit,'pricing_unit',p.pricing_unit,'unit_label',p.unit_label,
        'has_variants',p.has_variants,'product_type',p.product_type,'capabilities',p.capabilities,'engine_version',p.engine_version,
        'is_sold_out',p.is_sold_out,'is_featured',p.is_featured,
        'is_best_seller',p.id=any(v_best_sellers),
        'minimum_quantity',p.minimum_quantity,'quantity_step',p.quantity_step,
        'max_quantity',p.max_quantity,'stock_quantity',p.stock_quantity,'allows_notes',p.allows_notes,
        'has_options',exists(select 1 from public.product_option_groups pog where pog.product_id=p.id and pog.store_id=v_store and pog.is_active and not pog.is_archived),
        'sort_order',p.sort_order
      ) order by p.sort_order,p.name)
      from public.products p
      where p.store_id=v_store
        and private.product_runtime_available(v_store,p.id,now())
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.storefront_catalog(text) from public,anon,authenticated;
grant execute on function public.storefront_catalog(text) to service_role;

commit;
