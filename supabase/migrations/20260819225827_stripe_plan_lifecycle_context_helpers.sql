begin;

create or replace function public.backend_get_plan_lifecycle_context(
  _actor_user_id uuid,
  _store_id uuid,
  _target_plan_code text default null,
  _billing_interval text default null
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
declare
  _sub public.store_subscriptions%rowtype;
  _current_plan public.plans%rowtype;
  _current_price public.plan_prices%rowtype;
  _target_plan public.plans%rowtype;
  _target_price public.plan_prices%rowtype;
  _target_ref private.billing_provider_plan_refs%rowtype;
  _direction text;
  _current_monthly_equiv numeric:=0;
  _target_monthly_equiv numeric:=0;
begin
  if not private.is_store_manager_user(_actor_user_id,_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  perform private.ensure_store_default_subscription(_store_id);
  select * into _sub from public.store_subscriptions where store_id=_store_id;
  select * into _current_plan from public.plans where id=_sub.plan_id;
  if _sub.plan_price_id is not null then
    select * into _current_price from public.plan_prices where id=_sub.plan_price_id;
  end if;

  if nullif(btrim(coalesce(_target_plan_code,'')),'') is not null then
    if _billing_interval not in ('monthly','annual') then raise exception 'INVALID_BILLING_INTERVAL'; end if;
    select * into _target_plan from public.plans where code=lower(btrim(_target_plan_code)) and is_active limit 1;
    if not found or _target_plan.code='gratis' then raise exception 'TARGET_PLAN_NOT_FOUND'; end if;
    select * into _target_price from public.plan_prices
      where plan_id=_target_plan.id and billing_interval=_billing_interval and is_active
      order by created_at desc limit 1;
    if not found or _target_price.amount_cents<=0 then raise exception 'TARGET_PLAN_NOT_FOUND'; end if;
    select * into _target_ref from private.billing_provider_plan_refs
      where plan_price_id=_target_price.id and provider='stripe' and provider_status='active' limit 1;
    if not found then raise exception 'STRIPE_PRICE_NOT_READY'; end if;
    if _sub.plan_price_id=_target_price.id then raise exception 'SAME_PLAN'; end if;

    _current_monthly_equiv:=case when coalesce(_sub.billing_interval,'monthly')='annual'
      then coalesce(_current_price.amount_cents,0)::numeric/12 else coalesce(_current_price.amount_cents,0)::numeric end;
    _target_monthly_equiv:=case when _target_price.billing_interval='annual'
      then _target_price.amount_cents::numeric/12 else _target_price.amount_cents::numeric end;
    _direction:=case
      when _target_plan.sort_order>_current_plan.sort_order then 'upgrade'
      when _target_plan.sort_order<_current_plan.sort_order then 'downgrade'
      when _target_monthly_equiv>_current_monthly_equiv then 'upgrade'
      else 'downgrade' end;
  end if;

  return jsonb_build_object(
    'store_id',_store_id,
    'provider_subscription_id',_sub.provider_subscription_id,
    'provider_item_id',_sub.provider_item_id,
    'provider_schedule_id',_sub.provider_schedule_id,
    'provider_status',_sub.provider_status,
    'cancel_at_period_end',_sub.cancel_at_period_end,
    'current_period_end_at',coalesce(_sub.current_period_end_at,_sub.current_period_end::timestamptz),
    'current_plan_id',_current_plan.id,
    'current_plan_code',_current_plan.code,
    'current_plan_price_id',_sub.plan_price_id,
    'current_provider_price_id',_sub.provider_plan_id,
    'direction',_direction,
    'target_plan_id',_target_plan.id,
    'target_plan_code',_target_plan.code,
    'target_plan_price_id',_target_price.id,
    'target_provider_price_id',_target_ref.provider_plan_id,
    'target_amount_cents',_target_price.amount_cents,
    'target_billing_interval',_target_price.billing_interval
  );
end;
$$;
revoke all on function public.backend_get_plan_lifecycle_context(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.backend_get_plan_lifecycle_context(uuid,uuid,text,text) to service_role;

create or replace function public.backend_stage_plan_change(
  _store_id uuid,
  _target_plan_id uuid,
  _target_plan_price_id uuid,
  _effective_at timestamptz,
  _provider_schedule_id text default null
) returns boolean
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
begin
  update public.store_subscriptions
  set pending_plan_id=_target_plan_id,
      pending_plan_price_id=_target_plan_price_id,
      plan_change_effective_at=_effective_at,
      provider_schedule_id=coalesce(nullif(btrim(coalesce(_provider_schedule_id,'')),''),provider_schedule_id),
      updated_at=now()
  where store_id=_store_id;
  return found;
end;
$$;
revoke all on function public.backend_stage_plan_change(uuid,uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.backend_stage_plan_change(uuid,uuid,uuid,timestamptz,text) to service_role;

create or replace function public.backend_clear_pending_plan_change(_store_id uuid) returns boolean
language plpgsql security definer set search_path='pg_catalog','public' as $$
begin
  update public.store_subscriptions
  set pending_plan_id=null,pending_plan_price_id=null,plan_change_effective_at=null,provider_schedule_id=null,updated_at=now()
  where store_id=_store_id;
  return found;
end;
$$;
revoke all on function public.backend_clear_pending_plan_change(uuid) from public,anon,authenticated;
grant execute on function public.backend_clear_pending_plan_change(uuid) to service_role;

create or replace function public.backend_set_plan_cancel_state(_store_id uuid,_cancel_at_period_end boolean) returns boolean
language plpgsql security definer set search_path='pg_catalog','public' as $$
begin
  update public.store_subscriptions set cancel_at_period_end=_cancel_at_period_end,updated_at=now() where store_id=_store_id;
  return found;
end;
$$;
revoke all on function public.backend_set_plan_cancel_state(uuid,boolean) from public,anon,authenticated;
grant execute on function public.backend_set_plan_cancel_state(uuid,boolean) to service_role;

commit;
