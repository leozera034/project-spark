create table if not exists private.billing_provider_runtime_readiness (
  provider text not null,
  environment text not null,
  token_configured boolean not null default false,
  token_connected boolean not null default false,
  token_checked_at timestamptz,
  token_upstream_status integer,
  webhook_secret_configured boolean not null default false,
  webhook_secret_fingerprint text,
  webhook_secret_checked_at timestamptz,
  webhook_delivery_verified boolean not null default false,
  last_valid_webhook_at timestamptz,
  last_valid_webhook_event_type text,
  last_valid_webhook_event_key text,
  last_valid_webhook_resource_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, environment),
  constraint billing_provider_runtime_readiness_provider_check
    check (provider ~ '^[a-z0-9_]{2,64}$'),
  constraint billing_provider_runtime_readiness_environment_check
    check (environment in ('test','live')),
  constraint billing_provider_runtime_readiness_fingerprint_check
    check (webhook_secret_fingerprint is null or webhook_secret_fingerprint ~ '^[a-f0-9]{64}$')
);

alter table private.billing_provider_runtime_readiness enable row level security;
alter table private.billing_provider_runtime_readiness force row level security;
revoke all on private.billing_provider_runtime_readiness from public, anon, authenticated;
grant all on private.billing_provider_runtime_readiness to service_role;

