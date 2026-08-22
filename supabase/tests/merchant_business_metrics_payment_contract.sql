begin;

do $$
declare
  _uid uuid;
  _sid uuid;
  _oid uuid;
  _local_day date;
  _report_before jsonb;
  _report_after jsonb;
  _growth_before jsonb;
  _growth_after jsonb;
  _series_before bigint;
  _series_after bigint;
begin
  select r.user_id,o.store_id,o.id,(o.created_at at time zone coalesce(s.timezone,'America/Sao_Paulo'))::date
    into _uid,_sid,_oid,_local_day
  from public.orders o
  join public.stores s on s.id=o.store_id
  join public.user_roles r on r.store_id=o.store_id and r.is_active and r.role in ('proprietario','gerente')
  join public.user_profiles p on p.id=r.user_id and p.is_active
  where o.status in ('entregue','retirado')
    and o.payment_method_kind is distinct from 'stripe_online'
    and o.created_at>=now()-interval '30 days'
  order by o.created_at desc
  limit 1;

  if _uid is null then
    raise exception 'NO_ELIGIBLE_ORDER';
  end if;

  perform set_config('request.jwt.claim.sub',_uid::text,true);

  _report_before:=public.get_my_store_business_report_summary(_sid,'custom',_local_day,_local_day);
  _growth_before:=public.get_store_growth_summary(_sid);
  select coalesce(sum(x.orders),0)::bigint into _series_before
  from public.get_store_revenue_series(_sid,30) x;

  update public.orders
  set payment_method_kind='stripe_online',payment_status='pending'
  where id=_oid and store_id=_sid;

  _report_after:=public.get_my_store_business_report_summary(_sid,'custom',_local_day,_local_day);
  _growth_after:=public.get_store_growth_summary(_sid);
  select coalesce(sum(x.orders),0)::bigint into _series_after
  from public.get_store_revenue_series(_sid,30) x;

  if (_report_after->>'totalOrders')::bigint <> (_report_before->>'totalOrders')::bigint-1 then
    raise exception 'BUSINESS_REPORT_UNPAID_STRIPE_NOT_EXCLUDED';
  end if;
  if (_growth_after->>'orders30d')::bigint <> (_growth_before->>'orders30d')::bigint-1 then
    raise exception 'GROWTH_SUMMARY_UNPAID_STRIPE_NOT_EXCLUDED';
  end if;
  if _series_after <> _series_before-1 then
    raise exception 'REVENUE_SERIES_UNPAID_STRIPE_NOT_EXCLUDED';
  end if;
end $$;

select 'merchant_business_metrics_payment_gate_passed' as result;

rollback;
