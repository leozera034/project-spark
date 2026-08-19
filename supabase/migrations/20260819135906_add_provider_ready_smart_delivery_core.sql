alter table public.stores
  add column if not exists location_source text not null default 'unverified',
  add column if not exists location_verified_at timestamptz,
  add column if not exists location_accuracy_meters numeric;

alter table public.stores
  drop constraint if exists stores_location_source_check;
alter table public.stores
  add constraint stores_location_source_check
  check (location_source in ('unverified','manual_browser','manual_admin','google_geocoding'));

alter table public.stores
  drop constraint if exists stores_location_accuracy_check;
alter table public.stores
  add constraint stores_location_accuracy_check
  check (location_accuracy_meters is null or location_accuracy_meters >= 0);

alter table public.customer_addresses
  add column if not exists geocoding_status text not null default 'unverified',
  add column if not exists geocoding_provider text,
  add column if not exists geocoding_precision text,
  add column if not exists geocoded_at timestamptz;

alter table public.customer_addresses
  drop constraint if exists customer_addresses_geocoding_status_check;
alter table public.customer_addresses
  add constraint customer_addresses_geocoding_status_check
  check (geocoding_status in ('unverified','manual','provider_verified','failed'));

alter table public.deliveries
  add column if not exists route_distance_meters integer,
  add column if not exists route_duration_seconds integer,
  add column if not exists route_provider text,
  add column if not exists route_mode text,
  add column if not exists route_estimated_at timestamptz,
  add column if not exists route_is_approximate boolean not null default true,
  add column if not exists route_metadata jsonb not null default '{}'::jsonb;

alter table public.deliveries
  drop constraint if exists deliveries_route_distance_check;
alter table public.deliveries
  add constraint deliveries_route_distance_check
  check (route_distance_meters is null or route_distance_meters >= 0);

alter table public.deliveries
  drop constraint if exists deliveries_route_duration_check;
alter table public.deliveries
  add constraint deliveries_route_duration_check
  check (route_duration_seconds is null or route_duration_seconds >= 0);

alter table public.deliveries
  drop constraint if exists deliveries_route_mode_check;
alter table public.deliveries
  add constraint deliveries_route_mode_check
  check (route_mode is null or route_mode in ('drive','two_wheeler','bicycle','walk'));

alter table public.deliveries
  drop constraint if exists deliveries_route_metadata_object_check;
alter table public.deliveries
  add constraint deliveries_route_metadata_object_check
  check (jsonb_typeof(route_metadata) = 'object');

create index if not exists deliveries_route_pending_idx
  on public.deliveries(store_id, status, route_estimated_at)
  where status not in ('concluida','cancelada');

create table if not exists private.maps_provider_runtime_readiness (
  provider text not null,
  environment text not null default 'production',
  api_key_configured boolean not null default false,
  billing_confirmed boolean not null default false,
  routes_api_enabled boolean not null default false,
  geocoding_api_enabled boolean not null default false,
  kill_switch_enabled boolean not null default true,
  last_health_at timestamptz,
  last_error_code text,
  last_error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, environment),
  constraint maps_provider_runtime_provider_check check (provider ~ '^[a-z0-9_]+$'),
  constraint maps_provider_runtime_environment_check check (environment in ('production','test','disabled'))
);

alter table private.maps_provider_runtime_readiness enable row level security;
alter table private.maps_provider_runtime_readiness force row level security;
revoke all on private.maps_provider_runtime_readiness from public, anon, authenticated;
grant select, insert, update, delete on private.maps_provider_runtime_readiness to service_role;

