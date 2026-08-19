create table if not exists private.smart_delivery_store_controls (
  store_id uuid primary key references public.stores(id) on delete cascade,
  is_paused boolean not null default false,
  pause_reason text,
  paused_at timestamptz,
  paused_by uuid references public.user_profiles(id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smart_delivery_store_controls_reason_check check (pause_reason is null or char_length(pause_reason) <= 240),
  constraint smart_delivery_store_controls_version_check check (version >= 1),
  constraint smart_delivery_store_controls_pause_state_check check (
    (is_paused and paused_at is not null) or (not is_paused and paused_at is null)
  )
);

alter table private.smart_delivery_store_controls enable row level security;
alter table private.smart_delivery_store_controls force row level security;
revoke all on private.smart_delivery_store_controls from public, anon, authenticated;
grant select, insert, update, delete on private.smart_delivery_store_controls to service_role;

create index if not exists smart_delivery_store_controls_paused_by_idx
  on private.smart_delivery_store_controls(paused_by)
  where paused_by is not null;

-- FK-covering indexes: existing operational indexes are store-first and do not
-- cover the referenced column as the leading key for FK maintenance.
create index if not exists smart_delivery_jobs_address_fk_idx
  on private.smart_delivery_jobs(address_id)
  where address_id is not null;
create index if not exists smart_delivery_jobs_delivery_fk_idx
  on private.smart_delivery_jobs(delivery_id)
  where delivery_id is not null;

create or replace function private.is_store_manager_actor(
  _actor_user_id uuid,
  _store_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select _actor_user_id is not null
     and _store_id is not null
     and exists (
       select 1
       from public.user_profiles p
       join public.user_roles r on r.user_id = p.id
       where p.id = _actor_user_id
         and p.is_active
         and r.is_active
         and r.store_id = _store_id
         and r.role in ('proprietario','gerente')
     );
$$;

revoke all on function private.is_store_manager_actor(uuid,uuid) from public, anon, authenticated;
grant execute on function private.is_store_manager_actor(uuid,uuid) to service_role;

create or replace function private.is_smart_delivery_store_paused(_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce((
    select c.is_paused
    from private.smart_delivery_store_controls c
    where c.store_id = _store_id
  ), false);
$$;

revoke all on function private.is_smart_delivery_store_paused(uuid) from public, anon, authenticated;
grant execute on function private.is_smart_delivery_store_paused(uuid) to service_role;

create or replace function private.smart_delivery_geocoding_ready(_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select private.store_has_entitlement(_store_id,'delivery.smart')
    and not private.is_smart_delivery_store_paused(_store_id)
    and private.is_maps_feature_ready('google_maps','production','geocoding.address')
    and private.is_store_usage_allowed(_store_id,'google_maps','delivery.smart','geocoding.address',1);
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
    and private.is_maps_feature_ready('google_maps','production','routes.compute')
    and private.is_store_usage_allowed(_store_id,'google_maps','delivery.smart','routes.compute',1)
    and exists(
      select 1 from public.stores s
      where s.id=_store_id and s.latitude is not null and s.longitude is not null
    );
$$;

revoke all on function private.smart_delivery_geocoding_ready(uuid) from public, anon, authenticated;
revoke all on function private.smart_delivery_routes_ready(uuid) from public, anon, authenticated;
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
declare v_metric text := lower(btrim(_metric_code));
begin
  if v_metric not in ('routes.compute','geocoding.address') then return false; end if;
  if private.is_smart_delivery_store_paused(_store_id) then return false; end if;
  if not private.store_has_entitlement(_store_id,'delivery.smart') then return false; end if;
  if not private.is_maps_feature_ready('google_maps','production',v_metric) then return false; end if;
  return private.is_store_usage_allowed(_store_id,'google_maps','delivery.smart',v_metric,coalesce(_quantity,1));
end;
$$;

revoke all on function public.backend_check_smart_delivery_usage(uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.backend_check_smart_delivery_usage(uuid,text,numeric) to service_role;

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
begin
  select l.* into v_limit
  from private.integration_usage_limits l
  where l.store_id=_store_id
    and l.feature_code='delivery.smart'
    and l.metric_code=_metric_code
    and l.provider in ('google_maps','*')
  order by case when l.provider='google_maps' then 0 else 1 end
  limit 1;

  select coalesce(sum(c.quantity),0),
         coalesce(sum(c.provider_cost_micros),0),
         coalesce(sum(c.customer_charge_micros),0)
  into v_quantity,v_provider_cost,v_customer_charge
  from private.integration_usage_counters c
  where c.store_id=_store_id
    and c.provider='google_maps'
    and c.feature_code='delivery.smart'
    and c.metric_code=_metric_code
    and c.period_start=_period_start;

  return jsonb_build_object(
    'provider','google_maps',
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
    'next_unit_allowed',private.is_store_usage_allowed(_store_id,'google_maps','delivery.smart',_metric_code,1)
  );
end;
$$;

revoke all on function private.smart_delivery_usage_metric_snapshot(uuid,text,date) from public, anon, authenticated;
grant execute on function private.smart_delivery_usage_metric_snapshot(uuid,text,date) to service_role;

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
  v_reconciliation_pending boolean := false;
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
  where provider='google_maps' and environment='production';

  select * into v_control
  from private.smart_delivery_store_controls
  where store_id=_store_id;

  v_entitled := private.store_has_entitlement(_store_id,'delivery.smart');
  v_routes_usage := private.smart_delivery_usage_metric_snapshot(_store_id,'routes.compute',v_period_start);
  v_geocoding_usage := private.smart_delivery_usage_metric_snapshot(_store_id,'geocoding.address',v_period_start);
  v_routes_provider_ready := private.is_maps_feature_ready('google_maps','production','routes.compute');
  v_geocoding_provider_ready := private.is_maps_feature_ready('google_maps','production','geocoding.address');
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
    'job_type',q.job_type,
    'status',q.status,
    'attempts',q.attempts,
    'max_attempts',q.max_attempts,
    'error_code',q.last_error_code,
    'updated_at',q.updated_at
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
  where c.store_id=_store_id and c.provider='google_maps' and c.feature_code='delivery.smart' and c.period_start=v_period_start;

  select exists(
    select 1 from private.integration_usage_events e
    where e.store_id=_store_id and e.provider='google_maps' and e.feature_code='delivery.smart'
      and e.occurred_at >= v_period_start::timestamp
      and e.occurred_at < (v_period_end + 1)::timestamp
      and coalesce((e.metadata->>'provider_cost_reconciliation_pending')::boolean,false)
  ) into v_reconciliation_pending;

  if not v_entitled then v_diagnostics := v_diagnostics || '"addon_not_entitled"'::jsonb; end if;
  if coalesce(v_control.is_paused,false) then v_diagnostics := v_diagnostics || '"store_paused"'::jsonb; end if;
  if coalesce(v_runtime.kill_switch_enabled,true) then v_diagnostics := v_diagnostics || '"provider_global_kill_switch"'::jsonb; end if;
  if not coalesce(v_runtime.api_key_configured,false) then v_diagnostics := v_diagnostics || '"api_key_missing"'::jsonb; end if;
  if not coalesce(v_runtime.billing_confirmed,false) then v_diagnostics := v_diagnostics || '"billing_not_confirmed"'::jsonb; end if;
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
      'code','google_maps',
      'api_key_configured',coalesce(v_runtime.api_key_configured,false),
      'billing_confirmed',coalesce(v_runtime.billing_confirmed,false),
      'routes_api_enabled',coalesce(v_runtime.routes_api_enabled,false),
      'geocoding_api_enabled',coalesce(v_runtime.geocoding_api_enabled,false),
      'global_kill_switch_enabled',coalesce(v_runtime.kill_switch_enabled,true),
      'routes_provider_ready',v_routes_provider_ready,
      'geocoding_provider_ready',v_geocoding_provider_ready,
      'last_health_at',v_runtime.last_health_at,
      'last_error_code',v_runtime.last_error_code
    ),
    'capabilities',jsonb_build_object(
      'routes_ready',v_routes_ready,
      'geocoding_ready',v_geocoding_ready
    ),
    'usage',jsonb_build_object(
      'period_start',v_period_start,
      'period_end',v_period_end,
      'items',jsonb_build_array(v_routes_usage,v_geocoding_usage)
    ),
    'cost_tracking',jsonb_build_object(
      'provider_cost_micros',v_provider_cost,
      'customer_charge_micros',v_customer_charge,
      'reconciliation_pending',v_reconciliation_pending
    ),
    'jobs',v_jobs || jsonb_build_object('recent_issues',v_recent_issues),
    'diagnostics',v_diagnostics
  );
end;
$$;

create or replace function public.backend_set_store_smart_delivery_pause(
  _actor_user_id uuid,
  _store_id uuid,
  _paused boolean,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_reason text := left(nullif(btrim(coalesce(_reason,'')),''),240);
  v_row private.smart_delivery_store_controls%rowtype;
  v_cancelled integer := 0;
begin
  if not private.is_store_manager_actor(_actor_user_id,_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if _paused is null then raise exception 'INVALID_PAUSE_STATE' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(_store_id::text||':smart-delivery-control',20260819));

  insert into private.smart_delivery_store_controls(
    store_id,is_paused,pause_reason,paused_at,paused_by,version,updated_at
  ) values (
    _store_id,_paused,case when _paused then v_reason else null end,
    case when _paused then now() else null end,
    case when _paused then _actor_user_id else null end,1,now()
  )
  on conflict (store_id) do update
  set is_paused=excluded.is_paused,
      pause_reason=excluded.pause_reason,
      paused_at=excluded.paused_at,
      paused_by=excluded.paused_by,
      version=private.smart_delivery_store_controls.version+1,
      updated_at=now()
  returning * into v_row;

  if _paused then
    update private.smart_delivery_jobs j
    set status='cancelled',completed_at=now(),locked_at=null,locked_until=null,locked_by=null,
        last_error_code='store_paused',last_error_message='Smart Delivery paused by store manager',updated_at=now()
    where j.store_id=_store_id and j.status in ('queued','retry');
    get diagnostics v_cancelled = row_count;
  end if;

  insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context)
  values(
    _store_id,_actor_user_id,'loja',
    case when _paused then 'smart_delivery_paused' else 'smart_delivery_resumed' end,
    'smart_delivery_store_controls',_store_id,
    jsonb_build_object('paused',_paused,'cancelled_pending_jobs',v_cancelled,'reason',case when _paused then v_reason else null end)
  );

  return jsonb_build_object(
    'store_id',_store_id,
    'is_paused',v_row.is_paused,
    'pause_reason',v_row.pause_reason,
    'paused_at',v_row.paused_at,
    'version',v_row.version,
    'cancelled_pending_jobs',v_cancelled
  );
end;
$$;

revoke all on function public.backend_get_store_smart_delivery_control_center(uuid,uuid) from public, anon, authenticated;
revoke all on function public.backend_set_store_smart_delivery_pause(uuid,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.backend_get_store_smart_delivery_control_center(uuid,uuid) to service_role;
grant execute on function public.backend_set_store_smart_delivery_pause(uuid,uuid,boolean,text) to service_role;

-- Existing member-facing readiness stays backwards-compatible, but its final
-- route readiness now uses the hardened per-store pause/quota gate.
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
    'ready_for_smart_routes',private.smart_delivery_routes_ready(v_sid),
    'last_health_at',v_runtime.last_health_at,
    'last_error_code',v_runtime.last_error_code
  );
end;
$$;