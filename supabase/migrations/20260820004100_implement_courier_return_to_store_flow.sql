alter table public.deliveries
  add column if not exists return_started_at timestamptz,
  add column if not exists returned_to_store_at timestamptz,
  add column if not exists return_reason_code text,
  add column if not exists return_note text;

create or replace function private.courier_active_delivery_id(_courier_id uuid, _store_id uuid)
returns uuid
language sql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
  select d.id
  from public.deliveries d
  where d.courier_id = _courier_id
    and d.store_id = _store_id
    and d.status in ('atribuida','aceita','coletada','em_rota','retornando_loja')
  limit 1
$function$;

create or replace function private.courier_delivery_projection(_store uuid, _courier uuid, _delivery_id uuid, _reduced boolean)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _d public.deliveries; _o public.orders; _s public.stores; _c public.couriers;
  _acceptance boolean; _occ jsonb; _blocking boolean; _actions text[]; _addr jsonb;
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
  elsif _d.status in ('atribuida','aceita') then
    if _d.arrived_at_store_at is null then _actions:=array['confirm_arrival']; else _actions:=array['confirm_pickup']; end if;
    _actions:=_actions||array['report_occurrence'];
  elsif _d.status='coletada' then _actions:=array['start_delivery','report_occurrence'];
  elsif _d.status='em_rota' then
    _actions:=array['report_occurrence','start_return_to_store'];
    if not _blocking then _actions:=array['complete_delivery']||_actions; end if;
  elsif _d.status='retornando_loja' then
    _actions:=array['complete_return_to_store','report_occurrence'];
  end if;
  if _reduced then
    return jsonb_build_object('deliveryId',_d.id,'reduced',true,'status',_d.status::text,'version',_d.version,
      'assignedAt',_d.assigned_at,'orderNumber',_o.order_number,'storeName',_s.name,'neighborhood',_o.neighborhood_snapshot,
      'vehicle',_c.vehicle,'route',private.delivery_route_operational_projection(_d.id),'allowedActions',to_jsonb(_actions),
      'returnStartedAt',_d.return_started_at,'returnedToStoreAt',_d.returned_to_store_at,'returnReasonCode',_d.return_reason_code);
  end if;
  _addr:=coalesce(_o.address_snapshot,'{}'::jsonb);
  return jsonb_build_object(
    'deliveryId',_d.id,'reduced',false,'status',_d.status::text,'version',_d.version,'orderId',_o.id,
    'orderNumber',_o.order_number,'orderStatus',_o.status::text,'orderVersion',_o.version,'acceptanceRequired',_acceptance,
    'assignedAt',_d.assigned_at,'acceptedAt',_d.accepted_at,'arrivedAtStoreAt',_d.arrived_at_store_at,
    'pickedUpAt',_d.picked_up_at,'startedAt',_d.started_at,'completedAt',_d.completed_at,
    'returnStartedAt',_d.return_started_at,'returnedToStoreAt',_d.returned_to_store_at,'returnReasonCode',_d.return_reason_code,'returnNote',_d.return_note,
    'vehicle',_c.vehicle,'route',private.delivery_route_operational_projection(_d.id),
    'pickup',jsonb_build_object('storeName',_s.name,'address',_s.address_line,'phone',_s.phone),
    'customer',jsonb_build_object('firstName',split_part(coalesce(_o.customer_name,''),' ',1),'phone',_o.customer_phone,
      'neighborhood',_o.neighborhood_snapshot,'street',_addr->>'street','number',_addr->>'number','complement',_addr->>'complement',
      'reference',_addr->>'reference','notes',_o.customer_notes),
    'payment',jsonb_build_object('method',_o.payment_method_label,'kind',_o.payment_method_kind,'needsChange',coalesce(_o.payment_needs_change,false),
      'changeFor',_o.change_for,'orderAmount',_o.total_amount,'instructions',_o.payment_instructions),
    'occurrences',_occ,'requiresStoreAttention',_blocking,'allowedActions',to_jsonb(_actions)
  );
end;
$function$;

create or replace function public.get_my_courier_operational_context()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
declare _cid uuid; _sid uuid; _c public.couriers; _s public.stores; _d public.deliveries; _pending jsonb; _active jsonb; _acceptance boolean;
begin
  select courier_id,store_id into _cid,_sid from private.require_current_courier();
  select * into _c from public.couriers c where c.id=_cid and c.store_id=_sid;
  select * into _s from public.stores s where s.id=_sid;
  _acceptance:=_s.courier_acceptance_required;
  select * into _d from public.deliveries d where d.store_id=_sid and d.courier_id=_cid and d.status in ('atribuida','aceita','coletada','em_rota','retornando_loja') order by d.assigned_at desc limit 1;
  if _d.id is not null and _d.status='atribuida' and _acceptance then _pending:=private.courier_delivery_projection(_sid,_cid,_d.id,true); _active:=null;
  elsif _d.id is not null then _pending:=null; _active:=private.courier_delivery_projection(_sid,_cid,_d.id,false);
  else _pending:=null; _active:=null; end if;
  return jsonb_build_object('courierId',_c.id,'displayName',_c.full_name,'vehicle',_c.vehicle,'storeName',_s.name,
    'storePublicAddress',_s.address_line,'storePhone',_s.phone,'accountStatus',_c.status::text,
    'canAcceptDeliveries',_c.can_accept_deliveries,'acceptanceRequired',_acceptance,'onlineIntent',_c.is_online,
    'presenceStatus',private.courier_presence_status(_c.is_online,_c.last_seen_at),'lastSeenAt',_c.last_seen_at,
    'pendingAssignment',_pending,'activeDelivery',_active,'serverNow',now(),'version',_c.version);
