-- Comandiva: test-mode add-on checkout ledger and Mercado Pago reconciliation.
-- This migration creates no commercial price, provider plan or subscription by itself.

create table private.addon_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  addon_id uuid not null references public.addon_catalog(id) on delete restrict,
  addon_price_id uuid not null references public.addon_prices(id) on delete restrict,
  addon_subscription_id uuid not null references public.store_addon_subscriptions(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  billing_interval text not null check (billing_interval in ('monthly','annual')),
  provider text not null default 'mercado_pago' check (provider ~ '^[a-z0-9_]+$'),
  provider_plan_id text,
  provider_subscription_id text,
  provider_status text,
  idempotency_key text not null check (length(idempotency_key) between 8 and 160),
  external_reference text not null check (length(external_reference) between 8 and 255),
  checkout_url text,
  status text not null default 'created' check (status in ('created','provider_pending','checkout_ready','completed','failed','cancelled')),
  failure_code text,
  last_error text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id,idempotency_key)
);

create unique index addon_checkout_attempts_provider_subscription_uidx
  on private.addon_checkout_attempts(provider,provider_subscription_id)
  where provider_subscription_id is not null;
create index addon_checkout_attempts_subscription_idx
  on private.addon_checkout_attempts(addon_subscription_id,created_at desc);
create index addon_checkout_attempts_status_idx
  on private.addon_checkout_attempts(status,updated_at);

alter table private.addon_checkout_attempts enable row level security;
alter table private.addon_checkout_attempts force row level security;
revoke all on private.addon_checkout_attempts from public, anon, authenticated;
grant all on private.addon_checkout_attempts to service_role;

create trigger set_updated_at_addon_checkout_attempts
before update on private.addon_checkout_attempts
for each row execute function public.set_updated_at();

