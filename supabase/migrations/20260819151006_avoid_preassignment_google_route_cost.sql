create or replace function private.delivery_route_mode(_delivery_id uuid)
returns text
language sql
stable
security definer
set search_path='pg_catalog','public'
as $$
  select case
    when c.id is null or nullif(btrim(coalesce(c.vehicle,'')),'') is null then null
    when lower(c.vehicle) ~ '(moto|motorcycle|scooter|two[_ -]?wheel)' then 'two_wheeler'
    else 'drive'
  end
  from public.deliveries d
  left join public.couriers c on c.id=d.courier_id and c.store_id=d.store_id
  where d.id=_delivery_id;
$$;

create or replace function private.queue_delivery_google_route(_delivery_id uuid)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_mode text;
  v_addr_hash text;
begin
  select * into v_delivery from public.deliveries where id=_delivery_id;
  if not found or v_delivery.status in ('concluida','cancelada') then return null; end if;
  v_mode := private.delivery_route_mode(_delivery_id);
  if v_mode is null then return null; end if;
  select md5(coalesce(o.address_snapshot::text,'')) into v_addr_hash
  from public.orders o where o.id=v_delivery.order_id and o.store_id=v_delivery.store_id;
  return private.enqueue_smart_delivery_job(
    v_delivery.store_id,'compute_delivery_route',null,v_delivery.id,40,
    'delivery:'||v_delivery.id::text||':route:'||v_mode||':'||coalesce(v_addr_hash,'none'),
    jsonb_build_object('travel_mode',v_mode)
  );
end;
$$;

create or replace function public.backend_get_smart_delivery_job_context(_job_id uuid,_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
declare
  j private.smart_delivery_jobs%rowtype;
  a public.customer_addresses%rowtype;
  d public.deliveries%rowtype;
  o public.orders%rowtype;
  s public.stores%rowtype;
  v_lat numeric;
  v_lon numeric;
  v_mode text;
begin
  select * into j from private.smart_delivery_jobs
  where id=_job_id and status='processing' and locked_by=btrim(_worker_id) and locked_until>now();
  if not found then raise exception 'JOB_NOT_CLAIMED' using errcode='42501'; end if;

  select * into s from public.stores where id=j.store_id;
  if j.job_type='geocode_address' then
    if not private.smart_delivery_geocoding_ready(j.store_id) then return jsonb_build_object('ready',false,'reason','provider_not_ready'); end if;
    select * into a from public.customer_addresses where id=j.address_id and store_id=j.store_id;
    if not found then return jsonb_build_object('ready',false,'reason','address_not_found'); end if;
    if a.latitude is not null and a.longitude is not null then return jsonb_build_object('ready',false,'reason','already_geocoded'); end if;
    return jsonb_build_object(
      'ready',true,'jobType',j.job_type,'storeId',j.store_id,'addressId',a.id,
      'address',jsonb_build_object('street',a.street,'number',a.number,'neighborhood',a.neighborhood_name,'city',s.city,'state',s.state,'country','Brasil')
    );
  end if;

  if not private.smart_delivery_routes_ready(j.store_id) then return jsonb_build_object('ready',false,'reason','provider_not_ready'); end if;
  select * into d from public.deliveries where id=j.delivery_id and store_id=j.store_id;
  if not found or d.status in ('concluida','cancelada') then return jsonb_build_object('ready',false,'reason','delivery_unavailable'); end if;
  select * into o from public.orders where id=d.order_id and store_id=d.store_id;
  if not found or o.address_id is null then return jsonb_build_object('ready',false,'reason','address_not_found'); end if;
  select * into a from public.customer_addresses where id=o.address_id and store_id=o.store_id;
  v_lat := case when jsonb_typeof(o.address_snapshot->'latitude')='number' then (o.address_snapshot->>'latitude')::numeric else a.latitude end;
  v_lon := case when jsonb_typeof(o.address_snapshot->'longitude')='number' then (o.address_snapshot->>'longitude')::numeric else a.longitude end;
  if v_lat is null or v_lon is null or s.latitude is null or s.longitude is null then return jsonb_build_object('ready',false,'reason','coordinates_missing'); end if;
  v_mode := private.delivery_route_mode(d.id);
  if v_mode is null then return jsonb_build_object('ready',false,'reason','vehicle_unknown'); end if;
  return jsonb_build_object(
    'ready',true,'jobType',j.job_type,'storeId',j.store_id,'deliveryId',d.id,'travelMode',v_mode,
    'origin',jsonb_build_object('latitude',s.latitude,'longitude',s.longitude),
    'destination',jsonb_build_object('latitude',v_lat,'longitude',v_lon)
  );
end;
$$;
