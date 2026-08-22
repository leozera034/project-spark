-- Merchant financial center and payout availability contract.
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/store_financial_center_contract.sql

begin;

do $$
declare
  _uid uuid;
  _sid uuid;
  _other uuid;
  _oid uuid;
  _summary jsonb;
  _request jsonb;
  _rid uuid;
  _reserved_now integer;
  _reserved_future integer;
  _journal uuid;
  _processor_owner text;
  _fee_rejected boolean:=false;
  _forbidden boolean:=false;
begin
  select r.user_id,r.store_id into _uid,_sid
  from public.user_roles r
  join public.user_profiles p on p.id=r.user_id and p.is_active
  where r.is_active
    and r.store_id is not null
    and r.role in ('proprietario','gerente')
    and not private.is_platform_admin_user(r.user_id)
  order by r.created_at
  limit 1;
  if _uid is null then raise exception 'NO_NON_PLATFORM_MANAGER_FOR_TEST'; end if;

  select o.id into _oid
  from public.orders o
  where o.store_id=_sid
  order by o.created_at
  limit 1;
  if _oid is null then raise exception 'NO_STORE_ORDER_FOR_TEST'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',_uid::text,'role','authenticated')::text,true);

  insert into private.store_settlement_entries(
    store_id,order_id,provider,provider_payment_id,currency,gross_amount_cents,
    stripe_processing_fee_cents,platform_order_fee_cents,merchant_payable_cents,status,available_at,metadata
  ) values
    (_sid,_oid,'stripe','pi_finance_due_contract','BRL',10000,300,500,9200,'available',now()-interval '1 minute',jsonb_build_object('stripe_charge_id','ch_due_contract')),
    (_sid,_oid,'stripe','pi_finance_future_contract','BRL',20000,600,1000,18400,'available',now()+interval '2 days',jsonb_build_object('stripe_charge_id','ch_future_contract'));

  _summary:=public.get_my_store_financial_center(_sid);
  if (_summary#>>'{balances,availableCents}')::bigint <> 9200 then raise exception 'AVAILABLE_BALANCE_WRONG: %',_summary; end if;
  if (_summary#>>'{balances,pendingCents}')::bigint <> 18400 then raise exception 'PENDING_BALANCE_WRONG: %',_summary; end if;
  if coalesce((_summary->>'automaticPayoutAvailable')::boolean,true) then raise exception 'UNIMPLEMENTED_AUTOMATIC_PAYOUT_EXPOSED'; end if;

  _request:=public.request_my_store_payout(_sid,'standard','finance-center-contract-20260822');
  _rid:=(_request->>'id')::uuid;
  select count(*) into _reserved_now
  from private.store_settlement_entries
  where provider_payment_id='pi_finance_due_contract' and payout_request_id=_rid and status='reserved';
  select count(*) into _reserved_future
  from private.store_settlement_entries
  where provider_payment_id='pi_finance_future_contract' and payout_request_id is not null;
  if _reserved_now<>1 then raise exception 'DUE_SETTLEMENT_NOT_RESERVED'; end if;
  if _reserved_future<>0 then raise exception 'FUTURE_SETTLEMENT_WAS_RESERVED'; end if;

  _journal:=private.create_and_post_financial_journal(
    'finance-owner-normalization-contract','adjustment','stripe','owner-normalization',_sid,_oid,'BRL',
    jsonb_build_array(
      jsonb_build_object('account_code','stripe.contract','owner_type','processor','direction','debit','component_type','adjustment','amount_cents',100),
      jsonb_build_object('account_code','platform.contract','owner_type','platform','direction','credit','component_type','adjustment','amount_cents',100)
    ),'{}'::jsonb,now()
  );
  select owner_type into _processor_owner
  from private.financial_ledger_entries
  where journal_id=_journal and account_code='stripe.contract';
  if _processor_owner<>'stripe' then raise exception 'PROCESSOR_OWNER_NOT_NORMALIZED: %',_processor_owner; end if;

  begin
    insert into private.stripe_order_payment_intents(
      order_id,store_id,stripe_payment_intent_id,stripe_account_id,amount_cents,currency,application_fee_amount,status
    ) values(_oid,_sid,'pi_fee_boundary_contract','acct_fee_boundary_contract',100,'brl',100,'succeeded');
  exception when check_violation then
    _fee_rejected:=true;
  end;
  if not _fee_rejected then raise exception 'FULL_GROSS_APPLICATION_FEE_WAS_ACCEPTED'; end if;

  select s.id into _other
  from public.stores s
  where s.id<>_sid and not private.is_store_manager_user(_uid,s.id)
  order by s.created_at
  limit 1;
  if _other is not null then
    begin
      perform public.get_my_store_financial_center(_other);
    exception when insufficient_privilege then
      _forbidden:=true;
    when others then
      if sqlstate='42501' then _forbidden:=true; else raise; end if;
    end;
    if not _forbidden then raise exception 'CROSS_STORE_FINANCIAL_CENTER_ALLOWED'; end if;
  end if;
end $$;

select 'store_financial_center_contract_passed' as result;
rollback;
