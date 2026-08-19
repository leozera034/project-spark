alter table public.customer_addresses
  add column if not exists provider_place_id text;

update public.customer_addresses
set provider_place_id = google_place_id
where provider_place_id is null and google_place_id is not null;

alter table public.customer_addresses drop constraint if exists customer_addresses_location_source_check;
alter table public.customer_addresses add constraint customer_addresses_location_source_check
  check (location_source in ('none','browser_checkout','google_geocoding','openrouteservice_geocoding','manual','legacy'));

alter table public.stores drop constraint if exists stores_location_source_check;
alter table public.stores add constraint stores_location_source_check
  check (location_source in ('unverified','manual_browser','manual_admin','google_geocoding','openrouteservice_geocoding'));

create index if not exists customer_addresses_provider_place_id_idx
  on public.customer_addresses(provider_place_id)
  where provider_place_id is not null;

create or replace function private.current_smart_delivery_provider()
returns text
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  select 'openrouteservice'::text;
$$;

revoke all on function private.current_smart_delivery_provider() from public,anon,authenticated;
grant execute on function private.current_smart_delivery_provider() to service_role;

insert into private.maps_provider_runtime_readiness(
  provider,environment,api_key_configured,billing_confirmed,routes_api_enabled,
  geocoding_api_enabled,kill_switch_enabled,last_health_at,last_error_code,last_error_detail,updated_at
)
values(
  'openrouteservice','production',false,true,false,false,true,now(),
  'PROVIDER_NOT_PROBED',
  'OpenRouteService/HeiGIT is configured as the zero-cost Smart Delivery provider, but remains fail-closed until the server secret is validated by a controlled provider probe.',
  now()
)
on conflict (provider,environment) do update
set billing_confirmed=true,
    kill_switch_enabled=true,
    last_error_code='PROVIDER_NOT_PROBED',
    last_error_detail='OpenRouteService/HeiGIT is configured as the zero-cost Smart Delivery provider, but remains fail-closed until the server secret is validated by a controlled provider probe.',
    updated_at=now();