create or replace function private.is_store_manager_user(_user_id uuid,_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select _user_id is not null
     and _store_id is not null
     and exists (
       select 1
       from public.user_profiles p
       join public.user_roles r on r.user_id=p.id
       where p.id=_user_id
         and p.is_active
         and r.is_active
         and r.store_id=_store_id
         and r.role in ('proprietario','gerente')
     )
$function$;

revoke all on function private.is_store_manager_user(uuid,uuid) from public,anon,authenticated;
grant execute on function private.is_store_manager_user(uuid,uuid) to service_role;

create or replace function private.is_platform_admin_user(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select _user_id is not null and exists (
    select 1 from public.user_roles r
    where r.user_id=_user_id
      and r.is_active
      and r.role='admin_plataforma'
      and r.store_id is null
  )
$function$;

revoke all on function private.is_platform_admin_user(uuid) from public,anon,authenticated;
grant execute on function private.is_platform_admin_user(uuid) to service_role;

create or replace function private.addon_purchase_preflight_for_user(
  _actor_user_id uuid,
  _store_id uuid,
  _addon_code text,
  _billing_interval text default 'monthly'
)
returns jsonb
language plpgsql
stable
security definer
set search_path='public','private','pg_temp'
as $function$
declare
  _addon public.addon_catalog%rowtype;
  _price public.addon_prices%rowtype;
  _store_status text;
  _sub public.store_addon_subscriptions%rowtype;
  _billing jsonb;
  _provider_ref private.billing_provider_addon_price_refs%rowtype;
  _blockers jsonb := '[]'::jsonb;
begin
  if not private.is_store_manager_user(_actor_user_id,_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if _billing_interval not in ('monthly','annual') then
    raise exception 'INVALID_BILLING_INTERVAL' using errcode='P0001';
  end if;

  select s.status::text into _store_status from public.stores s where s.id=_store_id;
  if _store_status is null then raise exception 'STORE_NOT_FOUND' using errcode='P0001'; end if;

  select * into _addon from public.addon_catalog a where a.code=_addon_code;
  if not found then raise exception 'ADDON_NOT_FOUND' using errcode='P0001'; end if;

  select * into _price from public.addon_prices p
  where p.addon_id=_addon.id and p.billing_interval=_billing_interval
  limit 1;

  select * into _sub from public.store_addon_subscriptions s
  where s.store_id=_store_id and s.addon_id=_addon.id
  limit 1;

  _billing := public.get_store_billing_access(_store_id);

  if _store_status <> 'ativa' then
    _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','STORE_NOT_ACTIVE','message','A loja precisa estar ativa para contratar módulos.'));
  end if;
  if not _addon.is_active then
    _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','ADDON_INACTIVE','message','Este módulo está desativado.'));
  end if;
  if _addon.availability_status <> 'available' then
    _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','ADDON_NOT_AVAILABLE','message','Este módulo ainda não está disponível para contratação.'));
  end if;
  if _price.id is null or not coalesce(_price.is_active,false) then
    _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','PRICE_NOT_PUBLISHED','message','Ainda não existe preço publicado para este período.'));
  elsif _price.amount_cents <= 0 then
    _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','PRICE_NOT_CHARGEABLE','message','O preço publicado ainda não está habilitado para cobrança.'));
  end if;
  if coalesce(_billing->>'stage','billing_unconfigured')='billing_unconfigured' then
    _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','BASE_BILLING_UNCONFIGURED','message','A assinatura principal da loja precisa estar configurada antes de contratar um módulo.'));
  elsif not coalesce((_billing->>'can_manage_billing')::boolean,false) then
    _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','BILLING_RESTRICTED','message','O financeiro da loja está temporariamente bloqueado para novas contratações.'));
  end if;

  if _sub.id is not null then
    if _sub.status in ('trial','active','grace_period','complimentary') then
      _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','ALREADY_SUBSCRIBED','message','A loja já possui este módulo ativo.'));
    elsif _sub.status='pending' then
      _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','PURCHASE_IN_PROGRESS','message','Já existe uma contratação deste módulo em andamento.'));
    elsif _sub.status='past_due' then
      _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','ADDON_PAST_DUE','message','Regularize a cobrança anterior deste módulo antes de contratar novamente.'));
    end if;
  end if;

  if _price.id is not null then
    select * into _provider_ref
    from private.billing_provider_addon_price_refs r
    where r.addon_price_id=_price.id and r.provider='mercado_pago'
    limit 1;
    if _provider_ref.id is null or coalesce(_provider_ref.provider_plan_id,'')='' then
      _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','PROVIDER_PRICE_NOT_MAPPED','message','A cobrança deste módulo ainda não foi homologada no provedor.'));
    elsif coalesce(_provider_ref.provider_status,'') <> 'active' then
      _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','PROVIDER_PRICE_UNAVAILABLE','message','A cobrança deste módulo precisa ser sincronizada novamente com o provedor.'));
    end if;
  end if;

  return jsonb_build_object(
    'ready',jsonb_array_length(_blockers)=0,
    'addon',jsonb_build_object('id',_addon.id,'code',_addon.code,'name',_addon.name,'availability_status',_addon.availability_status),
    'price',case when _price.id is null then null else jsonb_build_object(
      'id',_price.id,'billing_interval',_price.billing_interval,'amount_cents',_price.amount_cents,'currency',_price.currency,
      'trial_days',_price.trial_days,'included_units',_price.included_units,'hard_limit_units',_price.hard_limit_units,
      'metering_metric_code',_price.metering_metric_code,'overage_unit_amount_micros',_price.overage_unit_amount_micros
    ) end,
    'provider','mercado_pago',
    'blockers',_blockers
  );
end;
$function$;

revoke all on function private.addon_purchase_preflight_for_user(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.addon_purchase_preflight_for_user(uuid,uuid,text,text) to service_role;

create or replace function public.get_store_addon_purchase_preflight(
  _store_id uuid,
  _addon_code text,
  _billing_interval text default 'monthly'
)
returns jsonb
language sql
stable
security definer
set search_path='public','private','pg_temp'
as $function$
  select private.addon_purchase_preflight_for_user(auth.uid(),_store_id,_addon_code,_billing_interval)
$function$;

revoke all on function public.get_store_addon_purchase_preflight(uuid,text,text) from public,anon;
grant execute on function public.get_store_addon_purchase_preflight(uuid,text,text) to authenticated,service_role;

alter table private.platform_addon_pricing_audit
  drop constraint if exists platform_addon_pricing_audit_action_check;
alter table private.platform_addon_pricing_audit
  add constraint platform_addon_pricing_audit_action_check
  check (action in ('catalog_update','price_upsert','provider_sync'));

create or replace function public.billing_get_addon_price_sync_context(
  _actor_user_id uuid,
  _addon_price_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path='public','private','pg_temp'
as $function$
declare
  _row record;
begin
  if not private.is_platform_admin_user(_actor_user_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select p.id as price_id,p.billing_interval,p.amount_cents,p.currency,p.trial_days,p.is_active,
         a.id as addon_id,a.code as addon_code,a.name as addon_name,a.is_active as addon_active,
         a.availability_status,
         r.provider_plan_id,r.provider_status,r.metadata as provider_metadata
  into _row
  from public.addon_prices p
  join public.addon_catalog a on a.id=p.addon_id
  left join private.billing_provider_addon_price_refs r
    on r.addon_price_id=p.id and r.provider='mercado_pago'
  where p.id=_addon_price_id;

  if not found then raise exception 'ADDON_PRICE_NOT_FOUND' using errcode='P0001'; end if;
  if not _row.is_active or _row.amount_cents <= 0 then
    raise exception 'ADDON_PRICE_NOT_CHARGEABLE' using errcode='P0001';
  end if;

  return jsonb_build_object(
    'price_id',_row.price_id,'addon_id',_row.addon_id,'addon_code',_row.addon_code,'addon_name',_row.addon_name,
    'billing_interval',_row.billing_interval,'amount_cents',_row.amount_cents,'currency',_row.currency,'trial_days',_row.trial_days,
    'provider_plan_id',_row.provider_plan_id,'provider_status',_row.provider_status,'provider_metadata',coalesce(_row.provider_metadata,'{}'::jsonb)
  );
end;
$function$;

revoke all on function public.billing_get_addon_price_sync_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.billing_get_addon_price_sync_context(uuid,uuid) to service_role;

create or replace function public.billing_upsert_addon_provider_price_ref(
  _actor_user_id uuid,
  _addon_price_id uuid,
  _provider_plan_id text,
  _provider_status text,
  _metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $function$
declare
  _addon_id uuid;
  _after jsonb;
begin
  if not private.is_platform_admin_user(_actor_user_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if nullif(btrim(_provider_plan_id),'') is null then raise exception 'INVALID_PROVIDER_PLAN_ID' using errcode='P0001'; end if;

  select addon_id into _addon_id from public.addon_prices where id=_addon_price_id;
  if _addon_id is null then raise exception 'ADDON_PRICE_NOT_FOUND' using errcode='P0001'; end if;

  insert into private.billing_provider_addon_price_refs(addon_price_id,provider,provider_plan_id,provider_status,metadata)
  values(_addon_price_id,'mercado_pago',btrim(_provider_plan_id),nullif(btrim(coalesce(_provider_status,'')),''),coalesce(_metadata,'{}'::jsonb))
  on conflict(addon_price_id,provider) do update set
    provider_plan_id=excluded.provider_plan_id,
    provider_status=excluded.provider_status,
    metadata=excluded.metadata,
    updated_at=now()
  returning jsonb_build_object(
    'addon_price_id',addon_price_id,'provider',provider,'provider_plan_id',provider_plan_id,
    'provider_status',provider_status,'metadata',metadata,'updated_at',updated_at
  ) into _after;

  insert into private.platform_addon_pricing_audit(actor_user_id,addon_id,addon_price_id,action,before_state,after_state)
  values(_actor_user_id,_addon_id,_addon_price_id,'provider_sync',null,_after);

  return _after;
end;
$function$;

revoke all on function public.billing_upsert_addon_provider_price_ref(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.billing_upsert_addon_provider_price_ref(uuid,uuid,text,text,jsonb) to service_role;

create or replace function public.billing_begin_addon_checkout(
  _actor_user_id uuid,
  _store_id uuid,
  _addon_code text,
  _billing_interval text,
  _idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $function$
declare
  _attempt private.addon_checkout_attempts%rowtype;
  _preflight jsonb;
  _addon_id uuid;
  _price_id uuid;
  _addon_name text;
  _price public.addon_prices%rowtype;
  _provider_ref private.billing_provider_addon_price_refs%rowtype;
  _subscription public.store_addon_subscriptions%rowtype;
  _external_reference text;
begin
  if not private.is_store_manager_user(_actor_user_id,_store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if _billing_interval not in ('monthly','annual') then raise exception 'INVALID_BILLING_INTERVAL' using errcode='P0001'; end if;
  if nullif(btrim(_idempotency_key),'') is null or length(btrim(_idempotency_key)) not between 8 and 160 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode='P0001';
  end if;

  select * into _attempt
  from private.addon_checkout_attempts a
  where a.store_id=_store_id and a.idempotency_key=btrim(_idempotency_key)
  limit 1;

  if found then
    select * into _price from public.addon_prices where id=_attempt.addon_price_id;
    return jsonb_build_object(
      'reused',true,'attempt_id',_attempt.id,'attempt_status',_attempt.status,
      'subscription_id',_attempt.addon_subscription_id,'provider_plan_id',_attempt.provider_plan_id,
      'provider_subscription_id',_attempt.provider_subscription_id,'provider_status',_attempt.provider_status,
      'checkout_url',_attempt.checkout_url,'external_reference',_attempt.external_reference,
      'amount_cents',_price.amount_cents,'currency',_price.currency,'trial_days',_price.trial_days,
      'billing_interval',_attempt.billing_interval,'failure_code',_attempt.failure_code
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(_store_id::text || ':' || coalesce(_addon_code,'') || ':' || _billing_interval,0));

  _preflight := private.addon_purchase_preflight_for_user(_actor_user_id,_store_id,_addon_code,_billing_interval);
  if not coalesce((_preflight->>'ready')::boolean,false) then
    raise exception 'ADDON_PURCHASE_NOT_READY' using errcode='P0001', detail=coalesce(_preflight->'blockers','[]'::jsonb)::text;
  end if;

  _addon_id := (_preflight->'addon'->>'id')::uuid;
  _addon_name := _preflight->'addon'->>'name';
  _price_id := (_preflight->'price'->>'id')::uuid;
  select * into _price from public.addon_prices where id=_price_id;
  select * into _provider_ref from private.billing_provider_addon_price_refs
    where addon_price_id=_price_id and provider='mercado_pago' and provider_status='active';
  if not found then raise exception 'PROVIDER_PRICE_NOT_READY' using errcode='P0001'; end if;

  select * into _subscription from public.store_addon_subscriptions
  where store_id=_store_id and addon_id=_addon_id for update;

  if found then
    update public.store_addon_subscriptions
    set addon_price_id=_price_id,
        status='pending',billing_interval=_billing_interval,billing_provider='mercado_pago',
        provider_customer_id=null,provider_subscription_id=null,provider_item_id=null,provider_status=null,provider_synced_at=null,
        current_period_start=null,current_period_end=null,trial_ends_at=null,grace_until=null,cancel_at_period_end=false,
        complimentary_until=null,complimentary_reason=null,activated_at=null,cancelled_at=null,updated_at=now()
    where id=_subscription.id
    returning * into _subscription;
  else
    insert into public.store_addon_subscriptions(store_id,addon_id,addon_price_id,status,billing_interval,billing_provider)
    values(_store_id,_addon_id,_price_id,'pending',_billing_interval,'mercado_pago')
    returning * into _subscription;
  end if;

  _external_reference := private.addon_billing_external_reference(_subscription.id);

  insert into private.addon_checkout_attempts(
    store_id,addon_id,addon_price_id,addon_subscription_id,actor_user_id,billing_interval,
    provider,provider_plan_id,idempotency_key,external_reference,status
  ) values(
    _store_id,_addon_id,_price_id,_subscription.id,_actor_user_id,_billing_interval,
    'mercado_pago',_provider_ref.provider_plan_id,btrim(_idempotency_key),_external_reference,'created'
  ) returning * into _attempt;

  return jsonb_build_object(
    'reused',false,'attempt_id',_attempt.id,'attempt_status',_attempt.status,
    'subscription_id',_subscription.id,'addon_code',_addon_code,'addon_name',_addon_name,
    'provider_plan_id',_provider_ref.provider_plan_id,'provider_status',_provider_ref.provider_status,
    'provider_subscription_id',null,'checkout_url',null,'external_reference',_external_reference,
    'amount_cents',_price.amount_cents,'currency',_price.currency,'trial_days',_price.trial_days,
    'billing_interval',_billing_interval
  );
exception
  when unique_violation then
    select * into _attempt from private.addon_checkout_attempts
    where store_id=_store_id and idempotency_key=btrim(_idempotency_key) limit 1;
    if _attempt.id is not null then
      select * into _price from public.addon_prices where id=_attempt.addon_price_id;
      return jsonb_build_object(
        'reused',true,'attempt_id',_attempt.id,'attempt_status',_attempt.status,
        'subscription_id',_attempt.addon_subscription_id,'provider_plan_id',_attempt.provider_plan_id,
        'provider_subscription_id',_attempt.provider_subscription_id,'provider_status',_attempt.provider_status,
        'checkout_url',_attempt.checkout_url,'external_reference',_attempt.external_reference,
        'amount_cents',_price.amount_cents,'currency',_price.currency,'trial_days',_price.trial_days,
        'billing_interval',_attempt.billing_interval,'failure_code',_attempt.failure_code
      );
    end if;
    raise;
end;
$function$;

revoke all on function public.billing_begin_addon_checkout(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.billing_begin_addon_checkout(uuid,uuid,text,text,text) to service_role;

create or replace function public.billing_claim_addon_checkout_provider_create(
  _actor_user_id uuid,
  _attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $function$
declare
  _attempt private.addon_checkout_attempts%rowtype;
  _claimed boolean := false;
begin
  select * into _attempt from private.addon_checkout_attempts where id=_attempt_id for update;
  if not found then raise exception 'CHECKOUT_ATTEMPT_NOT_FOUND' using errcode='P0001'; end if;
  if not private.is_store_manager_user(_actor_user_id,_attempt.store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;

  if _attempt.status='created' or (_attempt.status='provider_pending' and _attempt.updated_at < now()-interval '60 seconds') then
    update private.addon_checkout_attempts
    set status='provider_pending',failure_code=null,last_error=null,updated_at=now()
    where id=_attempt.id
    returning * into _attempt;
    _claimed := true;
  end if;

  return jsonb_build_object(
    'claimed',_claimed,'attempt_id',_attempt.id,'attempt_status',_attempt.status,'store_id',_attempt.store_id,
    'subscription_id',_attempt.addon_subscription_id,'provider_subscription_id',_attempt.provider_subscription_id,
    'checkout_url',_attempt.checkout_url,'external_reference',_attempt.external_reference,'updated_at',_attempt.updated_at
  );
end;
$function$;

revoke all on function public.billing_claim_addon_checkout_provider_create(uuid,uuid) from public,anon,authenticated;
grant execute on function public.billing_claim_addon_checkout_provider_create(uuid,uuid) to service_role;

create or replace function public.billing_complete_addon_checkout_provider_create(
  _actor_user_id uuid,
  _attempt_id uuid,
  _provider_subscription_id text,
  _provider_status text,
  _checkout_url text
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $function$
declare
  _attempt private.addon_checkout_attempts%rowtype;
begin
  select * into _attempt from private.addon_checkout_attempts where id=_attempt_id for update;
  if not found then raise exception 'CHECKOUT_ATTEMPT_NOT_FOUND' using errcode='P0001'; end if;
  if not private.is_store_manager_user(_actor_user_id,_attempt.store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if nullif(btrim(_provider_subscription_id),'') is null or nullif(btrim(_checkout_url),'') is null then
    raise exception 'INVALID_PROVIDER_CHECKOUT' using errcode='P0001';
  end if;

  perform private.attach_addon_provider_subscription(
    _attempt.addon_subscription_id,'mercado_pago',btrim(_provider_subscription_id),null,_provider_status
  );

  update private.addon_checkout_attempts
  set provider_subscription_id=btrim(_provider_subscription_id),provider_status=nullif(btrim(coalesce(_provider_status,'')),''),
      checkout_url=btrim(_checkout_url),status='checkout_ready',failure_code=null,last_error=null,updated_at=now()
  where id=_attempt.id
  returning * into _attempt;

  return jsonb_build_object(
    'attempt_id',_attempt.id,'attempt_status',_attempt.status,'subscription_id',_attempt.addon_subscription_id,
    'provider_subscription_id',_attempt.provider_subscription_id,'provider_status',_attempt.provider_status,
    'checkout_url',_attempt.checkout_url,'external_reference',_attempt.external_reference
  );
end;
$function$;

revoke all on function public.billing_complete_addon_checkout_provider_create(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.billing_complete_addon_checkout_provider_create(uuid,uuid,text,text,text) to service_role;

create or replace function public.billing_mark_addon_checkout_error(
  _actor_user_id uuid,
  _attempt_id uuid,
  _failure_code text,
  _last_error text,
  _definitive boolean default false
)
returns boolean
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $function$
declare
  _attempt private.addon_checkout_attempts%rowtype;
begin
  select * into _attempt from private.addon_checkout_attempts where id=_attempt_id for update;
  if not found then raise exception 'CHECKOUT_ATTEMPT_NOT_FOUND' using errcode='P0001'; end if;
  if not private.is_store_manager_user(_actor_user_id,_attempt.store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;

  update private.addon_checkout_attempts
  set status=case when _definitive then 'failed' else 'provider_pending' end,
      failure_code=left(nullif(btrim(coalesce(_failure_code,'')),''),120),
      last_error=left(nullif(btrim(coalesce(_last_error,'')),''),500),
      updated_at=now()
  where id=_attempt.id;

  if _definitive and _attempt.provider_subscription_id is null then
    update public.store_addon_subscriptions
    set status='cancelled',cancelled_at=now(),provider_status=coalesce(provider_status,'provider_create_failed'),updated_at=now()
    where id=_attempt.addon_subscription_id and status='pending' and provider_subscription_id is null;
  end if;

  return true;
end;
$function$;

revoke all on function public.billing_mark_addon_checkout_error(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.billing_mark_addon_checkout_error(uuid,uuid,text,text,boolean) to service_role;

create or replace function public.billing_reconcile_mercado_pago_preapproval(
  _provider_subscription_id text,
  _provider_status text,
  _external_reference text,
  _amount_cents integer,
  _currency text,
  _frequency integer,
  _frequency_type text,
  _next_payment_date timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $function$
declare
  _subscription_id uuid;
  _subscription public.store_addon_subscriptions%rowtype;
  _price public.addon_prices%rowtype;
  _canonical_status text;
  _trial_end timestamptz;
begin
  if nullif(btrim(_provider_subscription_id),'') is null then raise exception 'INVALID_PROVIDER_SUBSCRIPTION' using errcode='P0001'; end if;
  if coalesce(_external_reference,'') !~ '^comandiva:addon:[0-9a-fA-F-]{36}$' then
    raise exception 'INVALID_EXTERNAL_REFERENCE' using errcode='P0001';
  end if;

  _subscription_id := split_part(_external_reference,':',3)::uuid;
  select * into _subscription from public.store_addon_subscriptions where id=_subscription_id for update;
  if not found then raise exception 'ADDON_SUBSCRIPTION_NOT_FOUND' using errcode='P0001'; end if;
  select * into _price from public.addon_prices where id=_subscription.addon_price_id;
  if not found then raise exception 'ADDON_PRICE_NOT_FOUND' using errcode='P0001'; end if;

  if _subscription.billing_provider is not null and _subscription.billing_provider <> 'mercado_pago' then
    raise exception 'ADDON_PROVIDER_MISMATCH' using errcode='P0001';
  end if;
  if _subscription.provider_subscription_id is not null and _subscription.provider_subscription_id <> btrim(_provider_subscription_id) then
    raise exception 'PROVIDER_SUBSCRIPTION_MISMATCH' using errcode='P0001';
  end if;
  if coalesce(_amount_cents,-1) <> _price.amount_cents or upper(coalesce(_currency,'')) <> _price.currency then
    raise exception 'PROVIDER_PRICE_MISMATCH' using errcode='P0001';
  end if;
  if lower(coalesce(_frequency_type,'')) <> 'months'
     or (_subscription.billing_interval='monthly' and _frequency <> 1)
     or (_subscription.billing_interval='annual' and _frequency <> 12) then
    raise exception 'PROVIDER_INTERVAL_MISMATCH' using errcode='P0001';
  end if;

  _canonical_status := case lower(coalesce(_provider_status,''))
    when 'pending' then 'pending'
    when 'authorized' then case when _price.trial_days > 0 and _next_payment_date is not null and _next_payment_date > now() then 'trial' else 'active' end
    when 'paused' then 'suspended'
    when 'canceled' then 'cancelled'
    when 'cancelled' then 'cancelled'
    else null
  end;

  if _canonical_status is null then
    update public.store_addon_subscriptions
    set billing_provider='mercado_pago',provider_subscription_id=coalesce(provider_subscription_id,btrim(_provider_subscription_id)),
        provider_status=nullif(btrim(coalesce(_provider_status,'')),''),provider_synced_at=now(),updated_at=now()
    where id=_subscription.id;
    return jsonb_build_object('updated',false,'subscription_id',_subscription.id,'provider_status',_provider_status,'reason','unknown_provider_status');
  end if;

  _trial_end := case when _canonical_status='trial' then _next_payment_date else _subscription.trial_ends_at end;

  update public.store_addon_subscriptions
  set billing_provider='mercado_pago',provider_subscription_id=btrim(_provider_subscription_id),
      provider_status=nullif(btrim(coalesce(_provider_status,'')),''),provider_synced_at=now(),status=_canonical_status,
      trial_ends_at=_trial_end,
      activated_at=case when _canonical_status in ('active','trial') then coalesce(activated_at,now()) else activated_at end,
      cancelled_at=case when _canonical_status='cancelled' then coalesce(cancelled_at,now()) else cancelled_at end,
      updated_at=now()
  where id=_subscription.id;

  update private.addon_checkout_attempts
  set provider_subscription_id=coalesce(provider_subscription_id,btrim(_provider_subscription_id)),
      provider_status=nullif(btrim(coalesce(_provider_status,'')),''),
      status=case when _canonical_status in ('active','trial') then 'completed'
                  when _canonical_status='cancelled' then 'cancelled'
                  else status end,
      updated_at=now()
  where addon_subscription_id=_subscription.id
    and provider='mercado_pago'
    and (provider_subscription_id is null or provider_subscription_id=btrim(_provider_subscription_id));

  return jsonb_build_object('updated',true,'subscription_id',_subscription.id,'canonical_status',_canonical_status,'provider_status',_provider_status);
end;
$function$;

revoke all on function public.billing_reconcile_mercado_pago_preapproval(text,text,text,integer,text,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.billing_reconcile_mercado_pago_preapproval(text,text,text,integer,text,integer,text,timestamptz) to service_role;

comment on table private.addon_checkout_attempts is 'Idempotent test-mode checkout ledger. Never expose directly to store clients.';
comment on function public.billing_begin_addon_checkout(uuid,uuid,text,text,text) is 'Service-only start of add-on checkout after validating the authenticated actor explicitly.';
comment on function public.billing_reconcile_mercado_pago_preapproval(text,text,text,integer,text,integer,text,timestamptz) is 'Service-only authoritative reconciliation target for verified Mercado Pago preapproval snapshots.';
