create table if not exists public.store_delivery_pricing_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  mode text not null default 'neighborhood' check (mode in ('neighborhood','fixed','radius')),
  fixed_fee numeric(12,2) not null default 0 check (fixed_fee >= 0),
  fixed_min_order_amount numeric(12,2) check (fixed_min_order_amount is null or fixed_min_order_amount >= 0),
  fixed_eta_minutes integer check (fixed_eta_minutes is null or fixed_eta_minutes between 1 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_delivery_radius_bands (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  max_distance_km numeric(8,2) not null check (max_distance_km > 0 and max_distance_km <= 500),
  delivery_fee numeric(12,2) not null check (delivery_fee >= 0),
  min_order_amount numeric(12,2) check (min_order_amount is null or min_order_amount >= 0),
  eta_minutes integer check (eta_minutes is null or eta_minutes between 1 and 600),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,max_distance_km)
);

create index if not exists idx_store_delivery_radius_bands_lookup on public.store_delivery_radius_bands(store_id,is_active,max_distance_km);

alter table public.store_delivery_pricing_settings enable row level security;
alter table public.store_delivery_radius_bands enable row level security;

insert into public.store_delivery_pricing_settings(store_id)
select s.id from public.stores s
on conflict (store_id) do nothing;

create or replace function private.delivery_distance_km(_lat1 numeric,_lon1 numeric,_lat2 numeric,_lon2 numeric)
returns numeric
language sql immutable
set search_path to 'pg_catalog'
as $function$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians((_lat2-_lat1)::double precision)/2),2) +
    cos(radians(_lat1::double precision))*cos(radians(_lat2::double precision))*
    power(sin(radians((_lon2-_lon1)::double precision)/2),2)
  ))::numeric
$function$;

create or replace function public.get_store_delivery_pricing_config(_store_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to 'public','private','pg_temp'
as $function$
declare _sid uuid:=private.resolve_store(_store_id); _cfg public.store_delivery_pricing_settings; _bands jsonb;
begin
  perform private.require_permission('store.manage_neighborhoods',_sid);
  select * into _cfg from public.store_delivery_pricing_settings where store_id=_sid;
  if not found then
    _cfg.store_id:=_sid;
    _cfg.mode:='neighborhood';
    _cfg.fixed_fee:=0;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'max_distance_km',b.max_distance_km,'delivery_fee',b.delivery_fee,'min_order_amount',b.min_order_amount,'eta_minutes',b.eta_minutes,'is_active',b.is_active,'sort_order',b.sort_order) order by b.max_distance_km),'[]'::jsonb)
  into _bands from public.store_delivery_radius_bands b where b.store_id=_sid;
  return jsonb_build_object('store_id',_sid,'mode',_cfg.mode,'fixed_fee',_cfg.fixed_fee,'fixed_min_order_amount',_cfg.fixed_min_order_amount,'fixed_eta_minutes',_cfg.fixed_eta_minutes,'radius_bands',_bands);
end;$function$;

create or replace function public.update_store_delivery_pricing_config(
  _store_id uuid,_mode text,_fixed_fee numeric default 0,_fixed_min_order_amount numeric default null,_fixed_eta_minutes integer default null
) returns jsonb
language plpgsql security definer
set search_path to 'public','private','pg_temp'
as $function$
declare _sid uuid:=private.resolve_store(_store_id); _m text:=lower(btrim(coalesce(_mode,'')));
begin
  perform private.require_permission('store.manage_neighborhoods',_sid);
  if _m not in ('neighborhood','fixed','radius') then raise exception 'INVALID_DELIVERY_PRICING_MODE' using errcode='P0001'; end if;
  if coalesce(_fixed_fee,0)<0 then raise exception 'INVALID_FEE' using errcode='P0001'; end if;
  if _fixed_min_order_amount is not null and _fixed_min_order_amount<0 then raise exception 'INVALID_MIN_ORDER' using errcode='P0001'; end if;
  if _fixed_eta_minutes is not null and (_fixed_eta_minutes<1 or _fixed_eta_minutes>600) then raise exception 'INVALID_ETA' using errcode='P0001'; end if;
  insert into public.store_delivery_pricing_settings(store_id,mode,fixed_fee,fixed_min_order_amount,fixed_eta_minutes)
  values(_sid,_m,round(coalesce(_fixed_fee,0),2),case when _fixed_min_order_amount is null then null else round(_fixed_min_order_amount,2) end,_fixed_eta_minutes)
  on conflict(store_id) do update set mode=excluded.mode,fixed_fee=excluded.fixed_fee,fixed_min_order_amount=excluded.fixed_min_order_amount,fixed_eta_minutes=excluded.fixed_eta_minutes,updated_at=now();
  perform private.log_config_audit(_sid,'store.delivery_pricing.updated','store_delivery_pricing_settings',_sid,array['mode','fixed_fee','fixed_min_order_amount','fixed_eta_minutes']);
  return public.get_store_delivery_pricing_config(_sid);
end;$function$;

