create table if not exists private.platform_addon_pricing_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  addon_id uuid not null references public.addon_catalog(id) on delete restrict,
  addon_price_id uuid references public.addon_prices(id) on delete set null,
  action text not null check (action in ('catalog_update','price_upsert')),
  before_state jsonb,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists platform_addon_pricing_audit_addon_created_idx
  on private.platform_addon_pricing_audit(addon_id, created_at desc);

alter table private.platform_addon_pricing_audit enable row level security;
alter table private.platform_addon_pricing_audit force row level security;
revoke all on private.platform_addon_pricing_audit from public, anon, authenticated;
grant select, insert, update, delete on private.platform_addon_pricing_audit to service_role;

create or replace function public.admin_list_addon_offers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  _items jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(item order by (item->>'sort_order')::integer, item->>'name'),'[]'::jsonb)
  into _items
  from (
    select jsonb_build_object(
      'id', a.id,
      'code', a.code,
      'name', a.name,
      'description', a.description,
      'category', a.category,
      'billing_model', a.billing_model,
      'availability_status', a.availability_status,
      'is_active', a.is_active,
      'sort_order', a.sort_order,
      'monthly_price', case when pm.id is null then null else jsonb_build_object(
        'id',pm.id,'amount_cents',pm.amount_cents,'currency',pm.currency,'trial_days',pm.trial_days,
        'metering_metric_code',pm.metering_metric_code,'included_units',pm.included_units,
        'hard_limit_units',pm.hard_limit_units,'overage_unit_amount_micros',pm.overage_unit_amount_micros,
        'is_active',pm.is_active,
        'provider_ready', coalesce(rm.provider_plan_id,'') <> '' and coalesce(rm.provider_status,'active') not in ('disabled','inactive','retired'),
        'provider_status',rm.provider_status
      ) end,
      'annual_price', case when pa.id is null then null else jsonb_build_object(
        'id',pa.id,'amount_cents',pa.amount_cents,'currency',pa.currency,'trial_days',pa.trial_days,
        'metering_metric_code',pa.metering_metric_code,'included_units',pa.included_units,
        'hard_limit_units',pa.hard_limit_units,'overage_unit_amount_micros',pa.overage_unit_amount_micros,
        'is_active',pa.is_active,
        'provider_ready', coalesce(ra.provider_plan_id,'') <> '' and coalesce(ra.provider_status,'active') not in ('disabled','inactive','retired'),
        'provider_status',ra.provider_status
      ) end,
      'active_subscriptions', (
        select count(*) from public.store_addon_subscriptions s
        where s.addon_id=a.id and s.status in ('trial','active','grace_period','complimentary')
      )
    ) item
    from public.addon_catalog a
    left join public.addon_prices pm on pm.addon_id=a.id and pm.billing_interval='monthly'
    left join public.addon_prices pa on pa.addon_id=a.id and pa.billing_interval='annual'
    left join private.billing_provider_addon_price_refs rm on rm.addon_price_id=pm.id and rm.provider='mercado_pago'
    left join private.billing_provider_addon_price_refs ra on ra.addon_price_id=pa.id and ra.provider='mercado_pago'
  ) q;

  return jsonb_build_object('items',_items,'provider','mercado_pago');
end;
$$;

