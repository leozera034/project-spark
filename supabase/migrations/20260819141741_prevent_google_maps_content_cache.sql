alter table private.route_estimate_cache
  drop constraint if exists route_estimate_cache_google_policy_check;
alter table private.route_estimate_cache
  add constraint route_estimate_cache_google_policy_check
  check (provider <> 'google_maps');

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
  if v_provider='google_maps' then
    raise exception 'PROVIDER_CONTENT_CACHE_NOT_ALLOWED' using errcode='22023';
  end if;
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
