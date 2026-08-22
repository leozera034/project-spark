-- Stripe late-payment compensation and refund accounting contract.
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/stripe_late_payment_compensation_contract.sql

begin;

do $$
declare
  _o public.orders%rowtype;
  _pi text;
  _acct text;
  _amount integer;
  _paid jsonb;
  _refund jsonb;
  _payment_status text;
  _order_status public.order_status;
  _refunded integer;
  _audit_count integer;
  _refund_components text[];
begin
  select * into _o
  from public.orders
  where status in ('cancelado'::public.order_status,'recusado'::public.order_status)
    and total_amount > 0
  order by updated_at desc
  limit 1;
  if not found then raise exception 'NO_TERMINAL_ORDER_FOR_TEST'; end if;

  _pi := 'pi_late_contract_' || replace(_o.id::text,'-','');
  _acct := 'acct_late_contract_' || left(replace(_o.store_id::text,'-',''),16);
  _amount := round(_o.total_amount*100)::integer;

  insert into private.stripe_connect_accounts(
    store_id,stripe_account_id,details_submitted,charges_enabled,payouts_enabled,transfers_enabled,metadata
  ) values(_o.store_id,_acct,true,true,true,true,jsonb_build_object('source','late_payment_contract'))
  on conflict(store_id) do update set
    stripe_account_id=excluded.stripe_account_id,
    details_submitted=true,
    charges_enabled=true,
    payouts_enabled=true,
    transfers_enabled=true,
    metadata=private.stripe_connect_accounts.metadata||excluded.metadata;

  delete from private.stripe_order_payment_intents where order_id=_o.id;
  update public.orders
  set payment_method_kind='stripe_online',payment_provider='stripe',payment_status='pending',
      paid_amount_cents=0,refunded_amount_cents=0,paid_at=null
  where id=_o.id;

  _paid := public.backend_record_stripe_payment_intent(
    _o.id,_o.store_id,_pi,_acct,_amount,'brl',case when _amount>1 then 1 else 0 end,'succeeded',
    'evt_late_payment_contract',null,
    jsonb_build_object(
      'event_created',extract(epoch from now())::bigint,
      'charge_pattern','separate',
      'stripe_charge_id','ch_late_contract',
      'stripe_balance_transaction_id','txn_late_contract',
      'transfer_group','tg_late_contract'
    )
  );

  if coalesce((_paid->>'requires_refund')::boolean,false) is not true then
    raise exception 'LATE_PAYMENT_NOT_FLAGGED: %',_paid;
  end if;

  select status,payment_status into _order_status,_payment_status
  from public.orders where id=_o.id;
  if _order_status is distinct from _o.status then raise exception 'TERMINAL_ORDER_WAS_RESURRECTED'; end if;
  if _payment_status <> 'paid' then raise exception 'LATE_PAYMENT_NOT_RECORDED_AS_PAID: %',_payment_status; end if;

  _refund := public.backend_record_stripe_order_refund(
    _pi,null,'ch_late_contract',_amount,'brl','evt_late_refund_contract',extract(epoch from now())::bigint,
    jsonb_build_object('source','late_payment_contract','automatic',true)
  );
  if (_refund->>'payment_status') <> 'refunded' then raise exception 'REFUND_NOT_RECONCILED: %',_refund; end if;

  select status,payment_status,refunded_amount_cents into _order_status,_payment_status,_refunded
  from public.orders where id=_o.id;
  if _order_status is distinct from _o.status then raise exception 'REFUND_CHANGED_TERMINAL_ORDER_STATUS'; end if;
  if _payment_status <> 'refunded' or _refunded <> _amount then raise exception 'ORDER_REFUND_PROJECTION_INVALID'; end if;

  select count(*) into _audit_count
  from public.audit_logs
  where store_id=_o.store_id
    and entity='orders'
    and entity_id=_o.id
    and action='order.payment_received_after_terminal'
    and context->>'paymentIntentId'=_pi;
  if _audit_count <> 1 then raise exception 'LATE_PAYMENT_AUDIT_INVALID: %',_audit_count; end if;

  select array_agg(distinct e.component_type order by e.component_type) into _refund_components
  from private.financial_journals j
  join private.financial_ledger_entries e on e.journal_id=j.id
  where j.event_key='stripe:refund:evt_late_refund_contract';
  if _refund_components is distinct from array['refund']::text[] then
    raise exception 'REFUND_LEDGER_COMPONENT_INVALID: %',_refund_components;
  end if;

  _refund := public.backend_record_stripe_order_refund(
    _pi,null,'ch_late_contract',_amount,'brl','evt_late_refund_contract_duplicate',extract(epoch from now())::bigint,
    jsonb_build_object('source','late_payment_contract_duplicate')
  );
  if (_refund->>'delta_refund_cents')::integer <> 0 then raise exception 'REFUND_NOT_IDEMPOTENT: %',_refund; end if;
end $$;

select 'stripe_late_payment_compensation_contract_passed' as result;
rollback;
