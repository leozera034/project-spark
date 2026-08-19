-- Normalize the courier vehicle contract and expose route estimates safely.

update public.couriers
set vehicle = case
  when vehicle is null or btrim(vehicle) = '' then 'nao_informado'
  when lower(btrim(vehicle)) ~ '(moto|motorcycle|scooter|two[_ -]?wheel)' then 'moto'
  when lower(btrim(vehicle)) ~ '(carro|car|auto|automovel|automóvel)' then 'carro'
  else 'nao_informado'
end,
updated_at = now()
where vehicle is null
   or btrim(vehicle) = ''
   or lower(btrim(vehicle)) not in ('moto','carro','nao_informado');

alter table public.couriers alter column vehicle set default 'nao_informado';
alter table public.couriers alter column vehicle set not null;
alter table public.couriers drop constraint if exists couriers_vehicle_check;
alter table public.couriers add constraint couriers_vehicle_check check (vehicle in ('moto','carro','nao_informado'));

create or replace function private.delivery_route_mode(_delivery_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case c.vehicle
    when 'moto' then 'two_wheeler'
    when 'carro' then 'drive'
    else null
  end
  from public.deliveries d
  left join public.couriers c on c.id=d.courier_id and c.store_id=d.store_id
  where d.id=_delivery_id;
$$;

create or replace function private.local_route_estimate(
  _origin_latitude numeric,
  _origin_longitude numeric,
  _destination_latitude numeric,
  _destination_longitude numeric,
  _travel_mode text default 'unknown'
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = pg_catalog, private
as $$
declare
  v_mode text := lower(btrim(coalesce(_travel_mode,'unknown')));
  v_straight integer;
  v_factor numeric;
  v_speed_kmh numeric;
  v_distance integer;
  v_duration integer;
begin
  if v_mode not in ('drive','two_wheeler','bicycle','walk','unknown') then
    raise exception 'INVALID_TRAVEL_MODE' using errcode='22023';
  end if;
  v_straight := private.haversine_distance_meters(
    _origin_latitude,_origin_longitude,_destination_latitude,_destination_longitude
  );
  v_factor := case v_mode when 'walk' then 1.15 when 'bicycle' then 1.20 else 1.25 end;
  v_speed_kmh := case v_mode
    when 'walk' then 4.5
    when 'bicycle' then 15
    when 'two_wheeler' then 30
    else 28
  end;
  v_distance := ceil(v_straight * v_factor)::integer;
  v_duration := case when v_distance=0 then 0 else ceil(v_distance / ((v_speed_kmh*1000)/3600))::integer end;
  return jsonb_build_object(
    'source','local_approximation','provider','local_haversine','travel_mode',v_mode,
    'straight_line_meters',v_straight,'distance_meters',v_distance,
    'duration_seconds',v_duration,'is_approximate',true
  );
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
  v_mode text;
  v_lat numeric;
  v_lon numeric;
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
  v_mode := coalesce(private.delivery_route_mode(_delivery_id),'unknown');
  v_estimate := private.local_route_estimate(v_store.latitude,v_store.longitude,v_lat,v_lon,v_mode);
  update public.deliveries
  set route_distance_meters=(v_estimate->>'distance_meters')::integer,
      route_duration_seconds=(v_estimate->>'duration_seconds')::integer,
      route_provider='local_haversine',route_mode=v_mode,route_estimated_at=now(),route_is_approximate=true,
      route_metadata=jsonb_build_object(
        'straight_line_meters',(v_estimate->>'straight_line_meters')::integer,
        'source','local_approximation',
        'coordinate_source',coalesce(v_order.address_snapshot->>'locationSource',v_address.location_source),
        'vehicle_known',(v_mode<>'unknown')
      ),updated_at=now()
  where id=_delivery_id and (route_provider is null or route_provider='local_haversine');
  return jsonb_build_object('updated',true,'estimate',v_estimate);
end;
$$;

create or replace function private.delivery_route_operational_projection(_delivery_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when d.id is null or d.route_distance_meters is null or d.route_duration_seconds is null then null
    else jsonb_build_object(
      'distanceMeters',d.route_distance_meters,'durationSeconds',d.route_duration_seconds,
      'estimatedMinutes',ceil(d.route_duration_seconds/60.0)::integer,'provider',d.route_provider,
      'mode',d.route_mode,'isApproximate',d.route_is_approximate,
      'quality',case when d.route_is_approximate then 'approximate' else 'provider_route' end,
      'estimatedAt',d.route_estimated_at
    )
  end
  from public.deliveries d where d.id=_delivery_id;
$$;

create or replace function private.delivery_route_public_projection(_delivery_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when d.id is null or d.route_distance_meters is null or d.route_duration_seconds is null then null
    else jsonb_build_object(
      'distanceMeters',d.route_distance_meters,'durationSeconds',d.route_duration_seconds,
      'estimatedMinutes',ceil(d.route_duration_seconds/60.0)::integer,'isApproximate',d.route_is_approximate,
      'quality',case when d.route_is_approximate then 'approximate' else 'provider_route' end,
      'estimatedAt',d.route_estimated_at
    )
  end
  from public.deliveries d where d.id=_delivery_id;
$$;

create or replace function private.provision_store_courier_v2(
  _actor_user_id uuid,_store_id uuid,_auth_user_id uuid,_full_name text,_phone text,
  _login_identifier text,_synthetic_email text,_vehicle text,_can_accept_deliveries boolean,
  _is_active boolean,_idempotency_key text,_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare _intent public.courier_provisioning_intents; _courier public.couriers; _phone_digits text; _name text; _vehicle_norm text;
begin
  if _actor_user_id is null or _store_id is null or _auth_user_id is null then raise exception 'INVALID_INPUT' using errcode='P0001'; end if;
  if not exists (select 1 from public.user_profiles p where p.id=_actor_user_id and p.is_active)
     or not exists (select 1 from public.user_roles r where r.user_id=_actor_user_id and r.is_active and r.store_id=_store_id and r.role=any(private.permission_roles('couriers.create')))
  then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  _name:=nullif(btrim(coalesce(_full_name,'')),'');
  if _name is null or length(_name)<3 or length(_name)>80 then raise exception 'INVALID_NAME' using errcode='P0001'; end if;
  _phone_digits:=regexp_replace(coalesce(_phone,''),'\D','','g');
  if length(_phone_digits)<10 or length(_phone_digits)>13 then raise exception 'INVALID_PHONE' using errcode='P0001'; end if;
  _vehicle_norm:=lower(btrim(coalesce(_vehicle,'')));
  if _vehicle_norm not in ('moto','carro') then raise exception 'INVALID_VEHICLE' using errcode='P0001'; end if;
  select * into _intent from public.courier_provisioning_intents i where i.store_id=_store_id and i.idempotency_key=_idempotency_key for update;
  if found then
    if _intent.request_hash<>_request_hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='P0001'; end if;
    if _intent.status='concluida' and _intent.courier_id is not null then return jsonb_build_object('courierId',_intent.courier_id,'created',false); end if;
  else
    insert into public.courier_provisioning_intents(store_id,idempotency_key,request_hash) values(_store_id,_idempotency_key,_request_hash) returning * into _intent;
  end if;
  if exists(select 1 from public.couriers c where c.user_id=_auth_user_id)
     or exists(select 1 from public.courier_auth_identities i where i.login_identifier=_login_identifier)
     or exists(select 1 from public.couriers c where c.store_id=_store_id and c.phone=_phone_digits)
  then
    update public.courier_provisioning_intents set status='falha',updated_at=now() where id=_intent.id;
    raise exception 'COURIER_LINK_UNAVAILABLE' using errcode='P0001';
  end if;
  insert into public.user_profiles(id,full_name,display_name,phone,is_active)
  values(_auth_user_id,_name,split_part(_name,' ',1),_phone_digits,true)
  on conflict(id) do update set full_name=excluded.full_name,updated_at=now();
  insert into public.user_roles(user_id,store_id,role,is_active)
  values(_auth_user_id,_store_id,'entregador',coalesce(_is_active,true))
  on conflict(user_id,store_id,role) where store_id is not null do update set is_active=excluded.is_active,updated_at=now();
  insert into public.couriers(store_id,user_id,full_name,phone,vehicle,status,can_accept_deliveries)
  values(_store_id,_auth_user_id,_name,_phone_digits,_vehicle_norm,
    case when coalesce(_is_active,true) then 'ativo' else 'inativo' end::public.courier_status,
    coalesce(_can_accept_deliveries,true)) returning * into _courier;
  insert into public.courier_auth_identities(store_id,courier_id,auth_user_id,login_identifier,synthetic_email,requires_password_change,is_login_enabled,temporary_password_issued_at)
  values(_store_id,_courier.id,_auth_user_id,_login_identifier,_synthetic_email,true,coalesce(_is_active,true),now());
  update public.courier_provisioning_intents set status='concluida',courier_id=_courier.id,updated_at=now() where id=_intent.id;
  insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context)
  values(_store_id,_actor_user_id,'loja','courier.created','couriers',_courier.id,
    jsonb_build_object('fields',to_jsonb(array['full_name','phone','login_identifier','vehicle','can_accept_deliveries','status'])));
  perform private.emit_store_event(_store_id,'courier',_courier.id,'courier.created',_courier.version);
  return jsonb_build_object('courierId',_courier.id,'created',true);
end;
$$;

create or replace function public.provision_store_courier_admin_v2(
  _actor_user_id uuid,_store_id uuid,_auth_user_id uuid,_full_name text,_phone text,
  _login_identifier text,_synthetic_email text,_vehicle text,_can_accept_deliveries boolean,
  _is_active boolean,_idempotency_key text,_request_hash text
)
returns jsonb
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select private.provision_store_courier_v2(
    _actor_user_id,_store_id,_auth_user_id,_full_name,_phone,_login_identifier,_synthetic_email,
    _vehicle,_can_accept_deliveries,_is_active,_idempotency_key,_request_hash
  )
$$;
revoke all on function public.provision_store_courier_admin_v2(uuid,uuid,uuid,text,text,text,text,text,boolean,boolean,text,text) from public, anon, authenticated;
grant execute on function public.provision_store_courier_admin_v2(uuid,uuid,uuid,text,text,text,text,text,boolean,boolean,text,text) to service_role;

create or replace function public.update_store_courier_profile(
  _store_id uuid,_courier_id uuid,_expected_version integer,_full_name text,_phone text,
  _vehicle text,_can_accept_deliveries boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare _store uuid; _c public.couriers; _u public.couriers; _name text; _phone_digits text; _vehicle_norm text; _fields text[]:='{}';
begin
  _store:=private.resolve_store(_store_id); perform private.require_permission('couriers.update',_store);
  select * into _c from public.couriers c where c.id=_courier_id and c.store_id=_store;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _expected_version is null or _expected_version<>_c.version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  _name:=nullif(btrim(coalesce(_full_name,'')),'');
  if _name is null or length(_name)<3 or length(_name)>80 then raise exception 'INVALID_NAME' using errcode='P0001'; end if;
  _phone_digits:=regexp_replace(coalesce(_phone,''),'\D','','g');
  if length(_phone_digits)<10 or length(_phone_digits)>13 then raise exception 'INVALID_PHONE' using errcode='P0001'; end if;
  _vehicle_norm:=lower(btrim(coalesce(_vehicle,'')));
  if _vehicle_norm not in ('moto','carro') then raise exception 'INVALID_VEHICLE' using errcode='P0001'; end if;
  if _name<>_c.full_name then _fields:=_fields||'full_name'; end if;
  if _phone_digits<>_c.phone then _fields:=_fields||'phone'; end if;
  if _vehicle_norm<>_c.vehicle then _fields:=_fields||'vehicle'; end if;
  if coalesce(_can_accept_deliveries,_c.can_accept_deliveries)<>_c.can_accept_deliveries then _fields:=_fields||'can_accept_deliveries'; end if;
  update public.couriers c set full_name=_name,phone=_phone_digits,vehicle=_vehicle_norm,
    can_accept_deliveries=coalesce(_can_accept_deliveries,c.can_accept_deliveries),version=c.version+1,updated_at=now()
  where c.id=_courier_id and c.store_id=_store and c.version=_expected_version returning * into _u;
  if not found then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  perform private.log_config_audit(_store,'courier.updated','couriers',_courier_id,_fields);
  perform private.emit_store_event(_store,'courier',_courier_id,'courier.updated',_u.version);
  return public.get_my_store_courier_detail(_store,_courier_id);
exception when unique_violation then raise exception 'PHONE_ALREADY_USED' using errcode='P0001';
end;
$$;
revoke all on function public.update_store_courier_profile(uuid,uuid,integer,text,text,text,boolean) from public, anon;
grant execute on function public.update_store_courier_profile(uuid,uuid,integer,text,text,text,boolean) to authenticated, service_role;

create or replace function public.list_my_store_couriers(_store_id uuid, _account text default null, _presence text default null, _availability text default null)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare _store uuid; _rows jsonb;
begin
  _store:=private.resolve_store(_store_id); perform private.require_permission('couriers.view',_store);
  select coalesce(jsonb_agg(x order by x->>'displayName'),'[]'::jsonb) into _rows from (
    select jsonb_build_object('courierId',c.id,'displayName',c.full_name,'phoneMasked',private.mask_phone(c.phone),
      'vehicle',c.vehicle,'isActive',(c.status='ativo'),'canAcceptDeliveries',c.can_accept_deliveries,
      'presenceStatus',case when c.is_online then 'online' else 'offline' end,'lastSeenAt',c.last_seen_at,
      'currentAssignment',case when d.id is null then null else jsonb_build_object('deliveryId',d.id,'orderNumber',o.order_number,'deliveryStatus',d.status::text,'assignedAt',d.assigned_at) end,
      'createdAt',c.created_at,'updatedAt',c.updated_at,'version',c.version,'allowedActions',to_jsonb(private.courier_allowed_actions(_store,c.status))) as x
    from public.couriers c left join public.deliveries d on d.store_id=c.store_id and d.courier_id=c.id and d.status in ('atribuida','aceita','coletada','em_rota')
    left join public.orders o on o.id=d.order_id and o.store_id=d.store_id
    where c.store_id=_store and (_account is null or c.status::text=_account)
      and (_presence is null or (_presence='online')=c.is_online)
      and (_availability is null or (_availability='ocupado')=(d.id is not null))
  ) s;
  return jsonb_build_object('storeId',_store,'serverNow',now(),'couriers',_rows);
end; $$;

create or replace function public.get_my_store_courier_detail(_store_id uuid, _courier_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare _store uuid; _c public.couriers; _identity public.courier_auth_identities; _d public.deliveries; _hist jsonb;
begin
  _store:=private.resolve_store(_store_id); perform private.require_permission('couriers.view',_store);
  select * into _c from public.couriers c where c.id=_courier_id and c.store_id=_store;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  select * into _identity from public.courier_auth_identities i where i.courier_id=_c.id and i.store_id=_store;
  select * into _d from public.deliveries d where d.store_id=_store and d.courier_id=_c.id and d.status in ('atribuida','aceita','coletada','em_rota') limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('occurredAt',a.created_at,'action',a.action,'fields',a.context->'fields','reasonCode',a.context->>'reasonCode') order by a.created_at desc),'[]'::jsonb)
  into _hist from public.audit_logs a where a.store_id=_store and a.entity='couriers' and a.entity_id=_c.id limit 50;
  return jsonb_build_object('courierId',_c.id,'displayName',_c.full_name,'phone',_c.phone,'vehicle',_c.vehicle,
    'loginIdentifier',_identity.login_identifier,'loginEnabled',coalesce(_identity.is_login_enabled,false),
    'requiresPasswordChange',coalesce(_identity.requires_password_change,false),'isActive',(_c.status='ativo'),
    'canAcceptDeliveries',_c.can_accept_deliveries,'presenceStatus',case when _c.is_online then 'online' else 'offline' end,
    'lastSeenAt',_c.last_seen_at,'currentAssignment',case when _d.id is null then null else jsonb_build_object(
      'deliveryId',_d.id,'deliveryStatus',_d.status::text,'orderNumber',(select o.order_number from public.orders o where o.id=_d.order_id and o.store_id=_store),
      'assignedAt',_d.assigned_at,'route',private.delivery_route_operational_projection(_d.id)) end,
    'createdAt',_c.created_at,'updatedAt',_c.updated_at,'version',_c.version,'history',_hist,
    'allowedActions',to_jsonb(private.courier_allowed_actions(_store,_c.status)));
end; $$;

create or replace function public.list_eligible_couriers_for_delivery(_store_id uuid, _order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare _store uuid; _o public.orders; _rows jsonb;
begin
  _store:=private.resolve_store(_store_id); perform private.require_permission('couriers.assign',_store);
  select * into _o from public.orders o where o.id=_order_id and o.store_id=_store;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _o.fulfillment<>'entrega' then raise exception 'NOT_A_DELIVERY_ORDER' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(x order by x->>'displayName'),'[]'::jsonb) into _rows from (
    select jsonb_build_object('courierId',c.id,'displayName',c.full_name,'vehicle',c.vehicle,
      'presenceStatus',case when c.is_online then 'online' else 'offline' end,'lastSeenAt',c.last_seen_at,
      'canAcceptDeliveries',c.can_accept_deliveries,'hasActiveDelivery',(private.courier_active_delivery_id(c.id,_store) is not null),
      'eligibility',case when c.status<>'ativo' then 'blocked' when c.vehicle='nao_informado' then 'blocked'
        when not c.can_accept_deliveries then 'blocked' when private.courier_active_delivery_id(c.id,_store) is not null then 'blocked'
        when not c.is_online then 'confirm' else 'eligible' end,
      'blockingReason',case when c.status<>'ativo' then 'conta_inativa' when c.vehicle='nao_informado' then 'veiculo_nao_informado'
        when not c.can_accept_deliveries then 'sem_permissao_de_aceite' when private.courier_active_delivery_id(c.id,_store) is not null then 'entrega_ativa'
        when not c.is_online then 'offline' else null end,'version',c.version) as x from public.couriers c where c.store_id=_store
  ) s;
  return jsonb_build_object('storeId',_store,'orderId',_order_id,'couriers',_rows);
end; $$;

create or replace function public.get_store_delivery_assignment(_store_id uuid, _order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare _store uuid; _o public.orders; _d public.deliveries; _c public.couriers; _events jsonb;
begin
  _store:=private.resolve_store(_store_id); perform private.require_permission('couriers.view',_store);
  select * into _o from public.orders o where o.id=_order_id and o.store_id=_store;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _o.fulfillment<>'entrega' then return jsonb_build_object('applicable',false); end if;
  select * into _d from public.deliveries d where d.store_id=_store and d.order_id=_order_id;
  if _d.courier_id is not null then select * into _c from public.couriers c where c.id=_d.courier_id and c.store_id=_store; end if;
  select coalesce(jsonb_agg(jsonb_build_object('occurredAt',e.created_at,'kind',e.kind::text,'reasonCode',e.reason_code,
    'courierName',(select cc.full_name from public.couriers cc where cc.id=e.courier_id and cc.store_id=_store),
    'previousCourierName',(select pc.full_name from public.couriers pc where pc.id=e.previous_courier_id and pc.store_id=_store),'version',e.delivery_version)
    order by e.created_at desc),'[]'::jsonb) into _events from public.delivery_events e where e.store_id=_store and e.delivery_id=_d.id;
  return jsonb_build_object('applicable',true,'orderStatus',_o.status::text,
    'delivery',case when _d.id is null then null else jsonb_build_object('deliveryId',_d.id,'status',_d.status::text,'version',_d.version,'assignedAt',_d.assigned_at,
      'route',private.delivery_route_operational_projection(_d.id),'courier',case when _c.id is null then null else jsonb_build_object(
        'courierId',_c.id,'displayName',_c.full_name,'vehicle',_c.vehicle,'presenceStatus',case when _c.is_online then 'online' else 'offline' end,'isActive',(_c.status='ativo')) end,
      'history',_events) end,'canAssign',private.has_permission('couriers.assign',_store));
end; $$;

create or replace function private.courier_delivery_projection(_store uuid, _courier uuid, _delivery_id uuid, _reduced boolean)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare _d public.deliveries; _o public.orders; _s public.stores; _c public.couriers; _acceptance boolean; _occ jsonb; _blocking boolean; _actions text[]; _addr jsonb;
begin
  select * into _d from public.deliveries d where d.id=_delivery_id and d.store_id=_store and d.courier_id=_courier;
  if not found then return null; end if;
  select * into _o from public.orders o where o.id=_d.order_id and o.store_id=_store;
  select * into _s from public.stores s where s.id=_store;
  select * into _c from public.couriers c where c.id=_courier and c.store_id=_store;
  _acceptance:=_s.courier_acceptance_required;
  select coalesce(jsonb_agg(jsonb_build_object('occurrenceId',x.id,'code',x.code,'note',x.note,'requiresStoreAttention',x.requires_store_attention,'resolvedAt',x.resolved_at,'createdAt',x.created_at,'version',x.version) order by x.created_at desc),'[]'::jsonb)
  into _occ from public.delivery_occurrences x where x.store_id=_store and x.delivery_id=_d.id;
  select exists(select 1 from public.delivery_occurrences x where x.store_id=_store and x.delivery_id=_d.id and x.requires_store_attention and x.resolved_at is null) into _blocking;
  _actions:=array[]::text[];
  if _d.status='atribuida' and _acceptance then _actions:=array['accept','decline'];
  elsif _d.status in ('atribuida','aceita') then if _d.arrived_at_store_at is null then _actions:=array['confirm_arrival']; else _actions:=array['confirm_pickup']; end if; _actions:=_actions||array['report_occurrence'];
  elsif _d.status='coletada' then _actions:=array['start_delivery','report_occurrence'];
  elsif _d.status='em_rota' then _actions:=array['report_occurrence']; if not _blocking then _actions:=array['complete_delivery']||_actions; end if; end if;
  if _reduced then return jsonb_build_object('deliveryId',_d.id,'reduced',true,'status',_d.status::text,'version',_d.version,
    'assignedAt',_d.assigned_at,'orderNumber',_o.order_number,'storeName',_s.name,'neighborhood',_o.neighborhood_snapshot,
    'vehicle',_c.vehicle,'route',private.delivery_route_operational_projection(_d.id),'allowedActions',to_jsonb(_actions)); end if;
  _addr:=coalesce(_o.address_snapshot,'{}'::jsonb);
  return jsonb_build_object('deliveryId',_d.id,'reduced',false,'status',_d.status::text,'version',_d.version,'orderId',_o.id,
    'orderNumber',_o.order_number,'orderStatus',_o.status::text,'orderVersion',_o.version,'acceptanceRequired',_acceptance,
    'assignedAt',_d.assigned_at,'acceptedAt',_d.accepted_at,'arrivedAtStoreAt',_d.arrived_at_store_at,'pickedUpAt',_d.picked_up_at,'startedAt',_d.started_at,'completedAt',_d.completed_at,
    'vehicle',_c.vehicle,'route',private.delivery_route_operational_projection(_d.id),'pickup',jsonb_build_object('storeName',_s.name,'address',_s.address_line,'phone',_s.phone),
    'customer',jsonb_build_object('firstName',split_part(coalesce(_o.customer_name,''),' ',1),'phone',_o.customer_phone,'neighborhood',_o.neighborhood_snapshot,
      'street',_addr->>'street','number',_addr->>'number','complement',_addr->>'complement','reference',_addr->>'reference','notes',_o.customer_notes),
    'payment',jsonb_build_object('method',_o.payment_method_label,'kind',_o.payment_method_kind,'needsChange',coalesce(_o.payment_needs_change,false),'changeFor',_o.change_for,'orderAmount',_o.total_amount,'instructions',_o.payment_instructions),
    'occurrences',_occ,'requiresStoreAttention',_blocking,'allowedActions',to_jsonb(_actions));
end; $$;

create or replace function public.get_my_courier_operational_context()
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare _cid uuid; _sid uuid; _c public.couriers; _s public.stores; _d public.deliveries; _pending jsonb; _active jsonb; _acceptance boolean;
begin
  select courier_id,store_id into _cid,_sid from private.require_current_courier(); select * into _c from public.couriers c where c.id=_cid and c.store_id=_sid; select * into _s from public.stores s where s.id=_sid; _acceptance:=_s.courier_acceptance_required;
  select * into _d from public.deliveries d where d.store_id=_sid and d.courier_id=_cid and d.status in ('atribuida','aceita','coletada','em_rota') order by d.assigned_at desc limit 1;
  if _d.id is not null and _d.status='atribuida' and _acceptance then _pending:=private.courier_delivery_projection(_sid,_cid,_d.id,true); _active:=null;
  elsif _d.id is not null then _pending:=null; _active:=private.courier_delivery_projection(_sid,_cid,_d.id,false); else _pending:=null; _active:=null; end if;
  return jsonb_build_object('courierId',_c.id,'displayName',_c.full_name,'vehicle',_c.vehicle,'storeName',_s.name,'storePublicAddress',_s.address_line,'storePhone',_s.phone,
    'accountStatus',_c.status::text,'canAcceptDeliveries',_c.can_accept_deliveries,'acceptanceRequired',_acceptance,'onlineIntent',_c.is_online,
    'presenceStatus',private.courier_presence_status(_c.is_online,_c.last_seen_at),'lastSeenAt',_c.last_seen_at,'pendingAssignment',_pending,'activeDelivery',_active,'serverNow',now(),'version',_c.version);
end; $$;

create or replace function private.courier_vehicle_route_refresh_trigger()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_delivery_id uuid; v_mode text;
begin
  if old.vehicle is not distinct from new.vehicle then return new; end if;
  for v_delivery_id in select d.id from public.deliveries d where d.store_id=new.store_id and d.courier_id=new.id and d.status not in ('concluida','cancelada') loop
    v_mode:=private.delivery_route_mode(v_delivery_id);
    update private.smart_delivery_jobs j set status='cancelled',completed_at=now(),last_error_code='vehicle_changed',last_error_message='Vehicle changed before route execution.',updated_at=now()
      where j.delivery_id=v_delivery_id and j.job_type='compute_delivery_route' and j.status in ('queued','retry') and coalesce(j.metadata->>'travel_mode','') is distinct from coalesce(v_mode,'');
    update public.deliveries d set route_provider=null,route_distance_meters=null,route_duration_seconds=null,route_mode=null,route_estimated_at=null,route_is_approximate=true,route_metadata=jsonb_build_object('source','vehicle_changed'),updated_at=now()
      where d.id=v_delivery_id and (d.route_mode is distinct from coalesce(v_mode,'unknown'));
    perform private.refresh_delivery_local_route(v_delivery_id); perform private.queue_delivery_google_route(v_delivery_id);
  end loop; return new;
end; $$;
drop trigger if exists trg_courier_vehicle_route_refresh on public.couriers;
create trigger trg_courier_vehicle_route_refresh after update of vehicle on public.couriers for each row execute function private.courier_vehicle_route_refresh_trigger();

create or replace function public.backend_complete_smart_delivery_route_job(_job_id uuid,_worker_id text,_distance_meters integer,_duration_seconds integer,_travel_mode text,_request_id text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare j private.smart_delivery_jobs%rowtype; v_current_mode text;
begin
  select * into j from private.smart_delivery_jobs where id=_job_id and status='processing' and locked_by=btrim(_worker_id) and locked_until>now() for update;
  if not found or j.job_type<>'compute_delivery_route' then raise exception 'JOB_NOT_CLAIMED' using errcode='42501'; end if;
  if coalesce(_distance_meters,-1)<0 or coalesce(_duration_seconds,-1)<0 or _travel_mode not in ('drive','two_wheeler','bicycle','walk') then raise exception 'INVALID_ROUTE_RESULT'; end if;
  v_current_mode:=private.delivery_route_mode(j.delivery_id);
  if v_current_mode is null or v_current_mode is distinct from _travel_mode then
    update private.smart_delivery_jobs set status='cancelled',completed_at=now(),locked_at=null,locked_until=null,locked_by=null,last_error_code='stale_vehicle_mode',last_error_message='Route result no longer matches assigned vehicle.',updated_at=now() where id=j.id;
    return false;
  end if;
  update public.deliveries d set route_distance_meters=_distance_meters,route_duration_seconds=_duration_seconds,route_provider='google_maps',route_mode=_travel_mode,
    route_estimated_at=now(),route_is_approximate=false,route_metadata=jsonb_build_object('source','google_routes','request_id',left(coalesce(_request_id,''),80),'cached',false),updated_at=now()
  where d.id=j.delivery_id and d.store_id=j.store_id and d.status not in ('concluida','cancelada');
  perform private.record_integration_usage(j.store_id,'google_maps','delivery.smart','routes.compute',1,0,0,'smart-delivery:route:'||j.id::text,now(),jsonb_build_object('request_id',left(coalesce(_request_id,''),80),'provider_cost_reconciliation_pending',true));
  update private.smart_delivery_jobs set status='completed',completed_at=now(),locked_at=null,locked_until=null,locked_by=null,last_error_code=null,last_error_message=null,updated_at=now() where id=j.id;
  return true;
end; $$;

create or replace function public.get_my_store_order_detail(_store_id uuid, _order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare _store uuid; _o public.orders; _items jsonb; _contact boolean; _d public.deliveries;
begin
  _store:=private.resolve_store(_store_id); if not private.has_permission('orders.view_queue',_store) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  select * into _o from public.orders o where o.id=_order_id and o.store_id=_store; if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if; _contact:=private.has_permission('orders.view_customer_contact',_store);
  if _o.fulfillment='entrega' then select * into _d from public.deliveries d where d.store_id=_store and d.order_id=_o.id; end if;
  select coalesce(jsonb_agg(jsonb_build_object('productName',i.product_name,'variantName',i.variant_name,'quantity',i.quantity,'pricingUnit',i.pricing_unit::text,'unitPrice',i.unit_price,'lineTotal',i.line_total,'notes',i.notes,
    'options',coalesce((select jsonb_agg(jsonb_build_object('groupName',op.group_name,'optionName',op.option_name,'quantity',op.quantity) order by op.group_name,op.option_name) from public.order_item_options op where op.order_item_id=i.id and op.store_id=i.store_id),'[]'::jsonb)) order by i.sort_order),'[]'::jsonb)
  into _items from public.order_items i where i.order_id=_o.id and i.store_id=_store;
  return jsonb_build_object('id',_o.id,'orderNumber',_o.order_number,'createdAt',_o.created_at,'updatedAt',greatest(_o.updated_at,coalesce(_d.updated_at,_o.updated_at)),
    'status',_o.status::text,'publicCode',private.public_order_status_code(_o.status),'fulfillment',_o.fulfillment::text,'version',_o.version,'etaMinutes',_o.eta_minutes,
    'customer',jsonb_build_object('firstName',split_part(btrim(_o.customer_name),' ',1),'fullName',case when _contact then _o.customer_name else null end,'phone',case when _contact then coalesce(_o.customer_phone_display,_o.customer_phone) else null end),
    'delivery',case when _o.fulfillment='entrega' then jsonb_build_object('neighborhood',_o.neighborhood_snapshot,'address',case when _contact then _o.address_snapshot else null end,'route',private.delivery_route_operational_projection(_d.id)) else null end,
    'items',_items,'notes',_o.customer_notes,'payment',jsonb_build_object('label',_o.payment_method_label,'kind',_o.payment_method_kind,'changeFor',_o.change_for,'needsChange',_o.payment_needs_change,'instructions',_o.payment_instructions),
    'totals',jsonb_build_object('subtotal',_o.items_subtotal,'deliveryFee',_o.delivery_fee,'discount',_o.discount_total,'total',_o.total_amount),
    'resolution',jsonb_build_object('reasonCode',_o.reason_code,'internalNote',_o.internal_note,'customerMessage',_o.customer_visible_message),
    'isDelayed',(_o.status not in ('entregue','retirado','recusado','cancelado') and _o.eta_minutes is not null and now()>_o.created_at+make_interval(mins=>_o.eta_minutes+10)),
    'allowedActions',to_jsonb(private.order_allowed_actions(_o.status,_o.fulfillment,_store)));
end; $$;

create or replace function public.list_my_store_orders(_store_id uuid default null,_statuses text[] default null,_fulfillment text default null,_search text default null,_delayed_only boolean default false,_from timestamptz default null,_to timestamptz default null,_limit integer default 30,_cursor timestamptz default null,_cursor_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare _store uuid; _lim integer:=least(greatest(coalesce(_limit,30),1),50); _q text:=nullif(btrim(coalesce(_search,'')),''); _num integer:=null; _rows jsonb;
begin
  _store:=private.resolve_store(_store_id); if not private.has_permission('orders.view_queue',_store) then raise exception 'FORBIDDEN' using errcode='P0001'; end if; if _q is not null and _q~'^[0-9]+$' and length(_q)<=9 then _num:=_q::integer; end if;
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord),'[]'::jsonb) into _rows from (
    select o.created_at as ord,o.id as "id",o.order_number as "orderNumber",o.created_at as "createdAt",greatest(o.updated_at,coalesce(d.updated_at,o.updated_at)) as "updatedAt",o.status::text as "status",
      private.public_order_status_code(o.status) as "publicCode",o.fulfillment::text as "fulfillment",split_part(btrim(o.customer_name),' ',1) as "customerFirstName",
      (select count(*) from public.order_items i where i.order_id=o.id and i.store_id=o.store_id) as "itemCount",o.total_amount as "total",o.payment_method_label as "paymentLabel",o.eta_minutes as "etaMinutes",o.version as "version",
      private.delivery_route_operational_projection(d.id) as "route",
      (o.status not in ('entregue','retirado','recusado','cancelado') and o.eta_minutes is not null and now()>o.created_at+make_interval(mins=>o.eta_minutes+10)) as "isDelayed",
      greatest(0,(extract(epoch from (now()-o.created_at))/60)::int-coalesce(o.eta_minutes,0)-10) as "delayMinutes",to_jsonb(private.order_allowed_actions(o.status,o.fulfillment,o.store_id)) as "allowedActions"
    from public.orders o left join public.deliveries d on d.store_id=o.store_id and d.order_id=o.id
    where o.store_id=_store and (_statuses is null or o.status::text=any(_statuses)) and (_fulfillment is null or o.fulfillment::text=_fulfillment) and (_from is null or o.created_at>=_from) and (_to is null or o.created_at<=_to)
      and (_cursor is null or (o.created_at,o.id)<(_cursor,coalesce(_cursor_id,o.id)))
      and (_q is null or (_num is not null and o.order_number=_num) or o.customer_name ilike '%'||_q||'%' or (length(_q)>=4 and regexp_replace(o.customer_phone,'\D','','g') like '%'||regexp_replace(_q,'\D','','g')||'%' and private.has_permission('orders.view_customer_contact',_store)))
      and (not coalesce(_delayed_only,false) or (o.status not in ('entregue','retirado','recusado','cancelado') and o.eta_minutes is not null and now()>o.created_at+make_interval(mins=>o.eta_minutes+10)))
    order by o.created_at desc,o.id desc limit _lim
  ) t;
  return jsonb_build_object('storeId',_store,'orders',_rows,'limit',_lim);
end; $$;

create or replace function private.get_public_order_tracking(_token_hash text, _known_version text default null)
returns jsonb language plpgsql stable security definer set search_path = public, private, extensions as $$
declare v_order public.orders; v_store public.stores; v_settings public.store_settings; v_delivery public.deliveries; v_version text; v_code text; v_last timestamptz; v_items jsonb; v_timeline jsonb;
begin
  if _token_hash is null or _token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'error','not_found'); end if;
  select * into v_order from public.orders o where o.tracking_token_hash=_token_hash limit 1; if not found then return jsonb_build_object('ok',false,'error','not_found'); end if;
  select * into v_store from public.stores s where s.id=v_order.store_id; select * into v_settings from public.store_settings ss where ss.store_id=v_order.store_id;
  if v_order.fulfillment='entrega' then select * into v_delivery from public.deliveries d where d.store_id=v_order.store_id and d.order_id=v_order.id; end if;
  select max(h.created_at) into v_last from public.order_status_history h where h.order_id=v_order.id;
  v_last:=greatest(coalesce(v_last,v_order.updated_at),v_order.updated_at,coalesce(v_delivery.updated_at,v_order.updated_at)); v_code:=private.public_order_status_code(v_order.status);
  v_version:=encode(sha256(convert_to(v_order.status::text||'|'||v_order.version::text||'|'||v_last::text||'|'||coalesce(v_delivery.route_distance_meters::text,'')||'|'||coalesce(v_delivery.route_duration_seconds::text,'')||'|'||coalesce(v_delivery.route_is_approximate::text,''),'UTF8')),'hex');
  if _known_version is not null and _known_version=v_version then return jsonb_build_object('ok',true,'changed',false,'statusVersion',v_version); end if;
  select coalesce(jsonb_agg(item order by item->>'sortOrder'),'[]'::jsonb) into v_items from (
    select jsonb_build_object('sortOrder',lpad(oi.sort_order::text,6,'0'),'productName',oi.product_name,'variantName',oi.variant_name,'quantity',oi.quantity,'measurementUnit',oi.pricing_unit::text,'note',oi.notes,'lineTotal',oi.line_total,
      'options',coalesce((select jsonb_agg(jsonb_build_object('groupName',oo.group_name,'optionName',oo.option_name,'quantity',oo.quantity) order by oo.group_name,oo.option_name) from public.order_item_options oo where oo.order_item_id=oi.id and oo.store_id=oi.store_id),'[]'::jsonb)) as item
    from public.order_items oi where oi.order_id=v_order.id and oi.store_id=v_order.store_id) s;
  select coalesce(jsonb_agg(entry order by (entry->>'occurredAt')::timestamptz),'[]'::jsonb) into v_timeline from (
    select distinct on (private.public_order_status_code(h.to_status)) jsonb_build_object('code',private.public_order_status_code(h.to_status),'occurredAt',h.created_at) as entry
    from public.order_status_history h where h.order_id=v_order.id and h.store_id=v_order.store_id order by private.public_order_status_code(h.to_status),h.created_at) t;
  return jsonb_build_object('ok',true,'changed',true,'statusVersion',v_version,'orderNumber',v_order.order_number,'createdAt',v_order.created_at,'lastUpdatedAt',v_last,
    'store',jsonb_build_object('slug',v_store.slug,'name',v_store.name,'logoPath',v_settings.logo_path,'publicPhone',v_store.phone,'publicWhatsapp',v_store.whatsapp),
    'status',jsonb_build_object('publicCode',v_code,'isFinal',v_code in ('delivered','picked_up','declined','canceled'),'isSuccessful',v_code in ('delivered','picked_up'),'publicMessage',v_order.customer_visible_message),
    'fulfillment',jsonb_build_object('type',v_order.fulfillment::text,'neighborhoodName',v_order.neighborhood_snapshot,'estimatedMinutes',v_order.eta_minutes,'route',private.delivery_route_public_projection(v_delivery.id)),
    'items',v_items,'totals',jsonb_build_object('subtotal',v_order.items_subtotal,'deliveryFee',v_order.delivery_fee,'total',v_order.total_amount),
    'payment',jsonb_build_object('displayName',v_order.payment_method_label,'publicInstructions',v_order.payment_instructions,'changeFor',v_order.change_for),'timeline',v_timeline);
end; $$;

revoke all on function private.delivery_route_operational_projection(uuid) from public, anon, authenticated;
revoke all on function private.delivery_route_public_projection(uuid) from public, anon, authenticated;
revoke all on function private.provision_store_courier_v2(uuid,uuid,uuid,text,text,text,text,text,boolean,boolean,text,text) from public, anon, authenticated;
revoke all on function private.courier_vehicle_route_refresh_trigger() from public, anon, authenticated;
grant execute on function private.delivery_route_operational_projection(uuid) to service_role;
grant execute on function private.delivery_route_public_projection(uuid) to service_role;
grant execute on function private.provision_store_courier_v2(uuid,uuid,uuid,text,text,text,text,text,boolean,boolean,text,text) to service_role;
