create or replace function public.list_delivery_neighborhood_distance_candidates(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path='public','private','pg_temp'
as $$
declare _sid uuid:=private.resolve_store(_store_id); _lat numeric; _lon numeric; _rows jsonb;
begin
  perform private.require_permission('store.manage_neighborhoods',_sid);
  select latitude,longitude into _lat,_lon from public.stores where id=_sid;
  if _lat is null or _lon is null then
    return jsonb_build_object('storeLocationReady',false,'storeLatitude',_lat,'storeLongitude',_lon,'items','[]'::jsonb);
  end if;
  with observed as (
    select btrim(coalesce(a.neighborhood_name,'')) name, avg(a.latitude)::numeric lat, avg(a.longitude)::numeric lon,
           count(*)::int sample_count, max(a.last_used_at) last_seen
    from public.customer_addresses a
    where a.store_id=_sid and a.latitude is not null and a.longitude is not null and nullif(btrim(coalesce(a.neighborhood_name,'')),'') is not null
    group by public.normalize_label(a.neighborhood_name), btrim(a.neighborhood_name)
  ), ranked as (
    select o.*,
      6371 * 2 * asin(sqrt(power(sin(radians((o.lat-_lat)::double precision)/2),2)+cos(radians(_lat::double precision))*cos(radians(o.lat::double precision))*power(sin(radians((o.lon-_lon)::double precision)/2),2))) as distance_km,
      n.id existing_neighborhood_id,n.delivery_fee existing_fee,n.is_active existing_active
    from observed o
    left join public.neighborhoods n on n.store_id=_sid and not n.is_archived and public.normalize_label(n.name)=public.normalize_label(o.name)
  )
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'latitude',lat,'longitude',lon,'distanceKm',round(distance_km::numeric,2),'sampleCount',sample_count,'lastSeenAt',last_seen,'existingNeighborhoodId',existing_neighborhood_id,'existingFee',existing_fee,'existingActive',existing_active,'source','customer_history') order by distance_km,name),'[]'::jsonb) into _rows from ranked;
  return jsonb_build_object('storeLocationReady',true,'storeLatitude',_lat,'storeLongitude',_lon,'items',_rows);
end $$;

create or replace function public.bulk_upsert_store_neighborhoods(_store_id uuid,_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare _sid uuid:=private.resolve_store(_store_id); _item jsonb; _name text; _fee numeric; _min numeric; _eta int; _nid uuid; _next int; _count int:=0;
begin
  perform private.require_permission('store.manage_neighborhoods',_sid);
  if jsonb_typeof(coalesce(_items,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(_items,'[]'::jsonb))=0 then raise exception 'ITEMS_REQUIRED' using errcode='P0001'; end if;
  if jsonb_array_length(_items)>300 then raise exception 'TOO_MANY_ITEMS' using errcode='P0001'; end if;
  for _item in select value from jsonb_array_elements(_items) t(value) loop
    _name:=btrim(coalesce(_item->>'name','')); _fee:=nullif(_item->>'deliveryFee','')::numeric; _min:=nullif(_item->>'minimumOrderAmount','')::numeric; _eta:=coalesce(nullif(_item->>'estimatedMinutes','')::int,40);
    if length(_name)<2 or length(_name)>80 then raise exception 'INVALID_NAME' using errcode='P0001'; end if;
    if _fee is null or _fee<0 or _fee>100000 then raise exception 'INVALID_FEE' using errcode='P0001'; end if;
    if _min is not null and (_min<0 or _min>100000) then raise exception 'INVALID_MIN_ORDER' using errcode='P0001'; end if;
    if _eta<1 or _eta>600 then raise exception 'INVALID_ETA' using errcode='P0001'; end if;
    select id into _nid from public.neighborhoods where store_id=_sid and not is_archived and public.normalize_label(name)=public.normalize_label(_name) limit 1;
    if _nid is null then
      select coalesce(max(sort_order),0)+1 into _next from public.neighborhoods where store_id=_sid;
      insert into public.neighborhoods(store_id,name,delivery_fee,min_order_amount,eta_minutes,is_active,sort_order)
      values(_sid,_name,round(_fee,2),round(_min,2),_eta,true,_next) returning id into _nid;
    else
      update public.neighborhoods set delivery_fee=round(_fee,2),min_order_amount=round(_min,2),eta_minutes=_eta,is_active=true,updated_at=now() where id=_nid and store_id=_sid;
    end if;
    _count:=_count+1;
  end loop;
  perform private.log_config_audit(_sid,'store.neighborhood.bulk_upserted','neighborhoods',null,array['delivery_fee','min_order_amount','eta_minutes']);
  return jsonb_build_object('ok',true,'saved',_count,'configuration',public.get_my_store_configuration(_sid));
end $$;

create or replace function public.list_platform_stores(_search text default null,_status text default null,_limit integer default 50,_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path='public','private','pg_temp'
as $$
declare result jsonb; lim integer:=least(greatest(coalesce(_limit,50),1),200); off integer:=greatest(coalesce(_offset,0),0);
begin
 if not private.has_permission('platform.stores.view'::public.app_permission,null) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 with filtered as (
  select s.* from public.stores s where (nullif(btrim(coalesce(_search,'')),'') is null or s.name ilike '%'||btrim(_search)||'%' or s.slug ilike '%'||btrim(_search)||'%') and (nullif(btrim(coalesce(_status,'')),'') is null or s.status::text=_status)
 ), paged as (
  select f.id,f.name,f.slug,f.status::text status,f.created_at,f.city,f.state,
    (select count(*) from public.orders o where o.store_id=f.id) total_orders,
    p.code plan_code,p.name plan_name,ss.status subscription_status,ss.billing_interval,ss.billing_provider,ss.provider_status,ss.current_period_end,ss.complimentary_until,
    pp.amount_cents,pp.currency,
    case when ss.billing_provider='stripe' and lower(coalesce(ss.provider_status,'')) in ('active','trialing') then true else false end stripe_recurring_confirmed
  from filtered f
  left join public.store_subscriptions ss on ss.store_id=f.id
  left join public.plans p on p.id=ss.plan_id
  left join public.plan_prices pp on pp.plan_id=p.id and pp.billing_interval=ss.billing_interval and pp.is_active
  order by f.created_at desc,f.id limit lim offset off
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb),'total',(select count(*) from filtered)) into result;
 return result;
end $$;
