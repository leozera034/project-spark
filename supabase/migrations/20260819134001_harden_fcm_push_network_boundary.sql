revoke usage on schema net from public, anon, authenticated;
revoke execute on function net.http_get(text,jsonb,jsonb,integer) from public, anon, authenticated;
revoke execute on function net.http_post(text,jsonb,jsonb,jsonb,integer) from public, anon, authenticated;
revoke execute on function net.http_delete(text,jsonb,jsonb,integer,jsonb) from public, anon, authenticated;

create or replace function private.delivery_assignment_push_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_order_number bigint;
  v_result jsonb;
begin
  if new.courier_id is null or new.status <> 'atribuida' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.courier_id is not distinct from new.courier_id
       and old.status is not distinct from new.status
       and old.assigned_at is not distinct from new.assigned_at then
      return new;
    end if;
  end if;

  select o.order_number into v_order_number
  from public.orders o
  where o.id = new.order_id and o.store_id = new.store_id;

  begin
    v_result := private.queue_courier_push_message(
      new.store_id,
      new.courier_id,
      'delivery.assigned',
      'Nova entrega atribuída',
      case
        when v_order_number is null then 'Você recebeu uma nova entrega.'
        else 'Pedido #' || v_order_number::text || ' foi atribuído a você.'
      end,
      jsonb_build_object(
        'delivery_id', new.id::text,
        'order_id', new.order_id::text,
        'event', 'delivery.assigned'
      ),
      'delivery-assigned:' || new.id::text || ':' || new.courier_id::text || ':' || new.version::text,
      jsonb_build_object('source','delivery_trigger')
    );
  exception when others then
    begin
      insert into private.automation_event_failures(
        store_id,event_code,source_table,source_id,error_code,error_message,payload
      ) values (
        new.store_id,
        'push.delivery.assigned',
        'deliveries',
        new.id,
        sqlstate,
        left(sqlerrm,500),
        jsonb_build_object('courier_id',new.courier_id,'order_id',new.order_id)
      );
    exception when others then
      null;
    end;
  end;

  return new;
end;
$$;

revoke all on function private.delivery_assignment_push_trigger() from public,anon,authenticated;
