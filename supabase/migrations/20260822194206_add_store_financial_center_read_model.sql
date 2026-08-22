create or replace function public.get_my_store_financial_center(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  _uid uuid:=auth.uid();
  _pref private.store_payout_preferences%rowtype;
  _connect private.stripe_connect_accounts%rowtype;
  _policy private.financial_fee_policy%rowtype;
  _available bigint:=0;
  _pending bigint:=0;
  _reserved bigint:=0;
  _transferred bigint:=0;
  _effective_order_fee_bps integer:=0;
  _settlements jsonb:='[]'::jsonb;
  _payouts jsonb:='[]'::jsonb;
begin
  if not private.is_store_manager_user(_uid,_store_id) and not private.is_platform_admin_user(_uid) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if not exists(select 1 from public.stores s where s.id=_store_id) then
    raise exception 'STORE_NOT_FOUND' using errcode='P0001';
  end if;

  select * into _pref from private.store_payout_preferences where store_id=_store_id;
  select * into _connect from private.stripe_connect_accounts where store_id=_store_id;
  select * into _policy from private.financial_fee_policy where policy_key='default';
  _effective_order_fee_bps:=coalesce(_connect.application_fee_bps_override,_policy.order_application_fee_bps,0);

  select
    coalesce(sum(e.merchant_payable_cents) filter (
      where e.status='available' and e.payout_request_id is null and (e.available_at is null or e.available_at<=now())
    ),0),
    coalesce(sum(e.merchant_payable_cents) filter (
      where e.payout_request_id is null and (e.status='pending' or (e.status='available' and e.available_at is not null and e.available_at>now()))
    ),0),
    coalesce(sum(e.merchant_payable_cents) filter (where e.status='reserved'),0),
    coalesce(sum(e.merchant_payable_cents) filter (where e.status='transferred'),0)
  into _available,_pending,_reserved,_transferred
  from private.store_settlement_entries e
  where e.store_id=_store_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,
    'orderId',x.order_id,
    'orderNumber',x.order_number,
    'grossCents',x.gross_amount_cents,
    'stripeFeeCents',x.stripe_processing_fee_cents,
    'platformFeeCents',x.platform_order_fee_cents,
    'merchantPayableCents',x.merchant_payable_cents,
    'status',x.effective_status,
    'availableAt',x.available_at,
    'createdAt',x.created_at
  ) order by x.created_at desc),'[]'::jsonb)
  into _settlements
  from (
    select e.id,e.order_id,o.order_number,e.gross_amount_cents,e.stripe_processing_fee_cents,
           e.platform_order_fee_cents,e.merchant_payable_cents,e.available_at,e.created_at,
           case
             when e.status='available' and e.available_at is not null and e.available_at>now() then 'pending'
             else e.status
           end as effective_status
    from private.store_settlement_entries e
    left join public.orders o on o.id=e.order_id and o.store_id=e.store_id
    where e.store_id=_store_id
    order by e.created_at desc
    limit 100
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,
    'speed',x.payout_speed,
    'grossCents',x.gross_available_cents,
    'feeBps',x.payout_fee_bps,
    'feeCents',x.payout_fee_cents,
    'netCents',x.net_payout_cents,
    'status',x.status,
    'requestedAt',x.requested_at,
    'targetReleaseAt',x.target_release_at,
    'paidAt',x.paid_at,
    'completedAt',x.completed_at,
    'message',case x.last_error
      when 'stripe_connect_payouts_not_ready' then 'Finalize sua conta de recebimento para liberar o repasse.'
      when 'worker_lease_expired' then 'O repasse será tentado novamente automaticamente.'
      else null
    end
  ) order by x.created_at desc),'[]'::jsonb)
  into _payouts
  from (
    select * from private.store_payout_requests
    where store_id=_store_id
    order by created_at desc
    limit 50
  ) x;

  return jsonb_build_object(
    'storeId',_store_id,
    'currency','BRL',
    'balances',jsonb_build_object(
      'availableCents',_available,
      'pendingCents',_pending,
      'reservedCents',_reserved,
      'transferredCents',_transferred
    ),
    'connection',jsonb_build_object(
      'configured',_connect.store_id is not null,
      'detailsSubmitted',coalesce(_connect.details_submitted,false),
      'chargesEnabled',coalesce(_connect.charges_enabled,false),
      'payoutsEnabled',coalesce(_connect.payouts_enabled,false),
      'transfersEnabled',coalesce(_connect.transfers_enabled,false)
    ),
    'fees',jsonb_build_object(
      'orderApplicationFeeBps',_effective_order_fee_bps,
      'payoutStandardFeeBps',coalesce(_policy.payout_standard_fee_bps,0),
      'payoutDailyFeeBps',coalesce(_policy.payout_daily_fee_bps,0),
      'payoutFastFeeBps',coalesce(_policy.payout_fast_fee_bps,0),
      'payoutInstantFeeBps',coalesce(_policy.payout_instant_fee_bps,0)
    ),
    'payoutPreference',case when _pref.store_id is null then jsonb_build_object(
      'speed','standard','automatic',false,'minimumPayoutCents',1000
    ) else jsonb_build_object(
      'speed',_pref.payout_speed,
      'automatic',_pref.automatic,
      'minimumPayoutCents',_pref.minimum_payout_cents
    ) end,
    'automaticPayoutAvailable',false,
    'settlements',_settlements,
    'payouts',_payouts,
    'generatedAt',now()
  );
end;
$$;

revoke all on function public.get_my_store_financial_center(uuid) from public,anon;
grant execute on function public.get_my_store_financial_center(uuid) to authenticated;
