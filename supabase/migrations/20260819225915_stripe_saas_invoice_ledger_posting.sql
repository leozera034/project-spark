begin;

create or replace function public.billing_record_stripe_plan_invoice(
  _provider_subscription_id text,
  _provider_invoice_id text,
  _provider_payment_id text,
  _provider_event_key text,
  _provider_status text,
  _amount_due_cents integer,
  _amount_paid_cents integer,
  _currency text,
  _paid_at timestamptz,
  _due_at timestamptz,
  _metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
declare
  _sub public.store_subscriptions%rowtype;
  _row public.subscription_payments%rowtype;
  _amount integer;
  _entries jsonb;
begin
  select * into _sub
  from public.store_subscriptions
  where billing_provider='stripe' and provider_subscription_id=btrim(_provider_subscription_id)
  limit 1;
  if not found then return jsonb_build_object('relevant',false); end if;

  _amount:=greatest(coalesce(_amount_paid_cents,0),coalesce(_amount_due_cents,0),0);

  insert into public.subscription_payments(
    store_id,subscription_id,reference_month,amount,status,paid_at,provider,
    provider_payment_id,provider_invoice_id,provider_event_key,provider_status,
    amount_cents,currency,billing_interval,due_at,external_reference
  ) values(
    _sub.store_id,_sub.id,date_trunc('month',coalesce(_paid_at,_due_at,now()))::date,
    _amount::numeric/100,
    case when coalesce(_amount_paid_cents,0)>0 or lower(coalesce(_provider_status,''))='paid'
      then 'pago'::public.subscription_payment_status else 'pendente'::public.subscription_payment_status end,
    _paid_at,'stripe',nullif(btrim(coalesce(_provider_payment_id,'')),''),btrim(_provider_invoice_id),
    nullif(btrim(coalesce(_provider_event_key,'')),''),_provider_status,_amount,
    upper(coalesce(nullif(btrim(_currency),''),'BRL')),_sub.billing_interval,_due_at,
    'comandiva:subscription:'||_sub.id::text
  )
  on conflict(provider,provider_invoice_id) where provider is not null and provider_invoice_id is not null
  do update set
    provider_payment_id=coalesce(excluded.provider_payment_id,public.subscription_payments.provider_payment_id),
    provider_event_key=excluded.provider_event_key,
    provider_status=excluded.provider_status,
    status=excluded.status,
    amount=excluded.amount,
    amount_cents=excluded.amount_cents,
    paid_at=coalesce(excluded.paid_at,public.subscription_payments.paid_at),
    due_at=excluded.due_at,
    updated_at=now()
  returning * into _row;

  update public.store_subscriptions
  set last_invoice_id=_provider_invoice_id,
      last_invoice_status=_provider_status,
      last_payment_failure_at=case
        when lower(coalesce(_provider_status,'')) in ('open','past_due','uncollectible') then coalesce(last_payment_failure_at,now())
        when lower(coalesce(_provider_status,''))='paid' then null
        else last_payment_failure_at end,
      updated_at=now()
  where id=_sub.id;

  if _row.status='pago' and _amount>0 then
    _entries:=jsonb_build_array(
      jsonb_build_object('account_code','stripe.platform.balance','owner_type','platform','direction','debit','component_type','saas_cash','amount_cents',_amount),
      jsonb_build_object('account_code','platform.saas.revenue','owner_type','platform','direction','credit','component_type','saas_subscription','amount_cents',_amount)
    );
    perform private.create_and_post_financial_journal(
      'stripe:invoice:'||_provider_invoice_id||':paid',
      'saas_invoice_paid','stripe',_provider_invoice_id,_sub.store_id,null,
      upper(coalesce(nullif(btrim(_currency),''),'BRL')),_entries,
      coalesce(_metadata,'{}'::jsonb)||jsonb_build_object(
        'provider_subscription_id',_provider_subscription_id,
        'provider_payment_id',_provider_payment_id,
        'event_id',_provider_event_key
      ),
      coalesce(_paid_at,now())
    );
  end if;

  return jsonb_build_object('relevant',true,'payment_id',_row.id,'store_id',_row.store_id,'status',_row.status);
end;
$$;

revoke all on function public.billing_record_stripe_plan_invoice(text,text,text,text,text,integer,integer,text,timestamptz,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.billing_record_stripe_plan_invoice(text,text,text,text,text,integer,integer,text,timestamptz,timestamptz,jsonb) to service_role;

commit;
