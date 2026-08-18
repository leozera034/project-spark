create table if not exists public.billing_policy (
  policy_key text primary key,
  trial_plan_code text not null,
  fallback_plan_code text not null,
  trial_days smallint not null check (trial_days between 0 and 90),
  annual_months_charged smallint not null check (annual_months_charged between 1 and 12),
  payment_grace_days smallint not null check (payment_grace_days between 0 and 30),
  restrict_growth_after_days smallint not null check (restrict_growth_after_days between 0 and 30),
  restrict_writes_after_days smallint not null check (restrict_writes_after_days between 0 and 30),
  suspend_orders_after_days smallint not null check (suspend_orders_after_days between 0 and 60),
  reminder_days smallint[] not null default '{}'::smallint[],
  updated_at timestamptz not null default now(),
  check (restrict_growth_after_days <= restrict_writes_after_days),
  check (restrict_writes_after_days <= suspend_orders_after_days)
);

alter table public.billing_policy enable row level security;
revoke all on table public.billing_policy from anon, authenticated;
grant select, insert, update, delete on table public.billing_policy to service_role;

insert into public.billing_policy (
  policy_key,
  trial_plan_code,
  fallback_plan_code,
  trial_days,
  annual_months_charged,
  payment_grace_days,
  restrict_growth_after_days,
  restrict_writes_after_days,
  suspend_orders_after_days,
  reminder_days,
  updated_at
) values (
  'default',
  'profissional',
  'gratis',
  14,
  10,
  7,
  4,
  8,
  15,
  array[0,2,5,7,10,14]::smallint[],
  now()
)
on conflict (policy_key) do update set
  trial_plan_code = excluded.trial_plan_code,
  fallback_plan_code = excluded.fallback_plan_code,
  trial_days = excluded.trial_days,
  annual_months_charged = excluded.annual_months_charged,
  payment_grace_days = excluded.payment_grace_days,
  restrict_growth_after_days = excluded.restrict_growth_after_days,
  restrict_writes_after_days = excluded.restrict_writes_after_days,
  suspend_orders_after_days = excluded.suspend_orders_after_days,
  reminder_days = excluded.reminder_days,
  updated_at = now();

