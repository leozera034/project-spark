create or replace function public.get_store_billing_access(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','pg_temp'
as $function$
declare
  _sub public.store_subscriptions%rowtype;
  _plan_code text;
  _price public.plan_prices%rowtype;
  _policy public.billing_policy%rowtype;
  _stage text := 'full';
  _billing_source text := 'unknown';
  _payment_verified boolean := false;
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
  _last_paid_at timestamptz;
  _last_paid_amount_cents integer;
  _next_charge_at timestamptz;
begin
  select * into _policy from public.billing_policy where policy_key='default';
  select ss.* into _sub from public.store_subscriptions ss where ss.store_id=_store_id limit 1;

  if not found then
    return jsonb_build_object(
      'stage','billing_unconfigured','billing_source','unconfigured','payment_verified',false,
      'plan_code',null,'subscription_status',null,'overdue_days',0,
      'plan_amount_cents',null,'currency',null,'billing_interval',null,
      'last_paid_at',null,'last_paid_amount_cents',null,'next_charge_at',null,
      'can_accept_new_orders',false,'can_process_existing_orders',true,'can_manage_catalog',true,
      'can_use_growth',false,'can_manage_billing',true,'can_login',true
    );
  end if;

  select code into _plan_code from public.plans where id=_sub.plan_id;
  if _sub.plan_price_id is not null then select * into _price from public.plan_prices where id=_sub.plan_price_id; end if;

  select sp.paid_at,coalesce(sp.amount_cents,round(sp.amount*100)::integer)
    into _last_paid_at,_last_paid_amount_cents
  from public.subscription_payments sp
  where sp.subscription_id=_sub.id and sp.status='pago'
  order by coalesce(sp.paid_at,sp.created_at) desc limit 1;

  _manual_complimentary := _sub.complimentary_until is not null and _sub.complimentary_until > now();
  _trial_active := _sub.status='cortesia' and _sub.trial_ends_at is not null and _sub.trial_ends_at > now();
  _payment_verified := _sub.billing_provider='stripe'
    and nullif(btrim(coalesce(_sub.provider_subscription_id,'')),'') is not null
    and lower(coalesce(_sub.provider_status,'')) in ('active','trialing','past_due','unpaid','incomplete','paused');

  if _manual_complimentary then
    _stage := 'complimentary'; _billing_source := 'complimentary';
  elsif _plan_code=coalesce(_policy.fallback_plan_code,'gratis') and _sub.status='ativa' then
    _stage := 'free'; _billing_source := 'free';
  elsif _trial_active then
    _stage := 'trial'; _billing_source := case when _payment_verified then 'stripe_trial' else 'trial' end;
  elsif _sub.status='ativa' and _payment_verified then
    _stage := 'full'; _billing_source := 'stripe_paid';
    _next_charge_at := coalesce(_sub.current_period_end_at,_sub.current_period_end::timestamptz);
  elsif _sub.status='ativa' then
    _stage := 'manual_access'; _billing_source := 'manual_access';
  elsif _sub.status='inadimplente' then
    _billing_source := case when _payment_verified then 'stripe_paid' else 'manual_access' end;
    _anchor := coalesce(_sub.delinquent_since,case when _sub.grace_until is not null then _sub.grace_until-make_interval(days=>coalesce(_sub.grace_days,_policy.payment_grace_days,7)) end,_sub.updated_at,now());
    _overdue_days := greatest(0,floor(extract(epoch from (now()-_anchor))/86400)::integer);
    if _overdue_days>=coalesce(_policy.suspend_orders_after_days,15) then _stage:='suspended_orders'; _can_accept_new_orders:=false; _can_manage_catalog:=false; _can_use_growth:=false;
    elsif _overdue_days>=coalesce(_policy.restrict_writes_after_days,8) then _stage:='restricted_writes'; _can_manage_catalog:=false; _can_use_growth:=false;
    elsif _overdue_days>=coalesce(_policy.restrict_growth_after_days,4) then _stage:='restricted_growth'; _can_use_growth:=false;
    else _stage:='notice'; end if;
    _next_charge_at := coalesce(_sub.current_period_end_at,_sub.current_period_end::timestamptz);
  elsif _sub.status in ('suspensa','cancelada') then
    _stage:='suspended_orders'; _billing_source:=case when _payment_verified then 'stripe_paid' else 'manual_access' end;
    _can_accept_new_orders:=false; _can_manage_catalog:=false; _can_use_growth:=false;
  elsif _sub.status='cortesia' and coalesce(_sub.trial_ends_at,now())<=now() then
    _stage:='trial_expired'; _billing_source:='trial'; _can_accept_new_orders:=false; _can_manage_catalog:=false; _can_use_growth:=false;
  end if;

  return jsonb_build_object(
    'stage',_stage,'billing_source',_billing_source,'payment_verified',_payment_verified,
    'plan_code',_plan_code,'subscription_status',_sub.status::text,'overdue_days',_overdue_days,
    'trial_ends_at',_sub.trial_ends_at,'complimentary_until',_sub.complimentary_until,'grace_until',_sub.grace_until,
    'current_period_end',_sub.current_period_end,'plan_amount_cents',case when _price.id is null then null else _price.amount_cents end,
    'currency',case when _price.id is null then null else _price.currency end,'billing_interval',coalesce(_sub.billing_interval,_price.billing_interval),
    'last_paid_at',_last_paid_at,'last_paid_amount_cents',_last_paid_amount_cents,'next_charge_at',_next_charge_at,
    'can_accept_new_orders',_can_accept_new_orders,'can_process_existing_orders',_can_process_existing_orders,
    'can_manage_catalog',_can_manage_catalog,'can_use_growth',_can_use_growth,'can_manage_billing',_can_manage_billing,'can_login',_can_login
  );
end;
$function$;

create or replace function public.get_my_store_plan_billing_detail(_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _sub public.store_subscriptions%rowtype;
  _plan public.plans%rowtype;
  _price public.plan_prices%rowtype;
  _pending_plan public.plans%rowtype;
  _billing_source text;
  _payment_verified boolean;
  _last_paid jsonb;
begin
  if not private.is_store_member(_store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform private.ensure_store_default_subscription(_store_id);
  select * into _sub from public.store_subscriptions where store_id=_store_id;
  select * into _plan from public.plans where id=_sub.plan_id;
  if _sub.plan_price_id is not null then select * into _price from public.plan_prices where id=_sub.plan_price_id; end if;
  if _sub.pending_plan_id is not null then select * into _pending_plan from public.plans where id=_sub.pending_plan_id; end if;

  _payment_verified := _sub.billing_provider='stripe'
    and nullif(btrim(coalesce(_sub.provider_subscription_id,'')),'') is not null
    and lower(coalesce(_sub.provider_status,'')) in ('active','trialing','past_due','unpaid','incomplete','paused');
  _billing_source := case
    when _sub.complimentary_until is not null and _sub.complimentary_until>now() then 'complimentary'
    when _plan.code='gratis' then 'free'
    when _sub.status='cortesia' and _payment_verified then 'stripe_trial'
    when _sub.status='cortesia' then 'trial'
    when _payment_verified then 'stripe_paid'
    else 'manual_access'
  end;

  select jsonb_build_object('id',sp.id,'amount_cents',coalesce(sp.amount_cents,round(sp.amount*100)::integer),'currency',sp.currency,'paid_at',sp.paid_at,'provider_invoice_id',sp.provider_invoice_id)
  into _last_paid
  from public.subscription_payments sp
  where sp.subscription_id=_sub.id and sp.status='pago'
  order by coalesce(sp.paid_at,sp.created_at) desc limit 1;

  return jsonb_build_object(
    'store_id',_store_id,
    'plan',jsonb_build_object('id',_plan.id,'code',_plan.code,'name',_plan.name,'features',_plan.features,'max_orders_month',_plan.max_orders_month,'max_team_members',_plan.max_team_members,'max_couriers',_plan.max_couriers),
    'price',case when _price.id is null then null else jsonb_build_object('id',_price.id,'amount_cents',_price.amount_cents,'currency',_price.currency,'billing_interval',_price.billing_interval,'trial_days',_price.trial_days) end,
    'subscription',jsonb_build_object(
      'status',_sub.status::text,'provider_status',_sub.provider_status,'billing_provider',_sub.billing_provider,
      'billing_source',_billing_source,'payment_verified',_payment_verified,
      'current_period_end',_sub.current_period_end,'current_period_end_at',_sub.current_period_end_at,
      'trial_ends_at',_sub.trial_ends_at,'grace_until',_sub.grace_until,'cancel_at_period_end',_sub.cancel_at_period_end,
      'last_invoice_id',_sub.last_invoice_id,'last_invoice_status',_sub.last_invoice_status,'last_payment_failure_at',_sub.last_payment_failure_at,
      'last_paid',_last_paid
    ),
    'pending_change',case when _pending_plan.id is null then null else jsonb_build_object('plan_code',_pending_plan.code,'plan_name',_pending_plan.name,'effective_at',_sub.plan_change_effective_at) end,
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',sp.id,'invoice_id',sp.provider_invoice_id,'status',sp.status::text,'provider_status',sp.provider_status,'amount_cents',coalesce(sp.amount_cents,round(sp.amount*100)::integer),'currency',sp.currency,'paid_at',sp.paid_at,'due_at',sp.due_at,'created_at',sp.created_at) order by sp.created_at desc) from (select * from public.subscription_payments where subscription_id=_sub.id order by created_at desc limit 12) sp),'[]'::jsonb)
  );
end;
$function$;