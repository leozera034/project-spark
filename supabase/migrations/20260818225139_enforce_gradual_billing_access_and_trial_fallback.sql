alter table public.store_subscriptions
  add column if not exists delinquent_since timestamptz;

create or replace function private.set_subscription_delinquent_since()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.status = 'inadimplente' and (tg_op = 'INSERT' or old.status is distinct from 'inadimplente') then
    new.delinquent_since := coalesce(new.delinquent_since, now());
    new.grace_until := coalesce(new.grace_until, now() + make_interval(days => coalesce(new.grace_days, 7)));
  elsif new.status in ('ativa','cortesia') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.delinquent_since := null;
    new.grace_until := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_store_subscription_delinquent_since on public.store_subscriptions;
create trigger trg_store_subscription_delinquent_since
before insert or update of status on public.store_subscriptions
for each row execute function private.set_subscription_delinquent_since();

update public.store_subscriptions
set delinquent_since = coalesce(
      delinquent_since,
      case when grace_until is not null then grace_until - make_interval(days => grace_days) end,
      updated_at,
      now()
    ),
    grace_until = coalesce(
      grace_until,
      coalesce(delinquent_since, updated_at, now()) + make_interval(days => grace_days)
    )
where status = 'inadimplente';

create or replace function public.reconcile_store_billing(_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _sub public.store_subscriptions%rowtype;
  _current_plan_code text;
  _fallback_code text := 'gratis';
  _fallback_plan_id uuid;
  _fallback_price_id uuid;
  _fallback_amount_cents integer := 0;
  _changed boolean := false;
begin
  select * into _sub
  from public.store_subscriptions
  where store_id = _store_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'subscription_missing', 'changed', false);
  end if;

  select code into _current_plan_code from public.plans where id = _sub.plan_id;
  select fallback_plan_code into _fallback_code
  from public.billing_policy
  where policy_key = 'default';
  _fallback_code := coalesce(_fallback_code, 'gratis');

  if _sub.complimentary_until is not null and _sub.complimentary_until > now() then
    return jsonb_build_object('ok', true, 'reason', 'manual_complimentary', 'changed', false, 'plan_code', _current_plan_code);
  end if;

  if _sub.status = 'cortesia'
     and _sub.trial_ends_at is not null
     and _sub.trial_ends_at <= now()
     and coalesce(_sub.provider_status, '') not in ('authorized', 'active') then
    select p.id, pp.id, pp.amount_cents
      into _fallback_plan_id, _fallback_price_id, _fallback_amount_cents
    from public.plans p
    left join public.plan_prices pp
      on pp.plan_id = p.id
     and pp.billing_interval = 'monthly'
     and pp.is_active
    where p.code = _fallback_code
      and p.is_active
    limit 1;

    if _fallback_plan_id is null then
      raise exception 'BILLING_FALLBACK_PLAN_MISSING';
    end if;

    update public.store_subscriptions
    set plan_id = _fallback_plan_id,
        plan_price_id = _fallback_price_id,
        status = 'ativa',
        monthly_price = coalesce(_fallback_amount_cents, 0)::numeric / 100,
        discount_amount = 0,
        billing_interval = 'monthly',
        billing_provider = null,
        provider_customer_id = null,
        provider_subscription_id = null,
        provider_plan_id = null,
        provider_status = null,
        provider_synced_at = null,
        trial_ends_at = null,
        current_period_end = null,
        grace_until = null,
        delinquent_since = null,
        cancel_at_period_end = false,
        notes = concat_ws(E'\n', nullif(notes, ''), format('Trial encerrado em %s; migração automática para o plano %s.', now(), _fallback_code)),
        updated_at = now()
    where id = _sub.id;

    insert into public.audit_logs(store_id, actor_kind, action, entity, entity_id, context)
    values(
      _store_id,
      'sistema',
      'billing.trial_fallback',
      'store_subscriptions',
      _sub.id,
      jsonb_build_object('from_plan', _current_plan_code, 'to_plan', _fallback_code, 'trial_ended_at', _sub.trial_ends_at)
    );

    _changed := true;
    _current_plan_code := _fallback_code;
  end if;

  return jsonb_build_object('ok', true, 'changed', _changed, 'plan_code', _current_plan_code);
end;
$function$;

