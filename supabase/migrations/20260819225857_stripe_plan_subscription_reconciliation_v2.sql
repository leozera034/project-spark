begin;

create or replace function public.billing_reconcile_stripe_plan_subscription_event(
  _provider_subscription_id text,
  _provider_customer_id text,
  _provider_item_id text,
  _provider_status text,
  _external_reference text,
  _provider_price_id text,
  _current_period_start timestamptz,
  _current_period_end timestamptz,
  _trial_end timestamptz,
  _cancel_at_period_end boolean,
  _provider_event_created bigint
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
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
  _store_id uuid;
  _initial_checkout boolean:=false;
begin
  if nullif(btrim(coalesce(_provider_subscription_id,'')),'') is null then raise exception 'SUBSCRIPTION_ID_REQUIRED'; end if;
  if nullif(btrim(coalesce(_provider_price_id,'')),'') is null then raise exception 'STRIPE_PRICE_REQUIRED'; end if;

  select * into _sub
  from public.store_subscriptions
  where billing_provider='stripe' and provider_subscription_id=btrim(_provider_subscription_id)
  limit 1 for update;

  if found then
    _store_id:=_sub.store_id;
    if _provider_event_created is not null and _sub.provider_event_created is not null and _provider_event_created < _sub.provider_event_created then
      return jsonb_build_object('kind','plan','store_id',_store_id,'status',_sub.status,'provider_status',_sub.provider_status,'stale_event',true);
    end if;
  else
    if coalesce(_external_reference,'') !~ '^comandiva:plan:[0-9a-f-]{36}$' then raise exception 'EXTERNAL_REFERENCE_INVALID'; end if;
    _attempt_id:=split_part(_external_reference,':',3)::uuid;
    select * into _attempt from private.plan_checkout_attempts where id=_attempt_id for update;
    if not found then raise exception 'PLAN_CHECKOUT_NOT_FOUND'; end if;
    if _attempt.provider_price_id is distinct from _provider_price_id then raise exception 'STRIPE_PRICE_MISMATCH'; end if;
    _store_id:=_attempt.store_id;
    perform private.ensure_store_default_subscription(_store_id);
    select * into _sub from public.store_subscriptions where store_id=_store_id for update;
    _initial_checkout:=true;
  end if;

  select pp.* into _price
  from public.plan_prices pp
  join private.billing_provider_plan_refs r on r.plan_price_id=pp.id
  where r.provider='stripe' and r.provider_plan_id=_provider_price_id and r.provider_status='active'
    and pp.is_active
  limit 1;
  if not found then raise exception 'STRIPE_PRICE_MAPPING_MISSING'; end if;

  select * into _policy from public.billing_policy where policy_key='default';

  if _status in ('active','trialing','past_due','unpaid','incomplete','paused') then
    _access_status:=case
      when _status='trialing' then 'cortesia'::public.subscription_status
      when _status in ('past_due','unpaid') then 'inadimplente'::public.subscription_status
      when _status='paused' then 'suspensa'::public.subscription_status
      else 'ativa'::public.subscription_status end;

    update public.store_subscriptions set
      plan_id=_price.plan_id,
      plan_price_id=_price.id,
      status=_access_status,
      monthly_price=case when _price.billing_interval='annual' then round((_price.amount_cents::numeric/100)/12,2) else _price.amount_cents::numeric/100 end,
      discount_amount=0,
      billing_interval=_price.billing_interval,
      billing_provider='stripe',
      provider_customer_id=coalesce(nullif(btrim(coalesce(_provider_customer_id,'')),''),provider_customer_id),
      provider_subscription_id=btrim(_provider_subscription_id),
      provider_item_id=coalesce(nullif(btrim(coalesce(_provider_item_id,'')),''),provider_item_id),
      provider_plan_id=_provider_price_id,
      provider_status=_provider_status,
      provider_synced_at=now(),
      provider_event_created=coalesce(_provider_event_created,provider_event_created),
      current_period_start_at=_current_period_start,
      current_period_end_at=_current_period_end,
      current_period_end=_current_period_end::date,
      trial_ends_at=case when _status='trialing' then _trial_end else null end,
      grace_until=case when _status in ('past_due','unpaid') then coalesce(grace_until,now()+make_interval(days=>coalesce(_policy.payment_grace_days,7))) else null end,
      delinquent_since=case when _status in ('past_due','unpaid') then coalesce(delinquent_since,now()) else null end,
      cancel_at_period_end=coalesce(_cancel_at_period_end,false),
      pending_plan_id=case when pending_plan_price_id=_price.id then null else pending_plan_id end,
      pending_plan_price_id=case when pending_plan_price_id=_price.id then null else pending_plan_price_id end,
      plan_change_effective_at=case when pending_plan_price_id=_price.id then null else plan_change_effective_at end,
      cancelled_at=null,
      updated_at=now()
    where id=_sub.id
    returning * into _sub;

    if _initial_checkout then
      update private.plan_checkout_attempts
      set provider_subscription_id=btrim(_provider_subscription_id),provider_status=_provider_status,
          status=case when _status in ('active','trialing') then 'completed' else status end,updated_at=now()
      where id=_attempt.id;
    end if;

  elsif _status in ('canceled','incomplete_expired') then
    select p.id,pp.id into _fallback_plan_id,_fallback_price_id
    from public.plans p
    join public.plan_prices pp on pp.plan_id=p.id and pp.billing_interval='monthly' and pp.is_active
    where p.code=coalesce(_policy.fallback_plan_code,'gratis') and p.is_active and pp.amount_cents=0
    limit 1;
    if _fallback_plan_id is null then raise exception 'FREE_FALLBACK_PLAN_MISSING'; end if;

    update public.store_subscriptions set
      plan_id=_fallback_plan_id,
      plan_price_id=_fallback_price_id,
      status='ativa',
      monthly_price=0,
      discount_amount=0,
      billing_interval='monthly',
      billing_provider='stripe',
      provider_customer_id=coalesce(nullif(btrim(coalesce(_provider_customer_id,'')),''),provider_customer_id),
      provider_subscription_id=btrim(_provider_subscription_id),
      provider_item_id=coalesce(nullif(btrim(coalesce(_provider_item_id,'')),''),provider_item_id),
      provider_plan_id=_provider_price_id,
      provider_status=_provider_status,
      provider_synced_at=now(),
      provider_event_created=coalesce(_provider_event_created,provider_event_created),
      current_period_start_at=null,current_period_end_at=null,current_period_end=null,
      trial_ends_at=null,grace_until=null,delinquent_since=null,cancel_at_period_end=false,
      pending_plan_id=null,pending_plan_price_id=null,plan_change_effective_at=null,provider_schedule_id=null,
      cancelled_at=coalesce(cancelled_at,now()),updated_at=now()
    where id=_sub.id returning * into _sub;

    if _initial_checkout then
      update private.plan_checkout_attempts
      set provider_subscription_id=btrim(_provider_subscription_id),provider_status=_provider_status,status='cancelled',updated_at=now()
      where id=_attempt.id;
    end if;
  else
    update public.store_subscriptions
    set provider_status=_provider_status,provider_synced_at=now(),provider_event_created=coalesce(_provider_event_created,provider_event_created),updated_at=now()
    where id=_sub.id returning * into _sub;
  end if;

  return jsonb_build_object('kind','plan','store_id',_sub.store_id,'plan_id',_sub.plan_id,'status',_sub.status,'provider_status',_sub.provider_status,'initial_checkout',_initial_checkout);
end;
$$;
revoke all on function public.billing_reconcile_stripe_plan_subscription_event(text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean,bigint) from public,anon,authenticated;
grant execute on function public.billing_reconcile_stripe_plan_subscription_event(text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean,bigint) to service_role;

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
) returns jsonb
language sql
security definer
set search_path='pg_catalog','public'
as $$
  select public.billing_reconcile_stripe_plan_subscription_event(
    _provider_subscription_id,_provider_customer_id,_provider_item_id,_provider_status,_external_reference,
    _provider_price_id,_current_period_start,_current_period_end,_trial_end,_cancel_at_period_end,null
  );
$$;
revoke all on function public.billing_reconcile_stripe_plan_subscription(text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.billing_reconcile_stripe_plan_subscription(text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean) to service_role;

commit;
