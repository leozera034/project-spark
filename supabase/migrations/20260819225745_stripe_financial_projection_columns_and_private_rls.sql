begin;

alter table public.store_subscriptions
  add column if not exists provider_event_created bigint,
  add column if not exists current_period_start_at timestamptz,
  add column if not exists current_period_end_at timestamptz;

alter table private.stripe_order_payment_intents
  add column if not exists last_event_created bigint,
  add column if not exists paid_at timestamptz,
  add column if not exists refunded_amount_cents integer not null default 0;

alter table public.orders
  add column if not exists payment_status text not null default 'not_applicable',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_provider text,
  add column if not exists paid_amount_cents integer,
  add column if not exists refunded_amount_cents integer not null default 0;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check check (
  payment_status in ('not_applicable','pending','processing','paid','failed','partially_refunded','refunded','disputed','cancelled')
);

update public.orders
set payment_status='pending', payment_provider='stripe'
where payment_method_kind='stripe_online' and payment_status='not_applicable';

create unique index if not exists financial_journals_event_key_uidx on private.financial_journals(event_key);

alter table private.stripe_billing_customers enable row level security;
alter table private.stripe_connect_accounts enable row level security;
alter table private.stripe_order_payment_intents enable row level security;
alter table private.stripe_runtime_readiness enable row level security;
alter table private.stripe_webhook_events enable row level security;
alter table private.financial_fee_policy enable row level security;
alter table private.financial_journals enable row level security;
alter table private.financial_ledger_entries enable row level security;
alter table private.plan_checkout_attempts enable row level security;

revoke all on private.stripe_billing_customers from anon, authenticated;
revoke all on private.stripe_connect_accounts from anon, authenticated;
revoke all on private.stripe_order_payment_intents from anon, authenticated;
revoke all on private.stripe_runtime_readiness from anon, authenticated;
revoke all on private.stripe_webhook_events from anon, authenticated;
revoke all on private.financial_fee_policy from anon, authenticated;
revoke all on private.financial_journals from anon, authenticated;
revoke all on private.financial_ledger_entries from anon, authenticated;
revoke all on private.plan_checkout_attempts from anon, authenticated;

grant select,insert,update,delete on private.stripe_billing_customers to service_role;
grant select,insert,update,delete on private.stripe_connect_accounts to service_role;
grant select,insert,update,delete on private.stripe_order_payment_intents to service_role;
grant select,insert,update,delete on private.stripe_runtime_readiness to service_role;
grant select,insert,update,delete on private.stripe_webhook_events to service_role;
grant select,insert,update,delete on private.financial_fee_policy to service_role;
grant select,insert,update,delete on private.financial_journals to service_role;
grant select,insert,update,delete on private.financial_ledger_entries to service_role;
grant select,insert,update,delete on private.plan_checkout_attempts to service_role;

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
set search_path='pg_catalog','private'
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
  if jsonb_typeof(_entries) <> 'array' or jsonb_array_length(_entries) < 2 then raise exception 'FINANCIAL_ENTRIES_INVALID'; end if;

  insert into private.financial_journals(event_key,event_type,source_system,source_object_id,store_id,order_id,currency,status,occurred_at,metadata)
  values(btrim(_event_key),btrim(_event_type),btrim(_source_system),nullif(btrim(coalesce(_source_object_id,'')),''),_store_id,_order_id,upper(coalesce(nullif(btrim(_currency),''),'BRL')),'draft',coalesce(_occurred_at,now()),coalesce(_metadata,'{}'::jsonb))
  on conflict(event_key) do nothing
  returning id into _journal_id;
  if _journal_id is null then
    select id into _journal_id from private.financial_journals where event_key=_event_key;
    return _journal_id;
  end if;

  for _entry in select value from jsonb_array_elements(_entries)
  loop
    _amount:=coalesce((_entry->>'amount_cents')::bigint,0);
    _direction:=lower(coalesce(_entry->>'direction',''));
    _owner_type:=lower(coalesce(_entry->>'owner_type',''));
    if _amount<=0 or _direction not in ('debit','credit') or _owner_type not in ('platform','store','processor','customer') then
      raise exception 'FINANCIAL_ENTRY_INVALID';
    end if;
    insert into private.financial_ledger_entries(journal_id,account_code,owner_type,owner_store_id,direction,component_type,amount_cents,currency,metadata)
    values(
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
revoke all on function private.create_and_post_financial_journal(text,text,text,text,uuid,uuid,text,jsonb,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function private.create_and_post_financial_journal(text,text,text,text,uuid,uuid,text,jsonb,jsonb,timestamptz) to service_role;

commit;
