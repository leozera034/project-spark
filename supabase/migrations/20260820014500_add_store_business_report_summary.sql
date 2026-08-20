create or replace function public.get_my_store_business_report_summary(
  _store_id uuid,
  _period_type text,
  _start_date date default null,
  _end_date date default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _sid uuid;
  _limits record;
  _total_orders bigint := 0;
  _completed_orders bigint := 0;
  _cancelled_orders bigint := 0;
  _open_orders bigint := 0;
  _gross_completed numeric := 0;
  _online_paid_cents bigint := 0;
  _delivery_fees numeric := 0;
  _avg_ticket numeric := 0;
  _delivery_orders bigint := 0;
  _pickup_orders bigint := 0;
  _payment_methods jsonb := '[]'::jsonb;
begin
  _sid := private.require_delivery_report_store(_store_id);
  select * into _limits
  from private.delivery_report_period_limits(_sid, _period_type, _start_date, _end_date);

  select
    count(*),
    count(*) filter (where o.status::text in ('entregue','retirado')),
    count(*) filter (where o.status::text in ('cancelado','recusado')),
    count(*) filter (where o.status::text not in ('entregue','retirado','cancelado','recusado')),
    coalesce(sum(o.total_amount) filter (where o.status::text in ('entregue','retirado')),0),
    coalesce(sum(o.paid_amount_cents) filter (where lower(coalesce(o.payment_status,'')) in ('paid','pago')),0),
    coalesce(sum(o.delivery_fee) filter (where o.status::text in ('entregue','retirado')),0),
    count(*) filter (where o.fulfillment::text='entrega'),
    count(*) filter (where o.fulfillment::text='retirada')
  into _total_orders,_completed_orders,_cancelled_orders,_open_orders,_gross_completed,_online_paid_cents,_delivery_fees,_delivery_orders,_pickup_orders
  from public.orders o
  where o.store_id=_sid
    and o.created_at >= _limits.start_utc
    and o.created_at < _limits.end_utc;

  _avg_ticket := case when _completed_orders > 0 then round(_gross_completed / _completed_orders, 2) else 0 end;

  select coalesce(jsonb_agg(jsonb_build_object(
      'method', x.payment_method,
      'orders', x.orders,
      'amount', x.amount
    ) order by x.orders desc, x.payment_method), '[]'::jsonb)
  into _payment_methods
  from (
    select coalesce(nullif(btrim(o.payment_method_label),''), nullif(btrim(o.payment_method_kind),''), 'Não informado') payment_method,
           count(*) orders,
           round(coalesce(sum(o.total_amount),0),2) amount
    from public.orders o
    where o.store_id=_sid
      and o.created_at >= _limits.start_utc
      and o.created_at < _limits.end_utc
      and o.status::text in ('entregue','retirado')
    group by 1
  ) x;

  return jsonb_build_object(
    'totalOrders', coalesce(_total_orders,0),
    'completedOrders', coalesce(_completed_orders,0),
    'cancelledOrders', coalesce(_cancelled_orders,0),
    'openOrders', coalesce(_open_orders,0),
    'grossCompleted', coalesce(_gross_completed,0),
    'onlinePaidCents', coalesce(_online_paid_cents,0),
    'deliveryFees', coalesce(_delivery_fees,0),
    'averageTicket', coalesce(_avg_ticket,0),
    'deliveryOrders', coalesce(_delivery_orders,0),
    'pickupOrders', coalesce(_pickup_orders,0),
    'paymentMethods', _payment_methods,
    'period', jsonb_build_object('type',_period_type,'start',_limits.start_utc,'end',_limits.end_utc),
    'timezone', _limits.store_tz,
    'generatedAt', now()
  );
end;
$function$;

grant execute on function public.get_my_store_business_report_summary(uuid,text,date,date) to authenticated;