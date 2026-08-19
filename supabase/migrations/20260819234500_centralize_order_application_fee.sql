begin;

alter table private.stripe_connect_accounts
  add column if not exists application_fee_bps_override integer
  check (application_fee_bps_override is null or application_fee_bps_override between 0 and 10000);

-- The central policy is canonical. A connected account may opt into an explicit
-- override; the old application_fee_bps column remains as historical/compat data
-- but is no longer the source used to price new order payments.
create or replace function public.backend_get_order_stripe_payment_context(_order_id uuid,_tracking_token text)
returns jsonb
language plpgsql
stable security definer
set search_path='pg_catalog','public','private','extensions'
as $$
declare
  o public.orders%rowtype;
  a private.stripe_connect_accounts%rowtype;
  p private.financial_fee_policy%rowtype;
  token_hash text;
  amount_cents bigint;
  fee_bps integer;
  fee_cents bigint;
begin
  if _tracking_token is null or length(_tracking_token)<16 then return null; end if;
  token_hash:=encode(sha256(convert_to(_tracking_token,'UTF8')),'hex');
  select * into o from public.orders where id=_order_id and tracking_token_hash=token_hash;
  if not found then return null; end if;
  if o.payment_method_kind is distinct from 'stripe_online' then
    return jsonb_build_object('ready',false,'reason','order_not_stripe_payment','store_id',o.store_id,'order_id',o.id);
  end if;
  select * into a from private.stripe_connect_accounts where store_id=o.store_id;
  if not found or not a.charges_enabled then
    return jsonb_build_object('ready',false,'reason','stripe_connect_not_ready','store_id',o.store_id,'order_id',o.id);
  end if;
  select * into p from private.financial_fee_policy where policy_key='default';
  if not found then raise exception 'FINANCIAL_FEE_POLICY_MISSING'; end if;
  amount_cents:=round(o.total_amount*100)::bigint;
  if amount_cents<=0 or amount_cents>2147483647 then raise exception 'ORDER_AMOUNT_INVALID'; end if;
  fee_bps:=coalesce(a.application_fee_bps_override,p.order_application_fee_bps);
  fee_cents:=(amount_cents*fee_bps)/10000;
  return jsonb_build_object(
    'ready',true,'order_id',o.id,'store_id',o.store_id,'order_number',o.order_number,
    'amount_cents',amount_cents::integer,'currency','brl','stripe_account_id',a.stripe_account_id,
    'application_fee_bps',fee_bps,'application_fee_amount',greatest(fee_cents,0)::integer,
    'fee_policy_key',p.policy_key
  );
end;
$$;

commit;
