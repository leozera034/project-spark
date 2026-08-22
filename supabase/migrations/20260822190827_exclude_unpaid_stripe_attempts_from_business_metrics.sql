create or replace function public.get_my_store_business_report_summary(
  _store_id uuid,
  _period_type text,
  _start_date date default null,
  _end_date date default null
) returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
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
  from private.delivery_report_period_limits(_sid,_period_type,_start_date,_end_date);

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
    and o.created_at>=_limits.start_utc
    and o.created_at<_limits.end_utc
    and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status);

  _avg_ticket := case when _completed_orders>0 then round(_gross_completed/_completed_orders,2) else 0 end;

  select coalesce(jsonb_agg(jsonb_build_object(
      'method',x.payment_method,
      'orders',x.orders,
      'amount',x.amount
    ) order by x.orders desc,x.payment_method),'[]'::jsonb)
  into _payment_methods
  from (
    select coalesce(nullif(btrim(o.payment_method_label),''),nullif(btrim(o.payment_method_kind),''),'Não informado') payment_method,
           count(*) orders,
           round(coalesce(sum(o.total_amount),0),2) amount
    from public.orders o
    where o.store_id=_sid
      and o.created_at>=_limits.start_utc
      and o.created_at<_limits.end_utc
      and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
      and o.status::text in ('entregue','retirado')
    group by 1
  ) x;

  return jsonb_build_object(
    'totalOrders',coalesce(_total_orders,0),
    'completedOrders',coalesce(_completed_orders,0),
    'cancelledOrders',coalesce(_cancelled_orders,0),
    'openOrders',coalesce(_open_orders,0),
    'grossCompleted',coalesce(_gross_completed,0),
    'onlinePaidCents',coalesce(_online_paid_cents,0),
    'deliveryFees',coalesce(_delivery_fees,0),
    'averageTicket',coalesce(_avg_ticket,0),
    'deliveryOrders',coalesce(_delivery_orders,0),
    'pickupOrders',coalesce(_pickup_orders,0),
    'paymentMethods',_payment_methods,
    'period',jsonb_build_object('type',_period_type,'start',_limits.start_utc,'end',_limits.end_utc),
    'timezone',_limits.store_tz,
    'generatedAt',now()
  );
end;
$$;

create or replace function public.get_store_growth_summary(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare result jsonb;
begin
  perform private.require_growth_access(_store_id);
  select jsonb_build_object(
    'customers',count(*),
    'newCustomers30d',count(*) filter(where c.created_at>=now()-interval '30 days'),
    'repeatCustomers',count(*) filter(where coalesce(gs.completed_orders,c.orders_count)>=2),
    'vipCustomers',count(*) filter(where coalesce(gs.current_segment,case when c.orders_count>=5 then 'vip' else 'novos' end)='vip'),
    'inactiveCustomers',count(*) filter(where coalesce(gs.current_segment,case when c.last_order_at<now()-interval '30 days' then 'inativos' else 'novos' end)='inativos'),
    'orders30d',coalesce((
      select count(*)
      from public.orders o
      where o.store_id=_store_id
        and o.created_at>=now()-interval '30 days'
        and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
        and o.status not in ('cancelado','recusado')
    ),0),
    'revenue30d',coalesce((
      select sum(o.total_amount)
      from public.orders o
      where o.store_id=_store_id
        and o.created_at>=now()-interval '30 days'
        and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
        and o.status in ('entregue','retirado')
    ),0),
    'avgTicket30d',coalesce((
      select avg(o.total_amount)
      from public.orders o
      where o.store_id=_store_id
        and o.created_at>=now()-interval '30 days'
        and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
        and o.status in ('entregue','retirado')
    ),0)
  ) into result
  from public.customers c
  left join private.customer_growth_states gs on gs.store_id=c.store_id and gs.customer_id=c.id
  where c.store_id=_store_id;
  return coalesce(result,'{}'::jsonb);
end;
$$;

create or replace function public.get_store_revenue_series(_store_id uuid,_days integer default 30)
returns table(day date,orders bigint,revenue numeric,avg_ticket numeric)
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
begin
  perform private.require_growth_access(_store_id);
  return query
  with days as (
    select generate_series(
      current_date-(least(greatest(_days,7),90)-1),
      current_date,
      interval '1 day'
    )::date as d
  )
  select
    days.d,
    count(o.id) filter (
      where private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
        and o.status not in ('cancelado','recusado')
    )::bigint,
    coalesce(sum(o.total_amount) filter (
      where private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
        and o.status in ('entregue','retirado')
    ),0)::numeric,
    coalesce(avg(o.total_amount) filter (
      where private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
        and o.status in ('entregue','retirado')
    ),0)::numeric
  from days
  left join public.orders o
    on o.store_id=_store_id
   and o.created_at>=days.d
   and o.created_at<days.d+interval '1 day'
  group by days.d
  order by days.d;
end;
$$;
