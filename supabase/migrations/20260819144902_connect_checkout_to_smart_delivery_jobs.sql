alter table public.customer_addresses
  add column if not exists location_source text not null default 'none',
  add column if not exists location_accuracy_meters numeric,
  add column if not exists location_verified_at timestamptz,
  add column if not exists google_place_id text;

update public.customer_addresses
set location_source = case
  when latitude is null or longitude is null then 'none'
  when geocoding_provider = 'google_maps' then 'google_geocoding'
  when geocoding_status = 'manual' then 'manual'
  else 'legacy'
end
where location_source = 'none';

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.customer_addresses'::regclass and conname='customer_addresses_location_source_check') then
    alter table public.customer_addresses add constraint customer_addresses_location_source_check check (location_source in ('none','browser_checkout','google_geocoding','manual','legacy'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.customer_addresses'::regclass and conname='customer_addresses_location_accuracy_check') then
    alter table public.customer_addresses add constraint customer_addresses_location_accuracy_check check (location_accuracy_meters is null or (location_accuracy_meters >= 0 and location_accuracy_meters <= 10000));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.customer_addresses'::regclass and conname='customer_addresses_coordinate_pair_check') then
    alter table public.customer_addresses add constraint customer_addresses_coordinate_pair_check check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null));
  end if;
end $$;

create index if not exists customer_addresses_missing_coordinates_idx on public.customer_addresses(store_id, updated_at desc) where latitude is null and longitude is null;
create index if not exists customer_addresses_google_place_id_idx on public.customer_addresses(google_place_id) where google_place_id is not null;

create table if not exists private.smart_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  job_type text not null check (job_type in ('geocode_address','compute_delivery_route')),
  address_id uuid references public.customer_addresses(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','retry','completed','failed','cancelled')),
  priority integer not null default 100,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_until timestamptz,
  locked_by text,
  idempotency_key text not null,
  last_error_code text,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smart_delivery_jobs_target_check check ((job_type='geocode_address' and address_id is not null and delivery_id is null) or (job_type='compute_delivery_route' and delivery_id is not null)),
  constraint smart_delivery_jobs_store_idempotency_key unique(store_id,idempotency_key)
);

alter table private.smart_delivery_jobs enable row level security;
alter table private.smart_delivery_jobs force row level security;
revoke all on private.smart_delivery_jobs from public, anon, authenticated;
grant select,insert,update,delete on private.smart_delivery_jobs to service_role;

create index if not exists smart_delivery_jobs_claim_idx on private.smart_delivery_jobs(status, available_at, priority, created_at) where status in ('queued','retry','processing');
create index if not exists smart_delivery_jobs_address_idx on private.smart_delivery_jobs(store_id,address_id,created_at desc) where address_id is not null;
create index if not exists smart_delivery_jobs_delivery_idx on private.smart_delivery_jobs(store_id,delivery_id,created_at desc) where delivery_id is not null;

create or replace function private.smart_delivery_geocoding_ready(_store_id uuid)
returns boolean language sql stable security definer set search_path='pg_catalog','private' as $$
  select private.store_has_entitlement(_store_id,'delivery.smart') and coalesce((select r.api_key_configured and r.billing_confirmed and r.geocoding_api_enabled and not r.kill_switch_enabled from private.maps_provider_runtime_readiness r where r.provider='google_maps' and r.environment='production'),false);
$$;

create or replace function private.smart_delivery_routes_ready(_store_id uuid)
returns boolean language sql stable security definer set search_path='pg_catalog','public','private' as $$
  select private.store_has_entitlement(_store_id,'delivery.smart') and private.is_maps_provider_ready('google_maps','production') and exists(select 1 from public.stores s where s.id=_store_id and s.latitude is not null and s.longitude is not null);
$$;

