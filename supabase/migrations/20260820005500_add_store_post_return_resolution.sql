create or replace function public.retry_returned_delivery(
  _store_id uuid,
  _order_id uuid,
  _expected_order_version integer,
  _expected_delivery_version integer,
  _address jsonb default null,
  _internal_note text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _uid uuid := auth.uid();
  _store uuid;
  _o public.orders;
  _d public.deliveries;
  _ou public.orders;
  _du public.deliveries;
  _note text;
  _addr jsonb;
  _street text;
  _number text;
  _neighborhood text;
begin
  if _uid is null then raise exception 'UNAUTHENTICATED' using errcode='P0001'; end if;
  _store := private.resolve_store(_store_id);
  perform private.require_permission('couriers.assign', _store);
  if not private.has_permission('orders.view_queue', _store) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;

  select * into _o from public.orders o where o.id=_order_id and o.store_id=_store for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  select * into _d from public.deliveries d where d.order_id=_order_id and d.store_id=_store for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;

  if _o.version is distinct from _expected_order_version or _d.version is distinct from _expected_delivery_version then
    raise exception 'VERSION_CONFLICT' using errcode='P0001';
  end if;
  if _o.status <> 'saiu_para_entrega' or _d.status <> 'devolvida_loja' then
    raise exception 'INVALID_TRANSITION' using errcode='P0001';
  end if;

  _note := nullif(btrim(coalesce(_internal_note,'')), '');
  if _note is not null and (length(_note)>500 or _note ~ '[<>]') then raise exception 'INVALID_INTERNAL_NOTE' using errcode='P0001'; end if;

  _addr := _o.address_snapshot;
  if _address is not null then
    _street := nullif(btrim(coalesce(_address->>'street','')), '');
    _number := nullif(btrim(coalesce(_address->>'number','')), '');
    _neighborhood := nullif(btrim(coalesce(_address->>'neighborhoodName','')), '');
    if _street is null or _number is null or _neighborhood is null then raise exception 'INVALID_ADDRESS' using errcode='P0001'; end if;
    if length(_street)>160 or length(_number)>30 or length(_neighborhood)>100 then raise exception 'INVALID_ADDRESS' using errcode='P0001'; end if;
    _addr := (coalesce(_o.address_snapshot,'{}'::jsonb) || jsonb_build_object(
      'street',_street,
      'number',_number,
      'neighborhoodName',_neighborhood,
      'complement',nullif(btrim(coalesce(_address->>'complement','')),''),
      'reference',nullif(btrim(coalesce(_address->>'reference','')),''),
      'locationSource','store_return_correction'
    )) - 'latitude' - 'longitude' - 'googlePlaceId' - 'locationAccuracyMeters';
  end if;

  update public.orders o
     set status='aguardando_entregador',
         address_snapshot=_addr,
         neighborhood_snapshot=case when _address is not null then _neighborhood else o.neighborhood_snapshot end,
         internal_note=coalesce(_note,o.internal_note),
         finished_at=null,
         version=o.version+1,
         updated_at=now()
   where o.id=_order_id and o.store_id=_store and o.version=_expected_order_version
   returning * into _ou;
  if not found then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;

  update public.deliveries d
     set status='pendente', courier_id=null, assigned_at=null, accepted_at=null,
         arrived_at_store_at=null, picked_up_at=null, started_at=null, completed_at=null,
         cancelled_at=null, reason_code=null,
         route_distance_meters=null, route_duration_seconds=null, route_provider=null,
         route_estimated_at=null, route_is_approximate=true, route_metadata='{}'::jsonb,
         return_started_at=null, returned_to_store_at=null, return_reason_code=null, return_note=null,
         version=d.version+1, updated_at=now()
   where d.id=_d.id and d.store_id=_store and d.version=_expected_delivery_version
   returning * into _du;
  if not found then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;

  update public.delivery_occurrences x
     set resolved_at=coalesce(x.resolved_at,now()), resolved_by_user_id=coalesce(x.resolved_by_user_id,_uid),
         resolution_note=coalesce(x.resolution_note,'Nova tentativa de entrega autorizada pela loja.'),
         version=x.version + case when x.resolved_at is null then 1 else 0 end,
         updated_at=now()
   where x.store_id=_store and x.delivery_id=_d.id and x.resolved_at is null;

  insert into public.order_status_history(store_id,order_id,from_status,to_status,actor_kind,actor_user_id,action,internal_note)
  values(_store,_order_id,'saiu_para_entrega','aguardando_entregador','loja',_uid,'retry_returned_delivery',_note);
  insert into public.delivery_events(store_id,delivery_id,courier_id,previous_courier_id,kind,actor_user_id,reason_code,description,delivery_version)
  values(_store,_d.id,null,_d.courier_id,'ocorrencia',_uid,'retry_after_return','Nova tentativa liberada após devolução à loja.',_du.version);
  insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context)
  values(_store,_uid,'loja','delivery.retry_after_return','deliveries',_d.id,jsonb_build_object('orderId',_order_id,'addressCorrected',_address is not null,'deliveryVersion',_du.version,'orderVersion',_ou.version));
  perform private.emit_store_event(_store,'order',_order_id,'order.status_changed',_ou.version);
  perform private.emit_store_event(_store,'delivery',_d.id,'delivery.retry_after_return',_du.version);
  return jsonb_build_object('ok',true,'orderId',_order_id,'orderStatus',_ou.status::text,'orderVersion',_ou.version,'deliveryId',_d.id,'deliveryStatus',_du.status::text,'deliveryVersion',_du.version);
