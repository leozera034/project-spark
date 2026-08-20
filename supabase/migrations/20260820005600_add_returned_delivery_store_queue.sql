create or replace function public.list_my_store_returned_deliveries(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  _store uuid;
  _rows jsonb;
begin
  _store := private.resolve_store(_store_id);
  perform private.require_permission('orders.view_queue', _store);
  perform private.require_permission('couriers.view', _store);

  select coalesce(jsonb_agg(jsonb_build_object(
    'orderId',o.id,
    'orderNumber',o.order_number,
    'orderVersion',o.version,
    'customerName',o.customer_name,
    'customerPhone',o.customer_phone_display,
    'address',o.address_snapshot,
    'neighborhood',o.neighborhood_snapshot,
    'total',o.total_amount,
    'paymentLabel',o.payment_method_label,
    'deliveryId',d.id,
    'deliveryVersion',d.version,
    'deliveryStatus',d.status::text,
    'returnReasonCode',d.return_reason_code,
    'returnNote',d.return_note,
    'returnStartedAt',d.return_started_at,
    'returnedToStoreAt',d.returned_to_store_at,
    'courierName',c.full_name,
    'courierVehicle',c.vehicle::text,
    'canRetry',private.has_permission('couriers.assign',_store),
    'canCancel',private.has_permission('orders.cancel',_store)
  ) order by d.returned_to_store_at desc nulls last),'[]'::jsonb)
  into _rows
  from public.deliveries d
  join public.orders o on o.id=d.order_id and o.store_id=d.store_id
  left join public.couriers c on c.id=d.courier_id and c.store_id=d.store_id
  where d.store_id=_store
    and d.status='devolvida_loja'
    and o.status='saiu_para_entrega';

  return jsonb_build_object('storeId',_store,'returns',_rows,'count',jsonb_array_length(_rows));
end;
$$;

grant execute on function public.list_my_store_returned_deliveries(uuid) to authenticated;