create or replace function private.delivery_route_mode(_delivery_id uuid)
returns text language sql stable security definer set search_path='pg_catalog','public' as $$
  select case when c.id is not null and lower(coalesce(c.vehicle,'')) like '%car%' then 'drive' else 'two_wheeler' end
  from public.deliveries d left join public.couriers c on c.id=d.courier_id and c.store_id=d.store_id where d.id=_delivery_id;
$$;

create or replace function private.enqueue_smart_delivery_job(_store_id uuid,_job_type text,_address_id uuid default null,_delivery_id uuid default null,_priority integer default 100,_idempotency_key text default null,_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_id uuid; v_key text := nullif(btrim(coalesce(_idempotency_key,'')),''); v_order public.orders%rowtype; v_address public.customer_addresses%rowtype;
begin
  if _store_id is null or _job_type not in ('geocode_address','compute_delivery_route') or v_key is null or length(v_key)>240 then return null; end if;
  if _job_type='geocode_address' then
    if _address_id is null or not private.smart_delivery_geocoding_ready(_store_id) then return null; end if;
    select * into v_address from public.customer_addresses a where a.id=_address_id and a.store_id=_store_id;
    if not found or (v_address.latitude is not null and v_address.longitude is not null) then return null; end if;
  else
    if _delivery_id is null or not private.smart_delivery_routes_ready(_store_id) then return null; end if;
    select o.* into v_order from public.deliveries d join public.orders o on o.id=d.order_id and o.store_id=d.store_id where d.id=_delivery_id and d.store_id=_store_id and d.status not in ('concluida','cancelada');
    if not found or v_order.address_id is null then return null; end if;
    if coalesce((v_order.address_snapshot->>'latitude')::numeric,(select a.latitude from public.customer_addresses a where a.id=v_order.address_id and a.store_id=_store_id)) is null or coalesce((v_order.address_snapshot->>'longitude')::numeric,(select a.longitude from public.customer_addresses a where a.id=v_order.address_id and a.store_id=_store_id)) is null then return null; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(_store_id::text||':'||v_key,20260819));
  select j.id into v_id from private.smart_delivery_jobs j where j.store_id=_store_id and j.idempotency_key=v_key;
  if found then return v_id; end if;
  insert into private.smart_delivery_jobs(store_id,job_type,address_id,delivery_id,priority,idempotency_key,metadata) values(_store_id,_job_type,_address_id,_delivery_id,greatest(1,least(coalesce(_priority,100),1000)),v_key,coalesce(_metadata,'{}'::jsonb)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.queue_customer_address_geocode(_address_id uuid)
returns uuid language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_address public.customer_addresses%rowtype; v_hash text;
begin
  select * into v_address from public.customer_addresses where id=_address_id;
  if not found or (v_address.latitude is not null and v_address.longitude is not null) then return null; end if;
  v_hash := md5(coalesce(v_address.street,'')||'|'||coalesce(v_address.number,'')||'|'||coalesce(v_address.neighborhood_name,''));
  return private.enqueue_smart_delivery_job(v_address.store_id,'geocode_address',v_address.id,null,80,'address:'||v_address.id::text||':geocode:'||v_hash,jsonb_build_object('source','customer_address'));
end;
$$;

create or replace function private.queue_delivery_google_route(_delivery_id uuid)
returns uuid language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_delivery public.deliveries%rowtype; v_mode text; v_addr_hash text;
begin
  select * into v_delivery from public.deliveries where id=_delivery_id;
  if not found or v_delivery.status in ('concluida','cancelada') then return null; end if;
  v_mode := coalesce(private.delivery_route_mode(_delivery_id),'two_wheeler');
  select md5(coalesce(o.address_snapshot::text,'')) into v_addr_hash from public.orders o where o.id=v_delivery.order_id and o.store_id=v_delivery.store_id;
  return private.enqueue_smart_delivery_job(v_delivery.store_id,'compute_delivery_route',null,v_delivery.id,40,'delivery:'||v_delivery.id::text||':route:'||v_mode||':'||coalesce(v_addr_hash,'none'),jsonb_build_object('travel_mode',v_mode));
end;
$$;

create or replace function private.customer_address_smart_delivery_trigger()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_delivery_id uuid;
begin
  if new.latitude is null or new.longitude is null then perform private.queue_customer_address_geocode(new.id);
  else
    for v_delivery_id in select d.id from public.deliveries d join public.orders o on o.id=d.order_id and o.store_id=d.store_id where o.address_id=new.id and d.store_id=new.store_id and d.status not in ('concluida','cancelada') and (o.address_snapshot->>'latitude') is null loop
      update public.orders o set address_snapshot=coalesce(o.address_snapshot,'{}'::jsonb)||jsonb_build_object('latitude',new.latitude,'longitude',new.longitude,'locationSource',new.location_source) where o.id=(select d2.order_id from public.deliveries d2 where d2.id=v_delivery_id) and o.store_id=new.store_id and (o.address_snapshot->>'latitude') is null;
      perform private.refresh_delivery_local_route(v_delivery_id);
      perform private.queue_delivery_google_route(v_delivery_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_customer_address_smart_delivery on public.customer_addresses;
create trigger trg_customer_address_smart_delivery after insert or update of street,number,neighborhood_name,latitude,longitude on public.customer_addresses for each row execute function private.customer_address_smart_delivery_trigger();

create or replace function private.delivery_smart_route_job_trigger()
returns trigger language plpgsql security definer set search_path='pg_catalog','private' as $$
begin
  begin perform private.queue_delivery_google_route(new.id); exception when others then null; end;
  return new;
end;
$$;

drop trigger if exists trg_delivery_smart_route_job on public.deliveries;
create trigger trg_delivery_smart_route_job after insert or update of courier_id,status on public.deliveries for each row execute function private.delivery_smart_route_job_trigger();

create or replace function private.prepare_smart_delivery_jobs(_limit integer default 100)
returns integer language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_count integer:=0; r record;
begin
  for r in select a.id,a.store_id from public.customer_addresses a where a.latitude is null and a.longitude is null and private.smart_delivery_geocoding_ready(a.store_id) order by a.updated_at desc limit greatest(1,least(coalesce(_limit,100),500)) loop
    if private.queue_customer_address_geocode(r.id) is not null then v_count:=v_count+1; end if;
  end loop;
  for r in select d.id from public.deliveries d where d.status not in ('concluida','cancelada') and coalesce(d.route_provider,'')<>'google_maps' and private.smart_delivery_routes_ready(d.store_id) order by d.updated_at desc limit greatest(1,least(coalesce(_limit,100),500)) loop
    if private.queue_delivery_google_route(r.id) is not null then v_count:=v_count+1; end if;
  end loop;
  return v_count;
end;
$$;

create or replace function public.backend_claim_smart_delivery_jobs(_worker_id text,_limit integer default 10)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_rows jsonb;
begin
  if nullif(btrim(coalesce(_worker_id,'')),'') is null then raise exception 'INVALID_WORKER'; end if;
  with candidates as (
    select j.id from private.smart_delivery_jobs j where (j.status in ('queued','retry') and j.available_at<=now() or (j.status='processing' and j.locked_until<now())) and j.attempts<j.max_attempts order by j.priority asc,j.available_at asc,j.created_at asc for update skip locked limit greatest(1,least(coalesce(_limit,10),50))
  ), claimed as (
    update private.smart_delivery_jobs j set status='processing',attempts=j.attempts+1,locked_at=now(),locked_until=now()+interval '2 minutes',locked_by=btrim(_worker_id),updated_at=now() from candidates c where j.id=c.id returning j.id,j.store_id,j.job_type,j.address_id,j.delivery_id,j.attempts,j.max_attempts,j.metadata
  ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into v_rows from claimed;
  return v_rows;
end;
$$;

create or replace function public.backend_get_smart_delivery_job_context(_job_id uuid,_worker_id text)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare j private.smart_delivery_jobs%rowtype; a public.customer_addresses%rowtype; d public.deliveries%rowtype; o public.orders%rowtype; s public.stores%rowtype; v_lat numeric; v_lon numeric; v_mode text;
begin
  select * into j from private.smart_delivery_jobs where id=_job_id and status='processing' and locked_by=btrim(_worker_id) and locked_until>now();
  if not found then raise exception 'JOB_NOT_CLAIMED' using errcode='42501'; end if;
  select * into s from public.stores where id=j.store_id;
  if j.job_type='geocode_address' then
    if not private.smart_delivery_geocoding_ready(j.store_id) then return jsonb_build_object('ready',false,'reason','provider_not_ready'); end if;
    select * into a from public.customer_addresses where id=j.address_id and store_id=j.store_id;
    if not found then return jsonb_build_object('ready',false,'reason','address_not_found'); end if;
    if a.latitude is not null and a.longitude is not null then return jsonb_build_object('ready',false,'reason','already_geocoded'); end if;
    return jsonb_build_object('ready',true,'jobType',j.job_type,'storeId',j.store_id,'addressId',a.id,'address',jsonb_build_object('street',a.street,'number',a.number,'neighborhood',a.neighborhood_name,'city',s.city,'state',s.state,'country','Brasil'));
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
  v_mode := coalesce(private.delivery_route_mode(d.id),'two_wheeler');
  return jsonb_build_object('ready',true,'jobType',j.job_type,'storeId',j.store_id,'deliveryId',d.id,'travelMode',v_mode,'origin',jsonb_build_object('latitude',s.latitude,'longitude',s.longitude),'destination',jsonb_build_object('latitude',v_lat,'longitude',v_lon));
end;
$$;

create or replace function public.backend_complete_smart_delivery_geocode_job(_job_id uuid,_worker_id text,_latitude numeric,_longitude numeric,_place_id text,_precision text,_request_id text)
returns boolean language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare j private.smart_delivery_jobs%rowtype;
begin
  select * into j from private.smart_delivery_jobs where id=_job_id and status='processing' and locked_by=btrim(_worker_id) and locked_until>now() for update;
  if not found or j.job_type<>'geocode_address' then raise exception 'JOB_NOT_CLAIMED' using errcode='42501'; end if;
  if _latitude is null or _latitude not between -90 and 90 or _longitude is null or _longitude not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
  update public.customer_addresses a set latitude=_latitude,longitude=_longitude,geocoding_status='provider_verified',geocoding_provider='google_maps',geocoding_precision=nullif(left(coalesce(_precision,''),80),''),geocoded_at=now(),location_source='google_geocoding',location_accuracy_meters=null,location_verified_at=now(),google_place_id=nullif(left(coalesce(_place_id,''),256),''),updated_at=now() where a.id=j.address_id and a.store_id=j.store_id and a.latitude is null and a.longitude is null;
  perform private.record_integration_usage(j.store_id,'google_maps','delivery.smart','geocoding.address',1,0,0,'smart-delivery:geocode:'||j.id::text,now(),jsonb_build_object('request_id',left(coalesce(_request_id,''),80),'provider_cost_reconciliation_pending',true));
  update private.smart_delivery_jobs set status='completed',completed_at=now(),locked_at=null,locked_until=null,locked_by=null,last_error_code=null,last_error_message=null,updated_at=now() where id=j.id;
  return true;
end;
$$;

create or replace function public.backend_complete_smart_delivery_route_job(_job_id uuid,_worker_id text,_distance_meters integer,_duration_seconds integer,_travel_mode text,_request_id text)
returns boolean language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare j private.smart_delivery_jobs%rowtype;
begin
  select * into j from private.smart_delivery_jobs where id=_job_id and status='processing' and locked_by=btrim(_worker_id) and locked_until>now() for update;
  if not found or j.job_type<>'compute_delivery_route' then raise exception 'JOB_NOT_CLAIMED' using errcode='42501'; end if;
  if coalesce(_distance_meters,-1)<0 or coalesce(_duration_seconds,-1)<0 or _travel_mode not in ('drive','two_wheeler','bicycle','walk') then raise exception 'INVALID_ROUTE_RESULT'; end if;
  update public.deliveries d set route_distance_meters=_distance_meters,route_duration_seconds=_duration_seconds,route_provider='google_maps',route_mode=_travel_mode,route_estimated_at=now(),route_is_approximate=false,route_metadata=jsonb_build_object('source','google_routes','request_id',left(coalesce(_request_id,''),80),'cached',false),updated_at=now() where d.id=j.delivery_id and d.store_id=j.store_id and d.status not in ('concluida','cancelada');
  perform private.record_integration_usage(j.store_id,'google_maps','delivery.smart','routes.compute',1,0,0,'smart-delivery:route:'||j.id::text,now(),jsonb_build_object('request_id',left(coalesce(_request_id,''),80),'provider_cost_reconciliation_pending',true));
  update private.smart_delivery_jobs set status='completed',completed_at=now(),locked_at=null,locked_until=null,locked_by=null,last_error_code=null,last_error_message=null,updated_at=now() where id=j.id;
  return true;
end;
$$;

create or replace function public.backend_fail_smart_delivery_job(_job_id uuid,_worker_id text,_error_code text,_error_message text,_retriable boolean,_retry_after_seconds integer default 60)
returns boolean language plpgsql security definer set search_path='pg_catalog','private' as $$
declare j private.smart_delivery_jobs%rowtype; v_retry boolean;
begin
  select * into j from private.smart_delivery_jobs where id=_job_id and status='processing' and locked_by=btrim(_worker_id) for update;
  if not found then return false; end if;
  v_retry := coalesce(_retriable,false) and j.attempts<j.max_attempts;
  update private.smart_delivery_jobs set status=case when v_retry then 'retry' else 'failed' end,available_at=case when v_retry then now()+make_interval(secs=>greatest(15,least(coalesce(_retry_after_seconds,60),3600))) else available_at end,locked_at=null,locked_until=null,locked_by=null,last_error_code=left(coalesce(_error_code,'provider_error'),120),last_error_message=left(coalesce(_error_message,'provider error'),500),updated_at=now() where id=j.id;
  return true;
end;
$$;

create or replace function public.backend_cancel_smart_delivery_job(_job_id uuid,_worker_id text,_reason text)
returns boolean language plpgsql security definer set search_path='pg_catalog','private' as $$
begin
  update private.smart_delivery_jobs set status='cancelled',completed_at=now(),locked_at=null,locked_until=null,locked_by=null,last_error_code='cancelled',last_error_message=left(coalesce(_reason,'no_longer_needed'),500),updated_at=now() where id=_job_id and status='processing' and locked_by=btrim(_worker_id);
  return found;
end;
$$;

revoke all on function public.backend_claim_smart_delivery_jobs(text,integer) from public,anon,authenticated;
revoke all on function public.backend_get_smart_delivery_job_context(uuid,text) from public,anon,authenticated;
revoke all on function public.backend_complete_smart_delivery_geocode_job(uuid,text,numeric,numeric,text,text,text) from public,anon,authenticated;
revoke all on function public.backend_complete_smart_delivery_route_job(uuid,text,integer,integer,text,text) from public,anon,authenticated;
revoke all on function public.backend_fail_smart_delivery_job(uuid,text,text,text,boolean,integer) from public,anon,authenticated;
revoke all on function public.backend_cancel_smart_delivery_job(uuid,text,text) from public,anon,authenticated;
grant execute on function public.backend_claim_smart_delivery_jobs(text,integer) to service_role;
grant execute on function public.backend_get_smart_delivery_job_context(uuid,text) to service_role;
grant execute on function public.backend_complete_smart_delivery_geocode_job(uuid,text,numeric,numeric,text,text,text) to service_role;
grant execute on function public.backend_complete_smart_delivery_route_job(uuid,text,integer,integer,text,text) to service_role;
grant execute on function public.backend_fail_smart_delivery_job(uuid,text,text,text,boolean,integer) to service_role;
grant execute on function public.backend_cancel_smart_delivery_job(uuid,text,text) to service_role;

create or replace function private.refresh_delivery_local_route(_delivery_id uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_delivery public.deliveries%rowtype; v_store public.stores%rowtype; v_address public.customer_addresses%rowtype; v_order public.orders%rowtype; v_estimate jsonb; v_mode text:='two_wheeler'; v_lat numeric; v_lon numeric;
begin
  select * into v_delivery from public.deliveries where id=_delivery_id for update;
  if not found then return jsonb_build_object('updated',false,'reason','delivery_not_found'); end if;
  select * into v_order from public.orders where id=v_delivery.order_id and store_id=v_delivery.store_id;
  if not found or v_order.fulfillment::text<>'entrega' or v_order.address_id is null then return jsonb_build_object('updated',false,'reason','no_delivery_address'); end if;
  select * into v_store from public.stores where id=v_delivery.store_id;
  select * into v_address from public.customer_addresses where id=v_order.address_id and store_id=v_delivery.store_id;
  v_lat := case when jsonb_typeof(v_order.address_snapshot->'latitude')='number' then (v_order.address_snapshot->>'latitude')::numeric else v_address.latitude end;
  v_lon := case when jsonb_typeof(v_order.address_snapshot->'longitude')='number' then (v_order.address_snapshot->>'longitude')::numeric else v_address.longitude end;
  if v_store.latitude is null or v_store.longitude is null or v_lat is null or v_lon is null then return jsonb_build_object('updated',false,'reason','coordinates_missing'); end if;
  v_mode := coalesce(private.delivery_route_mode(_delivery_id),'two_wheeler');
  v_estimate := private.local_route_estimate(v_store.latitude,v_store.longitude,v_lat,v_lon,v_mode);
  update public.deliveries set route_distance_meters=(v_estimate->>'distance_meters')::integer,route_duration_seconds=(v_estimate->>'duration_seconds')::integer,route_provider='local_haversine',route_mode=v_mode,route_estimated_at=now(),route_is_approximate=true,route_metadata=jsonb_build_object('straight_line_meters',(v_estimate->>'straight_line_meters')::integer,'source','local_approximation','coordinate_source',coalesce(v_order.address_snapshot->>'locationSource',v_address.location_source)),updated_at=now() where id=_delivery_id and (route_provider is null or route_provider='local_haversine');
  return jsonb_build_object('updated',true,'estimate',v_estimate);
end;
$$;

create or replace function public.storefront_submit_order(_slug text,_payload jsonb)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare v_result jsonb; v_detail text; v_store_id uuid; v_access jsonb; v_order_id uuid; v_address_id uuid; v_lat numeric; v_lon numeric; v_accuracy numeric; v_has_coords boolean:=false; v_address public.customer_addresses%rowtype;
begin
  select st.id into v_store_id from public.stores st where st.slug=public.storefront_normalize_slug(_slug) and st.status='ativa' limit 1;
  if v_store_id is null then return jsonb_build_object('ok',false,'error','store_unavailable'); end if;
  perform public.reconcile_store_billing(v_store_id);
  v_access:=public.get_store_billing_access(v_store_id);
  if not coalesce((v_access->>'can_accept_new_orders')::boolean,false) then return jsonb_build_object('ok',false,'error','store_temporarily_unavailable','reason','billing_restricted','billing_stage',v_access->>'stage'); end if;
  begin
    v_result:=private.storefront_submit_order(_slug,_payload);
    if not coalesce((v_result->>'ok')::boolean,false) then raise exception using errcode='P0001',message='SHARK_CHECKOUT_ROLLBACK',detail=v_result::text; end if;
    if lower(coalesce(_payload#>>'{fulfillment,type}',''))='entrega' then
      v_order_id:=nullif(v_result#>>'{order,id}','')::uuid;
      select o.address_id into v_address_id from public.orders o where o.id=v_order_id and o.store_id=v_store_id;
      if v_address_id is not null then
        if jsonb_typeof(_payload#>'{address,latitude}')='number' and jsonb_typeof(_payload#>'{address,longitude}')='number' then v_lat:=(_payload#>>'{address,latitude}')::numeric; v_lon:=(_payload#>>'{address,longitude}')::numeric; v_has_coords:=v_lat between -90 and 90 and v_lon between -180 and 180; end if;
        if jsonb_typeof(_payload#>'{address,accuracyMeters}')='number' then v_accuracy:=(_payload#>>'{address,accuracyMeters}')::numeric; if v_accuracy<0 or v_accuracy>10000 then v_accuracy:=null; end if; end if;
        if v_has_coords then
          update public.customer_addresses a set latitude=v_lat,longitude=v_lon,location_source='browser_checkout',location_accuracy_meters=v_accuracy,location_verified_at=now(),geocoding_status='manual',geocoding_provider=null,geocoding_precision='device',geocoded_at=null,google_place_id=null,updated_at=now() where a.id=v_address_id and a.store_id=v_store_id and (a.latitude is null or a.longitude is null or a.location_source in ('none','browser_checkout','legacy'));
        else perform private.queue_customer_address_geocode(v_address_id); end if;
        select * into v_address from public.customer_addresses a where a.id=v_address_id and a.store_id=v_store_id;
        if found and v_address.latitude is not null and v_address.longitude is not null then
          update public.orders o set address_snapshot=coalesce(o.address_snapshot,'{}'::jsonb)||jsonb_build_object('latitude',v_address.latitude,'longitude',v_address.longitude,'locationSource',v_address.location_source,'locationAccuracyMeters',v_address.location_accuracy_meters,'googlePlaceId',v_address.google_place_id),updated_at=now() where o.id=v_order_id and o.store_id=v_store_id;
        end if;
      end if;
    end if;
    return v_result;
  exception when sqlstate 'P0001' then
    if sqlerrm='SHARK_CHECKOUT_ROLLBACK' then get stacked diagnostics v_detail=PG_EXCEPTION_DETAIL; return v_detail::jsonb; end if;
    if sqlerrm in ('PRODUCT_STOCK_INSUFFICIENT','OPTION_STOCK_INSUFFICIENT') then return jsonb_build_object('ok',false,'error','line_unavailable','reason','out_of_stock'); end if;
    raise;
  end;
end;
$$;

revoke all on function public.storefront_submit_order(text,jsonb) from public,anon,authenticated;
grant execute on function public.storefront_submit_order(text,jsonb) to service_role;

select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'comandiva_smart_delivery_worker_secret','Internal secret for Comandiva Smart Delivery cron worker',null) where not exists(select 1 from vault.decrypted_secrets where name='comandiva_smart_delivery_worker_secret');

select cron.unschedule(jobid) from cron.job where jobname='comandiva-smart-delivery-worker';
select cron.schedule('comandiva-smart-delivery-worker','* * * * *',$cron$
  select case
    when (select coalesce(r.api_key_configured and r.billing_confirmed and (r.routes_api_enabled or r.geocoding_api_enabled) and not r.kill_switch_enabled,false) from private.maps_provider_runtime_readiness r where r.provider='google_maps' and r.environment='production') then (
      with prepared as (select private.prepare_smart_delivery_jobs(100) as count)
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='comandiva_project_url' limit 1) || '/functions/v1/comandiva-smart-delivery-worker',
        headers := jsonb_build_object('Content-Type','application/json','x-comandiva-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='comandiva_smart_delivery_worker_secret' limit 1)),
        body := jsonb_build_object('source','cron','prepared',(select count from prepared)),
        timeout_milliseconds := 20000
      )
    ) else null::bigint end as request_id;
$cron$);