revoke all on function public.reconcile_store_billing(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_store_billing(uuid) to service_role;

create or replace function public.get_store_billing_access(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _sub public.store_subscriptions%rowtype;
  _plan_code text;
  _policy public.billing_policy%rowtype;
  _stage text := 'full';
  _overdue_days integer := 0;
  _anchor timestamptz;
  _manual_complimentary boolean := false;
  _trial_active boolean := false;
  _can_accept_new_orders boolean := true;
  _can_process_existing_orders boolean := true;
  _can_manage_catalog boolean := true;
  _can_use_growth boolean := true;
  _can_manage_billing boolean := true;
  _can_login boolean := true;
begin
  select * into _policy from public.billing_policy where policy_key = 'default';

  select ss.* into _sub
  from public.store_subscriptions ss
  where ss.store_id = _store_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'stage', 'billing_unconfigured',
      'plan_code', null,
      'subscription_status', null,
      'overdue_days', 0,
      'can_accept_new_orders', false,
      'can_process_existing_orders', true,
      'can_manage_catalog', true,
      'can_use_growth', false,
      'can_manage_billing', true,
      'can_login', true
    );
  end if;

  select code into _plan_code from public.plans where id = _sub.plan_id;
  _manual_complimentary := _sub.complimentary_until is not null and _sub.complimentary_until > now();
  _trial_active := _sub.status = 'cortesia' and _sub.trial_ends_at is not null and _sub.trial_ends_at > now();

  if _manual_complimentary then
    _stage := 'complimentary';
  elsif _plan_code = coalesce(_policy.fallback_plan_code, 'gratis') and _sub.status = 'ativa' then
    _stage := 'free';
  elsif _trial_active then
    _stage := 'trial';
  elsif _sub.status = 'ativa' then
    _stage := 'full';
  elsif _sub.status = 'inadimplente' then
    _anchor := coalesce(
      _sub.delinquent_since,
      case when _sub.grace_until is not null then _sub.grace_until - make_interval(days => coalesce(_sub.grace_days, _policy.payment_grace_days, 7)) end,
      _sub.updated_at,
      now()
    );
    _overdue_days := greatest(0, floor(extract(epoch from (now() - _anchor)) / 86400)::integer);

    if _overdue_days >= coalesce(_policy.suspend_orders_after_days, 15) then
      _stage := 'suspended_orders';
      _can_accept_new_orders := false;
      _can_manage_catalog := false;
      _can_use_growth := false;
    elsif _overdue_days >= coalesce(_policy.restrict_writes_after_days, 8) then
      _stage := 'restricted_writes';
      _can_manage_catalog := false;
      _can_use_growth := false;
    elsif _overdue_days >= coalesce(_policy.restrict_growth_after_days, 4) then
      _stage := 'restricted_growth';
      _can_use_growth := false;
    else
      _stage := 'notice';
    end if;
  elsif _sub.status in ('suspensa','cancelada') then
    _stage := 'suspended_orders';
    _can_accept_new_orders := false;
    _can_manage_catalog := false;
    _can_use_growth := false;
  elsif _sub.status = 'cortesia' and coalesce(_sub.trial_ends_at, now()) <= now() then
    _stage := 'trial_expired';
    _can_accept_new_orders := false;
    _can_manage_catalog := false;
    _can_use_growth := false;
  end if;

  return jsonb_build_object(
    'stage', _stage,
    'plan_code', _plan_code,
    'subscription_status', _sub.status::text,
    'overdue_days', _overdue_days,
    'trial_ends_at', _sub.trial_ends_at,
    'complimentary_until', _sub.complimentary_until,
    'grace_until', _sub.grace_until,
    'current_period_end', _sub.current_period_end,
    'can_accept_new_orders', _can_accept_new_orders,
    'can_process_existing_orders', _can_process_existing_orders,
    'can_manage_catalog', _can_manage_catalog,
    'can_use_growth', _can_use_growth,
    'can_manage_billing', _can_manage_billing,
    'can_login', _can_login
  );
end;
$function$;

revoke all on function public.get_store_billing_access(uuid) from public, anon, authenticated;
grant execute on function public.get_store_billing_access(uuid) to service_role;

create or replace function public.storefront_submit_order(_slug text, _payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_result jsonb;
  v_detail text;
  v_store_id uuid;
  v_access jsonb;
begin
  select st.id into v_store_id
  from public.stores st
  where st.slug = public.storefront_normalize_slug(_slug)
    and st.status = 'ativa'
  limit 1;

  if v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'store_unavailable');
  end if;

  perform public.reconcile_store_billing(v_store_id);
  v_access := public.get_store_billing_access(v_store_id);

  if not coalesce((v_access->>'can_accept_new_orders')::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'error', 'store_temporarily_unavailable',
      'reason', 'billing_restricted',
      'billing_stage', v_access->>'stage'
    );
  end if;

  begin
    v_result := private.storefront_submit_order(_slug, _payload);
    if not coalesce((v_result->>'ok')::boolean,false) then
      raise exception using errcode='P0001',message='SHARK_CHECKOUT_ROLLBACK',detail=v_result::text;
    end if;
    return v_result;
  exception
    when sqlstate 'P0001' then
      if sqlerrm='SHARK_CHECKOUT_ROLLBACK' then
        get stacked diagnostics v_detail=PG_EXCEPTION_DETAIL;
        return v_detail::jsonb;
      end if;
      if sqlerrm in ('PRODUCT_STOCK_INSUFFICIENT','OPTION_STOCK_INSUFFICIENT') then
        return jsonb_build_object('ok',false,'error','line_unavailable','reason','out_of_stock');
      end if;
      raise;
  end;
end;
$function$;