create or replace function public.backend_record_smart_delivery_provider_health(
  _api_key_configured boolean,
  _routes_api_enabled boolean,
  _geocoding_api_enabled boolean,
  _kill_switch_enabled boolean,
  _error_code text default null,
  _error_detail text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return private.record_maps_provider_runtime_health(
    private.current_smart_delivery_provider(),
    'production',
    coalesce(_api_key_configured,false),
    true,
    coalesce(_routes_api_enabled,false),
    coalesce(_geocoding_api_enabled,false),
    coalesce(_kill_switch_enabled,true),
    _error_code,
    _error_detail
  );
end;
$$;

revoke all on function public.backend_record_smart_delivery_provider_health(boolean,boolean,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.backend_record_smart_delivery_provider_health(boolean,boolean,boolean,boolean,text,text) to service_role;

create or replace function private.smart_delivery_geocoding_ready(_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select private.store_has_entitlement(_store_id,'delivery.smart')
    and not private.is_smart_delivery_store_paused(_store_id)
    and private.is_maps_feature_ready(private.current_smart_delivery_provider(),'production','geocoding.address')
    and private.is_store_usage_allowed(_store_id,private.current_smart_delivery_provider(),'delivery.smart','geocoding.address',1);
$$;

create or replace function private.smart_delivery_routes_ready(_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select private.store_has_entitlement(_store_id,'delivery.smart')
    and not private.is_smart_delivery_store_paused(_store_id)
    and private.is_maps_feature_ready(private.current_smart_delivery_provider(),'production','routes.compute')
    and private.is_store_usage_allowed(_store_id,private.current_smart_delivery_provider(),'delivery.smart','routes.compute',1)
    and exists(
      select 1 from public.stores s
      where s.id=_store_id and s.latitude is not null and s.longitude is not null
    );
$$;

revoke all on function private.smart_delivery_geocoding_ready(uuid) from public,anon,authenticated;
revoke all on function private.smart_delivery_routes_ready(uuid) from public,anon,authenticated;
grant execute on function private.smart_delivery_geocoding_ready(uuid) to service_role;
grant execute on function private.smart_delivery_routes_ready(uuid) to service_role;

create or replace function public.backend_check_smart_delivery_usage(
  _store_id uuid,
  _metric_code text,
  _quantity numeric default 1
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_metric text := lower(btrim(_metric_code));
  v_provider text := private.current_smart_delivery_provider();
begin
  if v_metric not in ('routes.compute','geocoding.address') then return false; end if;
  if private.is_smart_delivery_store_paused(_store_id) then return false; end if;
  if not private.store_has_entitlement(_store_id,'delivery.smart') then return false; end if;
  if not private.is_maps_feature_ready(v_provider,'production',v_metric) then return false; end if;
  return private.is_store_usage_allowed(_store_id,v_provider,'delivery.smart',v_metric,coalesce(_quantity,1));
end;
$$;

create or replace function public.backend_record_smart_delivery_usage(
  _store_id uuid,
  _metric_code text,
  _quantity numeric default 1,
  _provider_cost_micros bigint default 0,
  _customer_charge_micros bigint default 0,
  _idempotency_key text default null,
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_metric text := lower(btrim(_metric_code));
  v_provider text := private.current_smart_delivery_provider();
begin
  if v_metric not in ('routes.compute','geocoding.address') then
    raise exception 'INVALID_SMART_DELIVERY_METRIC' using errcode='22023';
  end if;
  if not private.store_has_entitlement(_store_id,'delivery.smart') then
    raise exception 'ADDON_ENTITLEMENT_REQUIRED' using errcode='42501';
  end if;
  return private.record_integration_usage(
    _store_id,v_provider,'delivery.smart',v_metric,coalesce(_quantity,1),
    0,greatest(coalesce(_customer_charge_micros,0),0),
    nullif(btrim(_idempotency_key),''),now(),
    coalesce(_metadata,'{}'::jsonb) || jsonb_build_object('provider_cost_reconciliation_pending',false)
  );
end;
$$;

revoke all on function public.backend_check_smart_delivery_usage(uuid,text,numeric) from public,anon,authenticated;
revoke all on function public.backend_record_smart_delivery_usage(uuid,text,numeric,bigint,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_check_smart_delivery_usage(uuid,text,numeric) to service_role;
grant execute on function public.backend_record_smart_delivery_usage(uuid,text,numeric,bigint,bigint,text,jsonb) to service_role;

create or replace function private.smart_delivery_usage_metric_snapshot(
  _store_id uuid,
  _metric_code text,
  _period_start date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_limit private.integration_usage_limits%rowtype;
  v_quantity numeric := 0;
  v_provider_cost bigint := 0;
  v_customer_charge bigint := 0;
  v_period_end date := (_period_start + interval '1 month - 1 day')::date;
  v_provider text := private.current_smart_delivery_provider();
begin
  select l.* into v_limit
  from private.integration_usage_limits l
  where l.store_id=_store_id
    and l.feature_code='delivery.smart'
    and l.metric_code=_metric_code
    and l.provider in (v_provider,'*')
  order by case when l.provider=v_provider then 0 else 1 end
  limit 1;

  select coalesce(sum(c.quantity),0),coalesce(sum(c.provider_cost_micros),0),coalesce(sum(c.customer_charge_micros),0)
  into v_quantity,v_provider_cost,v_customer_charge
  from private.integration_usage_counters c
  where c.store_id=_store_id
    and c.provider=v_provider
    and c.feature_code='delivery.smart'
    and c.metric_code=_metric_code
    and c.period_start=_period_start;

  return jsonb_build_object(
    'provider',v_provider,
    'metric_code',_metric_code,
    'period_start',_period_start,
    'period_end',v_period_end,
    'quantity',v_quantity,
    'included_units',case when v_limit.id is null then null else v_limit.included_units end,
    'hard_limit_units',case when v_limit.id is null then null else v_limit.hard_limit_units end,
    'warn_percent',case when v_limit.id is null then null else v_limit.warn_percent end,
    'critical_percent',case when v_limit.id is null then null else v_limit.critical_percent end,
    'limit_action',case when v_limit.id is null then null else v_limit.limit_action end,
    'provider_cost_micros',v_provider_cost,
    'customer_charge_micros',v_customer_charge,
    'next_unit_allowed',private.is_store_usage_allowed(_store_id,v_provider,'delivery.smart',_metric_code,1)
  );
end;
$$;

revoke all on function private.smart_delivery_usage_metric_snapshot(uuid,text,date) from public,anon,authenticated;
grant execute on function private.smart_delivery_usage_metric_snapshot(uuid,text,date) to service_role;

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
  v_provider text := private.current_smart_delivery_provider();
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
  v_provider_ready := private.is_maps_feature_ready(v_provider,'production','routes.compute');
  return v_estimate || jsonb_build_object(
    'available',true,
    'smart_delivery_entitled',v_entitled,
    'provider_ready',v_provider_ready,
    'provider_route_available',v_entitled and v_provider_ready and private.is_store_usage_allowed(v_sid,v_provider,'delivery.smart','routes.compute',1)
  );
end;
$$;

create or replace function public.backend_complete_smart_delivery_geocode_job(
  _job_id uuid,_worker_id text,_latitude numeric,_longitude numeric,
  _place_id text,_precision text,_request_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  j private.smart_delivery_jobs%rowtype;
  v_provider text := private.current_smart_delivery_provider();
begin
  select * into j from private.smart_delivery_jobs
  where id=_job_id and status='processing' and locked_by=btrim(_worker_id) and locked_until>now()
  for update;
  if not found or j.job_type<>'geocode_address' then raise exception 'JOB_NOT_CLAIMED' using errcode='42501'; end if;
  if _latitude is null or _latitude not between -90 and 90 or _longitude is null or _longitude not between -180 and 180 then
    raise exception 'INVALID_COORDINATES';
  end if;

  update public.customer_addresses a
  set latitude=_latitude,
      longitude=_longitude,
      geocoding_status='provider_verified',
      geocoding_provider=v_provider,
      geocoding_precision=nullif(left(coalesce(_precision,''),80),''),
      geocoded_at=now(),
      location_source='openrouteservice_geocoding',
      location_accuracy_meters=null,
      location_verified_at=now(),
      provider_place_id=nullif(left(coalesce(_place_id,''),256),''),
      google_place_id=null,
      updated_at=now()
  where a.id=j.address_id and a.store_id=j.store_id and a.latitude is null and a.longitude is null;

  perform private.record_integration_usage(
    j.store_id,v_provider,'delivery.smart','geocoding.address',1,0,0,
    'smart-delivery:geocode:'||j.id::text,now(),
    jsonb_build_object('request_id',left(coalesce(_request_id,''),80),'provider_cost_reconciliation_pending',false)
  );

  update private.smart_delivery_jobs
  set status='completed',completed_at=now(),locked_at=null,locked_until=null,locked_by=null,
      last_error_code=null,last_error_message=null,updated_at=now()
  where id=j.id;
  return true;
end;
$$;

create or replace function public.backend_complete_smart_delivery_route_job(
  _job_id uuid,_worker_id text,_distance_meters integer,_duration_seconds integer,
  _travel_mode text,_request_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  j private.smart_delivery_jobs%rowtype;
  v_provider text := private.current_smart_delivery_provider();
begin
  select * into j from private.smart_delivery_jobs
  where id=_job_id and status='processing' and locked_by=btrim(_worker_id) and locked_until>now()
  for update;
  if not found or j.job_type<>'compute_delivery_route' then raise exception 'JOB_NOT_CLAIMED' using errcode='42501'; end if;
  if coalesce(_distance_meters,-1)<0 or coalesce(_duration_seconds,-1)<0 or _travel_mode not in ('drive','two_wheeler','bicycle','walk') then
    raise exception 'INVALID_ROUTE_RESULT';
  end if;

  update public.deliveries d
  set route_distance_meters=_distance_meters,
      route_duration_seconds=_duration_seconds,
      route_provider=v_provider,
      route_mode=_travel_mode,
      route_estimated_at=now(),
      route_is_approximate=false,
      route_metadata=jsonb_build_object(
        'source','openrouteservice_directions',
        'request_id',left(coalesce(_request_id,''),80),
        'cached',false,
        'traffic_aware',false,
        'two_wheeler_profile_note',case when _travel_mode='two_wheeler' then 'driving-car' else null end
      ),
      updated_at=now()
  where d.id=j.delivery_id and d.store_id=j.store_id and d.status not in ('concluida','cancelada');

  perform private.record_integration_usage(
    j.store_id,v_provider,'delivery.smart','routes.compute',1,0,0,
    'smart-delivery:route:'||j.id::text,now(),
    jsonb_build_object('request_id',left(coalesce(_request_id,''),80),'provider_cost_reconciliation_pending',false)
  );

  update private.smart_delivery_jobs
  set status='completed',completed_at=now(),locked_at=null,locked_until=null,locked_by=null,
      last_error_code=null,last_error_message=null,updated_at=now()
  where id=j.id;
  return true;
end;
$$;

revoke all on function public.backend_complete_smart_delivery_geocode_job(uuid,text,numeric,numeric,text,text,text) from public,anon,authenticated;
revoke all on function public.backend_complete_smart_delivery_route_job(uuid,text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.backend_complete_smart_delivery_geocode_job(uuid,text,numeric,numeric,text,text,text) to service_role;
grant execute on function public.backend_complete_smart_delivery_route_job(uuid,text,integer,integer,text,text) to service_role;

create or replace function private.prepare_smart_delivery_jobs(_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_count integer:=0;
  r record;
  v_provider text := private.current_smart_delivery_provider();
begin
  for r in
    select a.id,a.store_id
    from public.customer_addresses a
    where a.latitude is null and a.longitude is null and private.smart_delivery_geocoding_ready(a.store_id)
    order by a.updated_at desc
    limit greatest(1,least(coalesce(_limit,100),500))
  loop
    if private.queue_customer_address_geocode(r.id) is not null then v_count:=v_count+1; end if;
  end loop;

  for r in
    select d.id
    from public.deliveries d
    where d.status not in ('concluida','cancelada')
      and coalesce(d.route_provider,'')<>v_provider
      and private.smart_delivery_routes_ready(d.store_id)
    order by d.updated_at desc
    limit greatest(1,least(coalesce(_limit,100),500))
  loop
    if private.queue_delivery_google_route(r.id) is not null then v_count:=v_count+1; end if;
  end loop;
  return v_count;
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
  v_provider text := private.current_smart_delivery_provider();
begin
  if auth.uid() is null or not private.is_store_member(v_sid) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select * into v_store from public.stores where id=v_sid;
  select * into v_runtime from private.maps_provider_runtime_readiness where provider=v_provider and environment='production';
  v_entitled := private.store_has_entitlement(v_sid,'delivery.smart');

  return jsonb_build_object(
    'static_neighborhood_eta_available',exists(select 1 from public.neighborhoods n where n.store_id=v_sid and n.is_active and not n.is_archived),
    'static_neighborhood_count',(select count(*) from public.neighborhoods n where n.store_id=v_sid and n.is_active and not n.is_archived),
    'store_coordinates_set',v_store.latitude is not null and v_store.longitude is not null,
    'store_location_source',v_store.location_source,
    'geocoded_customer_addresses',(select count(*) from public.customer_addresses a where a.store_id=v_sid and a.latitude is not null and a.longitude is not null),
    'smart_delivery_entitled',v_entitled,
    'provider',v_provider,
    'api_key_configured',coalesce(v_runtime.api_key_configured,false),
    'billing_confirmed',coalesce(v_runtime.billing_confirmed,true),
    'routes_api_enabled',coalesce(v_runtime.routes_api_enabled,false),
    'geocoding_api_enabled',coalesce(v_runtime.geocoding_api_enabled,false),
    'kill_switch_enabled',coalesce(v_runtime.kill_switch_enabled,true),
    'provider_ready',private.is_maps_provider_ready(v_provider,'production'),
    'local_approximation_ready',v_store.latitude is not null and v_store.longitude is not null,
    'ready_for_smart_routes',private.smart_delivery_routes_ready(v_sid),
    'last_health_at',v_runtime.last_health_at,
    'last_error_code',v_runtime.last_error_code
  );
end;
$$;

create or replace function public.backend_get_store_smart_delivery_control_center(
  _actor_user_id uuid,
  _store_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_store public.stores%rowtype;
  v_runtime private.maps_provider_runtime_readiness%rowtype;
  v_control private.smart_delivery_store_controls%rowtype;
  v_timezone text;
  v_period_start date;
  v_period_end date;
  v_entitled boolean;
  v_routes_usage jsonb;
  v_geocoding_usage jsonb;
  v_routes_provider_ready boolean;
  v_geocoding_provider_ready boolean;
  v_routes_ready boolean;
  v_geocoding_ready boolean;
  v_jobs jsonb;
  v_recent_issues jsonb;
  v_diagnostics jsonb := '[]'::jsonb;
  v_overall text;
  v_provider_cost bigint := 0;
  v_customer_charge bigint := 0;
  v_provider text := private.current_smart_delivery_provider();
begin
  if not private.is_store_manager_actor(_actor_user_id,_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select * into v_store from public.stores where id=_store_id;
  if not found then raise exception 'STORE_NOT_FOUND' using errcode='22023'; end if;
  v_timezone := coalesce(v_store.timezone,'America/Sao_Paulo');
  v_period_start := date_trunc('month',now() at time zone v_timezone)::date;
  v_period_end := (v_period_start + interval '1 month - 1 day')::date;

  select * into v_runtime
  from private.maps_provider_runtime_readiness
  where provider=v_provider and environment='production';

  select * into v_control
  from private.smart_delivery_store_controls
  where store_id=_store_id;

  v_entitled := private.store_has_entitlement(_store_id,'delivery.smart');
  v_routes_usage := private.smart_delivery_usage_metric_snapshot(_store_id,'routes.compute',v_period_start);
  v_geocoding_usage := private.smart_delivery_usage_metric_snapshot(_store_id,'geocoding.address',v_period_start);
  v_routes_provider_ready := private.is_maps_feature_ready(v_provider,'production','routes.compute');
  v_geocoding_provider_ready := private.is_maps_feature_ready(v_provider,'production','geocoding.address');
  v_routes_ready := private.smart_delivery_routes_ready(_store_id);
  v_geocoding_ready := private.smart_delivery_geocoding_ready(_store_id);

  select jsonb_build_object(
    'queued',(select count(*) from private.smart_delivery_jobs j where j.store_id=_store_id and j.status='queued'),
    'processing',(select count(*) from private.smart_delivery_jobs j where j.store_id=_store_id and j.status='processing'),
    'retry',(select count(*) from private.smart_delivery_jobs j where j.store_id=_store_id and j.status='retry'),
    'completed',(select count(*) from private.smart_delivery_jobs j where j.store_id=_store_id and j.status='completed'),
    'failed',(select count(*) from private.smart_delivery_jobs j where j.store_id=_store_id and j.status='failed'),
    'cancelled',(select count(*) from private.smart_delivery_jobs j where j.store_id=_store_id and j.status='cancelled'),
    'oldest_pending_at',(select min(j.created_at) from private.smart_delivery_jobs j where j.store_id=_store_id and j.status in ('queued','retry')),
    'stale_processing',(select count(*) from private.smart_delivery_jobs j where j.store_id=_store_id and j.status='processing' and j.locked_until is not null and j.locked_until<now())
  ) into v_jobs;

  select coalesce(jsonb_agg(jsonb_build_object(
    'job_type',q.job_type,'status',q.status,'attempts',q.attempts,'max_attempts',q.max_attempts,
    'error_code',q.last_error_code,'updated_at',q.updated_at
  ) order by q.updated_at desc),'[]'::jsonb)
  into v_recent_issues
  from (
    select j.job_type,j.status,j.attempts,j.max_attempts,j.last_error_code,j.updated_at
    from private.smart_delivery_jobs j
    where j.store_id=_store_id and j.status in ('retry','failed','cancelled')
    order by j.updated_at desc
    limit 10
  ) q;

  select coalesce(sum(c.provider_cost_micros),0),coalesce(sum(c.customer_charge_micros),0)
  into v_provider_cost,v_customer_charge
  from private.integration_usage_counters c
  where c.store_id=_store_id and c.provider=v_provider and c.feature_code='delivery.smart' and c.period_start=v_period_start;

  if not v_entitled then v_diagnostics := v_diagnostics || '"addon_not_entitled"'::jsonb; end if;
  if coalesce(v_control.is_paused,false) then v_diagnostics := v_diagnostics || '"store_paused"'::jsonb; end if;
  if coalesce(v_runtime.kill_switch_enabled,true) then v_diagnostics := v_diagnostics || '"provider_global_kill_switch"'::jsonb; end if;
  if not coalesce(v_runtime.api_key_configured,false) then v_diagnostics := v_diagnostics || '"api_key_missing"'::jsonb; end if;
  if not coalesce(v_runtime.routes_api_enabled,false) then v_diagnostics := v_diagnostics || '"routes_api_disabled"'::jsonb; end if;
  if not coalesce(v_runtime.geocoding_api_enabled,false) then v_diagnostics := v_diagnostics || '"geocoding_api_disabled"'::jsonb; end if;
  if v_runtime.last_error_code is not null then v_diagnostics := v_diagnostics || '"provider_health_error"'::jsonb; end if;
  if v_store.latitude is null or v_store.longitude is null then v_diagnostics := v_diagnostics || '"store_coordinates_missing"'::jsonb; end if;
  if coalesce((v_routes_usage->>'next_unit_allowed')::boolean,true)=false then v_diagnostics := v_diagnostics || '"routes_usage_limit_reached"'::jsonb; end if;
  if coalesce((v_geocoding_usage->>'next_unit_allowed')::boolean,true)=false then v_diagnostics := v_diagnostics || '"geocoding_usage_limit_reached"'::jsonb; end if;
  if coalesce((v_jobs->>'failed')::integer,0)>0 then v_diagnostics := v_diagnostics || '"failed_jobs_present"'::jsonb; end if;
  if coalesce((v_jobs->>'stale_processing')::integer,0)>0 then v_diagnostics := v_diagnostics || '"stale_processing_jobs"'::jsonb; end if;

  v_overall := case
    when coalesce(v_control.is_paused,false) then 'paused'
    when v_routes_ready and v_geocoding_ready then 'ready'
    when v_routes_ready or v_geocoding_ready then 'partial'
    else 'blocked'
  end;

  return jsonb_build_object(
    'store_id',_store_id,
    'overall_status',v_overall,
    'smart_delivery_entitled',v_entitled,
    'store',jsonb_build_object(
      'coordinates_set',v_store.latitude is not null and v_store.longitude is not null,
      'location_source',v_store.location_source,
      'local_approximation_ready',v_store.latitude is not null and v_store.longitude is not null
    ),
    'control',jsonb_build_object(
      'is_paused',coalesce(v_control.is_paused,false),
      'pause_reason',v_control.pause_reason,
      'paused_at',v_control.paused_at,
      'version',coalesce(v_control.version,0)
    ),
    'provider',jsonb_build_object(
      'code',v_provider,
      'api_key_configured',coalesce(v_runtime.api_key_configured,false),
      'billing_confirmed',true,
      'routes_api_enabled',coalesce(v_runtime.routes_api_enabled,false),
      'geocoding_api_enabled',coalesce(v_runtime.geocoding_api_enabled,false),
      'global_kill_switch_enabled',coalesce(v_runtime.kill_switch_enabled,true),
      'routes_provider_ready',v_routes_provider_ready,
      'geocoding_provider_ready',v_geocoding_provider_ready,
      'last_health_at',v_runtime.last_health_at,
      'last_error_code',v_runtime.last_error_code
    ),
    'capabilities',jsonb_build_object('routes_ready',v_routes_ready,'geocoding_ready',v_geocoding_ready),
    'usage',jsonb_build_object('period_start',v_period_start,'period_end',v_period_end,'items',jsonb_build_array(v_routes_usage,v_geocoding_usage)),
    'cost_tracking',jsonb_build_object(
      'provider_cost_micros',v_provider_cost,
      'customer_charge_micros',v_customer_charge,
      'reconciliation_pending',false
    ),
    'jobs',v_jobs || jsonb_build_object('recent_issues',v_recent_issues),
    'diagnostics',v_diagnostics
  );
end;
$$;

revoke all on function public.backend_get_store_smart_delivery_control_center(uuid,uuid) from public,anon,authenticated;
grant execute on function public.backend_get_store_smart_delivery_control_center(uuid,uuid) to service_role;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='comandiva-smart-delivery-worker' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule(
    'comandiva-smart-delivery-worker',
    '* * * * *',
    $cron$
      select case
        when (
          select coalesce(r.api_key_configured and r.billing_confirmed and (r.routes_api_enabled or r.geocoding_api_enabled) and not r.kill_switch_enabled,false)
          from private.maps_provider_runtime_readiness r
          where r.provider='openrouteservice' and r.environment='production'
        ) then (
          with prepared as (select private.prepare_smart_delivery_jobs(100) as count)
          select net.http_post(
            url := (select decrypted_secret from vault.decrypted_secrets where name='comandiva_project_url' limit 1) || '/functions/v1/comandiva-smart-delivery-worker',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'x-comandiva-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='comandiva_smart_delivery_worker_secret' limit 1)
            ),
            body := jsonb_build_object('source','cron','prepared',(select count from prepared)),
            timeout_milliseconds := 20000
          )
        ) else null::bigint
      end as request_id;
    $cron$
  );
end $$;
