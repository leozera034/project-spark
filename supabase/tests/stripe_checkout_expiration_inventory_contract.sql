begin;

do $$
declare
  _oid uuid;
  _sid uuid;
  _before integer;
  _after integer;
  _result jsonb;
begin
  select o.id,o.store_id into _oid,_sid
  from public.orders o
  where o.status='aguardando_confirmacao'
    and exists (
      select 1
      from public.inventory_reservations r
      where r.order_id=o.id and r.store_id=o.store_id and r.released_at is null
    )
  order by o.created_at desc
  limit 1;

  if _oid is null then
    raise exception 'NO_PENDING_ORDER_WITH_RESERVATION';
  end if;

  select count(*) into _before
  from public.inventory_reservations
  where order_id=_oid and store_id=_sid and released_at is null;

  update public.orders
  set payment_method_kind='stripe_online',payment_status='pending',payment_provider='stripe'
  where id=_oid and store_id=_sid;

  _result:=public.backend_expire_stripe_order_checkout(
    _oid,
    'cs_test_expired_contract',
    'evt_test_expired_contract'
  );

  if coalesce((_result->>'processed')::boolean,false) is not true then
    raise exception 'EXPIRATION_NOT_PROCESSED: %',_result;
  end if;

  if not exists (
    select 1
    from public.orders
    where id=_oid and store_id=_sid and status='cancelado' and payment_status='cancelled'
  ) then
    raise exception 'ORDER_NOT_CANCELLED_AFTER_EXPIRATION';
  end if;

  select count(*) into _after
  from public.inventory_reservations
  where order_id=_oid and store_id=_sid and released_at is null;

  if _before<=0 or _after<>0 then
    raise exception 'INVENTORY_NOT_RELEASED before=% after=%',_before,_after;
  end if;

  if not exists (
    select 1
    from public.order_status_history h
    where h.order_id=_oid
      and h.store_id=_sid
      and h.action='payment_expired'
      and h.reason_code='stripe_checkout_expired'
  ) then
    raise exception 'EXPIRATION_HISTORY_MISSING';
  end if;
end $$;

select 'stripe_checkout_expiration_inventory_contract_passed' as result;

rollback;