end;
$function$;

create or replace function public.start_my_delivery_return(_delivery_id uuid, _expected_version integer, _reason_code text, _note text, _idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _uid uuid:=auth.uid(); _cid uuid; _sid uuid; _key text; _d public.deliveries; _u public.deliveries; _existing jsonb; _result jsonb; _clean_note text; _occ_id uuid;
begin
  select courier_id,store_id into _cid,_sid from private.require_current_courier();
  _key:=nullif(btrim(coalesce(_idempotency_key,'')),'');
  if _key is null or length(_key)<8 or length(_key)>120 then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='P0001'; end if;
  select i.result into _existing from public.courier_action_intents i where i.courier_id=_cid and i.idempotency_key=_key;
  if _existing is not null then return _existing; end if;
  if _reason_code is null or _reason_code not in ('customer_not_found','incorrect_address','customer_refused','payment_problem','unsafe_location','other') then raise exception 'INVALID_REASON' using errcode='P0001'; end if;
  _clean_note:=nullif(btrim(coalesce(_note,'')),'');
  if _clean_note is not null and (length(_clean_note)>300 or _clean_note ~ '[<>]') then raise exception 'INVALID_NOTE' using errcode='P0001'; end if;
  select * into _d from public.deliveries d where d.id=_delivery_id and d.store_id=_sid for update;
  if not found or _d.courier_id is distinct from _cid then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _expected_version is null or _expected_version<>_d.version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  if _d.status<>'em_rota' then raise exception 'INVALID_TRANSITION' using errcode='P0001'; end if;
  insert into public.delivery_occurrences(store_id,delivery_id,courier_id,code,note,requires_store_attention)
  values(_sid,_d.id,_cid,_reason_code,_clean_note,true) returning id into _occ_id;
  update public.deliveries d set status='retornando_loja',return_started_at=now(),return_reason_code=_reason_code,return_note=_clean_note,reason_code=_reason_code,version=d.version+1,updated_at=now()
  where d.id=_d.id and d.store_id=_sid and d.version=_expected_version and d.courier_id=_cid returning * into _u;
  if not found then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  insert into public.delivery_events(store_id,delivery_id,courier_id,kind,actor_user_id,reason_code,delivery_version)
  values(_sid,_d.id,_cid,'inicio_retorno',_uid,_reason_code,_u.version);
  insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context)
  values(_sid,_uid,'entregador','delivery.return_started','deliveries',_d.id,jsonb_build_object('reasonCode',_reason_code,'version',_u.version));
  perform private.emit_store_event(_sid,'delivery',_d.id,'delivery.return_started',_u.version);
  _result:=jsonb_build_object('ok',true,'deliveryId',_d.id,'status',_u.status::text,'version',_u.version,'occurrenceId',_occ_id);
  insert into public.courier_action_intents(store_id,courier_id,delivery_id,action,idempotency_key,result) values(_sid,_cid,_d.id,'start_return_to_store',_key,_result);
  return _result;
end;
$function$;

create or replace function public.complete_my_delivery_return(_delivery_id uuid, _expected_version integer, _idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _uid uuid:=auth.uid(); _cid uuid; _sid uuid; _key text; _d public.deliveries; _u public.deliveries; _existing jsonb; _result jsonb;
begin
  select courier_id,store_id into _cid,_sid from private.require_current_courier();
  _key:=nullif(btrim(coalesce(_idempotency_key,'')),'');
  if _key is null or length(_key)<8 or length(_key)>120 then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='P0001'; end if;
  select i.result into _existing from public.courier_action_intents i where i.courier_id=_cid and i.idempotency_key=_key;
  if _existing is not null then return _existing; end if;
  select * into _d from public.deliveries d where d.id=_delivery_id and d.store_id=_sid for update;
  if not found or _d.courier_id is distinct from _cid then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  if _expected_version is null or _expected_version<>_d.version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  if _d.status<>'retornando_loja' then raise exception 'INVALID_TRANSITION' using errcode='P0001'; end if;
  update public.deliveries d set status='devolvida_loja',returned_to_store_at=now(),version=d.version+1,updated_at=now()
  where d.id=_d.id and d.store_id=_sid and d.version=_expected_version and d.courier_id=_cid returning * into _u;
  if not found then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  insert into public.delivery_events(store_id,delivery_id,courier_id,kind,actor_user_id,reason_code,delivery_version)
  values(_sid,_d.id,_cid,'devolucao_loja',_uid,_d.return_reason_code,_u.version);
  insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context)
  values(_sid,_uid,'entregador','delivery.return_completed','deliveries',_d.id,jsonb_build_object('reasonCode',_d.return_reason_code,'version',_u.version));
  perform private.emit_store_event(_sid,'delivery',_d.id,'delivery.return_completed',_u.version);
  _result:=jsonb_build_object('ok',true,'deliveryId',_d.id,'status',_u.status::text,'version',_u.version);
  insert into public.courier_action_intents(store_id,courier_id,delivery_id,action,idempotency_key,result) values(_sid,_cid,_d.id,'complete_return_to_store',_key,_result);
  return _result;
end;
$function$;

grant execute on function public.start_my_delivery_return(uuid,integer,text,text,text) to authenticated;
grant execute on function public.complete_my_delivery_return(uuid,integer,text) to authenticated;
