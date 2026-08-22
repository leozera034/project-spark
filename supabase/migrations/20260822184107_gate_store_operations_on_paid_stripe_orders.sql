begin;

-- P0: Stripe online orders must never enter the merchant operational flow
-- before the payment is confirmed. Keep the rule server-side so a manual RPC
-- call cannot bypass the UI.

create or replace function private.order_payment_operational_ready(
  _payment_method_kind text,
  _payment_status text
) returns boolean
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select _payment_method_kind is distinct from 'stripe_online'
      or _payment_status = 'paid'
$$;

revoke all on function private.order_payment_operational_ready(text,text) from public, anon, authenticated;

create or replace function private.initialize_order_payment_projection()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  if new.payment_method_kind = 'stripe_online' then
    if new.payment_status is null or new.payment_status = 'not_applicable' then
      new.payment_status := 'pending';
    end if;
    if nullif(btrim(coalesce(new.payment_provider,'')),'') is null then
      new.payment_provider := 'stripe';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.initialize_order_payment_projection() from public, anon, authenticated;

drop trigger if exists trg_initialize_order_payment_projection on public.orders;
create trigger trg_initialize_order_payment_projection
before insert on public.orders
for each row execute function private.initialize_order_payment_projection();

create or replace function private.guard_online_order_operational_transition()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  if old.payment_method_kind = 'stripe_online'
     and old.status = 'aguardando_confirmacao'
     and new.status is distinct from old.status
     and not (
       new.payment_status = 'paid'
       or (
         new.status = 'cancelado'
         and new.payment_status in ('failed','cancelled')
       )
     ) then
    raise exception 'PAYMENT_NOT_CONFIRMED' using errcode='P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_online_order_operational_transition() from public, anon, authenticated;

drop trigger if exists trg_guard_online_order_operational_transition on public.orders;
create trigger trg_guard_online_order_operational_transition
before update of status on public.orders
for each row execute function private.guard_online_order_operational_transition();

create or replace function private.emit_order_payment_realtime_event()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  if new.payment_status is distinct from old.payment_status then
    perform private.emit_store_event(
      new.store_id,
      'order',
      new.id,
      'order.payment_status_changed',
      new.version
    );
  end if;
  return new;
end;
$$;

revoke all on function private.emit_order_payment_realtime_event() from public, anon, authenticated;

drop trigger if exists trg_emit_order_payment_realtime_event on public.orders;
create trigger trg_emit_order_payment_realtime_event
after update of payment_status on public.orders
for each row
when (old.payment_status is distinct from new.payment_status)
execute function private.emit_order_payment_realtime_event();

