create or replace function public.backend_get_order_stripe_checkout_context(_order_id uuid, _tracking_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public', 'private', 'extensions'
as $$
declare
  o public.orders%rowtype;
  a private.stripe_connect_accounts%rowtype;
  p private.financial_fee_policy%rowtype;
  s public.store_settings%rowtype;
  token_hash text;
  amount_cents bigint;
  fee_bps integer;
  fee_cents bigint;
begin
  if _tracking_token is null or length(_tracking_token)<16 then return null; end if;
  token_hash:=encode(sha256(convert_to(_tracking_token,'UTF8')),'hex');
  select * into o from public.orders where id=_order_id and tracking_token_hash=token_hash;
  if not found then return null; end if;
  if o.payment_method_kind is distinct from 'stripe_online' then return jsonb_build_object('ready',false,'reason','order_not_stripe_payment','store_id',o.store_id,'order_id',o.id); end if;
  select * into s from public.store_settings where store_id=o.store_id;
  if not found or not coalesce(s.online_payments_enabled,false) then return jsonb_build_object('ready',false,'reason','online_payments_disabled','store_id',o.store_id,'order_id',o.id); end if;
  if o.status is distinct from 'aguardando_confirmacao'::public.order_status then return jsonb_build_object('ready',false,'reason','order_not_payable','store_id',o.store_id,'order_id',o.id,'status',o.status::text); end if;
  if o.payment_status='paid' then return jsonb_build_object('ready',false,'reason','order_already_paid','store_id',o.store_id,'order_id',o.id,'payment_status',o.payment_status); end if;
  if o.payment_status not in ('pending','processing','failed') then return jsonb_build_object('ready',false,'reason','payment_not_retryable','store_id',o.store_id,'order_id',o.id,'payment_status',o.payment_status); end if;
  select * into a from private.stripe_connect_accounts where store_id=o.store_id;
  if not found or not coalesce(a.details_submitted,false) or not coalesce(a.payouts_enabled,false) or not coalesce(a.transfers_enabled,false) then
    return jsonb_build_object('ready',false,'reason','stripe_connect_payouts_not_ready','store_id',o.store_id,'order_id',o.id);
  end if;
  select * into p from private.financial_fee_policy where policy_key='default';
  if not found then raise exception 'FINANCIAL_FEE_POLICY_MISSING'; end if;
  amount_cents:=round(o.total_amount*100)::bigint;
  if amount_cents<=0 or amount_cents>2147483647 then raise exception 'ORDER_AMOUNT_INVALID'; end if;
  fee_bps:=coalesce(a.application_fee_bps_override,p.order_application_fee_bps);
  fee_cents:=(amount_cents*fee_bps)/10000;
  return jsonb_build_object('ready',true,'charge_pattern','separate','order_id',o.id,'store_id',o.store_id,'order_number',o.order_number,'amount_cents',amount_cents::integer,'currency','brl','stripe_account_id',a.stripe_account_id,'platform_fee_bps',fee_bps,'platform_fee_cents',greatest(fee_cents,0)::integer,'fee_policy_key',p.policy_key);
end;
$$;

revoke all on function public.backend_get_order_stripe_checkout_context(uuid,text) from public, anon, authenticated;
grant execute on function public.backend_get_order_stripe_checkout_context(uuid,text) to service_role;

create or replace function public.backend_get_order_stripe_payment_context(_order_id uuid, _tracking_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public', 'private', 'extensions'
as $$
declare
  token_hash text;
  o public.orders%rowtype;
begin
  if _tracking_token is null or length(_tracking_token)<16 then return null; end if;
  token_hash:=encode(sha256(convert_to(_tracking_token,'UTF8')),'hex');
  select * into o from public.orders where id=_order_id and tracking_token_hash=token_hash;
  if not found then return null; end if;
  return jsonb_build_object('ready',false,'reason','legacy_direct_charge_retired','store_id',o.store_id,'order_id',o.id);
end;
$$;
