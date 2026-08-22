create or replace function public.backend_expire_stripe_order_checkout(
  _order_id uuid,
  _checkout_session_id text,
  _event_id text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  _o public.orders%rowtype;
  _updated public.orders%rowtype;
begin
  select * into _o
  from public.orders o
  where o.id=_order_id
  for update;

  if not found then
    return jsonb_build_object('processed',false,'reason','order_not_found');
  end if;

  if _o.payment_method_kind is distinct from 'stripe_online' then
    return jsonb_build_object('processed',false,'reason','not_stripe_order','order_id',_o.id);
  end if;

  if _o.payment_status='paid' then
    return jsonb_build_object('processed',false,'reason','already_paid','order_id',_o.id,'status',_o.status::text);
  end if;

  if _o.status is distinct from 'aguardando_confirmacao'::public.order_status then
    return jsonb_build_object('processed',false,'reason','order_not_pending','order_id',_o.id,'status',_o.status::text);
  end if;

  update public.orders o
  set payment_provider='stripe',
      payment_status='cancelled',
      status='cancelado',
      version=o.version+1,
      updated_at=now(),
      finished_at=coalesce(o.finished_at,now()),
      reason_code='stripe_checkout_expired',
      cancellation_reason='stripe_checkout_expired',
      internal_note=left(concat_ws(' · ',
        nullif(o.internal_note,''),
        'Checkout Stripe expirado',
        case when nullif(btrim(coalesce(_checkout_session_id,'')),'') is not null then 'session='||_checkout_session_id end,
        case when nullif(btrim(coalesce(_event_id,'')),'') is not null then 'event='||_event_id end
      ),500),
      customer_visible_message='Pagamento online não concluído no prazo. O pedido foi cancelado e você pode tentar novamente.'
  where o.id=_o.id
    and o.version=_o.version
    and o.status='aguardando_confirmacao'
    and o.payment_status<>'paid'
  returning * into _updated;

  if not found then
    return jsonb_build_object('processed',false,'reason','concurrent_change','order_id',_o.id);
  end if;

  insert into public.order_status_history(
    store_id,order_id,from_status,to_status,actor_kind,reason,action,reason_code,internal_note,customer_visible_message
  ) values (
    _updated.store_id,_updated.id,_o.status,_updated.status,'sistema',
    'checkout Stripe expirado sem pagamento','payment_expired','stripe_checkout_expired',
    'Checkout Stripe expirado',_updated.customer_visible_message
  );

  insert into public.audit_logs(store_id,actor_kind,action,entity,entity_id,context)
  values(
    _updated.store_id,'sistema','order.payment_expired','orders',_updated.id,
    jsonb_build_object(
      'checkoutSessionId',nullif(btrim(coalesce(_checkout_session_id,'')),''),
      'eventId',nullif(btrim(coalesce(_event_id,'')),''),
      'fromStatus',_o.status::text,
      'toStatus',_updated.status::text,
      'version',_updated.version
    )
  );

  perform private.emit_store_event(_updated.store_id,'order',_updated.id,'order.status_changed',_updated.version);

  return jsonb_build_object(
    'processed',true,
    'order_id',_updated.id,
    'store_id',_updated.store_id,
    'status',_updated.status::text,
    'payment_status',_updated.payment_status,
    'version',_updated.version
  );
end;
$$;

revoke all on function public.backend_expire_stripe_order_checkout(uuid,text,text) from public,anon,authenticated;
grant execute on function public.backend_expire_stripe_order_checkout(uuid,text,text) to service_role;
