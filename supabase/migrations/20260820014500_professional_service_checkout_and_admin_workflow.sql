create or replace function public.list_store_professional_service_orders(_store_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare _sid uuid:=private.resolve_store(_store_id);
begin
  perform private.require_permission('catalog.view',_sid);
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',o.id,'service_id',o.service_id,'service_code',s.code,'service_name',s.name,'status',o.status,
    'price_cents',o.price_cents,'currency',o.currency,'notes',o.notes,
    'stripe_checkout_session_id',o.stripe_checkout_session_id,'checkout_url',o.checkout_url,
    'requested_at',o.requested_at,'paid_at',o.paid_at,'in_progress_at',o.in_progress_at,
    'delivered_at',o.delivered_at,'cancelled_at',o.cancelled_at
  ) order by o.requested_at desc)
  from public.professional_service_orders o
  join public.professional_services s on s.id=o.service_id
  where o.store_id=_sid),'[]'::jsonb);
end;$$;

create or replace function public.backend_mark_professional_service_checkout(
  _order_id uuid,
  _checkout_session_id text,
  _checkout_url text
) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare _row public.professional_service_orders;
begin
  if _checkout_session_id is null or btrim(_checkout_session_id)='' then raise exception 'CHECKOUT_SESSION_REQUIRED'; end if;
  update public.professional_service_orders
  set stripe_checkout_session_id=_checkout_session_id,
      checkout_url=_checkout_url,
      status=case when status='requested' then 'awaiting_payment' else status end,
      updated_at=now()
  where id=_order_id and status in ('requested','awaiting_payment')
  returning * into _row;
  if not found then raise exception 'SERVICE_ORDER_NOT_PAYABLE'; end if;
  return jsonb_build_object('id',_row.id,'status',_row.status,'checkout_url',_row.checkout_url,'stripe_checkout_session_id',_row.stripe_checkout_session_id);
end;$$;

create or replace function public.backend_complete_professional_service_payment(
  _order_id uuid,
  _checkout_session_id text,
  _payment_intent_id text,
  _amount_total integer,
  _currency text,
  _event_id text
) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare _row public.professional_service_orders;
begin
  select * into _row from public.professional_service_orders where id=_order_id for update;
  if not found then raise exception 'SERVICE_ORDER_NOT_FOUND'; end if;
  if _row.price_cents is null or _row.price_cents<=0 then raise exception 'SERVICE_ORDER_PRICE_INVALID'; end if;
  if _amount_total is null or _amount_total<>_row.price_cents then raise exception 'SERVICE_ORDER_AMOUNT_MISMATCH'; end if;
  if lower(coalesce(_currency,''))<>lower(_row.currency) then raise exception 'SERVICE_ORDER_CURRENCY_MISMATCH'; end if;
  if _row.status in ('paid','in_progress','delivered') then
    return jsonb_build_object('id',_row.id,'status',_row.status,'duplicate',true);
  end if;
  if _row.status not in ('requested','awaiting_payment') then raise exception 'SERVICE_ORDER_NOT_PAYABLE'; end if;
  update public.professional_service_orders
  set status='paid',
      stripe_checkout_session_id=coalesce(_checkout_session_id,stripe_checkout_session_id),
      stripe_payment_intent_id=coalesce(_payment_intent_id,stripe_payment_intent_id),
      checkout_url=null,
      paid_at=coalesce(paid_at,now()),
      updated_at=now()
  where id=_order_id returning * into _row;
  perform private.log_config_audit(_row.store_id,'professional_service.paid','professional_service_orders',_row.id,array['status','paid_at','stripe_checkout_session_id','stripe_payment_intent_id']);
  return jsonb_build_object('id',_row.id,'status',_row.status,'paid_at',_row.paid_at,'event_id',_event_id,'duplicate',false);
end;$$;

create or replace function public.admin_list_professional_service_orders(_status text default null)
returns jsonb language plpgsql stable security definer set search_path=public,private,pg_temp as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',o.id,'store_id',o.store_id,'store_name',st.name,'service_id',o.service_id,'service_code',s.code,'service_name',s.name,
    'status',o.status,'price_cents',o.price_cents,'currency',o.currency,'notes',o.notes,
    'requested_at',o.requested_at,'paid_at',o.paid_at,'in_progress_at',o.in_progress_at,'delivered_at',o.delivered_at,'cancelled_at',o.cancelled_at
  ) order by case o.status when 'paid' then 0 when 'in_progress' then 1 when 'awaiting_payment' then 2 else 3 end,o.requested_at desc)
  from public.professional_service_orders o
  join public.professional_services s on s.id=o.service_id
  join public.stores st on st.id=o.store_id
  where _status is null or o.status=_status),'[]'::jsonb);
end;$$;

create or replace function public.admin_update_professional_service_order_status(_order_id uuid,_status text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare _row public.professional_service_orders;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if _status not in ('in_progress','delivered','cancelled','refunded') then raise exception 'INVALID_STATUS'; end if;
  select * into _row from public.professional_service_orders where id=_order_id for update;
  if not found then raise exception 'SERVICE_ORDER_NOT_FOUND'; end if;
  if _status='in_progress' and _row.status<>'paid' then raise exception 'SERVICE_ORDER_MUST_BE_PAID'; end if;
  if _status='delivered' and _row.status<>'in_progress' then raise exception 'SERVICE_ORDER_MUST_BE_IN_PROGRESS'; end if;
  if _status='cancelled' and _row.status not in ('requested','awaiting_payment') then raise exception 'SERVICE_ORDER_CANNOT_BE_CANCELLED'; end if;
  if _status='refunded' and _row.status not in ('paid','in_progress','delivered') then raise exception 'SERVICE_ORDER_CANNOT_BE_REFUNDED'; end if;
  update public.professional_service_orders set
    status=_status,
    in_progress_at=case when _status='in_progress' then coalesce(in_progress_at,now()) else in_progress_at end,
    delivered_at=case when _status='delivered' then coalesce(delivered_at,now()) else delivered_at end,
    cancelled_at=case when _status='cancelled' then coalesce(cancelled_at,now()) else cancelled_at end,
    updated_at=now()
  where id=_order_id returning * into _row;
  perform private.log_config_audit(_row.store_id,'professional_service.status_changed','professional_service_orders',_row.id,array['status']);
  return to_jsonb(_row);
end;$$;

grant execute on function public.admin_list_professional_service_orders(text) to authenticated;
grant execute on function public.admin_update_professional_service_order_status(uuid,text) to authenticated;
revoke all on function public.backend_mark_professional_service_checkout(uuid,text,text) from public, anon, authenticated;
revoke all on function public.backend_complete_professional_service_payment(uuid,text,text,integer,text,text) from public, anon, authenticated;