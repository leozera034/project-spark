begin;

-- P1: Product availability configured by the merchant must be authoritative.
-- Enforce schedule, sold-out/stock state, available variants and per-product
-- max quantity on the server, not only in the storefront UI.

create or replace function private.product_runtime_available(
  _store_id uuid,
  _product_id uuid,
  _at timestamptz default now()
) returns boolean
language plpgsql
stable
set search_path to 'public','private','pg_temp'
as $$
declare
  _p public.products;
  _timezone text;
  _local timestamp;
  _dow integer;
  _prev_dow integer;
  _time time;
  _current_day_allowed boolean;
  _previous_day_allowed boolean;
begin
  select p.* into _p
    from public.products p
   where p.id=_product_id and p.store_id=_store_id
   limit 1;

  if not found or _p.is_archived or not _p.is_available or _p.is_sold_out then
    return false;
  end if;

  select coalesce(nullif(btrim(s.timezone),''),'America/Sao_Paulo')
    into _timezone
    from public.stores s
   where s.id=_store_id;
  _timezone:=coalesce(_timezone,'America/Sao_Paulo');

  if _p.stock_quantity is not null and _p.stock_quantity <= 0 then
    return false;
  end if;

  if _p.has_variants and not exists (
    select 1 from public.product_variants v
     where v.store_id=_store_id and v.product_id=_product_id
       and v.is_available and not v.is_archived
  ) then
    return false;
  end if;

  _local:=_at at time zone _timezone;
  _dow:=extract(dow from _local)::integer;
  _prev_dow:=case when _dow=0 then 6 else _dow-1 end;
  _time:=_local::time;
  _current_day_allowed:=_p.available_weekdays is null or _dow=any(_p.available_weekdays);
  _previous_day_allowed:=_p.available_weekdays is null or _prev_dow=any(_p.available_weekdays);

  if _p.available_from is null and _p.available_to is null then
    return _current_day_allowed;
  end if;

  if _p.available_from is not null and _p.available_to is not null then
    if _p.available_to > _p.available_from then
      return _current_day_allowed and _time >= _p.available_from and _time < _p.available_to;
    end if;
    return (_current_day_allowed and _time >= _p.available_from)
        or (_previous_day_allowed and _time < _p.available_to);
  end if;

  if _p.available_from is not null then
    return _current_day_allowed and _time >= _p.available_from;
  end if;

  return _current_day_allowed and _time < _p.available_to;
end;
$$;

revoke all on function private.product_runtime_available(uuid,uuid,timestamptz) from public,anon,authenticated;

create or replace function private.reserve_product_inventory_from_order_item()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _max_quantity integer;
  _order_quantity numeric;
begin
  if new.product_id is null then return new; end if;

  if not private.product_runtime_available(new.store_id,new.product_id,now()) then
    raise exception 'PRODUCT_RUNTIME_UNAVAILABLE' using errcode='P0001';
  end if;

  select p.max_quantity into _max_quantity
    from public.products p
   where p.id=new.product_id and p.store_id=new.store_id and not p.is_archived;

  if _max_quantity is not null then
    select coalesce(sum(i.quantity),0)
      into _order_quantity
      from public.order_items i
     where i.store_id=new.store_id
       and i.order_id=new.order_id
       and i.product_id=new.product_id;

    if _order_quantity > _max_quantity then
      raise exception 'PRODUCT_MAX_QUANTITY_EXCEEDED' using errcode='P0001';
    end if;
  end if;

  perform private.reserve_product_inventory(new.store_id,new.order_id,new.id,new.product_id,new.quantity,'product');
  return new;
end;
$$;