create table if not exists private.route_estimate_cache (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null,
  cache_key text not null,
  travel_mode text not null,
  origin_latitude numeric not null,
  origin_longitude numeric not null,
  destination_latitude numeric not null,
  destination_longitude numeric not null,
  distance_meters integer not null,
  duration_seconds integer not null,
  traffic_duration_seconds integer,
  is_traffic_aware boolean not null default false,
  provider_cost_micros bigint not null default 0,
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_estimate_cache_provider_check check (provider ~ '^[a-z0-9_]+$'),
  constraint route_estimate_cache_mode_check check (travel_mode in ('drive','two_wheeler','bicycle','walk')),
  constraint route_estimate_cache_distance_check check (distance_meters >= 0),
  constraint route_estimate_cache_duration_check check (duration_seconds >= 0 and (traffic_duration_seconds is null or traffic_duration_seconds >= 0)),
  constraint route_estimate_cache_cost_check check (provider_cost_micros >= 0),
  constraint route_estimate_cache_key_check check (char_length(cache_key) between 16 and 160),
  constraint route_estimate_cache_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists route_estimate_cache_store_provider_key_uidx
  on private.route_estimate_cache(store_id, provider, cache_key);
create index if not exists route_estimate_cache_expiry_idx
  on private.route_estimate_cache(expires_at);

alter table private.route_estimate_cache enable row level security;
alter table private.route_estimate_cache force row level security;
revoke all on private.route_estimate_cache from public, anon, authenticated;
grant select, insert, update, delete on private.route_estimate_cache to service_role;

create or replace function private.haversine_distance_meters(
  _origin_latitude numeric,
  _origin_longitude numeric,
  _destination_latitude numeric,
  _destination_longitude numeric
)
returns integer
language plpgsql
immutable
security definer
set search_path = pg_catalog
as $$
declare
  v_lat1 double precision := radians(_origin_latitude::double precision);
  v_lat2 double precision := radians(_destination_latitude::double precision);
  v_dlat double precision := radians((_destination_latitude - _origin_latitude)::double precision);
  v_dlon double precision := radians((_destination_longitude - _origin_longitude)::double precision);
  v_a double precision;
  v_c double precision;
begin
  if _origin_latitude not between -90 and 90
     or _destination_latitude not between -90 and 90
     or _origin_longitude not between -180 and 180
     or _destination_longitude not between -180 and 180 then
    raise exception 'INVALID_COORDINATES' using errcode='22023';
  end if;

  v_a := power(sin(v_dlat / 2), 2)
      + cos(v_lat1) * cos(v_lat2) * power(sin(v_dlon / 2), 2);
  v_c := 2 * atan2(sqrt(v_a), sqrt(greatest(0, 1 - v_a)));
  return round(6371008.8 * v_c)::integer;
end;
$$;

create or replace function private.local_route_estimate(
  _origin_latitude numeric,
  _origin_longitude numeric,
  _destination_latitude numeric,
  _destination_longitude numeric,
  _travel_mode text default 'two_wheeler'
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = pg_catalog, private
as $$
declare
  v_mode text := lower(btrim(coalesce(_travel_mode,'two_wheeler')));
  v_straight integer;
  v_factor numeric;
  v_speed_kmh numeric;
  v_distance integer;
  v_duration integer;
begin
  if v_mode not in ('drive','two_wheeler','bicycle','walk') then
    raise exception 'INVALID_TRAVEL_MODE' using errcode='22023';
  end if;

  v_straight := private.haversine_distance_meters(
    _origin_latitude,_origin_longitude,_destination_latitude,_destination_longitude
  );

  v_factor := case v_mode
    when 'walk' then 1.15
    when 'bicycle' then 1.20
    else 1.25
  end;
  v_speed_kmh := case v_mode
    when 'walk' then 4.5
    when 'bicycle' then 15
    when 'drive' then 28
    else 30
  end;

  v_distance := ceil(v_straight * v_factor)::integer;
  v_duration := case
    when v_distance = 0 then 0
    else ceil(v_distance / ((v_speed_kmh * 1000) / 3600))::integer
  end;

  return jsonb_build_object(
    'source','local_approximation',
    'provider','local_haversine',
    'travel_mode',v_mode,
    'straight_line_meters',v_straight,
    'distance_meters',v_distance,
    'duration_seconds',v_duration,
    'is_approximate',true
  );
end;
$$;

create or replace function private.is_maps_provider_ready(
  _provider text default 'google_maps',
  _environment text default 'production'
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce((
    select r.api_key_configured
       and r.billing_confirmed
       and r.routes_api_enabled
       and not r.kill_switch_enabled
    from private.maps_provider_runtime_readiness r
    where r.provider = lower(btrim(_provider))
      and r.environment = lower(btrim(_environment))
  ), false);
$$;

create or replace function private.record_maps_provider_runtime_health(
  _provider text,
  _environment text,
  _api_key_configured boolean,
  _billing_confirmed boolean,
  _routes_api_enabled boolean,
  _geocoding_api_enabled boolean,
  _kill_switch_enabled boolean,
  _error_code text default null,
  _error_detail text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_provider text := lower(btrim(_provider));
  v_environment text := lower(btrim(_environment));
  v_row private.maps_provider_runtime_readiness%rowtype;
begin
  if v_provider !~ '^[a-z0-9_]+$' then
    raise exception 'INVALID_PROVIDER' using errcode='22023';
  end if;
  if v_environment not in ('production','test','disabled') then
    raise exception 'INVALID_ENVIRONMENT' using errcode='22023';
  end if;

  insert into private.maps_provider_runtime_readiness(
    provider,environment,api_key_configured,billing_confirmed,routes_api_enabled,
    geocoding_api_enabled,kill_switch_enabled,last_health_at,last_error_code,last_error_detail,updated_at
  ) values (
    v_provider,v_environment,coalesce(_api_key_configured,false),coalesce(_billing_confirmed,false),
    coalesce(_routes_api_enabled,false),coalesce(_geocoding_api_enabled,false),
    coalesce(_kill_switch_enabled,true),now(),left(nullif(btrim(_error_code),''),120),
    left(nullif(btrim(_error_detail),''),500),now()
  )
  on conflict (provider,environment) do update
  set api_key_configured=excluded.api_key_configured,
      billing_confirmed=excluded.billing_confirmed,
      routes_api_enabled=excluded.routes_api_enabled,
      geocoding_api_enabled=excluded.geocoding_api_enabled,
      kill_switch_enabled=excluded.kill_switch_enabled,
      last_health_at=now(),
      last_error_code=excluded.last_error_code,
      last_error_detail=excluded.last_error_detail,
      updated_at=now()
  returning * into v_row;

  return jsonb_build_object(
    'provider',v_row.provider,
    'environment',v_row.environment,
    'api_key_configured',v_row.api_key_configured,
    'billing_confirmed',v_row.billing_confirmed,
    'routes_api_enabled',v_row.routes_api_enabled,
    'geocoding_api_enabled',v_row.geocoding_api_enabled,
    'kill_switch_enabled',v_row.kill_switch_enabled,
    'last_health_at',v_row.last_health_at,
    'last_error_code',v_row.last_error_code,
    'ready_for_routes',v_row.api_key_configured and v_row.billing_confirmed and v_row.routes_api_enabled and not v_row.kill_switch_enabled
  );
end;
$$;

create or replace function private.get_cached_route_estimate(
  _store_id uuid,
  _provider text,
  _cache_key text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select jsonb_build_object(
    'id',c.id,
    'provider',c.provider,
    'travel_mode',c.travel_mode,
    'distance_meters',c.distance_meters,
    'duration_seconds',c.duration_seconds,
    'traffic_duration_seconds',c.traffic_duration_seconds,
    'is_traffic_aware',c.is_traffic_aware,
    'expires_at',c.expires_at,
    'metadata',c.metadata
  )
  from private.route_estimate_cache c
  where c.store_id=_store_id
    and c.provider=lower(btrim(_provider))
    and c.cache_key=btrim(_cache_key)
    and c.expires_at>now()
  limit 1;
$$;

create or replace function private.upsert_route_estimate_cache(
  _store_id uuid,
  _provider text,
  _cache_key text,
  _travel_mode text,
  _origin_latitude numeric,
  _origin_longitude numeric,
  _destination_latitude numeric,
  _destination_longitude numeric,
  _distance_meters integer,
  _duration_seconds integer,
  _traffic_duration_seconds integer default null,
  _is_traffic_aware boolean default false,
  _provider_cost_micros bigint default 0,
  _ttl_seconds integer default 900,
  _metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_provider text := lower(btrim(_provider));
  v_mode text := lower(btrim(_travel_mode));
  v_key text := btrim(_cache_key);
  v_row private.route_estimate_cache%rowtype;
begin
  if not exists(select 1 from public.stores s where s.id=_store_id) then
    raise exception 'STORE_NOT_FOUND' using errcode='22023';
  end if;
  if v_provider !~ '^[a-z0-9_]+$' then raise exception 'INVALID_PROVIDER' using errcode='22023'; end if;
  if v_mode not in ('drive','two_wheeler','bicycle','walk') then raise exception 'INVALID_TRAVEL_MODE' using errcode='22023'; end if;
  if char_length(v_key) not between 16 and 160 then raise exception 'INVALID_CACHE_KEY' using errcode='22023'; end if;
  if _distance_meters<0 or _duration_seconds<0 or coalesce(_traffic_duration_seconds,0)<0 then raise exception 'INVALID_ROUTE_METRICS' using errcode='22023'; end if;
  if _ttl_seconds not between 60 and 86400 then raise exception 'INVALID_TTL' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(_metadata,'{}'::jsonb))<>'object' then raise exception 'INVALID_METADATA' using errcode='22023'; end if;

  perform private.haversine_distance_meters(_origin_latitude,_origin_longitude,_destination_latitude,_destination_longitude);

  insert into private.route_estimate_cache(
    store_id,provider,cache_key,travel_mode,origin_latitude,origin_longitude,
    destination_latitude,destination_longitude,distance_meters,duration_seconds,
    traffic_duration_seconds,is_traffic_aware,provider_cost_micros,expires_at,metadata
  ) values (
    _store_id,v_provider,v_key,v_mode,_origin_latitude,_origin_longitude,
    _destination_latitude,_destination_longitude,_distance_meters,_duration_seconds,
    _traffic_duration_seconds,coalesce(_is_traffic_aware,false),greatest(coalesce(_provider_cost_micros,0),0),
    now()+make_interval(secs=>_ttl_seconds),coalesce(_metadata,'{}'::jsonb)
  )
  on conflict (store_id,provider,cache_key) do update
  set travel_mode=excluded.travel_mode,
      origin_latitude=excluded.origin_latitude,
      origin_longitude=excluded.origin_longitude,
      destination_latitude=excluded.destination_latitude,
      destination_longitude=excluded.destination_longitude,
      distance_meters=excluded.distance_meters,
      duration_seconds=excluded.duration_seconds,
      traffic_duration_seconds=excluded.traffic_duration_seconds,
      is_traffic_aware=excluded.is_traffic_aware,
      provider_cost_micros=excluded.provider_cost_micros,
      expires_at=excluded.expires_at,
      metadata=excluded.metadata,
      updated_at=now()
  returning * into v_row;

  return jsonb_build_object(
    'id',v_row.id,'provider',v_row.provider,'travel_mode',v_row.travel_mode,
    'distance_meters',v_row.distance_meters,'duration_seconds',v_row.duration_seconds,
    'traffic_duration_seconds',v_row.traffic_duration_seconds,'expires_at',v_row.expires_at
  );
end;
$$;

create or replace function private.prune_route_estimate_cache()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare v_count integer;
begin
  delete from private.route_estimate_cache where expires_at < now() - interval '1 day';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.refresh_delivery_local_route(_delivery_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_store public.stores%rowtype;
  v_address public.customer_addresses%rowtype;
  v_order public.orders%rowtype;
  v_estimate jsonb;
  v_mode text := 'two_wheeler';
begin
  select * into v_delivery from public.deliveries where id=_delivery_id for update;
  if not found then return jsonb_build_object('updated',false,'reason','delivery_not_found'); end if;

  select * into v_order from public.orders where id=v_delivery.order_id and store_id=v_delivery.store_id;
  if not found or v_order.fulfillment::text<>'entrega' or v_order.address_id is null then
    return jsonb_build_object('updated',false,'reason','no_delivery_address');
  end if;

  select * into v_store from public.stores where id=v_delivery.store_id;
  select * into v_address from public.customer_addresses where id=v_order.address_id and store_id=v_delivery.store_id;

  if v_store.latitude is null or v_store.longitude is null or v_address.latitude is null or v_address.longitude is null then
    return jsonb_build_object('updated',false,'reason','coordinates_missing');
  end if;

  if v_delivery.courier_id is not null and exists(
    select 1 from public.couriers c where c.id=v_delivery.courier_id and c.store_id=v_delivery.store_id and lower(coalesce(c.vehicle,'')) like '%car%'
  ) then
    v_mode := 'drive';
  end if;

  v_estimate := private.local_route_estimate(v_store.latitude,v_store.longitude,v_address.latitude,v_address.longitude,v_mode);

  update public.deliveries
  set route_distance_meters=(v_estimate->>'distance_meters')::integer,
      route_duration_seconds=(v_estimate->>'duration_seconds')::integer,
      route_provider='local_haversine',
      route_mode=v_mode,
      route_estimated_at=now(),
      route_is_approximate=true,
      route_metadata=jsonb_build_object('straight_line_meters',(v_estimate->>'straight_line_meters')::integer,'source','local_approximation'),
      updated_at=now()
  where id=_delivery_id
    and (route_provider is null or route_provider='local_haversine');

  return jsonb_build_object('updated',true,'estimate',v_estimate);
end;
$$;

create or replace function private.delivery_local_route_insert_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  begin
    perform private.refresh_delivery_local_route(new.id);
  exception when others then
    begin
      insert into private.automation_event_failures(store_id,event_code,source_table,source_id,error_code,error_message,payload)
      values(new.store_id,'delivery.local_route.refresh','deliveries',new.id,sqlstate,left(sqlerrm,500),jsonb_build_object('order_id',new.order_id));
    exception when others then null;
    end;
  end;
  return new;
end;
$$;

drop trigger if exists trg_delivery_local_route_insert on public.deliveries;
create trigger trg_delivery_local_route_insert
after insert on public.deliveries
for each row execute function private.delivery_local_route_insert_trigger();

create or replace function private.customer_address_route_refresh_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_delivery_id uuid;
begin
  if old.latitude is not distinct from new.latitude and old.longitude is not distinct from new.longitude then return new; end if;
  for v_delivery_id in
    select d.id
    from public.deliveries d
    join public.orders o on o.id=d.order_id and o.store_id=d.store_id
    where o.address_id=new.id
      and d.store_id=new.store_id
      and d.status not in ('concluida','cancelada')
      and (d.route_provider is null or d.route_provider='local_haversine')
  loop
    perform private.refresh_delivery_local_route(v_delivery_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_customer_address_route_refresh on public.customer_addresses;
create trigger trg_customer_address_route_refresh
after update of latitude,longitude on public.customer_addresses
for each row execute function private.customer_address_route_refresh_trigger();

create or replace function public.update_store_location_coordinates(
  _store_id uuid,
  _latitude numeric,
  _longitude numeric,
  _source text default 'manual_browser',
  _accuracy_meters numeric default null,
  _expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_sid uuid := private.resolve_store(_store_id);
  v_cur public.stores%rowtype;
  v_source text := lower(btrim(coalesce(_source,'manual_browser')));
  v_delivery_id uuid;
begin
  perform private.require_permission('store.update_profile',v_sid);
  if _latitude not between -90 and 90 or _longitude not between -180 and 180 then
    raise exception 'INVALID_COORDINATES' using errcode='22023';
  end if;
  if v_source not in ('manual_browser','manual_admin','google_geocoding') then
    raise exception 'INVALID_LOCATION_SOURCE' using errcode='22023';
  end if;
  if _accuracy_meters is not null and _accuracy_meters<0 then
    raise exception 'INVALID_LOCATION_ACCURACY' using errcode='22023';
  end if;

  select * into v_cur from public.stores where id=v_sid for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  perform private.assert_version(_expected_updated_at,v_cur.updated_at);

  update public.stores
  set latitude=_latitude,
      longitude=_longitude,
      location_source=v_source,
      location_accuracy_meters=_accuracy_meters,
      location_verified_at=now(),
      updated_at=now()
  where id=v_sid;

  perform private.log_config_audit(v_sid,'store.location.updated','stores',v_sid,array['latitude','longitude','location_source','location_accuracy_meters','location_verified_at']);

  for v_delivery_id in
    select d.id from public.deliveries d
    where d.store_id=v_sid and d.status not in ('concluida','cancelada') and (d.route_provider is null or d.route_provider='local_haversine')
  loop
    perform private.refresh_delivery_local_route(v_delivery_id);
  end loop;

  return public.get_my_store_configuration(v_sid);
end;
$$;

create or replace function public.preview_store_delivery_estimate(
  _store_id uuid,
  _destination_latitude numeric,
  _destination_longitude numeric,
  _travel_mode text default 'two_wheeler'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sid uuid := private.resolve_store(_store_id);
  v_store public.stores%rowtype;
  v_estimate jsonb;
  v_entitled boolean;
  v_provider_ready boolean;
begin
  if auth.uid() is null or not private.is_store_member(v_sid) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select * into v_store from public.stores where id=v_sid;
  if v_store.latitude is null or v_store.longitude is null then
    return jsonb_build_object('available',false,'reason','store_coordinates_missing');
  end if;

  v_estimate := private.local_route_estimate(v_store.latitude,v_store.longitude,_destination_latitude,_destination_longitude,_travel_mode);
  v_entitled := private.store_has_entitlement(v_sid,'delivery.smart');
  v_provider_ready := private.is_maps_provider_ready('google_maps','production');

  return v_estimate || jsonb_build_object(
    'available',true,
    'smart_delivery_entitled',v_entitled,
    'provider_ready',v_provider_ready,
    'provider_route_available',v_entitled and v_provider_ready
  );
end;
$$;

create or replace function public.get_my_store_smart_delivery_readiness(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sid uuid := private.resolve_store(_store_id);
  v_runtime private.maps_provider_runtime_readiness%rowtype;
  v_store public.stores%rowtype;
  v_entitled boolean;
begin
  if auth.uid() is null or not private.is_store_member(v_sid) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select * into v_store from public.stores where id=v_sid;
  select * into v_runtime from private.maps_provider_runtime_readiness where provider='google_maps' and environment='production';
  v_entitled := private.store_has_entitlement(v_sid,'delivery.smart');

  return jsonb_build_object(
    'static_neighborhood_eta_available',exists(select 1 from public.neighborhoods n where n.store_id=v_sid and n.is_active and not n.is_archived),
    'static_neighborhood_count',(select count(*) from public.neighborhoods n where n.store_id=v_sid and n.is_active and not n.is_archived),
    'store_coordinates_set',v_store.latitude is not null and v_store.longitude is not null,
    'store_location_source',v_store.location_source,
    'geocoded_customer_addresses',(select count(*) from public.customer_addresses a where a.store_id=v_sid and a.latitude is not null and a.longitude is not null),
    'smart_delivery_entitled',v_entitled,
    'provider','google_maps',
    'api_key_configured',coalesce(v_runtime.api_key_configured,false),
    'billing_confirmed',coalesce(v_runtime.billing_confirmed,false),
    'routes_api_enabled',coalesce(v_runtime.routes_api_enabled,false),
    'geocoding_api_enabled',coalesce(v_runtime.geocoding_api_enabled,false),
    'kill_switch_enabled',coalesce(v_runtime.kill_switch_enabled,true),
    'provider_ready',private.is_maps_provider_ready('google_maps','production'),
    'local_approximation_ready',v_store.latitude is not null and v_store.longitude is not null,
    'ready_for_smart_routes',v_entitled and private.is_maps_provider_ready('google_maps','production') and v_store.latitude is not null and v_store.longitude is not null,
    'last_health_at',v_runtime.last_health_at,
    'last_error_code',v_runtime.last_error_code
  );
end;
$$;

create or replace function public.backend_record_maps_provider_runtime_health(
  _provider text,
  _environment text,
  _api_key_configured boolean,
  _billing_confirmed boolean,
  _routes_api_enabled boolean,
  _geocoding_api_enabled boolean,
  _kill_switch_enabled boolean,
  _error_code text default null,
  _error_detail text default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, private
as $$
  select private.record_maps_provider_runtime_health(_provider,_environment,_api_key_configured,_billing_confirmed,_routes_api_enabled,_geocoding_api_enabled,_kill_switch_enabled,_error_code,_error_detail);
$$;

create or replace function public.backend_get_cached_route_estimate(_store_id uuid,_provider text,_cache_key text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, private
as $$ select private.get_cached_route_estimate(_store_id,_provider,_cache_key); $$;

create or replace function public.backend_upsert_route_estimate_cache(
  _store_id uuid,_provider text,_cache_key text,_travel_mode text,
  _origin_latitude numeric,_origin_longitude numeric,_destination_latitude numeric,_destination_longitude numeric,
  _distance_meters integer,_duration_seconds integer,_traffic_duration_seconds integer default null,
  _is_traffic_aware boolean default false,_provider_cost_micros bigint default 0,_ttl_seconds integer default 900,_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, private
as $$
  select private.upsert_route_estimate_cache(_store_id,_provider,_cache_key,_travel_mode,_origin_latitude,_origin_longitude,_destination_latitude,_destination_longitude,_distance_meters,_duration_seconds,_traffic_duration_seconds,_is_traffic_aware,_provider_cost_micros,_ttl_seconds,_metadata);
$$;

create or replace function public.update_store_address(_store_id uuid, _postal_code text, _street text, _address_number text, _address_complement text, _neighborhood text, _city text, _state text, _expected_updated_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_sid uuid := private.resolve_store(_store_id);
  v_cur public.stores%rowtype;
  v_postal text;
  v_street text;
  v_number text;
  v_complement text;
  v_neighborhood text;
  v_city text;
  v_state text;
  v_formatted text;
  v_address_changed boolean;
begin
  perform private.require_permission('store.update_profile',v_sid);
  select * into v_cur from public.stores where id=v_sid for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  perform private.assert_version(_expected_updated_at,v_cur.updated_at);

  v_postal:=nullif(regexp_replace(coalesce(_postal_code,''),'[^0-9]','','g'),'');
  v_street:=nullif(btrim(coalesce(_street,'')),'');
  v_number:=nullif(btrim(coalesce(_address_number,'')),'');
  v_complement:=nullif(btrim(coalesce(_address_complement,'')),'');
  v_neighborhood:=nullif(btrim(coalesce(_neighborhood,'')),'');
  v_city:=nullif(btrim(coalesce(_city,'')),'');
  v_state:=upper(nullif(btrim(coalesce(_state,'')),''));

  if v_postal is null or length(v_postal)<>8 then raise exception 'INVALID_POSTAL_CODE' using errcode='P0001'; end if;
  if v_street is null or length(v_street)<2 or length(v_street)>180 then raise exception 'INVALID_STREET' using errcode='P0001'; end if;
  if v_city is null or length(v_city)<2 or length(v_city)>120 then raise exception 'INVALID_CITY' using errcode='P0001'; end if;
  if v_state is null or v_state !~ '^[A-Z]{2}$' then raise exception 'INVALID_STATE' using errcode='P0001'; end if;
  if v_number is not null and length(v_number)>40 then raise exception 'INVALID_ADDRESS_NUMBER' using errcode='P0001'; end if;
  if v_complement is not null and length(v_complement)>120 then raise exception 'INVALID_ADDRESS_COMPLEMENT' using errcode='P0001'; end if;
  if v_neighborhood is not null and length(v_neighborhood)>120 then raise exception 'INVALID_NEIGHBORHOOD' using errcode='P0001'; end if;

  v_formatted:=concat_ws(', ',v_street,v_number,v_neighborhood,concat_ws(' - ',v_city,v_state),v_postal);
  v_address_changed := v_cur.postal_code is distinct from v_postal
    or v_cur.street is distinct from v_street
    or v_cur.address_number is distinct from v_number
    or v_cur.address_complement is distinct from v_complement
    or v_cur.neighborhood is distinct from v_neighborhood
    or v_cur.city is distinct from v_city
    or v_cur.state is distinct from v_state;

  update public.stores
  set postal_code=v_postal,
      street=v_street,
      address_number=v_number,
      address_complement=v_complement,
      neighborhood=v_neighborhood,
      city=v_city,
      state=v_state,
      address_line=v_formatted,
      latitude=case when v_address_changed then null else latitude end,
      longitude=case when v_address_changed then null else longitude end,
      location_source=case when v_address_changed then 'unverified' else location_source end,
      location_verified_at=case when v_address_changed then null else location_verified_at end,
      location_accuracy_meters=case when v_address_changed then null else location_accuracy_meters end,
      updated_at=now()
  where id=v_sid;

  perform private.log_config_audit(v_sid,'store.address.updated','stores',v_sid,array['postal_code','street','address_number','address_complement','neighborhood','city','state','address_line','latitude','longitude','location_source']);
  return public.get_my_store_configuration(v_sid);
end;
$$;

revoke all on function private.haversine_distance_meters(numeric,numeric,numeric,numeric) from public,anon,authenticated;
revoke all on function private.local_route_estimate(numeric,numeric,numeric,numeric,text) from public,anon,authenticated;
revoke all on function private.is_maps_provider_ready(text,text) from public,anon,authenticated;
revoke all on function private.record_maps_provider_runtime_health(text,text,boolean,boolean,boolean,boolean,boolean,text,text) from public,anon,authenticated;
revoke all on function private.get_cached_route_estimate(uuid,text,text) from public,anon,authenticated;
revoke all on function private.upsert_route_estimate_cache(uuid,text,text,text,numeric,numeric,numeric,numeric,integer,integer,integer,boolean,bigint,integer,jsonb) from public,anon,authenticated;
revoke all on function private.prune_route_estimate_cache() from public,anon,authenticated;
revoke all on function private.refresh_delivery_local_route(uuid) from public,anon,authenticated;
revoke all on function private.delivery_local_route_insert_trigger() from public,anon,authenticated;
revoke all on function private.customer_address_route_refresh_trigger() from public,anon,authenticated;

grant execute on function private.haversine_distance_meters(numeric,numeric,numeric,numeric) to service_role;
grant execute on function private.local_route_estimate(numeric,numeric,numeric,numeric,text) to service_role;
grant execute on function private.is_maps_provider_ready(text,text) to service_role;
grant execute on function private.record_maps_provider_runtime_health(text,text,boolean,boolean,boolean,boolean,boolean,text,text) to service_role;
grant execute on function private.get_cached_route_estimate(uuid,text,text) to service_role;
grant execute on function private.upsert_route_estimate_cache(uuid,text,text,text,numeric,numeric,numeric,numeric,integer,integer,integer,boolean,bigint,integer,jsonb) to service_role;
grant execute on function private.prune_route_estimate_cache() to service_role;
grant execute on function private.refresh_delivery_local_route(uuid) to service_role;

revoke all on function public.update_store_location_coordinates(uuid,numeric,numeric,text,numeric,timestamptz) from public,anon;
revoke all on function public.preview_store_delivery_estimate(uuid,numeric,numeric,text) from public,anon;
revoke all on function public.get_my_store_smart_delivery_readiness(uuid) from public,anon;
grant execute on function public.update_store_location_coordinates(uuid,numeric,numeric,text,numeric,timestamptz) to authenticated;
grant execute on function public.preview_store_delivery_estimate(uuid,numeric,numeric,text) to authenticated;
grant execute on function public.get_my_store_smart_delivery_readiness(uuid) to authenticated;

revoke all on function public.backend_record_maps_provider_runtime_health(text,text,boolean,boolean,boolean,boolean,boolean,text,text) from public,anon,authenticated;
revoke all on function public.backend_get_cached_route_estimate(uuid,text,text) from public,anon,authenticated;
revoke all on function public.backend_upsert_route_estimate_cache(uuid,text,text,text,numeric,numeric,numeric,numeric,integer,integer,integer,boolean,bigint,integer,jsonb) from public,anon,authenticated;
grant execute on function public.backend_record_maps_provider_runtime_health(text,text,boolean,boolean,boolean,boolean,boolean,text,text) to service_role;
grant execute on function public.backend_get_cached_route_estimate(uuid,text,text) to service_role;
grant execute on function public.backend_upsert_route_estimate_cache(uuid,text,text,text,numeric,numeric,numeric,numeric,integer,integer,integer,boolean,bigint,integer,jsonb) to service_role;

select cron.unschedule(jobid) from cron.job where jobname='comandiva-route-cache-prune';
select cron.schedule('comandiva-route-cache-prune','52 4 * * *',$$select private.prune_route_estimate_cache();$$);