create or replace function public.replace_store_delivery_radius_bands(_store_id uuid,_bands jsonb)
returns jsonb
language plpgsql security definer
set search_path to 'public','private','pg_temp'
as $function$
declare _sid uuid:=private.resolve_store(_store_id); _b jsonb; _distance numeric; _fee numeric; _min numeric; _eta int; _idx int:=0; _last numeric:=0;
begin
  perform private.require_permission('store.manage_neighborhoods',_sid);
  if jsonb_typeof(coalesce(_bands,'[]'::jsonb))<>'array' then raise exception 'INVALID_RADIUS_BANDS' using errcode='P0001'; end if;
  if jsonb_array_length(coalesce(_bands,'[]'::jsonb))>20 then raise exception 'TOO_MANY_RADIUS_BANDS' using errcode='P0001'; end if;
  delete from public.store_delivery_radius_bands where store_id=_sid;
  for _b in select value from jsonb_array_elements(coalesce(_bands,'[]'::jsonb)) loop
    _idx:=_idx+1;
    _distance:=nullif(_b->>'max_distance_km','')::numeric;
    _fee:=nullif(_b->>'delivery_fee','')::numeric;
    _min:=nullif(_b->>'min_order_amount','')::numeric;
    _eta:=nullif(_b->>'eta_minutes','')::int;
    if _distance is null or _distance<=_last or _distance>500 then raise exception 'INVALID_RADIUS_BANDS' using errcode='P0001'; end if;
    if _fee is null or _fee<0 then raise exception 'INVALID_FEE' using errcode='P0001'; end if;
    if _min is not null and _min<0 then raise exception 'INVALID_MIN_ORDER' using errcode='P0001'; end if;
    if _eta is not null and (_eta<1 or _eta>600) then raise exception 'INVALID_ETA' using errcode='P0001'; end if;
    insert into public.store_delivery_radius_bands(store_id,max_distance_km,delivery_fee,min_order_amount,eta_minutes,is_active,sort_order)
    values(_sid,round(_distance,2),round(_fee,2),case when _min is null then null else round(_min,2) end,_eta,coalesce((_b->>'is_active')::boolean,true),_idx);
    _last:=_distance;
  end loop;
  perform private.log_config_audit(_sid,'store.delivery_radius_bands.replaced','store_delivery_radius_bands',null,array['max_distance_km','delivery_fee','min_order_amount','eta_minutes']);
  return public.get_store_delivery_pricing_config(_sid);
end;$function$;

create or replace function public.storefront_delivery_quote(_slug text,_latitude numeric default null,_longitude numeric default null,_neighborhood_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public','private','pg_temp'
as $function$
declare _store public.stores; _cfg public.store_delivery_pricing_settings; _band public.store_delivery_radius_bands; _n public.neighborhoods; _distance numeric;
begin
  select * into _store from public.stores where slug=public.storefront_normalize_slug(_slug) and status='ativa' limit 1;
  if not found or not coalesce(_store.accepts_delivery,false) then return jsonb_build_object('ok',false,'error','delivery_unavailable'); end if;
  select * into _cfg from public.store_delivery_pricing_settings where store_id=_store.id;
  if not found then _cfg.mode:='neighborhood'; end if;
  if coalesce(_cfg.mode,'neighborhood')='fixed' then
    return jsonb_build_object('ok',true,'mode','fixed','deliveryFee',coalesce(_cfg.fixed_fee,0),'minimumOrderAmount',_cfg.fixed_min_order_amount,'estimatedMinutes',coalesce(_cfg.fixed_eta_minutes,40));
  elsif _cfg.mode='radius' then
    if _latitude is null or _longitude is null then return jsonb_build_object('ok',false,'error','location_required','mode','radius'); end if;
    if _store.latitude is null or _store.longitude is null then return jsonb_build_object('ok',false,'error','store_location_required','mode','radius'); end if;
    if _latitude not between -90 and 90 or _longitude not between -180 and 180 then return jsonb_build_object('ok',false,'error','location_invalid','mode','radius'); end if;
    _distance:=private.delivery_distance_km(_store.latitude,_store.longitude,_latitude,_longitude);
    select * into _band from public.store_delivery_radius_bands b where b.store_id=_store.id and b.is_active and b.max_distance_km>=_distance order by b.max_distance_km asc limit 1;
    if not found then return jsonb_build_object('ok',false,'error','outside_delivery_radius','mode','radius','distanceKm',round(_distance,2)); end if;
    return jsonb_build_object('ok',true,'mode','radius','distanceKm',round(_distance,2),'maxDistanceKm',_band.max_distance_km,'deliveryFee',_band.delivery_fee,'minimumOrderAmount',_band.min_order_amount,'estimatedMinutes',coalesce(_band.eta_minutes,40),'bandId',_band.id);
  else
    if _neighborhood_id is null then return jsonb_build_object('ok',false,'error','neighborhood_required','mode','neighborhood'); end if;
    select * into _n from public.neighborhoods where id=_neighborhood_id and store_id=_store.id and is_active and not is_archived;
    if not found then return jsonb_build_object('ok',false,'error','neighborhood_unavailable','mode','neighborhood'); end if;
    return jsonb_build_object('ok',true,'mode','neighborhood','deliveryFee',_n.delivery_fee,'minimumOrderAmount',_n.min_order_amount,'estimatedMinutes',_n.eta_minutes,'neighborhoodId',_n.id,'neighborhoodName',_n.name);
  end if;
end;$function$;

grant execute on function public.get_store_delivery_pricing_config(uuid) to authenticated;
grant execute on function public.update_store_delivery_pricing_config(uuid,text,numeric,numeric,integer) to authenticated;
grant execute on function public.replace_store_delivery_radius_bands(uuid,jsonb) to authenticated;
grant execute on function public.storefront_delivery_quote(text,numeric,numeric,uuid) to anon,authenticated;
