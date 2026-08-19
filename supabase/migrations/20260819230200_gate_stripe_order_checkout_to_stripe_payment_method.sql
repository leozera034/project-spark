create or replace function public.backend_get_order_stripe_payment_context(_order_id uuid, _tracking_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog','public','private','extensions'
as $$
declare
  o public.orders%rowtype;
  a private.stripe_connect_accounts%rowtype;
  token_hash text;
  amount_cents integer;
  fee integer;
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
  amount_cents:=round(o.total_amount*100)::integer;
  fee:=floor(amount_cents * a.application_fee_bps / 10000.0)::integer;
  return jsonb_build_object('ready',true,'order_id',o.id,'store_id',o.store_id,'order_number',o.order_number,'amount_cents',amount_cents,'currency','brl','stripe_account_id',a.stripe_account_id,'application_fee_amount',greatest(fee,0));
end;
$$;
revoke all on function public.backend_get_order_stripe_payment_context(uuid,text) from public,anon,authenticated;
grant execute on function public.backend_get_order_stripe_payment_context(uuid,text) to service_role;
