alter table private.stripe_order_payment_intents
  drop constraint if exists stripe_order_payment_intents_application_fee_lt_amount_check;

alter table private.stripe_order_payment_intents
  add constraint stripe_order_payment_intents_application_fee_lt_amount_check
  check (application_fee_amount >= 0 and application_fee_amount < amount_cents);

create or replace function private.create_and_post_financial_journal(
  _event_key text,
  _event_type text,
  _source_system text,
  _source_object_id text,
  _store_id uuid,
  _order_id uuid,
  _currency text,
  _entries jsonb,
  _metadata jsonb default '{}'::jsonb,
  _occurred_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','private'
as $$
declare
  _journal_id uuid;
  _entry jsonb;
  _amount bigint;
  _direction text;
  _owner_type text;
begin
  if nullif(btrim(_event_key),'') is null then raise exception 'FINANCIAL_EVENT_KEY_REQUIRED'; end if;
  select id into _journal_id from private.financial_journals where event_key=_event_key;
  if found then return _journal_id; end if;
  if jsonb_typeof(_entries)<>'array' or jsonb_array_length(_entries)<2 then raise exception 'FINANCIAL_ENTRIES_INVALID'; end if;

  insert into private.financial_journals(
    event_key,event_type,source_system,source_object_id,store_id,order_id,currency,status,occurred_at,metadata
  ) values(
    btrim(_event_key),btrim(_event_type),btrim(_source_system),nullif(btrim(coalesce(_source_object_id,'')),''),
    _store_id,_order_id,upper(coalesce(nullif(btrim(_currency),''),'BRL')),'draft',coalesce(_occurred_at,now()),coalesce(_metadata,'{}'::jsonb)
  ) on conflict(event_key) do nothing returning id into _journal_id;

  if _journal_id is null then
    select id into _journal_id from private.financial_journals where event_key=_event_key;
    return _journal_id;
  end if;

  for _entry in select value from jsonb_array_elements(_entries)
  loop
    _amount:=coalesce((_entry->>'amount_cents')::bigint,0);
    _direction:=lower(coalesce(_entry->>'direction',''));
    _owner_type:=lower(coalesce(_entry->>'owner_type',''));
    if _owner_type='processor' then _owner_type:='stripe'; end if;
    if _amount<=0 or _direction not in ('debit','credit') or _owner_type not in ('platform','store','stripe','customer','clearing') then
      raise exception 'FINANCIAL_ENTRY_INVALID';
    end if;
    insert into private.financial_ledger_entries(
      journal_id,account_code,owner_type,owner_store_id,direction,component_type,amount_cents,currency,metadata
    ) values(
      _journal_id,
      left(coalesce(nullif(btrim(_entry->>'account_code'),''),'unclassified'),120),
      _owner_type,
      case when _owner_type='store' then _store_id else null end,
      _direction,
      left(coalesce(nullif(btrim(_entry->>'component_type'),''),'unclassified'),120),
      _amount,
      upper(coalesce(nullif(btrim(_currency),''),'BRL')),
      coalesce(_entry->'metadata','{}'::jsonb)
    );
  end loop;
  perform private.post_financial_journal(_journal_id);
  return _journal_id;
end;
$$;

create or replace function public.get_my_store_payout_summary(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  u uuid:=auth.uid();
  p private.store_payout_preferences%rowtype;
  gross bigint;
  pending bigint;
  reserved bigint;
  transferred bigint;
begin
  if not private.is_store_manager_user(u,_store_id) and not private.is_platform_admin_user(u) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select * into p from private.store_payout_preferences where store_id=_store_id;
  select coalesce(sum(merchant_payable_cents),0) into gross
  from private.store_settlement_entries
  where store_id=_store_id and status='available' and payout_request_id is null
    and (available_at is null or available_at<=now());
  select coalesce(sum(merchant_payable_cents),0) into pending
  from private.store_settlement_entries
  where store_id=_store_id and payout_request_id is null
    and (status='pending' or (status='available' and available_at is not null and available_at>now()));
  select coalesce(sum(merchant_payable_cents),0) into reserved
  from private.store_settlement_entries where store_id=_store_id and status='reserved';
  select coalesce(sum(merchant_payable_cents),0) into transferred
  from private.store_settlement_entries where store_id=_store_id and status='transferred';
  return jsonb_build_object(
    'store_id',_store_id,
    'available_cents',gross,
    'pending_cents',pending,
    'reserved_cents',reserved,
    'transferred_cents',transferred,
    'preference',case when p.store_id is null then
      jsonb_build_object('payout_speed','standard','automatic',false,'minimum_payout_cents',1000,'currency','BRL')
    else to_jsonb(p) end
  );
end;
$$;

create or replace function public.request_my_store_payout(
  _store_id uuid,
  _payout_speed text,
  _idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  u uuid:=auth.uid();
  s text:=lower(btrim(coalesce(_payout_speed,'')));
  gross integer;
  q jsonb;
  r private.store_payout_requests%rowtype;
  total_base bigint;
  fee_left integer;
  item record;
  alloc integer;
  amount integer;
begin
  if not private.is_store_manager_user(u,_store_id) and not private.is_platform_admin_user(u) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(_idempotency_key,'')),'') is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023';
  end if;
  select * into r from private.store_payout_requests where idempotency_key=_idempotency_key;
  if found then return to_jsonb(r)||jsonb_build_object('reused',true); end if;

  select coalesce(sum(merchant_payable_cents),0)::integer into gross
  from private.store_settlement_entries
  where store_id=_store_id and status='available' and payout_request_id is null
    and (available_at is null or available_at<=now());
  if gross<=0 then raise exception 'NO_AVAILABLE_BALANCE' using errcode='22023'; end if;

  q:=public.backend_quote_store_payout(_store_id,gross,s);
  insert into private.store_payout_requests(
    store_id,idempotency_key,payout_speed,gross_available_cents,payout_fee_bps,payout_fee_cents,
    net_payout_cents,currency,status,requested_at,target_release_at,metadata
  ) values(
    _store_id,_idempotency_key,q->>'payout_speed',gross,(q->>'payout_fee_bps')::int,
    (q->>'payout_fee_cents')::int,(q->>'net_payout_cents')::int,'BRL','requested',now(),
    private.compute_payout_target_release_at(s,now()),jsonb_build_object('requested_by',u)
  ) returning * into r;

  update private.store_settlement_entries
  set payout_request_id=r.id,status='reserved',updated_at=now()
  where store_id=_store_id and status='available' and payout_request_id is null
    and (available_at is null or available_at<=now());

  select coalesce(sum(merchant_payable_cents),0) into total_base
  from private.store_settlement_entries where payout_request_id=r.id;
  fee_left:=r.payout_fee_cents;
  for item in
    select id,merchant_payable_cents,metadata
    from private.store_settlement_entries where payout_request_id=r.id order by created_at,id
  loop
    alloc:=case when total_base<=0 then 0 else floor((r.payout_fee_cents::numeric*item.merchant_payable_cents)/total_base)::integer end;
    alloc:=least(alloc,fee_left);
    amount:=greatest(item.merchant_payable_cents-alloc,0);
    fee_left:=fee_left-alloc;
    insert into private.store_payout_transfer_items(
      payout_request_id,settlement_entry_id,store_id,gross_component_cents,allocated_payout_fee_cents,
      transfer_amount_cents,stripe_source_charge_id,metadata
    ) values(
      r.id,item.id,_store_id,item.merchant_payable_cents,alloc,amount,
      nullif(item.metadata->>'stripe_charge_id',''),jsonb_build_object('pro_rata',true)
    );
  end loop;
  if fee_left>0 then
    update private.store_payout_transfer_items
    set allocated_payout_fee_cents=allocated_payout_fee_cents+fee_left,
        transfer_amount_cents=greatest(transfer_amount_cents-fee_left,0),updated_at=now()
    where id=(select id from private.store_payout_transfer_items where payout_request_id=r.id order by created_at desc,id desc limit 1);
  end if;
  return to_jsonb(r)||jsonb_build_object('reused',false);
end;
$$;

revoke all on function public.get_my_store_payout_summary(uuid) from public,anon;
revoke all on function public.request_my_store_payout(uuid,text,text) from public,anon;
