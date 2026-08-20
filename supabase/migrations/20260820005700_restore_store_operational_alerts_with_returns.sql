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
   where o.store_id=_store and o.status='aguardando_confirmacao' and o.created_at < now()-interval '60 seconds';

  select coalesce(jsonb_agg(jsonb_build_object('entity_id',o.id,'order_number',o.order_number,'store_id',_store) order by o.ready_at),'[]'::jsonb)
    into _no_courier
    from public.orders o
    left join public.deliveries d on d.store_id=o.store_id and d.order_id=o.id
   where o.store_id=_store and o.status='aguardando_entregador'
     and coalesce(o.ready_at,o.updated_at) < now()-interval '5 minutes'
     and (d.id is null or d.courier_id is null);

  select coalesce(jsonb_agg(jsonb_build_object('entity_id',o.id,'order_number',o.order_number,'store_id',_store,'returned_at',d.returned_to_store_at,'reason_code',d.return_reason_code) order by d.returned_to_store_at),'[]'::jsonb)
    into _returns
    from public.orders o
    join public.deliveries d on d.store_id=o.store_id and d.order_id=o.id
   where o.store_id=_store and o.status='saiu_para_entrega' and d.status='devolvida_loja';

  return jsonb_build_object('unanswered_orders',_unanswered,'no_courier_alerts',_no_courier,'returned_delivery_alerts',_returns);
end;
$$;

grant execute on function public.get_my_store_operational_alerts(uuid) to authenticated;