create or replace function public.get_my_store_order_counts(_store_id uuid default null::uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _store uuid;
  _out jsonb;
begin
  _store:=private.resolve_store(_store_id);
  if not private.has_permission('orders.view_queue',_store) then
    raise exception 'FORBIDDEN' using errcode='P0001';
  end if;

  select jsonb_object_agg(k,n) into _out
  from (
    select o.status::text as k,count(*) as n
    from public.orders o
    where o.store_id=_store
      and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
      and (o.status not in ('entregue','retirado','recusado','cancelado') or o.created_at>now()-interval '2 days')
    group by o.status
  ) s;

  return jsonb_build_object('storeId',_store,'byStatus',coalesce(_out,'{}'::jsonb));
end;
$$;

create or replace function public.list_my_store_orders(
  _store_id uuid default null::uuid,
  _statuses text[] default null::text[],
  _fulfillment text default null::text,
  _search text default null::text,
  _delayed_only boolean default false,
  _from timestamptz default null::timestamptz,
  _to timestamptz default null::timestamptz,
  _limit integer default 30,
  _cursor timestamptz default null::timestamptz,
  _cursor_id uuid default null::uuid
) returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _store uuid;
  _lim integer:=least(greatest(coalesce(_limit,30),1),50);
  _q text:=nullif(btrim(coalesce(_search,'')),'');
  _num integer:=null;
  _rows jsonb;
begin
  _store:=private.resolve_store(_store_id);
  if not private.has_permission('orders.view_queue',_store) then
    raise exception 'FORBIDDEN' using errcode='P0001';
  end if;
  if _q is not null and _q~'^[0-9]+$' and length(_q)<=9 then _num:=_q::integer; end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord),'[]'::jsonb) into _rows
  from (
    select o.created_at as ord,o.id as "id",o.order_number as "orderNumber",o.created_at as "createdAt",
      greatest(o.updated_at,coalesce(d.updated_at,o.updated_at)) as "updatedAt",o.status::text as "status",
      private.public_order_status_code(o.status) as "publicCode",o.fulfillment::text as "fulfillment",
      split_part(btrim(o.customer_name),' ',1) as "customerFirstName",
      (select count(*) from public.order_items i where i.order_id=o.id and i.store_id=o.store_id) as "itemCount",
      o.total_amount as "total",o.payment_method_label as "paymentLabel",o.eta_minutes as "etaMinutes",o.version as "version",
      private.delivery_route_operational_projection(d.id) as "route",
      (o.status not in ('entregue','retirado','recusado','cancelado') and o.eta_minutes is not null and now()>o.created_at+make_interval(mins=>o.eta_minutes+10)) as "isDelayed",
      greatest(0,(extract(epoch from (now()-o.created_at))/60)::int-coalesce(o.eta_minutes,0)-10) as "delayMinutes",
      to_jsonb(private.order_allowed_actions(o.status,o.fulfillment,o.store_id)) as "allowedActions"
    from public.orders o
    left join public.deliveries d on d.store_id=o.store_id and d.order_id=o.id
    where o.store_id=_store
      and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
      and (_statuses is null or o.status::text=any(_statuses))
      and (_fulfillment is null or o.fulfillment::text=_fulfillment)
      and (_from is null or o.created_at>=_from)
      and (_to is null or o.created_at<=_to)
      and (_cursor is null or (o.created_at,o.id)<(_cursor,coalesce(_cursor_id,o.id)))
      and (_q is null or (_num is not null and o.order_number=_num) or o.customer_name ilike '%'||_q||'%'
        or (length(_q)>=4 and regexp_replace(o.customer_phone,'\D','','g') like '%'||regexp_replace(_q,'\D','','g')||'%'
          and private.has_permission('orders.view_customer_contact',_store)))
      and (not coalesce(_delayed_only,false) or (o.status not in ('entregue','retirado','recusado','cancelado') and o.eta_minutes is not null and now()>o.created_at+make_interval(mins=>o.eta_minutes+10)))
    order by o.created_at desc,o.id desc
    limit _lim
  ) t;

  return jsonb_build_object('storeId',_store,'orders',_rows,'limit',_lim);
end;
$$;