insert into public.plans (
  code, name, description, monthly_price,
  max_orders_month, max_team_members, max_couriers,
  features, is_active, sort_order, updated_at
) values
  (
    'gratis', 'Grátis',
    'Para conhecer a Comandiva e começar sem risco.',
    0, 50, 1, 1,
    jsonb_build_object(
      'catalog', true,
      'orders', true,
      'pickup', true,
      'delivery', true,
      'tracking', true,
      'reports', 'basic',
      'thermal_print', false,
      'kds', false,
      'growth', false,
      'priority_support', false
    ),
    true, 10, now()
  ),
  (
    'essencial', 'Essencial',
    'Para operações pequenas que já vendem todos os dias.',
    69.90, 1000, 2, 3,
    jsonb_build_object(
      'catalog', true,
      'orders', true,
      'pickup', true,
      'delivery', true,
      'tracking', true,
      'reports', 'standard',
      'thermal_print', true,
      'kds', false,
      'growth', false,
      'priority_support', false
    ),
    true, 20, now()
  ),
  (
    'profissional', 'Profissional',
    'Para lojas em crescimento que precisam de cozinha, equipe e gestão comercial.',
    129.90, 5000, 5, 10,
    jsonb_build_object(
      'catalog', true,
      'orders', true,
      'pickup', true,
      'delivery', true,
      'tracking', true,
      'reports', 'advanced',
      'thermal_print', true,
      'kds', true,
      'growth', true,
      'priority_support', false
    ),
    true, 30, now()
  ),
  (
    'avancado', 'Avançado',
    'Para operações de alto volume que precisam de mais equipe, entregadores e suporte.',
    199.90, null, 15, 30,
    jsonb_build_object(
      'catalog', true,
      'orders', true,
      'pickup', true,
      'delivery', true,
      'tracking', true,
      'reports', 'advanced',
      'thermal_print', true,
      'kds', true,
      'growth', true,
      'priority_support', true
    ),
    true, 40, now()
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  max_orders_month = excluded.max_orders_month,
  max_team_members = excluded.max_team_members,
  max_couriers = excluded.max_couriers,
  features = excluded.features,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.plan_prices (plan_id, billing_interval, amount_cents, currency, trial_days, is_active, updated_at)
select p.id, v.billing_interval, v.amount_cents, 'BRL', v.trial_days, true, now()
from public.plans p
join (values
  ('gratis', 'monthly', 0, 0),
  ('essencial', 'monthly', 6990, 0),
  ('essencial', 'annual', 69900, 0),
  ('profissional', 'monthly', 12990, 14),
  ('profissional', 'annual', 129900, 14),
  ('avancado', 'monthly', 19990, 0),
  ('avancado', 'annual', 199900, 0)
) as v(plan_code, billing_interval, amount_cents, trial_days)
  on v.plan_code = p.code
on conflict (plan_id, billing_interval) do update set
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  trial_days = excluded.trial_days,
  is_active = excluded.is_active,
  updated_at = now();

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
  _plan_code text default 'profissional'::text,
  _origin text default 'autoatendimento'::text,
  _requested_by uuid default null::uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _existing public.store_provisioning_intents;
  _slug_n text := public.normalize_store_slug(coalesce(_store_name,''));
  _store_id uuid;
  _effective_plan_code text;
  _plan_id uuid;
  _plan_price numeric;
  _plan_price_id uuid;
  _plan_amount_cents integer;
  _trial_plan_code text := 'profissional';
  _trial_days smallint := 14;
  _payment_grace_days smallint := 7;
  _weekday int;
begin
  select trial_plan_code, trial_days, payment_grace_days
    into _trial_plan_code, _trial_days, _payment_grace_days
  from public.billing_policy
  where policy_key = 'default';

  if coalesce(btrim(_slug),'') <> '' then
    _slug_n := public.normalize_store_slug(_slug);
  end if;

  select * into _existing
  from public.store_provisioning_intents
  where idempotency_key = _idempotency_key;

  if found then
    if _existing.request_hash <> _request_hash then raise exception 'CONFLITO_IDEMPOTENCIA'; end if;
    if _existing.status = 'concluida' then
      return jsonb_build_object(
        'store_id', _existing.store_id,
        'slug', (select slug from public.stores where id = _existing.store_id),
        'already_provisioned', true
      );
    end if;
  else
    insert into public.store_provisioning_intents(idempotency_key,request_hash,origin,owner_user_id,requested_by)
    values(_idempotency_key,_request_hash,_origin,_owner_user_id,_requested_by);
  end if;

  if length(_slug_n) < 3 or length(_slug_n) > 60 then raise exception 'SLUG_INVALIDO'; end if;
  if _slug_n = any(private.reserved_slugs()) then raise exception 'SLUG_RESERVADO'; end if;
  if exists(select 1 from public.stores where slug = _slug_n) then raise exception 'SLUG_EM_USO'; end if;
  if coalesce(btrim(_store_name),'') = '' then raise exception 'NOME_INVALIDO'; end if;

  insert into public.stores(slug,name,status,segment,phone,whatsapp,city,state,timezone,accepts_delivery,accepts_pickup)
  values(
    _slug_n,btrim(_store_name),'em_implantacao',nullif(btrim(coalesce(_segment,'')),''),
    nullif(btrim(coalesce(_phone,'')),''),nullif(btrim(coalesce(_phone,'')),''),
    coalesce(nullif(btrim(coalesce(_city,'')),''),'Não informado'),
    upper(coalesce(nullif(btrim(coalesce(_state,'')),''),'BR')),
    'America/Sao_Paulo',true,true
  ) returning id into _store_id;

  insert into public.store_settings(store_id) values(_store_id);
  for _weekday in 0..6 loop
    insert into public.store_hours(store_id,weekday,opens_at,closes_at,is_active)
    values(_store_id,_weekday,'08:00','23:00',true);
  end loop;

  insert into public.payment_methods(store_id,kind,label,needs_change,is_active,sort_order,available_for_delivery,available_for_pickup)
  values
    (_store_id,'dinheiro','Dinheiro',true,true,1,true,true),
    (_store_id,'pix','Pix',false,true,2,true,true);

  insert into public.user_profiles(id,full_name,display_name,phone,is_active)
  values(_owner_user_id,btrim(_owner_full_name),split_part(btrim(_owner_full_name),' ',1),nullif(btrim(coalesce(_phone,'')),''),true)
  on conflict(id) do update set
    full_name = excluded.full_name,
    display_name = excluded.display_name,
    is_active = true,
    updated_at = now();

  insert into public.user_roles(user_id,store_id,role,is_active)
  values(_owner_user_id,_store_id,'proprietario',true)
  on conflict do nothing;

  _effective_plan_code := case
    when coalesce(_origin, 'autoatendimento') = 'autoatendimento' then coalesce(_trial_plan_code, 'profissional')
    else coalesce(nullif(btrim(_plan_code), ''), coalesce(_trial_plan_code, 'profissional'))
  end;

  select p.id, p.monthly_price, pp.id, pp.amount_cents
    into _plan_id, _plan_price, _plan_price_id, _plan_amount_cents
  from public.plans p
  left join public.plan_prices pp
    on pp.plan_id = p.id and pp.billing_interval = 'monthly' and pp.is_active
  where p.code = _effective_plan_code and p.is_active
  limit 1;

  if _plan_id is null then
    raise exception 'PLANO_INDISPONIVEL';
  end if;

  if _effective_plan_code = 'gratis' then
    insert into public.store_subscriptions(
      store_id,plan_id,status,monthly_price,due_day,grace_days,current_period_end,started_at,notes,
      plan_price_id,billing_interval,trial_ends_at
    ) values(
      _store_id,_plan_id,'ativa',coalesce(_plan_amount_cents,0)::numeric / 100,10,_payment_grace_days,
      null,current_date,'Plano gratuito.',_plan_price_id,'monthly',null
    );
  else
    insert into public.store_subscriptions(
      store_id,plan_id,status,monthly_price,due_day,grace_days,current_period_end,started_at,notes,
      plan_price_id,billing_interval,trial_ends_at
    ) values(
      _store_id,_plan_id,'cortesia',coalesce(_plan_amount_cents,round(_plan_price * 100)::int)::numeric / 100,
      10,_payment_grace_days,(current_date + make_interval(days => _trial_days))::date,current_date,
      format('Teste gratuito de %s dias do plano %s.', _trial_days, _effective_plan_code),
      _plan_price_id,'monthly',now() + make_interval(days => _trial_days)
    );
  end if;

  insert into public.audit_logs(store_id,actor_user_id,actor_kind,action,entity,entity_id,context)
  values(
    _store_id,coalesce(_requested_by,_owner_user_id),'sistema','platform.store_created','stores',_store_id,
    jsonb_build_object(
      'origin',_origin,
      'slug',_slug_n,
      'requested_plan_code',_plan_code,
      'effective_plan_code',_effective_plan_code,
      'trial_days',case when _effective_plan_code='gratis' then 0 else _trial_days end
    )
  );

  update public.store_provisioning_intents
  set status='concluida',store_id=_store_id,owner_user_id=_owner_user_id,updated_at=now()
  where idempotency_key=_idempotency_key;

  return jsonb_build_object(
    'store_id',_store_id,
    'slug',_slug_n,
    'already_provisioned',false,
    'plan_code',_effective_plan_code,
    'trial_days',case when _effective_plan_code='gratis' then 0 else _trial_days end
  );
end;
$function$;

revoke all on function public.provision_store_with_owner(text,text,uuid,text,text,text,text,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.provision_store_with_owner(text,text,uuid,text,text,text,text,text,text,text,text,text,uuid) to service_role;
