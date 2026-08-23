create table if not exists public.product_category_placements (
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  primary key (store_id, product_id, category_id)
);

create index if not exists product_category_placements_by_product
  on public.product_category_placements(store_id, product_id, sort_order, category_id);
create index if not exists product_category_placements_by_category
  on public.product_category_placements(store_id, category_id, product_id);

alter table public.product_category_placements enable row level security;
revoke all on table public.product_category_placements from public, anon, authenticated;
grant all on table public.product_category_placements to service_role;

create or replace function private.validate_product_category_placement()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  _primary_category uuid;
begin
  select p.category_id into _primary_category
    from public.products p
   where p.id=new.product_id and p.store_id=new.store_id and not p.is_archived;
  if _primary_category is null then
    raise exception 'PRODUCT_NOT_FOUND' using errcode='P0001';
  end if;

  if not exists (
    select 1 from public.categories c
     where c.id=new.category_id and c.store_id=new.store_id
  ) then
    raise exception 'CATEGORY_NOT_FOUND' using errcode='P0001';
  end if;

  if new.category_id=_primary_category then
    raise exception 'PRIMARY_CATEGORY_REDUNDANT' using errcode='P0001';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_validate_product_category_placement on public.product_category_placements;
create trigger trg_validate_product_category_placement
before insert or update on public.product_category_placements
for each row execute function private.validate_product_category_placement();

create or replace function private.cleanup_product_primary_category_placement()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  delete from public.product_category_placements pcp
   where pcp.store_id=new.store_id
     and pcp.product_id=new.id
     and pcp.category_id=new.category_id;
  return new;
end;
$function$;

drop trigger if exists trg_cleanup_product_primary_category_placement on public.products;
create trigger trg_cleanup_product_primary_category_placement
after insert or update of category_id on public.products
for each row execute function private.cleanup_product_primary_category_placement();

create or replace function public.get_catalog_product_category_placements(
  _store_id uuid,
  _product_id uuid
)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  _sid uuid := private.resolve_store(_store_id);
  _product public.products;
  _additional uuid[];
begin
  perform private.require_permission('catalog.view',_sid);
  select * into _product
    from public.products p
   where p.store_id=_sid and p.id=_product_id;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0001'; end if;

  select coalesce(array_agg(pcp.category_id order by pcp.sort_order,pcp.category_id),'{}'::uuid[])
    into _additional
    from public.product_category_placements pcp
    join public.categories c on c.id=pcp.category_id and c.store_id=pcp.store_id
   where pcp.store_id=_sid and pcp.product_id=_product_id
     and c.is_active and not c.is_archived;

  return jsonb_build_object(
    'product_id',_product.id,
    'primary_category_id',_product.category_id,
    'additional_category_ids',to_jsonb(_additional),
    'category_ids',to_jsonb(array[_product.category_id] || _additional)
  );
end;
$function$;

create or replace function public.set_catalog_product_category_placements(
  _store_id uuid,
  _product_id uuid,
  _category_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  _sid uuid := private.resolve_store(_store_id);
  _product public.products;
  _requested uuid[];
  _valid_count integer;
begin
  perform private.require_permission('catalog.update',_sid);
  select * into _product
    from public.products p
   where p.store_id=_sid and p.id=_product_id
   for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0001'; end if;
  if _product.is_archived then raise exception 'PRODUCT_ARCHIVED' using errcode='P0001'; end if;

  select coalesce(array_agg(x.category_id order by x.ordinality),'{}'::uuid[])
    into _requested
    from (
      select distinct on (u.category_id) u.category_id,u.ordinality
        from unnest(coalesce(_category_ids,'{}'::uuid[])) with ordinality as u(category_id,ordinality)
       where u.category_id is not null and u.category_id<>_product.category_id
       order by u.category_id,u.ordinality
    ) x;

  if cardinality(_requested)>8 then
    raise exception 'TOO_MANY_CATEGORY_PLACEMENTS' using errcode='P0001';
  end if;

  select count(*)::int into _valid_count
    from public.categories c
   where c.store_id=_sid and c.id=any(_requested)
     and c.is_active and not c.is_archived;
  if _valid_count<>cardinality(_requested) then
    raise exception 'INVALID_CATEGORY_PLACEMENT' using errcode='P0001';
  end if;

  delete from public.product_category_placements pcp
   where pcp.store_id=_sid and pcp.product_id=_product_id;

  insert into public.product_category_placements(store_id,product_id,category_id,sort_order)
  select _sid,_product_id,u.category_id,(u.ordinality-1)::integer
    from unnest(_requested) with ordinality as u(category_id,ordinality);

  perform private.log_config_audit(_sid,'catalog.product.category_placements_changed','products',_product_id,array['category_placements']);

  return public.get_catalog_product_category_placements(_sid,_product_id);
end;
$function$;

revoke all on function public.get_catalog_product_category_placements(uuid,uuid) from public, anon;
revoke all on function public.set_catalog_product_category_placements(uuid,uuid,uuid[]) from public, anon;
grant execute on function public.get_catalog_product_category_placements(uuid,uuid) to authenticated, service_role;
grant execute on function public.set_catalog_product_category_placements(uuid,uuid,uuid[]) to authenticated, service_role;

create or replace function public.storefront_catalog(_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
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
        join public.orders o on o.id=oi.order_id and o.store_id=oi.store_id
       where oi.store_id=v_store
         and oi.product_id is not null
         and o.created_at >= now() - interval '30 days'
         and o.status not in ('recusado','cancelado')
         and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
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
          where p.store_id=v_store
            and private.product_runtime_available(v_store,p.id,now())
            and (
              p.category_id=c.id
              or exists(
                select 1 from public.product_category_placements pcp
                 where pcp.store_id=v_store and pcp.product_id=p.id and pcp.category_id=c.id
              )
            )
        )
    ),'[]'::jsonb),
    'products',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'category_id',p.category_id,
        'category_ids',to_jsonb(array[p.category_id] || coalesce((
          select array_agg(pcp.category_id order by pcp.sort_order,pcp.category_id)
            from public.product_category_placements pcp
            join public.categories pc on pc.id=pcp.category_id and pc.store_id=pcp.store_id
           where pcp.store_id=v_store and pcp.product_id=p.id
             and pc.is_active and not pc.is_archived
        ),'{}'::uuid[])),
        'name',p.name,'description',p.description,'image_path',p.image_path,
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
$function$;