create or replace function public.billing_record_provider_runtime_health(
  _provider text,
  _environment text,
  _token_configured boolean,
  _token_connected boolean,
  _token_upstream_status integer,
  _webhook_secret_configured boolean,
  _webhook_secret_fingerprint text,
  _last_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  _row private.billing_provider_runtime_readiness%rowtype;
  _reset_webhook boolean;
begin
  if _provider is null or _provider !~ '^[a-z0-9_]{2,64}$' then
    raise exception 'INVALID_PROVIDER' using errcode='P0001';
  end if;
  if _environment not in ('test','live') then
    raise exception 'INVALID_ENVIRONMENT' using errcode='P0001';
  end if;
  if _webhook_secret_fingerprint is not null and _webhook_secret_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_SECRET_FINGERPRINT' using errcode='P0001';
  end if;

  select * into _row
  from private.billing_provider_runtime_readiness r
  where r.provider=_provider and r.environment=_environment
  for update;

  _reset_webhook :=
    (_row.provider is not null and _row.webhook_secret_fingerprint is distinct from _webhook_secret_fingerprint)
    or not coalesce(_webhook_secret_configured,false);

  insert into private.billing_provider_runtime_readiness (
    provider, environment,
    token_configured, token_connected, token_checked_at, token_upstream_status,
    webhook_secret_configured, webhook_secret_fingerprint, webhook_secret_checked_at,
    webhook_delivery_verified,
    last_valid_webhook_at, last_valid_webhook_event_type,
    last_valid_webhook_event_key, last_valid_webhook_resource_id,
    last_error, updated_at
  ) values (
    _provider, _environment,
    coalesce(_token_configured,false), coalesce(_token_connected,false), now(), _token_upstream_status,
    coalesce(_webhook_secret_configured,false), _webhook_secret_fingerprint, now(),
    false,
    null, null, null, null,
    left(_last_error,500), now()
  )
  on conflict (provider,environment) do update set
    token_configured=excluded.token_configured,
    token_connected=excluded.token_connected,
    token_checked_at=excluded.token_checked_at,
    token_upstream_status=excluded.token_upstream_status,
    webhook_secret_configured=excluded.webhook_secret_configured,
    webhook_secret_fingerprint=excluded.webhook_secret_fingerprint,
    webhook_secret_checked_at=excluded.webhook_secret_checked_at,
    webhook_delivery_verified=case
      when _reset_webhook then false
      else private.billing_provider_runtime_readiness.webhook_delivery_verified
    end,
    last_valid_webhook_at=case when _reset_webhook then null else private.billing_provider_runtime_readiness.last_valid_webhook_at end,
    last_valid_webhook_event_type=case when _reset_webhook then null else private.billing_provider_runtime_readiness.last_valid_webhook_event_type end,
    last_valid_webhook_event_key=case when _reset_webhook then null else private.billing_provider_runtime_readiness.last_valid_webhook_event_key end,
    last_valid_webhook_resource_id=case when _reset_webhook then null else private.billing_provider_runtime_readiness.last_valid_webhook_resource_id end,
    last_error=excluded.last_error,
    updated_at=now()
  returning * into _row;

  return jsonb_build_object(
    'provider',_row.provider,
    'environment',_row.environment,
    'token_connected',_row.token_connected,
    'webhook_secret_configured',_row.webhook_secret_configured,
    'webhook_delivery_verified',_row.webhook_delivery_verified,
    'ready_for_checkout',_row.token_connected and _row.webhook_secret_configured and _row.webhook_delivery_verified
  );
end;
$function$;

create or replace function public.billing_record_provider_webhook_delivery(
  _provider text,
  _environment text,
  _provider_event_key text,
  _event_type text,
  _resource_id text,
  _webhook_secret_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  _row private.billing_provider_runtime_readiness%rowtype;
begin
  if _provider is null or _provider !~ '^[a-z0-9_]{2,64}$' then
    raise exception 'INVALID_PROVIDER' using errcode='P0001';
  end if;
  if _environment not in ('test','live') then
    raise exception 'INVALID_ENVIRONMENT' using errcode='P0001';
  end if;
  if coalesce(_provider_event_key,'')='' or coalesce(_event_type,'')='' or coalesce(_resource_id,'')='' then
    raise exception 'INVALID_WEBHOOK_VERIFICATION' using errcode='P0001';
  end if;
  if _webhook_secret_fingerprint is null or _webhook_secret_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_SECRET_FINGERPRINT' using errcode='P0001';
  end if;

  insert into private.billing_provider_runtime_readiness (
    provider, environment,
    token_configured, token_connected, token_checked_at,
    webhook_secret_configured, webhook_secret_fingerprint, webhook_secret_checked_at,
    webhook_delivery_verified, last_valid_webhook_at,
    last_valid_webhook_event_type, last_valid_webhook_event_key, last_valid_webhook_resource_id,
    last_error, updated_at
  ) values (
    _provider, _environment,
    true, true, now(),
    true, _webhook_secret_fingerprint, now(),
    true, now(),
    left(_event_type,200), left(_provider_event_key,300), left(_resource_id,300),
    null, now()
  )
  on conflict (provider,environment) do update set
    token_configured=true,
    token_connected=true,
    token_checked_at=now(),
    webhook_secret_configured=true,
    webhook_secret_fingerprint=excluded.webhook_secret_fingerprint,
    webhook_secret_checked_at=now(),
    webhook_delivery_verified=true,
    last_valid_webhook_at=now(),
    last_valid_webhook_event_type=excluded.last_valid_webhook_event_type,
    last_valid_webhook_event_key=excluded.last_valid_webhook_event_key,
    last_valid_webhook_resource_id=excluded.last_valid_webhook_resource_id,
    last_error=null,
    updated_at=now()
  returning * into _row;

  return jsonb_build_object(
    'provider',_row.provider,
    'environment',_row.environment,
    'webhook_delivery_verified',_row.webhook_delivery_verified,
    'last_valid_webhook_at',_row.last_valid_webhook_at,
    'ready_for_checkout',_row.token_connected and _row.webhook_secret_configured and _row.webhook_delivery_verified
  );
end;
$function$;

create or replace function public.admin_get_billing_provider_readiness(
  _provider text default 'mercado_pago',
  _environment text default 'test'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $function$
declare
  _row private.billing_provider_runtime_readiness%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if _environment not in ('test','live') then
    raise exception 'INVALID_ENVIRONMENT' using errcode='P0001';
  end if;

  select * into _row
  from private.billing_provider_runtime_readiness r
  where r.provider=_provider and r.environment=_environment;

  return jsonb_build_object(
    'provider',_provider,
    'environment',_environment,
    'initialized',_row.provider is not null,
    'token_configured',coalesce(_row.token_configured,false),
    'token_connected',coalesce(_row.token_connected,false),
    'token_checked_at',_row.token_checked_at,
    'token_upstream_status',_row.token_upstream_status,
    'webhook_secret_configured',coalesce(_row.webhook_secret_configured,false),
    'webhook_secret_checked_at',_row.webhook_secret_checked_at,
    'webhook_delivery_verified',coalesce(_row.webhook_delivery_verified,false),
    'last_valid_webhook_at',_row.last_valid_webhook_at,
    'last_valid_webhook_event_type',_row.last_valid_webhook_event_type,
    'last_error',_row.last_error,
    'ready_for_checkout',
      coalesce(_row.token_connected,false)
      and coalesce(_row.webhook_secret_configured,false)
      and coalesce(_row.webhook_delivery_verified,false)
  );
end;
$function$;

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
set search_path = public, private, pg_temp
as $function$
declare
  _addon public.addon_catalog%rowtype;
  _price public.addon_prices%rowtype;
  _store_status text;
  _sub public.store_addon_subscriptions%rowtype;
  _billing jsonb;
  _provider_ref private.billing_provider_addon_price_refs%rowtype;
  _runtime private.billing_provider_runtime_readiness%rowtype;
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

  select * into _runtime
  from private.billing_provider_runtime_readiness r
  where r.provider='mercado_pago' and r.environment='test';

  if _runtime.provider is null then
    _blockers := _blockers || jsonb_build_array(jsonb_build_object(
      'code','PROVIDER_RUNTIME_NOT_VERIFIED',
      'message','A infraestrutura de cobrança ainda não concluiu a verificação operacional.'
    ));
  else
    if not _runtime.token_configured or not _runtime.token_connected then
      _blockers := _blockers || jsonb_build_array(jsonb_build_object(
        'code','PROVIDER_TOKEN_NOT_READY',
        'message','A conexão com o Mercado Pago precisa estar saudável antes da contratação.'
      ));
    end if;
    if not _runtime.webhook_secret_configured then
      _blockers := _blockers || jsonb_build_array(jsonb_build_object(
        'code','PROVIDER_WEBHOOK_SECRET_NOT_READY',
        'message','A autenticação do webhook do Mercado Pago ainda não está configurada.'
      ));
    elsif not _runtime.webhook_delivery_verified then
      _blockers := _blockers || jsonb_build_array(jsonb_build_object(
        'code','PROVIDER_WEBHOOK_NOT_VERIFIED',
        'message','A entrega real de webhooks do Mercado Pago ainda não foi verificada. A contratação permanece bloqueada por segurança.'
      ));
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
    'provider_readiness',jsonb_build_object(
      'environment','test',
      'token_connected',coalesce(_runtime.token_connected,false),
      'webhook_secret_configured',coalesce(_runtime.webhook_secret_configured,false),
      'webhook_delivery_verified',coalesce(_runtime.webhook_delivery_verified,false),
      'last_valid_webhook_at',_runtime.last_valid_webhook_at
    ),
    'blockers',_blockers
  );
end;
$function$;

revoke all on function public.billing_record_provider_runtime_health(text,text,boolean,boolean,integer,boolean,text,text) from public, anon, authenticated;
grant execute on function public.billing_record_provider_runtime_health(text,text,boolean,boolean,integer,boolean,text,text) to service_role;

revoke all on function public.billing_record_provider_webhook_delivery(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.billing_record_provider_webhook_delivery(text,text,text,text,text,text) to service_role;

revoke all on function public.admin_get_billing_provider_readiness(text,text) from public, anon;
grant execute on function public.admin_get_billing_provider_readiness(text,text) to authenticated, service_role;
