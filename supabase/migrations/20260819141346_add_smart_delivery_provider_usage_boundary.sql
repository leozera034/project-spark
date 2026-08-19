create or replace function private.is_maps_feature_ready(
  _provider text,
  _environment text,
  _metric_code text
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
       and not r.kill_switch_enabled
       and case lower(btrim(_metric_code))
         when 'routes.compute' then r.routes_api_enabled
         when 'geocoding.address' then r.geocoding_api_enabled
         else false
       end
    from private.maps_provider_runtime_readiness r
    where r.provider=lower(btrim(_provider))
      and r.environment=lower(btrim(_environment))
  ),false);
$$;

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
  if not private.store_has_entitlement(_store_id,'delivery.smart') then return false; end if;
  if not private.is_maps_feature_ready('google_maps','production',v_metric) then return false; end if;
  return private.is_store_usage_allowed(_store_id,'google_maps','delivery.smart',v_metric,coalesce(_quantity,1));
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
declare v_metric text := lower(btrim(_metric_code));
begin
  if v_metric not in ('routes.compute','geocoding.address') then
    raise exception 'INVALID_SMART_DELIVERY_METRIC' using errcode='22023';
  end if;
  if not private.store_has_entitlement(_store_id,'delivery.smart') then
    raise exception 'ADDON_ENTITLEMENT_REQUIRED' using errcode='42501';
  end if;
  return private.record_integration_usage(
    _store_id,'google_maps','delivery.smart',v_metric,coalesce(_quantity,1),
    greatest(coalesce(_provider_cost_micros,0),0),greatest(coalesce(_customer_charge_micros,0),0),
    nullif(btrim(_idempotency_key),''),now(),coalesce(_metadata,'{}'::jsonb)
  );
end;
$$;

revoke all on function private.is_maps_feature_ready(text,text,text) from public,anon,authenticated;
grant execute on function private.is_maps_feature_ready(text,text,text) to service_role;

revoke all on function public.backend_check_smart_delivery_usage(uuid,text,numeric) from public,anon,authenticated;
revoke all on function public.backend_record_smart_delivery_usage(uuid,text,numeric,bigint,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_check_smart_delivery_usage(uuid,text,numeric) to service_role;
grant execute on function public.backend_record_smart_delivery_usage(uuid,text,numeric,bigint,bigint,text,jsonb) to service_role;
