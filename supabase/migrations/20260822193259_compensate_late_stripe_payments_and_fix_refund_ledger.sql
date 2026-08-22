create or replace function public.backend_record_stripe_payment_intent(
  _order_id uuid,
  _store_id uuid,
  _payment_intent_id text,
  _stripe_account_id text,
  _amount_cents integer,
  _currency text,
  _application_fee_amount integer,
  _status text,
  _event_id text default null,
  _last_error text default null,
  _metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v private.stripe_order_payment_intents%rowtype;
  _order public.orders%rowtype;
  _mapped_account text;
  _expected_amount bigint;
  _event_created bigint;
  _journal_entries jsonb;
  _store_net bigint;
  _pattern text;
  _charge_id text;
  _bt_id text;
  _transfer_group text;
  _requires_refund boolean := false;
  _effective_metadata jsonb;
begin
  if nullif(btrim(coalesce(_payment_intent_id,'')),'') is null then raise exception 'STRIPE_PAYMENT_INTENT_REQUIRED' using errcode='P0001'; end if;
  if nullif(btrim(coalesce(_stripe_account_id,'')),'') is null then raise exception 'STRIPE_ACCOUNT_REQUIRED' using errcode='P0001'; end if;

  select * into _order from public.orders o where o.id=_order_id and o.store_id=_store_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0001'; end if;
  if _order.payment_method_kind is distinct from 'stripe_online' then raise exception 'ORDER_PAYMENT_METHOD_MISMATCH' using errcode='P0001'; end if;

  _expected_amount:=round(_order.total_amount*100)::bigint;
  if _amount_cents is null or _amount_cents::bigint<>_expected_amount then raise exception 'ORDER_PAYMENT_AMOUNT_MISMATCH' using errcode='P0001'; end if;
  if lower(coalesce(_currency,''))<>'brl' then raise exception 'ORDER_PAYMENT_CURRENCY_MISMATCH' using errcode='P0001'; end if;
  if coalesce(_application_fee_amount,0)<0 or coalesce(_application_fee_amount,0)>_amount_cents then raise exception 'ORDER_PAYMENT_FEE_INVALID' using errcode='P0001'; end if;

  select a.stripe_account_id into _mapped_account from private.stripe_connect_accounts a where a.store_id=_store_id;
  if _mapped_account is null then raise exception 'STRIPE_ACCOUNT_NOT_MAPPED' using errcode='P0001'; end if;
  if _mapped_account is distinct from _stripe_account_id then raise exception 'STRIPE_ACCOUNT_MISMATCH' using errcode='P0001'; end if;

  _event_created:=case when coalesce(_metadata->>'event_created','') ~ '^\d+$' then (_metadata->>'event_created')::bigint else null end;
  _pattern:=coalesce(nullif(lower(btrim(_metadata->>'charge_pattern')),''),'direct');
  if _pattern not in ('direct','separate') then raise exception 'STRIPE_CHARGE_PATTERN_INVALID' using errcode='P0001'; end if;
  _charge_id:=nullif(btrim(coalesce(_metadata->>'stripe_charge_id','')),'');
  _bt_id:=nullif(btrim(coalesce(_metadata->>'stripe_balance_transaction_id','')),'');
  _transfer_group:=nullif(btrim(coalesce(_metadata->>'transfer_group','')),'');
  _requires_refund := _status='succeeded' and _order.status in ('cancelado'::public.order_status,'recusado'::public.order_status);
  _effective_metadata := coalesce(_metadata,'{}'::jsonb) || jsonb_build_object(
    'order_status_at_payment',_order.status::text,
    'late_terminal_payment',_requires_refund
  );

  select * into v from private.stripe_order_payment_intents where order_id=_order_id;
  if found and _event_created is not null and v.last_event_created is not null and _event_created < v.last_event_created then
    return jsonb_build_object(
      'order_id',v.order_id,
      'payment_intent_id',v.stripe_payment_intent_id,
      'status',v.status,
      'stale_event',true,
      'requires_refund',false
    );
  end if;

  insert into private.stripe_order_payment_intents(
    order_id,store_id,stripe_payment_intent_id,stripe_account_id,amount_cents,currency,
    application_fee_amount,status,last_event_id,last_event_created,last_error,metadata,paid_at,
    charge_pattern,stripe_charge_id,stripe_balance_transaction_id,transfer_group,updated_at
  ) values(
    _order_id,_store_id,_payment_intent_id,_stripe_account_id,_amount_cents,lower(_currency),
    greatest(_application_fee_amount,0),_status,_event_id,_event_created,_last_error,_effective_metadata,
    case when _status='succeeded' then now() else null end,_pattern,_charge_id,_bt_id,_transfer_group,now()
  )
  on conflict(order_id) do update set
    stripe_payment_intent_id=excluded.stripe_payment_intent_id,
    stripe_account_id=excluded.stripe_account_id,
    amount_cents=excluded.amount_cents,
    currency=excluded.currency,
    application_fee_amount=excluded.application_fee_amount,
    status=excluded.status,
    last_event_id=coalesce(excluded.last_event_id,private.stripe_order_payment_intents.last_event_id),
    last_event_created=coalesce(excluded.last_event_created,private.stripe_order_payment_intents.last_event_created),
    last_error=excluded.last_error,
    metadata=private.stripe_order_payment_intents.metadata||excluded.metadata,
    paid_at=case when excluded.status='succeeded' then coalesce(private.stripe_order_payment_intents.paid_at,now()) else private.stripe_order_payment_intents.paid_at end,
    charge_pattern=excluded.charge_pattern,
    stripe_charge_id=coalesce(excluded.stripe_charge_id,private.stripe_order_payment_intents.stripe_charge_id),
    stripe_balance_transaction_id=coalesce(excluded.stripe_balance_transaction_id,private.stripe_order_payment_intents.stripe_balance_transaction_id),
    transfer_group=coalesce(excluded.transfer_group,private.stripe_order_payment_intents.transfer_group),
    updated_at=now()
  returning * into v;

  update public.orders
  set payment_provider='stripe',
      payment_status=case
        when _status='succeeded' then 'paid'
        when _status in ('processing','requires_action','requires_confirmation','requires_capture') then 'processing'
        when _status='canceled' then 'cancelled'
        when _status='requires_payment_method' and _event_id is not null then 'failed'
        else 'pending'
      end,
      paid_amount_cents=case when _status='succeeded' then _amount_cents else paid_amount_cents end,
      paid_at=case when _status='succeeded' then coalesce(paid_at,now()) else paid_at end,
      updated_at=now()
  where id=_order_id and store_id=_store_id;

  if _status='succeeded' then
    _store_net:=greatest(_amount_cents::bigint-greatest(_application_fee_amount,0)::bigint,0);
    _journal_entries:=jsonb_build_array(
      jsonb_build_object(
        'account_code',case when _pattern='separate' then 'stripe.platform.gross' else 'stripe.connected.gross' end,
        'owner_type',case when _pattern='separate' then 'platform' else 'store' end,
        'direction','debit','component_type','gross_payment','amount_cents',_amount_cents
      ),
      jsonb_build_object(
        'account_code','store.sales.clearing','owner_type','store','direction','credit',
        'component_type','store_payable','amount_cents',_store_net
      )
    );
    if greatest(_application_fee_amount,0)>0 then
      _journal_entries:=_journal_entries||jsonb_build_array(
        jsonb_build_object(
          'account_code','platform.application_fee.revenue','owner_type','platform','direction','credit',
          'component_type','platform_processing_fee','amount_cents',greatest(_application_fee_amount,0)
        )
      );
    end if;
    perform private.create_and_post_financial_journal(
      'stripe:payment_intent:'||_payment_intent_id||':succeeded','order_payment','stripe',_payment_intent_id,
      _store_id,_order_id,upper(_currency),_journal_entries,
      jsonb_build_object(
        'stripe_account_id',_stripe_account_id,
        'application_fee_amount',greatest(_application_fee_amount,0),
        'event_id',_event_id,
        'charge_pattern',_pattern,
        'stripe_charge_id',_charge_id,
        'stripe_balance_transaction_id',_bt_id,
        'transfer_group',_transfer_group,
        'late_terminal_payment',_requires_refund,
        'order_status_at_payment',_order.status::text
      ),now()
    );

    if _requires_refund and not exists(
      select 1 from public.audit_logs a
      where a.store_id=_store_id
        and a.entity='orders'
        and a.entity_id=_order_id
        and a.action='order.payment_received_after_terminal'
        and a.context->>'paymentIntentId'=_payment_intent_id
    ) then
      insert into public.audit_logs(store_id,actor_kind,action,entity,entity_id,context)
      values(
        _store_id,'sistema','order.payment_received_after_terminal','orders',_order_id,
        jsonb_build_object(
          'paymentIntentId',_payment_intent_id,
          'amountCents',_amount_cents,
          'orderStatus',_order.status::text,
          'requiresRefund',true
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'order_id',v.order_id,
    'payment_intent_id',v.stripe_payment_intent_id,
    'status',v.status,
    'charge_pattern',v.charge_pattern,
    'order_status',_order.status::text,
    'requires_refund',_requires_refund
  );
end;
$$;

create or replace function public.backend_record_stripe_order_refund(
  _payment_intent_id text,
  _stripe_account_id text,
  _charge_id text,
  _amount_refunded_cents integer,
  _currency text,
  _event_id text,
  _event_created bigint default null,
  _metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  _pi private.stripe_order_payment_intents%rowtype;
  _previous integer;
  _refunded integer;
  _delta integer;
  _status text;
  _entries jsonb;
  _source_account text;
begin
  if nullif(btrim(coalesce(_payment_intent_id,'')),'') is null then raise exception 'PAYMENT_INTENT_REQUIRED'; end if;
  select * into _pi from private.stripe_order_payment_intents where stripe_payment_intent_id=btrim(_payment_intent_id) limit 1 for update;
  if not found then return jsonb_build_object('relevant',false); end if;
  if nullif(btrim(coalesce(_stripe_account_id,'')),'') is not null and _pi.stripe_account_id is distinct from btrim(_stripe_account_id) then raise exception 'STRIPE_ACCOUNT_MISMATCH'; end if;

  _previous:=greatest(coalesce(_pi.refunded_amount_cents,0),0);
  _refunded:=least(greatest(coalesce(_amount_refunded_cents,0),0),_pi.amount_cents);
  _delta:=greatest(_refunded-_previous,0);
  _status:=case when _refunded>=_pi.amount_cents then 'refunded' when _refunded>0 then 'partially_refunded' else 'paid' end;

  update private.stripe_order_payment_intents
  set refunded_amount_cents=_refunded,
      last_event_id=coalesce(nullif(btrim(coalesce(_event_id,'')),''),last_event_id),
      last_event_created=case when _event_created is null then last_event_created when last_event_created is null then _event_created else greatest(last_event_created,_event_created) end,
      metadata=metadata||coalesce(_metadata,'{}'::jsonb)||jsonb_build_object(
        'last_refund_charge_id',nullif(btrim(coalesce(_charge_id,'')),''),
        'last_refund_event_id',nullif(btrim(coalesce(_event_id,'')),'')
      ),
      updated_at=now()
  where order_id=_pi.order_id;

  update public.orders
  set payment_provider='stripe',refunded_amount_cents=_refunded,payment_status=_status,updated_at=now()
  where id=_pi.order_id and store_id=_pi.store_id;

  update private.store_settlement_entries
  set status=case when _status='refunded' then 'refunded' else status end,
      metadata=metadata||jsonb_build_object('refunded_amount_cents',_refunded,'refund_event_id',_event_id),
      updated_at=now()
  where order_id=_pi.order_id and provider_payment_id=_payment_intent_id;

  if _delta>0 then
    _source_account:=case when _pi.charge_pattern='separate' then 'stripe.platform.balance' else 'stripe.connected.balance' end;
    _entries:=jsonb_build_array(
      jsonb_build_object(
        'account_code','store.sales.refunds','owner_type','store','direction','debit',
        'component_type','refund','amount_cents',_delta
      ),
      jsonb_build_object(
        'account_code',_source_account,'owner_type',case when _pi.charge_pattern='separate' then 'platform' else 'store' end,
        'direction','credit','component_type','refund','amount_cents',_delta
      )
    );
    perform private.create_and_post_financial_journal(
      'stripe:refund:'||coalesce(nullif(btrim(coalesce(_event_id,'')),''),coalesce(nullif(btrim(coalesce(_charge_id,'')),''),_payment_intent_id||':'||_refunded::text)),
      'order_refund','stripe',coalesce(nullif(btrim(coalesce(_charge_id,'')),''),_payment_intent_id),
      _pi.store_id,_pi.order_id,upper(coalesce(nullif(btrim(_currency),''),_pi.currency,'BRL')),_entries,
      coalesce(_metadata,'{}'::jsonb)||jsonb_build_object(
        'payment_intent_id',_payment_intent_id,
        'charge_id',_charge_id,
        'event_id',_event_id,
        'cumulative_refunded_cents',_refunded,
        'charge_pattern',_pi.charge_pattern
      ),now()
    );
  end if;

  return jsonb_build_object(
    'relevant',true,
    'order_id',_pi.order_id,
    'payment_status',_status,
    'refunded_amount_cents',_refunded,
    'delta_refund_cents',_delta,
    'charge_pattern',_pi.charge_pattern
  );
end;
$$;

revoke all on function public.backend_record_stripe_payment_intent(uuid,uuid,text,text,integer,text,integer,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_record_stripe_payment_intent(uuid,uuid,text,text,integer,text,integer,text,text,text,jsonb) to service_role;
revoke all on function public.backend_record_stripe_order_refund(text,text,text,integer,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.backend_record_stripe_order_refund(text,text,text,integer,text,text,bigint,jsonb) to service_role;
