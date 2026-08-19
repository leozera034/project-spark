begin;

-- Public self-service signup must never grant a paid plan merely because the
-- browser selected it. New stores start on the explicit free plan; a paid plan
-- is granted only after Stripe Checkout/subscription reconciliation.
create or replace function public.provision_store_with_owner(
  _idempotency_key text,
  _request_hash text,
  _owner_user_id uuid,
  _owner_full_name text,
  _store_name text,
  _slug text,
  _city text,
  _state text,
  _segment text,
  _phone text,
  _plan_code text default 'gratis',
  _origin text default 'autoatendimento',
  _requested_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _existing public.store_provisioning_intents;
  _slug_n text := public.normalize_store_slug(coalesce(_store_name,''));
  _store_id uuid;
  _effective_plan_code text;
  _plan_id uuid;
  _plan_price_id uuid;
  _plan_amount_cents integer;
  _fallback_plan_code text := 'gratis';
  _payment_grace_days smallint := 7;
  _weekday int;
begin
  select coalesce(fallback_plan_code,'gratis'), payment_grace_days
    into _fallback_plan_code, _payment_grace_days
  from public.billing_policy
  where policy_key='default';

  if coalesce(btrim(_slug),'') <> '' then _slug_n:=public.normalize_store_slug(_slug); end if;

  select * into _existing from public.store_provisioning_intents where idempotency_key=_idempotency_key;
  if found then
    if _existing.request_hash <> _request_hash then raise exception 'CONFLITO_IDEMPOTENCIA'; end if;
    if _existing.status='concluida' then
      return jsonb_build_object('store_id',_existing.store_id,'slug',(select slug from public.stores where id=_existing.store_id),'already_provisioned',true);
    end if;
  else
    insert into public.store_provisioning_intents(idempotency_key,request_hash,origin,owner_user_id,requested_by)
    values(_idempotency_key,_request_hash,_origin,_owner_user_id,_requested_by);
  end if;

  if length(_slug_n)<3 or length(_slug_n)>60 then raise exception 'SLUG_INVALIDO'; end if;
  if _slug_n=any(private.reserved_slugs()) then raise exception 'SLUG_RESERVADO'; end if;
  if exists(select 1 from public.stores where slug=_slug_n) then raise exception 'SLUG_EM_USO'; end if;
  if coalesce(btrim(_store_name),'')='' then raise exception 'NOME_INVALIDO'; end if;

  insert into public.stores(slug,name,status,segment,phone,whatsapp,city,state,timezone,accepts_delivery,accepts_pickup)
  values(_slug_n,btrim(_store_name),'em_implantacao',nullif(btrim(coalesce(_segment,'')),''),nullif(btrim(coalesce(_phone,'')),''),nullif(btrim(coalesce(_phone,'')),''),coalesce(nullif(btrim(coalesce(_city,'')),''),'Não informado'),upper(coalesce(nullif(btrim(coalesce(_state,'')),''),'BR')),'America/Sao_Paulo',true,true)
  returning id into _store_id;

  insert into public.store_settings(store_id) values(_store_id);
  for _weekday in 0..6 loop
    insert into public.store_hours(store_id,weekday,opens_at,closes_at,is_active)
    values(_store_id,_weekday,'08:00','23:00',true);
  end loop;

  insert into public.payment_methods(store_id,kind,label,needs_change,is_active,sort_order,available_for_delivery,available_for_pickup)
  values (_store_id,'dinheiro','Dinheiro',true,true,1,true,true),(_store_id,'pix','Pix',false,true,2,true,true);

  insert into public.user_profiles(id,full_name,display_name,phone,is_active)
  values(_owner_user_id,btrim(_owner_full_name),split_part(btrim(_owner_full_name),' ',1),nullif(btrim(coalesce(_phone,'')),''),true)
  on conflict(id) do update set full_name=excluded.full_name,display_name=excluded.display_name,is_active=true,updated_at=now();

  insert into public.user_roles(user_id,store_id,role,is_active)
  values(_owner_user_id,_store_id,'proprietario',true) on conflict do nothing;

  -- Autoatendimento always starts free. Admin provisioning may still explicitly
  -- choose another plan as an internal/commercial override.
  _effective_plan_code:=case when coalesce(_origin,'autoatendimento')='autoatendimento' then coalesce(_fallback_plan_code,'gratis') else coalesce(nullif(btrim(_plan_code),''),coalesce(_fallback_plan_code,'gratis')) end;

  select p.id,pp.id,pp.amount_cents into _plan_id,_plan_price_id,_plan_amount_cents
  from public.plans p
  join public.plan_prices pp on pp.plan_id=p.id and pp.billing_interval='monthly' and pp.is_active
  where p.code=_effective_plan_code and p.is_active
  order by pp.created_at asc limit 1;

  if _plan_id is null then raise exception 'PLANO_INDISPONIVEL'; end if;
  if coalesce(_origin,'autoatendimento')='autoatendimento' and coalesce(_plan_amount_cents,0)<>0 then raise exception 'FREE_FALLBACK_PLAN_INVALID'; end if;

  insert into public.store_subscriptions(store_id,plan_id,status,monthly_price,due_day,grace_days,current_period_end,started_at,notes,plan_price_id,billing_interval,trial_ends_at,billing_provider,provider_status)
  values(_store_id,_plan_id,'ativa',coalesce(_plan_amount_cents,0)::numeric/100,10,_payment_grace_days,null,current_date,'Plano inicial da loja.',_plan_price_id,'monthly',null,null,null);

  insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context)
  values(_store_id,coalesce(_requested_by,_owner_user_id),'sistema','platform.store_created','stores',_store_id,jsonb_build_object('origin',_origin,'slug',_slug_n,'requested_plan_code',_plan_code,'effective_plan_code',_effective_plan_code,'paid_plan_requires_stripe_confirmation',true));

  update public.store_provisioning_intents set status='concluida',store_id=_store_id,owner_user_id=_owner_user_id,updated_at=now() where idempotency_key=_idempotency_key;

  return jsonb_build_object('store_id',_store_id,'slug',_slug_n,'already_provisioned',false,'plan_code',_effective_plan_code,'requested_plan_code',_plan_code,'trial_days',0);
end;
$$;

commit;