end;
$$;

create or replace function public.cancel_returned_delivery(
  _store_id uuid,
  _order_id uuid,
  _expected_order_version integer,
  _expected_delivery_version integer,
  _reason_code text,
  _internal_note text default null,
  _customer_message text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _uid uuid:=auth.uid(); _store uuid; _o public.orders; _d public.deliveries;
  _ou public.orders; _du public.deliveries; _reason public.order_transition_reasons;
  _note text; _message text;
begin
  if _uid is null then raise exception 'UNAUTHENTICATED' using errcode='P0001'; end if;
  _store:=private.resolve_store(_store_id);
  perform private.require_permission('orders.cancel',_store);
  select * into _o from public.orders o where o.id=_order_id and o.store_id=_store for update;
  select * into _d from public.deliveries d where d.order_id=_order_id and d.store_id=_store for update;
  if _o.id is null or _d.id is null then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _o.version is distinct from _expected_order_version or _d.version is distinct from _expected_delivery_version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  if _o.status<>'saiu_para_entrega' or _d.status<>'devolvida_loja' then raise exception 'INVALID_TRANSITION' using errcode='P0001'; end if;
  if _reason_code is null then raise exception 'REASON_REQUIRED' using errcode='P0001'; end if;
  select * into _reason from public.order_transition_reasons r where r.code=_reason_code and r.is_active and r.applies_cancel;
  if not found then raise exception 'INVALID_REASON' using errcode='P0001'; end if;
  _note:=nullif(btrim(coalesce(_internal_note,'')),'');
  if _note is not null and length(_note)>500 then raise exception 'INVALID_INTERNAL_NOTE' using errcode='P0001'; end if;
  _message:=nullif(btrim(coalesce(_customer_message,'')),'');
  if _message is null then _message:=_reason.public_message; end if;
  if _message is not null and (length(_message)>160 or _message~'[<>]') then raise exception 'INVALID_PUBLIC_MESSAGE' using errcode='P0001'; end if;

  update public.orders o set status='cancelado',version=o.version+1,updated_at=now(),finished_at=now(),reason_code=_reason_code,
    internal_note=coalesce(_note,o.internal_note),customer_visible_message=_message,cancellation_reason=_reason_code
    where o.id=_order_id and o.store_id=_store and o.version=_expected_order_version returning * into _ou;
  update public.deliveries d set status='cancelada',cancelled_at=now(),reason_code=_reason_code,version=d.version+1,updated_at=now()
    where d.id=_d.id and d.store_id=_store and d.version=_expected_delivery_version returning * into _du;
  if _ou.id is null or _du.id is null then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  update public.delivery_occurrences x set resolved_at=coalesce(x.resolved_at,now()),resolved_by_user_id=coalesce(x.resolved_by_user_id,_uid),
    resolution_note=coalesce(x.resolution_note,'Pedido cancelado após devolução à loja.'),version=x.version+case when x.resolved_at is null then 1 else 0 end,updated_at=now()
    where x.store_id=_store and x.delivery_id=_d.id and x.resolved_at is null;
  insert into public.order_status_history(store_id,order_id,from_status,to_status,actor_kind,actor_user_id,reason,action,reason_code,internal_note,customer_visible_message)
    values(_store,_order_id,'saiu_para_entrega','cancelado','loja',_uid,_reason_code,'cancel_after_return',_reason_code,_note,_message);
  insert into public.delivery_events(store_id,delivery_id,courier_id,kind,actor_user_id,reason_code,description,delivery_version)
    values(_store,_d.id,_d.courier_id,'cancelada',_uid,_reason_code,'Pedido cancelado após devolução à loja.',_du.version);
  insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context)
    values(_store,_uid,'loja','delivery.cancel_after_return','deliveries',_d.id,jsonb_build_object('orderId',_order_id,'reasonCode',_reason_code,'deliveryVersion',_du.version,'orderVersion',_ou.version));
  perform private.emit_store_event(_store,'order',_order_id,'order.status_changed',_ou.version);
  perform private.emit_store_event(_store,'delivery',_d.id,'delivery.cancel_after_return',_du.version);
  return jsonb_build_object('ok',true,'orderId',_order_id,'orderStatus','cancelado','orderVersion',_ou.version,'deliveryId',_d.id,'deliveryStatus','cancelada','deliveryVersion',_du.version);