create or replace function public.storefront_catalog(_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_slug text:=public.storefront_normalize_slug(_slug);
  v_store uuid;
begin
  if v_slug is null then return null; end if;
  select st.id into v_store from public.stores st where st.slug=v_slug and st.status='ativa' limit 1;
  if v_store is null then return null; end if;

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
        'is_sold_out',p.is_sold_out,'is_featured',p.is_featured,'minimum_quantity',p.minimum_quantity,'quantity_step',p.quantity_step,
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

create or replace function public.storefront_product(_slug text,_product_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_slug text:=public.storefront_normalize_slug(_slug);
  v_store uuid;
  p public.products;
begin
  if v_slug is null or _product_id is null then return null; end if;
  select st.id into v_store from public.stores st where st.slug=v_slug and st.status='ativa' limit 1;
  if v_store is null then return null; end if;
  if not private.product_runtime_available(v_store,_product_id,now()) then return null; end if;

  select * into p from public.products pr where pr.id=_product_id and pr.store_id=v_store limit 1;
  if not found then return null; end if;

  return jsonb_build_object(
    'product',jsonb_build_object(
      'id',p.id,'category_id',p.category_id,'name',p.name,'description',p.description,'image_path',p.image_path,'base_price',p.base_price,
      'sale_mode',p.sale_mode,'measurement_unit',p.measurement_unit,'pricing_unit',p.pricing_unit,'unit_label',p.unit_label,
      'has_variants',p.has_variants,'product_type',p.product_type,'capabilities',p.capabilities,'engine_version',p.engine_version,
      'pricing_rules',p.pricing_rules,'is_sold_out',p.is_sold_out,'stock_quantity',p.stock_quantity,'minimum_quantity',p.minimum_quantity,
      'quantity_step',p.quantity_step,'max_quantity',p.max_quantity,'allows_notes',p.allows_notes
    ),
    'variants',coalesce((
      select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'price',v.price,'is_default',v.is_default,'package_quantity',v.package_quantity,'package_unit',v.package_unit,'max_flavors',v.max_flavors,'flavor_parts',v.flavor_parts) order by v.sort_order,v.name)
      from public.product_variants v
      where v.product_id=p.id and v.store_id=v_store and v.is_available and not v.is_archived
    ),'[]'::jsonb),
    'option_groups',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',g.id,'link_id',pog.id,'name',g.name,'description',g.description,'role',g.role,'selection_type',g.selection_type,
        'is_required',coalesce(pog.is_required,g.is_required),'min_selections',coalesce(pog.min_selections,g.min_selections),
        'max_selections',coalesce(pog.max_selections,g.max_selections),'included_selections',g.included_selections,'allow_quantity',g.allow_quantity,
        'pricing_strategy',g.pricing_strategy,'price_effect',g.price_effect,'portion_count',g.portion_count,'sort_order',pog.sort_order,
        'items',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',i.id,'name',i.name,'description',i.description,
            'additional_price',case when exists(select 1 from public.product_variant_option_item_prices vp where vp.store_id=v_store and vp.product_id=p.id and vp.option_item_id=i.id) then 0 else i.additional_price end,
            'has_variant_price',exists(select 1 from public.product_variant_option_item_prices vp where vp.store_id=v_store and vp.product_id=p.id and vp.option_item_id=i.id),
            'max_quantity',greatest(i.max_quantity,20),'linked_product_id',i.linked_product_id,'linked_variant_id',i.linked_variant_id
          ) order by i.sort_order,i.name)
          from public.option_items i
          where i.option_group_id=g.id and i.store_id=v_store and i.is_available and not i.is_archived
        ),'[]'::jsonb)
      ) order by pog.sort_order,g.name)
      from public.product_option_groups pog
      join public.option_groups g on g.id=pog.option_group_id and g.store_id=v_store
      where pog.product_id=p.id and pog.store_id=v_store and pog.is_active and not pog.is_archived and g.is_active and not g.is_archived
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.storefront_price(
  _slug text,
  _product_id uuid,
  _variant_id uuid default null::uuid,
  _quantity numeric default 1,
  _selections jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_slug text:=public.storefront_normalize_slug(_slug);
  v_store uuid;
  v_count int;
  v_grouped jsonb;
  v_max_quantity integer;
begin
  if v_slug is null or _product_id is null then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
  if jsonb_typeof(coalesce(_selections,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(_selections,'[]'::jsonb))>60 then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
  if _quantity is null or _quantity<=0 or _quantity>1000 then return jsonb_build_object('ok',false,'error','invalid_request'); end if;

  select st.id into v_store from public.stores st where st.slug=v_slug and st.status='ativa' limit 1;
  if v_store is null then return jsonb_build_object('ok',false,'error','store_not_found'); end if;
  if not private.product_runtime_available(v_store,_product_id,now()) then return jsonb_build_object('ok',false,'error','product_unavailable'); end if;

  select p.max_quantity into v_max_quantity from public.products p where p.id=_product_id and p.store_id=v_store;
  if v_max_quantity is not null and _quantity>v_max_quantity then return jsonb_build_object('ok',false,'error','quantity_limit'); end if;

  if _variant_id is not null and not exists (
    select 1 from public.product_variants v
    where v.id=_variant_id and v.product_id=_product_id and v.store_id=v_store and v.is_available and not v.is_archived
  ) then return jsonb_build_object('ok',false,'error','variant_not_found'); end if;

  select count(*) into v_count
  from jsonb_array_elements(coalesce(_selections,'[]'::jsonb)) as sel
  where not exists (
    select 1 from public.option_items i
    join public.product_option_groups pog on pog.option_group_id=i.option_group_id and pog.product_id=_product_id and pog.store_id=v_store and pog.is_active and not pog.is_archived
    where i.id=nullif(sel->>'option_item_id','')::uuid and i.store_id=v_store and i.is_available and not i.is_archived
  );
  if v_count>0 then return jsonb_build_object('ok',false,'error','invalid_selection'); end if;

  select coalesce(jsonb_agg(g),'[]'::jsonb) into v_grouped
  from (
    select jsonb_build_object('group_id',sel->>'option_group_id','items',jsonb_agg(jsonb_build_object('item_id',sel->>'option_item_id','quantity',coalesce(nullif(sel->>'quantity','')::numeric,1)))) as g
    from jsonb_array_elements(coalesce(_selections,'[]'::jsonb)) as sel
    where sel->>'option_group_id' is not null
    group by sel->>'option_group_id'
  ) s;

  return jsonb_build_object('ok',true,'result',private.calculate_configured_product_price(v_store,_product_id,_variant_id,_quantity,v_grouped));
exception when others then
  return jsonb_build_object('ok',false,'error','calculation_failed');
end;
$$;

create or replace function public.storefront_submit_order(_slug text,_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_result jsonb;
  v_detail text;
  v_store_id uuid;
  v_access jsonb;
  v_order_id uuid;
  v_address_id uuid;
  v_lat numeric;
  v_lon numeric;
  v_accuracy numeric;
  v_has_coords boolean:=false;
  v_address public.customer_addresses%rowtype;
begin
  select st.id into v_store_id from public.stores st where st.slug=public.storefront_normalize_slug(_slug) and st.status='ativa' limit 1;
  if v_store_id is null then return jsonb_build_object('ok',false,'error','store_unavailable'); end if;
  perform public.reconcile_store_billing(v_store_id);
  v_access:=public.get_store_billing_access(v_store_id);
  if not coalesce((v_access->>'can_accept_new_orders')::boolean,false) then
    return jsonb_build_object('ok',false,'error','store_temporarily_unavailable','reason','billing_restricted','billing_stage',v_access->>'stage');
  end if;

  begin
    v_result:=private.storefront_submit_order(_slug,_payload);
    if not coalesce((v_result->>'ok')::boolean,false) then
      raise exception using errcode='P0001',message='SHARK_CHECKOUT_ROLLBACK',detail=v_result::text;
    end if;

    if lower(coalesce(_payload#>>'{fulfillment,type}',''))='entrega' then
      v_order_id:=nullif(v_result#>>'{order,id}','')::uuid;
      select o.address_id into v_address_id from public.orders o where o.id=v_order_id and o.store_id=v_store_id;
      if v_address_id is not null then
        if jsonb_typeof(_payload#>'{address,latitude}')='number' and jsonb_typeof(_payload#>'{address,longitude}')='number' then
          v_lat:=(_payload#>>'{address,latitude}')::numeric;
          v_lon:=(_payload#>>'{address,longitude}')::numeric;
          v_has_coords:=v_lat between -90 and 90 and v_lon between -180 and 180;
        end if;
        if jsonb_typeof(_payload#>'{address,accuracyMeters}')='number' then
          v_accuracy:=(_payload#>>'{address,accuracyMeters}')::numeric;
          if v_accuracy<0 or v_accuracy>10000 then v_accuracy:=null; end if;
        end if;

        if v_has_coords then
          update public.customer_addresses a
             set latitude=v_lat,longitude=v_lon,location_source='browser_checkout',location_accuracy_meters=v_accuracy,location_verified_at=now(),
                 geocoding_status='manual',geocoding_provider=null,geocoding_precision='device',geocoded_at=null,google_place_id=null,updated_at=now()
           where a.id=v_address_id and a.store_id=v_store_id
             and (a.latitude is null or a.longitude is null or a.location_source in ('none','browser_checkout','legacy'));
        else
          perform private.queue_customer_address_geocode(v_address_id);
        end if;

        select * into v_address from public.customer_addresses a where a.id=v_address_id and a.store_id=v_store_id;
        if found and v_address.latitude is not null and v_address.longitude is not null then
          update public.orders o
             set address_snapshot=coalesce(o.address_snapshot,'{}'::jsonb)||jsonb_build_object(
               'latitude',v_address.latitude,'longitude',v_address.longitude,'locationSource',v_address.location_source,
               'locationAccuracyMeters',v_address.location_accuracy_meters,'googlePlaceId',v_address.google_place_id
             ),updated_at=now()
           where o.id=v_order_id and o.store_id=v_store_id;
        end if;
      end if;
    end if;
    return v_result;
  exception
    when sqlstate 'P0001' then
      if sqlerrm='SHARK_CHECKOUT_ROLLBACK' then
        get stacked diagnostics v_detail=PG_EXCEPTION_DETAIL;
        return v_detail::jsonb;
      end if;
      if sqlerrm in ('PRODUCT_STOCK_INSUFFICIENT','OPTION_STOCK_INSUFFICIENT') then
        return jsonb_build_object('ok',false,'error','line_unavailable','reason','out_of_stock');
      end if;
      if sqlerrm='PRODUCT_RUNTIME_UNAVAILABLE' then
        return jsonb_build_object('ok',false,'error','line_unavailable','reason','unavailable_now');
      end if;
      if sqlerrm='PRODUCT_MAX_QUANTITY_EXCEEDED' then
        return jsonb_build_object('ok',false,'error','line_unavailable','reason','quantity_limit');
      end if;
      raise;
  end;
end;
$$;

commit;
