alter type public.payment_method_kind add value if not exists 'stripe_online';

create or replace function public.backend_upsert_stripe_connect_account(
  _store_id uuid,
  _stripe_account_id text,
  _country text,
  _business_type text,
  _details_submitted boolean,
  _charges_enabled boolean,
  _payouts_enabled boolean,
  _requirements_currently_due jsonb,
  _metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v private.stripe_connect_accounts%rowtype;
begin
  insert into private.stripe_connect_accounts(store_id,stripe_account_id,country,business_type,details_submitted,charges_enabled,payouts_enabled,requirements_currently_due,metadata,updated_at)
  values(_store_id,_stripe_account_id,nullif(_country,''),nullif(_business_type,''),coalesce(_details_submitted,false),coalesce(_charges_enabled,false),coalesce(_payouts_enabled,false),coalesce(_requirements_currently_due,'[]'::jsonb),coalesce(_metadata,'{}'::jsonb),now())
  on conflict(store_id) do update set
    stripe_account_id=excluded.stripe_account_id,
    country=excluded.country,
    business_type=excluded.business_type,
    details_submitted=excluded.details_submitted,
    charges_enabled=excluded.charges_enabled,
    payouts_enabled=excluded.payouts_enabled,
    requirements_currently_due=excluded.requirements_currently_due,
    metadata=private.stripe_connect_accounts.metadata || excluded.metadata,
    updated_at=now()
  returning * into v;

  if coalesce(_charges_enabled,false) then
    insert into public.payment_methods(store_id,kind,label,instructions,needs_change,is_active,sort_order,available_for_delivery,available_for_pickup,updated_at)
    values(_store_id,'stripe_online'::public.payment_method_kind,'Cartão online · Stripe','Pagamento seguro online por cartão. Você será redirecionado para a Stripe após enviar o pedido.',false,true,5,true,true,now())
    on conflict(store_id,label) do update set
      kind='stripe_online'::public.payment_method_kind,
      instructions=excluded.instructions,
      needs_change=false,
      is_active=true,
      available_for_delivery=true,
      available_for_pickup=true,
      updated_at=now();
  else
    update public.payment_methods
      set is_active=false, updated_at=now()
    where store_id=_store_id and kind='stripe_online'::public.payment_method_kind;
  end if;

  return jsonb_build_object('store_id',v.store_id,'stripe_account_id',v.stripe_account_id,'charges_enabled',v.charges_enabled,'payouts_enabled',v.payouts_enabled,'details_submitted',v.details_submitted);
end;
$$;

revoke all on function public.backend_upsert_stripe_connect_account(uuid,text,text,text,boolean,boolean,boolean,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.backend_upsert_stripe_connect_account(uuid,text,text,text,boolean,boolean,boolean,jsonb,jsonb) to service_role;