end;
$$;

grant execute on function public.retry_returned_delivery(uuid,uuid,integer,integer,jsonb,text) to authenticated;
grant execute on function public.cancel_returned_delivery(uuid,uuid,integer,integer,text,text,text) to authenticated;

create or replace function public.get_store_delivery_assignment(_store_id uuid, _order_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
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
    'previousCourierName',(select pc.full_name from public.couriers pc where pc.id=e.previous_courier_id and pc.store_id=_store),
    'version',e.delivery_version) order by e.created_at desc),'[]'::jsonb) into _events
  from public.delivery_events e where e.store_id=_store and e.delivery_id=_d.id;
  return jsonb_build_object(
    'applicable',true,'orderStatus',_o.status::text,'orderVersion',_o.version,
    'delivery',case when _d.id is null then null else jsonb_build_object(
      'deliveryId',_d.id,'status',_d.status::text,'version',_d.version,'assignedAt',_d.assigned_at,
      'route',private.delivery_route_operational_projection(_d.id),
      'returnStartedAt',_d.return_started_at,'returnedToStoreAt',_d.returned_to_store_at,
      'returnReasonCode',_d.return_reason_code,'returnNote',_d.return_note,
      'courier',case when _c.id is null then null else jsonb_build_object(
        'courierId',_c.id,'displayName',_c.full_name,'vehicle',_c.vehicle,
        'presenceStatus',case when _c.is_online then 'online' else 'offline' end,'isActive',(_c.status='ativo')) end,
      'history',_events
    ) end,
    'canAssign',private.has_permission('couriers.assign',_store),
    'canCancel',private.has_permission('orders.cancel',_store),
    'postReturnPending',coalesce(_d.status='devolvida_loja',false)
  );
end;
$$;