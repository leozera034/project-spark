begin;

create or replace function public.backend_record_stripe_order_refund(
  _payment_intent_id text,
  _stripe_account_id text,
  _charge_id text,
  _amount_refunded_cents integer,
  _currency text,
  _event_id text,
  _event_created bigint default null,
  _metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
declare
  _pi private.stripe_order_payment_intents%rowtype;
  _previous integer;
  _refunded integer;
  _delta integer;
  _status text;
  _entries jsonb;
begin
  if nullif(btrim(coalesce(_payment_intent_id,'')),'') is null then raise exception 'PAYMENT_INTENT_REQUIRED'; end if;

  select * into _pi
  from private.stripe_order_payment_intents
  where stripe_payment_intent_id=btrim(_payment_intent_id)
  limit 1
  for update;

  if not found then return jsonb_build_object('relevant',false); end if;
  if nullif(btrim(coalesce(_stripe_account_id,'')),'') is not null and _pi.stripe_account_id is distinct from btrim(_stripe_account_id) then
    raise exception 'STRIPE_ACCOUNT_MISMATCH';
  end if;

  _previous:=greatest(coalesce(_pi.refunded_amount_cents,0),0);
  _refunded:=least(greatest(coalesce(_amount_refunded_cents,0),0),_pi.amount_cents);
  _delta:=greatest(_refunded-_previous,0);
  _status:=case when _refunded>=_pi.amount_cents then 'refunded' when _refunded>0 then 'partially_refunded' else 'paid' end;

  update private.stripe_order_payment_intents
  set refunded_amount_cents=_refunded,
      last_event_id=coalesce(nullif(btrim(coalesce(_event_id,'')),''),last_event_id),
      last_event_created=case
        when _event_created is null then last_event_created
        when last_event_created is null then _event_created
        else greatest(last_event_created,_event_created)
      end,
      metadata=metadata || coalesce(_metadata,'{}'::jsonb) || jsonb_build_object(
        'last_refund_charge_id',nullif(btrim(coalesce(_charge_id,'')),''),
        'last_refund_event_id',nullif(btrim(coalesce(_event_id,'')),'')
      ),
      updated_at=now()
  where order_id=_pi.order_id;

  update public.orders
  set payment_provider='stripe',
      refunded_amount_cents=_refunded,
      payment_status=_status,
      updated_at=now()
  where id=_pi.order_id and store_id=_pi.store_id;

  if _delta>0 then
    _entries:=jsonb_build_array(
      jsonb_build_object('account_code','store.sales.refunds','owner_type','store','direction','debit','component_type','customer_refund','amount_cents',_delta),
      jsonb_build_object('account_code','stripe.connected.balance','owner_type','store','direction','credit','component_type','customer_refund','amount_cents',_delta)
    );
    perform private.create_and_post_financial_journal(
      'stripe:refund:'||coalesce(nullif(btrim(coalesce(_event_id,'')),''),coalesce(nullif(btrim(coalesce(_charge_id,'')),''),_payment_intent_id||':'||_refunded::text)),
      'order_refund','stripe',coalesce(nullif(btrim(coalesce(_charge_id,'')),''),_payment_intent_id),
      _pi.store_id,_pi.order_id,upper(coalesce(nullif(btrim(_currency),''),_pi.currency,'BRL')),_entries,
      coalesce(_metadata,'{}'::jsonb)||jsonb_build_object('payment_intent_id',_payment_intent_id,'charge_id',_charge_id,'event_id',_event_id,'cumulative_refunded_cents',_refunded),
      now()
    );
  end if;

  return jsonb_build_object('relevant',true,'order_id',_pi.order_id,'payment_status',_status,'refunded_amount_cents',_refunded,'delta_refund_cents',_delta);
end;
$$;

create or replace function public.backend_record_stripe_order_dispute(
  _payment_intent_id text,
  _stripe_account_id text,
  _dispute_id text,
  _dispute_status text,
  _amount_cents integer,
  _currency text,
  _event_id text,
  _event_created bigint default null,
  _metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
declare
  _pi private.stripe_order_payment_intents%rowtype;
  _normalized text:=lower(btrim(coalesce(_dispute_status,'')));
  _payment_status text;
begin
  if nullif(btrim(coalesce(_payment_intent_id,'')),'') is null then return jsonb_build_object('relevant',false); end if;

  select * into _pi
  from private.stripe_order_payment_intents
  where stripe_payment_intent_id=btrim(_payment_intent_id)
  limit 1
  for update;

  if not found then return jsonb_build_object('relevant',false); end if;
  if nullif(btrim(coalesce(_stripe_account_id,'')),'') is not null and _pi.stripe_account_id is distinct from btrim(_stripe_account_id) then
    raise exception 'STRIPE_ACCOUNT_MISMATCH';
  end if;

  _payment_status:=case
    when _normalized='won' then case
      when coalesce(_pi.refunded_amount_cents,0)>=_pi.amount_cents then 'refunded'
      when coalesce(_pi.refunded_amount_cents,0)>0 then 'partially_refunded'
      else 'paid' end
    else 'disputed'
  end;

  update private.stripe_order_payment_intents
  set last_event_id=coalesce(nullif(btrim(coalesce(_event_id,'')),''),last_event_id),
      last_event_created=case
        when _event_created is null then last_event_created
        when last_event_created is null then _event_created
        else greatest(last_event_created,_event_created)
      end,
      metadata=metadata || coalesce(_metadata,'{}'::jsonb) || jsonb_build_object(
        'last_dispute_id',nullif(btrim(coalesce(_dispute_id,'')),''),
        'last_dispute_status',_normalized,
        'last_dispute_amount_cents',greatest(coalesce(_amount_cents,0),0),
        'last_dispute_currency',lower(coalesce(nullif(btrim(_currency),''),currency)),
        'last_dispute_event_id',nullif(btrim(coalesce(_event_id,'')),'')
      ),
      updated_at=now()
  where order_id=_pi.order_id;

  update public.orders
  set payment_provider='stripe',payment_status=_payment_status,updated_at=now()
  where id=_pi.order_id and store_id=_pi.store_id;

  return jsonb_build_object('relevant',true,'order_id',_pi.order_id,'payment_status',_payment_status,'dispute_status',_normalized);
end;
$$;

revoke all on function public.backend_record_stripe_order_refund(text,text,text,integer,text,text,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.backend_record_stripe_order_dispute(text,text,text,text,integer,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.backend_record_stripe_order_refund(text,text,text,integer,text,text,bigint,jsonb) to service_role;
grant execute on function public.backend_record_stripe_order_dispute(text,text,text,text,integer,text,text,bigint,jsonb) to service_role;

commit;