create or replace function public.get_my_store_order_detail(_store_id uuid, _order_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _store uuid;
  _o public.orders;
  _items jsonb;
  _contact boolean;
  _d public.deliveries;
  _payment_ready boolean;
begin
  _store:=private.resolve_store(_store_id);
  if not private.has_permission('orders.view_queue',_store) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  select * into _o from public.orders o where o.id=_order_id and o.store_id=_store;
  if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
  _contact:=private.has_permission('orders.view_customer_contact',_store);
  _payment_ready:=private.order_payment_operational_ready(_o.payment_method_kind,_o.payment_status);
  if _o.fulfillment='entrega' then select * into _d from public.deliveries d where d.store_id=_store and d.order_id=_o.id; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productName',i.product_name,'variantName',i.variant_name,'quantity',i.quantity,
    'pricingUnit',i.pricing_unit::text,'unitPrice',i.unit_price,'lineTotal',i.line_total,'notes',i.notes,
    'options',coalesce((select jsonb_agg(jsonb_build_object('groupName',op.group_name,'optionName',op.option_name,'quantity',op.quantity) order by op.group_name,op.option_name)
      from public.order_item_options op where op.order_item_id=i.id and op.store_id=i.store_id),'[]'::jsonb)
  ) order by i.sort_order),'[]'::jsonb)
  into _items from public.order_items i where i.order_id=_o.id and i.store_id=_store;

  return jsonb_build_object(
    'id',_o.id,'orderNumber',_o.order_number,'createdAt',_o.created_at,'updatedAt',greatest(_o.updated_at,coalesce(_d.updated_at,_o.updated_at)),
    'status',_o.status::text,'publicCode',private.public_order_status_code(_o.status),'fulfillment',_o.fulfillment::text,'version',_o.version,'etaMinutes',_o.eta_minutes,
    'customer',jsonb_build_object('firstName',split_part(btrim(_o.customer_name),' ',1),'fullName',case when _contact then _o.customer_name else null end,
      'phone',case when _contact then coalesce(_o.customer_phone_display,_o.customer_phone) else null end),
    'delivery',case when _o.fulfillment='entrega' then jsonb_build_object('neighborhood',_o.neighborhood_snapshot,
      'address',case when _contact then _o.address_snapshot else null end,'route',private.delivery_route_operational_projection(_d.id)) else null end,
    'items',_items,'notes',_o.customer_notes,
    'payment',jsonb_build_object(
      'label',_o.payment_method_label,'kind',_o.payment_method_kind,'changeFor',_o.change_for,
      'needsChange',_o.payment_needs_change,'instructions',_o.payment_instructions,
      'status',_o.payment_status,'provider',_o.payment_provider,'operationalReady',_payment_ready
    ),
    'totals',jsonb_build_object('subtotal',_o.items_subtotal,'deliveryFee',_o.delivery_fee,'discount',_o.discount_total,'total',_o.total_amount),
    'resolution',jsonb_build_object('reasonCode',_o.reason_code,'internalNote',_o.internal_note,'customerMessage',_o.customer_visible_message),
    'isDelayed',(_o.status not in ('entregue','retirado','recusado','cancelado') and _o.eta_minutes is not null and now()>_o.created_at+make_interval(mins=>_o.eta_minutes+10)),
    'allowedActions',case when _payment_ready then to_jsonb(private.order_allowed_actions(_o.status,_o.fulfillment,_store)) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.get_my_store_operational_alerts(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _store uuid;
  _unanswered jsonb;
  _no_courier jsonb;
  _returns jsonb;
begin
  _store:=private.resolve_store(_store_id);
  perform private.require_permission('orders.view_queue',_store);

  select coalesce(jsonb_agg(jsonb_build_object('entity_id',o.id,'order_number',o.order_number,'store_id',_store) order by o.created_at),'[]'::jsonb)
    into _unanswered
    from public.orders o
   where o.store_id=_store
     and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
     and o.status='aguardando_confirmacao'
     and o.created_at < now()-interval '60 seconds';

  select coalesce(jsonb_agg(jsonb_build_object('entity_id',o.id,'order_number',o.order_number,'store_id',_store) order by o.ready_at),'[]'::jsonb)
    into _no_courier
    from public.orders o
    left join public.deliveries d on d.store_id=o.store_id and d.order_id=o.id
   where o.store_id=_store
     and private.order_payment_operational_ready(o.payment_method_kind,o.payment_status)
     and o.status='aguardando_entregador'
     and coalesce(o.ready_at,o.updated_at) < now()-interval '5 minutes'
     and (d.id is null or d.courier_id is null);

  select coalesce(jsonb_agg(jsonb_build_object('entity_id',o.id,'order_number',o.order_number,'store_id',_store,'returned_at',d.returned_to_store_at,'reason_code',d.return_reason_code) order by d.returned_to_store_at),'[]'::jsonb)
    into _returns
    from public.orders o
    join public.deliveries d on d.store_id=o.store_id and d.order_id=o.id
   where o.store_id=_store
     and o.status='saiu_para_entrega'
     and d.status='devolvida_loja';

  return jsonb_build_object('unanswered_orders',_unanswered,'no_courier_alerts',_no_courier,'returned_delivery_alerts',_returns);
end;
$$;

commit;
