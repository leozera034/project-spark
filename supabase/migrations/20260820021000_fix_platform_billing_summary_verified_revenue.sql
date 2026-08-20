create or replace function public.get_platform_billing_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  result jsonb;
begin
  if not private.has_permission('platform.billing.view'::public.app_permission, null) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select jsonb_build_object(
    'activeSubscriptions', count(*) filter (where ss.billing_provider='stripe' and lower(coalesce(ss.provider_status,''))='active'),
    'trialSubscriptions', count(*) filter (where ss.billing_provider='stripe' and lower(coalesce(ss.provider_status,''))='trialing'),
    'manualAccessSubscriptions', count(*) filter (where ss.status='ativa' and coalesce(ss.billing_provider,'')<>'stripe' and coalesce(p.code,'')<>coalesce(bp.fallback_plan_code,'gratis')),
    'courtesySubscriptions', count(*) filter (where ss.complimentary_until is not null and ss.complimentary_until>now()),
    'internalTrialSubscriptions', count(*) filter (where ss.status='cortesia' and ss.trial_ends_at is not null and ss.trial_ends_at>now() and coalesce(ss.billing_provider,'')<>'stripe'),
    'delinquentSubscriptions', count(*) filter (where ss.status='inadimplente' or lower(coalesce(ss.provider_status,'')) in ('past_due','unpaid')),
    'suspendedSubscriptions', count(*) filter (where ss.status='suspensa' or lower(coalesce(ss.provider_status,''))='paused'),
    'monthlyRecurringRevenue', coalesce(sum(greatest(ss.monthly_price-ss.discount_amount,0)) filter (where ss.billing_provider='stripe' and lower(coalesce(ss.provider_status,''))='active'),0),
    'manualAccessReferenceValue', coalesce(sum(greatest(ss.monthly_price-ss.discount_amount,0)) filter (where ss.status='ativa' and coalesce(ss.billing_provider,'')<>'stripe' and coalesce(p.code,'')<>coalesce(bp.fallback_plan_code,'gratis')),0),
    'paidCurrentMonth', coalesce((select sum(sp.amount) from public.subscription_payments sp where sp.status='pago' and sp.paid_at>=date_trunc('month',now()) and sp.paid_at<date_trunc('month',now())+interval '1 month'),0),
    'generatedAt', now()
  ) into result
  from public.store_subscriptions ss
  left join public.plans p on p.id=ss.plan_id
  left join public.billing_policy bp on bp.policy_key='default';

  return result;
end;
$$;
