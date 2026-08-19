begin;

-- Ensure every store has an explicit commercial state. A missing paid Stripe
-- subscription maps to the configured free/fallback plan, never to NULL.
create or replace function private.ensure_store_default_subscription(_store_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  _existing_id uuid;
  _fallback_code text;
  _plan_id uuid;
  _price_id uuid;
  _amount_cents integer;
begin
  select id into _existing_id from public.store_subscriptions where store_id=_store_id;
  if _existing_id is not null then return _existing_id; end if;

  select coalesce(fallback_plan_code,'gratis') into _fallback_code
  from public.billing_policy where policy_key='default';
  _fallback_code:=coalesce(_fallback_code,'gratis');

  select p.id,pp.id,pp.amount_cents into _plan_id,_price_id,_amount_cents
  from public.plans p
  join public.plan_prices pp on pp.plan_id=p.id and pp.billing_interval='monthly' and pp.is_active
  where p.code=_fallback_code and p.is_active
  order by pp.created_at asc
  limit 1;

  if _plan_id is null or coalesce(_amount_cents,0)<>0 then
    raise exception 'FREE_FALLBACK_PLAN_INVALID';
  end if;

  insert into public.store_subscriptions(
    store_id,plan_id,plan_price_id,status,monthly_price,discount_amount,
    billing_interval,billing_provider,provider_status
  ) values (
    _store_id,_plan_id,_price_id,'ativa',0,0,'monthly',null,null
  )
  on conflict(store_id) do nothing
  returning id into _existing_id;

  if _existing_id is null then
    select id into _existing_id from public.store_subscriptions where store_id=_store_id;
  end if;
  return _existing_id;
end;
$$;
revoke all on function private.ensure_store_default_subscription(uuid) from public,anon,authenticated;
grant execute on function private.ensure_store_default_subscription(uuid) to service_role;

create or replace function public.get_my_store_billing_access(_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.is_store_member(_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  perform private.ensure_store_default_subscription(_store_id);
  perform public.reconcile_store_billing(_store_id);
  return public.get_store_billing_access(_store_id);
end;
$$;

-- Begin checkout using canonical DB price + Stripe mapping. The browser never
-- supplies a Stripe price ID or an amount.
create or replace function public.billing_begin_plan_checkout(
  _actor_user_id uuid,
  _store_id uuid,
  _plan_code text,
  _billing_interval text,
  _idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  _attempt private.plan_checkout_attempts%rowtype;
  _plan public.plans%rowtype;
  _price public.plan_prices%rowtype;
  _provider_ref private.billing_provider_plan_refs%rowtype;
  _current public.store_subscriptions%rowtype;
  _attempt_id uuid;
  _external_reference text;
begin
  if not private.is_store_manager_user(_actor_user_id,_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if _billing_interval not in ('monthly','annual') then
    raise exception 'INVALID_BILLING_INTERVAL' using errcode='P0001';
  end if;
  if nullif(btrim(_idempotency_key),'') is null or length(btrim(_idempotency_key)) not between 8 and 160 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode='P0001';
  end if;

  perform private.ensure_store_default_subscription(_store_id);

  select * into _attempt
  from private.plan_checkout_attempts
  where store_id=_store_id and idempotency_key=btrim(_idempotency_key)
  limit 1;
  if found then
    return jsonb_build_object(
      'reused',true,'attempt_id',_attempt.id,'attempt_status',_attempt.status,
      'provider_price_id',_attempt.provider_price_id,'provider_checkout_id',_attempt.provider_checkout_id,
      'provider_subscription_id',_attempt.provider_subscription_id,'provider_status',_attempt.provider_status,
      'checkout_url',_attempt.checkout_url,'external_reference',_attempt.external_reference,
      'plan_id',_attempt.plan_id,'plan_price_id',_attempt.plan_price_id,'billing_interval',_attempt.billing_interval
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(_store_id::text||':plan:'||lower(btrim(coalesce(_plan_code,'')))||':'||_billing_interval,0));

  select * into _plan from public.plans
  where code=lower(btrim(coalesce(_plan_code,''))) and is_active
  limit 1;
  if not found then raise exception 'PLAN_NOT_FOUND' using errcode='P0001'; end if;

  select * into _price from public.plan_prices
  where plan_id=_plan.id and billing_interval=_billing_interval and is_active
  order by created_at desc limit 1;
  if not found then raise exception 'PLAN_PRICE_NOT_FOUND' using errcode='P0001'; end if;
  if _price.amount_cents<=0 then raise exception 'FREE_PLAN_REQUIRES_NO_CHECKOUT' using errcode='P0001'; end if;

  select * into _provider_ref from private.billing_provider_plan_refs
  where plan_price_id=_price.id and provider='stripe' and provider_status='active'
  limit 1;
  if not found then raise exception 'STRIPE_PRICE_NOT_READY' using errcode='P0001'; end if;

  select * into _current from public.store_subscriptions where store_id=_store_id for update;
  if _current.provider_subscription_id is not null
     and lower(coalesce(_current.provider_status,'')) in ('active','trialing','past_due','unpaid','incomplete') then
    raise exception 'ACTIVE_SUBSCRIPTION_EXISTS' using errcode='P0001';
  end if;

  _attempt_id:=gen_random_uuid();
  _external_reference:='comandiva:plan:'||_attempt_id::text;
  insert into private.plan_checkout_attempts(
    id,store_id,actor_user_id,plan_id,plan_price_id,billing_interval,provider,
    provider_price_id,idempotency_key,external_reference,status
  ) values (
    _attempt_id,_store_id,_actor_user_id,_plan.id,_price.id,_billing_interval,'stripe',
    _provider_ref.provider_plan_id,btrim(_idempotency_key),_external_reference,'created'
  ) returning * into _attempt;

  return jsonb_build_object(
    'reused',false,'attempt_id',_attempt.id,'attempt_status',_attempt.status,
    'provider','stripe','provider_price_id',_provider_ref.provider_plan_id,
    'checkout_url',null,'external_reference',_external_reference,
    'plan_id',_plan.id,'plan_code',_plan.code,'plan_name',_plan.name,
    'plan_price_id',_price.id,'amount_cents',_price.amount_cents,'currency',_price.currency,
    'trial_days',_price.trial_days,'billing_interval',_billing_interval
  );
end;
$$;

create or replace function public.billing_complete_plan_checkout_session_create(
  _actor_user_id uuid,
  _attempt_id uuid,
  _provider_checkout_id text,
  _provider_status text,
  _checkout_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare _attempt private.plan_checkout_attempts%rowtype;
begin
  select * into _attempt from private.plan_checkout_attempts where id=_attempt_id for update;
  if not found then raise exception 'CHECKOUT_ATTEMPT_NOT_FOUND' using errcode='P0001'; end if;
  if not private.is_store_manager_user(_actor_user_id,_attempt.store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if nullif(btrim(_provider_checkout_id),'') is null or nullif(btrim(_checkout_url),'') is null then
    raise exception 'INVALID_PROVIDER_CHECKOUT' using errcode='P0001';
  end if;
  update private.plan_checkout_attempts
  set provider_checkout_id=btrim(_provider_checkout_id),provider_status=nullif(btrim(coalesce(_provider_status,'')),''),
      checkout_url=btrim(_checkout_url),status='checkout_open',failure_code=null,last_error=null,updated_at=now()
  where id=_attempt.id returning * into _attempt;
  return jsonb_build_object('attempt_id',_attempt.id,'attempt_status',_attempt.status,'provider_checkout_id',_attempt.provider_checkout_id,'checkout_url',_attempt.checkout_url,'external_reference',_attempt.external_reference);
end;
$$;

create or replace function public.billing_mark_plan_checkout_error(
  _actor_user_id uuid,
  _attempt_id uuid,
  _failure_code text,
  _last_error text,
  _definitive boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare _attempt private.plan_checkout_attempts%rowtype;
begin
  select * into _attempt from private.plan_checkout_attempts where id=_attempt_id for update;
  if not found then raise exception 'CHECKOUT_ATTEMPT_NOT_FOUND' using errcode='P0001'; end if;
  if not private.is_store_manager_user(_actor_user_id,_attempt.store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  update private.plan_checkout_attempts
  set status=case when _definitive then 'failed' else status end,
      failure_code=left(nullif(btrim(coalesce(_failure_code,'')),''),120),
      last_error=left(nullif(btrim(coalesce(_last_error,'')),''),500),updated_at=now()
  where id=_attempt.id;
  return true;
end;
$$;

-- Backend-only lookup used by signed Stripe webhooks.
create or replace function public.backend_get_plan_checkout_attempt(_attempt_id uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select to_jsonb(a) from private.plan_checkout_attempts a where a.id=_attempt_id limit 1
$$;

-- Primary plan reconciliation. It intentionally activates a paid plan only for
-- Stripe states that grant access. incomplete never upgrades access.
create or replace function public.billing_reconcile_stripe_plan_subscription(
  _provider_subscription_id text,
  _provider_customer_id text,
  _provider_item_id text,
  _provider_status text,
  _external_reference text,
  _provider_price_id text,
  _current_period_start timestamptz,
  _current_period_end timestamptz,
  _trial_end timestamptz,
  _cancel_at_period_end boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  _attempt_id uuid;
  _attempt private.plan_checkout_attempts%rowtype;
  _sub public.store_subscriptions%rowtype;
  _price public.plan_prices%rowtype;
  _policy public.billing_policy%rowtype;
  _fallback_plan_id uuid;
  _fallback_price_id uuid;
  _status text:=lower(btrim(coalesce(_provider_status,'')));
  _access_status public.subscription_status;
begin
  if _external_reference !~ '^comandiva:plan:[0-9a-f-]{36}$' then
    raise exception 'EXTERNAL_REFERENCE_INVALID' using errcode='P0001';
  end if;
  _attempt_id:=split_part(_external_reference,':',3)::uuid;
  select * into _attempt from private.plan_checkout_attempts where id=_attempt_id for update;
  if not found then raise exception 'PLAN_CHECKOUT_NOT_FOUND' using errcode='P0001'; end if;
  if _attempt.provider_price_id is distinct from _provider_price_id then raise exception 'STRIPE_PRICE_MISMATCH' using errcode='P0001'; end if;

  select pp.* into _price
  from public.plan_prices pp
  join private.billing_provider_plan_refs r on r.plan_price_id=pp.id
  where pp.id=_attempt.plan_price_id and r.provider='stripe' and r.provider_plan_id=_provider_price_id and r.provider_status='active';
  if not found then raise exception 'STRIPE_PRICE_MAPPING_MISSING' using errcode='P0001'; end if;

  perform private.ensure_store_default_subscription(_attempt.store_id);
  select * into _sub from public.store_subscriptions where store_id=_attempt.store_id for update;
  select * into _policy from public.billing_policy where policy_key='default';

  if _status in ('active','trialing','past_due','unpaid') then
    _access_status:=case when _status='trialing' then 'cortesia'::public.subscription_status
                         when _status in ('past_due','unpaid') then 'inadimplente'::public.subscription_status
                         else 'ativa'::public.subscription_status end;

    update public.store_subscriptions
    set plan_id=_attempt.plan_id,plan_price_id=_attempt.plan_price_id,
        status=_access_status,monthly_price=case when _attempt.billing_interval='annual' then round((_price.amount_cents::numeric/100)/12,2) else _price.amount_cents::numeric/100 end,
        discount_amount=0,billing_interval=_attempt.billing_interval,billing_provider='stripe',
        provider_customer_id=nullif(btrim(coalesce(_provider_customer_id,'')),''),
        provider_subscription_id=btrim(_provider_subscription_id),provider_item_id=nullif(btrim(coalesce(_provider_item_id,'')),''),
        provider_plan_id=_provider_price_id,provider_status=_provider_status,provider_synced_at=now(),
        current_period_end=_current_period_end::date,trial_ends_at=_trial_end,
        grace_until=case when _status in ('past_due','unpaid') then coalesce(grace_until,now()+make_interval(days=>coalesce(_policy.payment_grace_days,7))) else null end,
        delinquent_since=case when _status in ('past_due','unpaid') then coalesce(delinquent_since,now()) else null end,
        cancel_at_period_end=coalesce(_cancel_at_period_end,false),
        pending_plan_id=null,pending_plan_price_id=null,plan_change_effective_at=null,
        updated_at=now()
    where id=_sub.id returning * into _sub;

    update private.plan_checkout_attempts
    set provider_subscription_id=btrim(_provider_subscription_id),provider_status=_provider_status,
        status=case when _status in ('active','trialing') then 'completed' else status end,updated_at=now()
    where id=_attempt.id;
  elsif _status in ('canceled','incomplete_expired') then
    select p.id,pp.id into _fallback_plan_id,_fallback_price_id
    from public.plans p join public.plan_prices pp on pp.plan_id=p.id and pp.billing_interval='monthly' and pp.is_active
    where p.code=coalesce(_policy.fallback_plan_code,'gratis') and p.is_active and pp.amount_cents=0 limit 1;
    if _fallback_plan_id is null then raise exception 'FREE_FALLBACK_PLAN_MISSING'; end if;

    update public.store_subscriptions
    set plan_id=_fallback_plan_id,plan_price_id=_fallback_price_id,status='ativa',monthly_price=0,discount_amount=0,
        billing_interval='monthly',billing_provider='stripe',provider_customer_id=nullif(btrim(coalesce(_provider_customer_id,'')),''),
        provider_subscription_id=btrim(_provider_subscription_id),provider_item_id=nullif(btrim(coalesce(_provider_item_id,'')),''),
        provider_plan_id=_provider_price_id,provider_status=_provider_status,provider_synced_at=now(),current_period_end=null,
        trial_ends_at=null,grace_until=null,delinquent_since=null,cancel_at_period_end=false,
        pending_plan_id=null,pending_plan_price_id=null,plan_change_effective_at=null,updated_at=now()
    where id=_sub.id returning * into _sub;
    update private.plan_checkout_attempts set provider_subscription_id=btrim(_provider_subscription_id),provider_status=_provider_status,status='cancelled',updated_at=now() where id=_attempt.id;
  else
    -- incomplete/pending states are recorded without prematurely granting the paid plan.
    update public.store_subscriptions
    set billing_provider='stripe',provider_customer_id=coalesce(nullif(btrim(coalesce(_provider_customer_id,'')),''),provider_customer_id),
        provider_subscription_id=btrim(_provider_subscription_id),provider_item_id=coalesce(nullif(btrim(coalesce(_provider_item_id,'')),''),provider_item_id),
        provider_plan_id=_provider_price_id,provider_status=_provider_status,provider_synced_at=now(),updated_at=now()
    where id=_sub.id returning * into _sub;
    update private.plan_checkout_attempts set provider_subscription_id=btrim(_provider_subscription_id),provider_status=_provider_status,updated_at=now() where id=_attempt.id;
  end if;

  return jsonb_build_object('kind','plan','attempt_id',_attempt.id,'store_id',_attempt.store_id,'plan_id',_sub.plan_id,'status',_sub.status,'provider_status',_sub.provider_status);
end;
$$;

-- Invoice projection for the current SaaS subscription. Stripe remains source of truth.
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
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare _sub public.store_subscriptions%rowtype; _row public.subscription_payments%rowtype; _amount integer;
begin
  select * into _sub from public.store_subscriptions
  where billing_provider='stripe' and provider_subscription_id=btrim(_provider_subscription_id)
  limit 1;
  if not found then return jsonb_build_object('relevant',false); end if;
  _amount:=greatest(coalesce(_amount_paid_cents,0),coalesce(_amount_due_cents,0),0);
  insert into public.subscription_payments(
    store_id,subscription_id,reference_month,amount,status,paid_at,provider,provider_payment_id,
    provider_invoice_id,provider_event_key,provider_status,amount_cents,currency,billing_interval,due_at,external_reference
  ) values (
    _sub.store_id,_sub.id,date_trunc('month',coalesce(_paid_at,_due_at,now()))::date,_amount::numeric/100,
    case when coalesce(_amount_paid_cents,0)>0 or lower(coalesce(_provider_status,''))='paid' then 'pago'::public.subscription_payment_status else 'pendente'::public.subscription_payment_status end,
    _paid_at,'stripe',nullif(btrim(coalesce(_provider_payment_id,'')),''),btrim(_provider_invoice_id),nullif(btrim(coalesce(_provider_event_key,'')),''),
    _provider_status,_amount,upper(coalesce(nullif(btrim(_currency),''),'BRL')),_sub.billing_interval,_due_at,'comandiva:subscription:'||_sub.id::text
  )
  on conflict(provider,provider_invoice_id) where provider is not null and provider_invoice_id is not null
  do update set provider_payment_id=coalesce(excluded.provider_payment_id,public.subscription_payments.provider_payment_id),
    provider_event_key=excluded.provider_event_key,provider_status=excluded.provider_status,status=excluded.status,
    amount=excluded.amount,amount_cents=excluded.amount_cents,paid_at=coalesce(excluded.paid_at,public.subscription_payments.paid_at),
    due_at=excluded.due_at,updated_at=now()
  returning * into _row;

  update public.store_subscriptions set last_invoice_id=_provider_invoice_id,last_invoice_status=_provider_status,
    last_payment_failure_at=case when lower(coalesce(_provider_status,'')) in ('open','past_due','uncollectible') then coalesce(last_payment_failure_at,now()) else null end,
    updated_at=now() where id=_sub.id;
  return jsonb_build_object('relevant',true,'payment_id',_row.id,'store_id',_row.store_id,'status',_row.status);
end;
$$;

create or replace function public.get_my_store_plan_billing_detail(_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare _sub public.store_subscriptions%rowtype; _plan public.plans%rowtype; _price public.plan_prices%rowtype; _pending_plan public.plans%rowtype;
begin
  if not private.is_store_member(_store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform private.ensure_store_default_subscription(_store_id);
  select * into _sub from public.store_subscriptions where store_id=_store_id;
  select * into _plan from public.plans where id=_sub.plan_id;
  if _sub.plan_price_id is not null then select * into _price from public.plan_prices where id=_sub.plan_price_id; end if;
  if _sub.pending_plan_id is not null then select * into _pending_plan from public.plans where id=_sub.pending_plan_id; end if;
  return jsonb_build_object(
    'store_id',_store_id,'plan',jsonb_build_object('id',_plan.id,'code',_plan.code,'name',_plan.name,'features',_plan.features,'max_orders_month',_plan.max_orders_month,'max_team_members',_plan.max_team_members,'max_couriers',_plan.max_couriers),
    'price',case when _price.id is null then null else jsonb_build_object('id',_price.id,'amount_cents',_price.amount_cents,'currency',_price.currency,'billing_interval',_price.billing_interval,'trial_days',_price.trial_days) end,
    'subscription',jsonb_build_object('status',_sub.status::text,'provider_status',_sub.provider_status,'billing_provider',_sub.billing_provider,'current_period_end',_sub.current_period_end,'trial_ends_at',_sub.trial_ends_at,'grace_until',_sub.grace_until,'cancel_at_period_end',_sub.cancel_at_period_end,'last_invoice_id',_sub.last_invoice_id,'last_invoice_status',_sub.last_invoice_status,'last_payment_failure_at',_sub.last_payment_failure_at),
    'pending_change',case when _pending_plan.id is null then null else jsonb_build_object('plan_code',_pending_plan.code,'plan_name',_pending_plan.name,'effective_at',_sub.plan_change_effective_at) end,
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',sp.id,'invoice_id',sp.provider_invoice_id,'status',sp.status::text,'provider_status',sp.provider_status,'amount_cents',coalesce(sp.amount_cents,round(sp.amount*100)::integer),'currency',sp.currency,'paid_at',sp.paid_at,'due_at',sp.due_at,'created_at',sp.created_at) order by sp.created_at desc) from (select * from public.subscription_payments where subscription_id=_sub.id order by created_at desc limit 12) sp),'[]'::jsonb)
  );
end;
$$;

-- Only authenticated store members may use the public read RPC. All write/reconcile
-- RPCs are called by authenticated Edge Functions/service-role paths.
revoke all on function public.billing_begin_plan_checkout(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.billing_complete_plan_checkout_session_create(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.billing_mark_plan_checkout_error(uuid,uuid,text,text,boolean) from public,anon,authenticated;
revoke all on function public.backend_get_plan_checkout_attempt(uuid) from public,anon,authenticated;
revoke all on function public.billing_reconcile_stripe_plan_subscription(text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.billing_record_stripe_plan_invoice(text,text,text,text,text,integer,integer,text,timestamptz,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.billing_begin_plan_checkout(uuid,uuid,text,text,text) to service_role;
grant execute on function public.billing_complete_plan_checkout_session_create(uuid,uuid,text,text,text) to service_role;
grant execute on function public.billing_mark_plan_checkout_error(uuid,uuid,text,text,boolean) to service_role;
grant execute on function public.backend_get_plan_checkout_attempt(uuid) to service_role;
grant execute on function public.billing_reconcile_stripe_plan_subscription(text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean) to service_role;
grant execute on function public.billing_record_stripe_plan_invoice(text,text,text,text,text,integer,integer,text,timestamptz,timestamptz,jsonb) to service_role;
revoke all on function public.get_my_store_plan_billing_detail(uuid) from public,anon;
grant execute on function public.get_my_store_plan_billing_detail(uuid) to authenticated,service_role;

commit;