create or replace function public.admin_update_addon_catalog(
  _addon_id uuid,
  _availability_status text,
  _is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  _before jsonb;
  _after jsonb;
begin
  if not private.is_platform_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if _availability_status not in ('planned','beta','available','retired') then
    raise exception 'INVALID_AVAILABILITY_STATUS' using errcode='P0001';
  end if;

  select to_jsonb(a) into _before from public.addon_catalog a where a.id=_addon_id for update;
  if _before is null then raise exception 'ADDON_NOT_FOUND' using errcode='P0001'; end if;

  update public.addon_catalog
  set availability_status=_availability_status,
      is_active=coalesce(_is_active,false),
      updated_at=now()
  where id=_addon_id
  returning to_jsonb(addon_catalog.*) into _after;

  insert into private.platform_addon_pricing_audit(actor_user_id,addon_id,action,before_state,after_state)
  values(auth.uid(),_addon_id,'catalog_update',_before,_after);

  return _after;
end;
$$;

create or replace function public.admin_upsert_addon_price(
  _addon_id uuid,
  _billing_interval text,
  _amount_cents integer,
  _trial_days integer default 0,
  _metering_metric_code text default null,
  _included_units numeric default null,
  _hard_limit_units numeric default null,
  _overage_unit_amount_micros bigint default null,
  _is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  _price_id uuid;
  _before jsonb;
  _after jsonb;
  _billing_model text;
begin
  if not private.is_platform_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if _billing_interval not in ('monthly','annual') then raise exception 'INVALID_BILLING_INTERVAL' using errcode='P0001'; end if;
  if _amount_cents is null or _amount_cents < 0 then raise exception 'INVALID_AMOUNT' using errcode='P0001'; end if;
  if coalesce(_trial_days,0) not between 0 and 365 then raise exception 'INVALID_TRIAL_DAYS' using errcode='P0001'; end if;
  if _included_units is not null and _included_units < 0 then raise exception 'INVALID_INCLUDED_UNITS' using errcode='P0001'; end if;
  if _hard_limit_units is not null and _hard_limit_units < 0 then raise exception 'INVALID_HARD_LIMIT_UNITS' using errcode='P0001'; end if;
  if _included_units is not null and _hard_limit_units is not null and _hard_limit_units < _included_units then
    raise exception 'HARD_LIMIT_BELOW_INCLUDED_UNITS' using errcode='P0001';
  end if;
  if _overage_unit_amount_micros is not null and _overage_unit_amount_micros < 0 then raise exception 'INVALID_OVERAGE_AMOUNT' using errcode='P0001'; end if;
  if nullif(btrim(_metering_metric_code),'') is not null and btrim(_metering_metric_code) !~ '^[a-z0-9_.-]+$' then
    raise exception 'INVALID_METERING_METRIC_CODE' using errcode='P0001';
  end if;

  select billing_model into _billing_model from public.addon_catalog where id=_addon_id;
  if _billing_model is null then raise exception 'ADDON_NOT_FOUND' using errcode='P0001'; end if;
  if _billing_model='flat' and (_included_units is not null or _hard_limit_units is not null or _overage_unit_amount_micros is not null or nullif(btrim(_metering_metric_code),'') is not null) then
    raise exception 'FLAT_ADDON_CANNOT_HAVE_METERING' using errcode='P0001';
  end if;
  if _billing_model in ('metered','hybrid') and nullif(btrim(_metering_metric_code),'') is null then
    raise exception 'METERING_METRIC_REQUIRED' using errcode='P0001';
  end if;

  select p.id,to_jsonb(p) into _price_id,_before
  from public.addon_prices p
  where p.addon_id=_addon_id and p.billing_interval=_billing_interval
  for update;

  insert into public.addon_prices(
    addon_id,billing_interval,amount_cents,currency,trial_days,metering_metric_code,
    included_units,hard_limit_units,overage_unit_amount_micros,is_active
  ) values(
    _addon_id,_billing_interval,_amount_cents,'BRL',coalesce(_trial_days,0),nullif(btrim(_metering_metric_code),''),
    _included_units,_hard_limit_units,_overage_unit_amount_micros,coalesce(_is_active,true)
  )
  on conflict(addon_id,billing_interval) do update set
    amount_cents=excluded.amount_cents,
    currency='BRL',
    trial_days=excluded.trial_days,
    metering_metric_code=excluded.metering_metric_code,
    included_units=excluded.included_units,
    hard_limit_units=excluded.hard_limit_units,
    overage_unit_amount_micros=excluded.overage_unit_amount_micros,
    is_active=excluded.is_active,
    updated_at=now()
  returning id,to_jsonb(addon_prices.*) into _price_id,_after;

  insert into private.platform_addon_pricing_audit(actor_user_id,addon_id,addon_price_id,action,before_state,after_state)
  values(auth.uid(),_addon_id,_price_id,'price_upsert',_before,_after);

  return _after;
end;
$$;

create or replace function public.get_store_addon_purchase_preflight(
  _store_id uuid,
  _addon_code text,
  _billing_interval text default 'monthly'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  _addon public.addon_catalog%rowtype;
  _price public.addon_prices%rowtype;
  _store_status text;
  _sub public.store_addon_subscriptions%rowtype;
  _billing jsonb;
  _provider_ref private.billing_provider_addon_price_refs%rowtype;
  _blockers jsonb := '[]'::jsonb;
  _ready boolean := true;
begin
  if not private.is_store_manager(_store_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if _billing_interval not in ('monthly','annual') then raise exception 'INVALID_BILLING_INTERVAL' using errcode='P0001'; end if;

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
    elsif coalesce(_provider_ref.provider_status,'active') in ('disabled','inactive','retired') then
      _blockers := _blockers || jsonb_build_array(jsonb_build_object('code','PROVIDER_PRICE_UNAVAILABLE','message','A cobrança deste módulo está indisponível no provedor.'));
    end if;
  end if;

  _ready := jsonb_array_length(_blockers)=0;

  return jsonb_build_object(
    'ready',_ready,
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
$$;

revoke all on function public.admin_list_addon_offers() from public, anon;
revoke all on function public.admin_update_addon_catalog(uuid,text,boolean) from public, anon;
revoke all on function public.admin_upsert_addon_price(uuid,text,integer,integer,text,numeric,numeric,bigint,boolean) from public, anon;
revoke all on function public.get_store_addon_purchase_preflight(uuid,text,text) from public, anon;

grant execute on function public.admin_list_addon_offers() to authenticated;
grant execute on function public.admin_update_addon_catalog(uuid,text,boolean) to authenticated;
grant execute on function public.admin_upsert_addon_price(uuid,text,integer,integer,text,numeric,numeric,bigint,boolean) to authenticated;
grant execute on function public.get_store_addon_purchase_preflight(uuid,text,text) to authenticated;
