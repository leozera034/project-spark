begin;

do $$
declare
  _oid uuid;
  _token text:='audit-payment-token-20260822';
  _ctx jsonb;
  _created_fn text;
begin
  select id into _oid from public.orders order by created_at desc limit 1;
  if _oid is null then raise exception 'NO_ORDER'; end if;

  update public.orders
  set tracking_token_hash=encode(sha256(convert_to(_token,'UTF8')),'hex'),
      payment_method_kind='stripe_online',
      payment_status='pending',
      status='cancelado'
  where id=_oid;

  _ctx:=public.backend_get_order_stripe_payment_context(_oid,_token);
  if _ctx->>'reason' <> 'order_not_payable' then
    raise exception 'CANCELLED_ORDER_PAYMENT_CONTEXT_NOT_BLOCKED: %',_ctx;
  end if;

  update public.orders
  set status='aguardando_confirmacao',payment_status='paid'
  where id=_oid;

  _ctx:=public.backend_get_order_stripe_payment_context(_oid,_token);
  if _ctx->>'reason' <> 'order_already_paid' then
    raise exception 'PAID_ORDER_PAYMENT_CONTEXT_NOT_BLOCKED: %',_ctx;
  end if;

  _created_fn:=pg_get_functiondef('private.capture_order_created_automation()'::regprocedure);
  if _created_fn not ilike '%order_payment_operational_ready%' then
    raise exception 'ORDER_CREATED_AUTOMATION_NOT_PAYMENT_GATED';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid='public.orders'::regclass
      and not t.tgisinternal
      and t.tgname='trg_order_paid_created_automation'
  ) then
    raise exception 'PAID_ORDER_CREATED_AUTOMATION_TRIGGER_MISSING';
  end if;
end $$;

select 'stripe_order_payment_lifecycle_contract_passed' as result;

rollback;
