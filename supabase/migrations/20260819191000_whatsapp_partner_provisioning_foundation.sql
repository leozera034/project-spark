-- Provider-agnostic WhatsApp add-on provisioning foundation.
-- No provider purchase or credential is required by this migration.

create table if not exists private.whatsapp_provisioning_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text,
  status text not null default 'awaiting_payment',
  checkout_reference text,
  provider_reference text,
  onboarding_url text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  provisioning_started_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_provisioning_status_chk check (status in (
    'awaiting_payment','paid','provisioning','awaiting_customer','active','degraded','suspended','cancelled','failed'
  )),
  constraint whatsapp_provisioning_provider_chk check (provider is null or provider in (
    'meta_whatsapp','partner_bsp','360dialog_whatsapp','twilio_whatsapp','evolution_api'
  ))
);

create unique index if not exists whatsapp_provisioning_one_open_per_store
on private.whatsapp_provisioning_requests(store_id)
where status in ('awaiting_payment','paid','provisioning','awaiting_customer','active','degraded','suspended');

create index if not exists whatsapp_provisioning_status_idx
on private.whatsapp_provisioning_requests(status, requested_at);

alter table private.whatsapp_provisioning_requests enable row level security;
revoke all on private.whatsapp_provisioning_requests from public, anon, authenticated;

create or replace function public.request_whatsapp_addon(_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_id uuid;
  v_status text;
begin
  perform private.require_growth_access(_store_id);

  select id,status into v_id,v_status
  from private.whatsapp_provisioning_requests
  where store_id=_store_id
    and status in ('awaiting_payment','paid','provisioning','awaiting_customer','active','degraded','suspended')
  order by created_at desc limit 1;

  if v_id is null then
    insert into private.whatsapp_provisioning_requests(store_id,status)
    values(_store_id,'awaiting_payment') returning id,status into v_id,v_status;
  end if;

  return jsonb_build_object(
    'request_id',v_id,
    'status',v_status,
    'requires_payment',v_status='awaiting_payment',
    'message',case when v_status='awaiting_payment' then 'WhatsApp add-on awaits payment before provider provisioning.' else 'WhatsApp add-on request already exists.' end
  );
end;
$$;

create or replace function public.get_whatsapp_addon_provisioning(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare v private.whatsapp_provisioning_requests%rowtype;
begin
  perform private.require_growth_access(_store_id);
  select * into v from private.whatsapp_provisioning_requests
  where store_id=_store_id order by created_at desc limit 1;
  if not found then return jsonb_build_object('status','not_requested','request_id',null); end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'request_id',v.id,'status',v.status,'provider',v.provider,
    'onboarding_url',v.onboarding_url,'requested_at',v.requested_at,
    'paid_at',v.paid_at,'activated_at',v.activated_at,
    'last_error',v.last_error
  ));
end;
$$;

-- Backend-only transition used by payment/provider webhooks. This is deliberately
-- generic so a BSP can be selected later without changing the store-facing API.
create or replace function public.backend_transition_whatsapp_provisioning(
  _request_id uuid,
  _status text,
  _provider text default null,
  _checkout_reference text default null,
  _provider_reference text default null,
  _onboarding_url text default null,
  _last_error text default null,
  _metadata jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare v private.whatsapp_provisioning_requests%rowtype;
begin
  if _status not in ('awaiting_payment','paid','provisioning','awaiting_customer','active','degraded','suspended','cancelled','failed') then
    raise exception 'INVALID_PROVISIONING_STATUS' using errcode='22023';
  end if;
  if _provider is not null and _provider not in ('meta_whatsapp','partner_bsp','360dialog_whatsapp','twilio_whatsapp','evolution_api') then
    raise exception 'INVALID_WHATSAPP_PROVIDER' using errcode='22023';
  end if;

  update private.whatsapp_provisioning_requests set
    status=_status,
    provider=coalesce(_provider,provider),
    checkout_reference=coalesce(nullif(btrim(coalesce(_checkout_reference,'')),''),checkout_reference),
    provider_reference=coalesce(nullif(btrim(coalesce(_provider_reference,'')),''),provider_reference),
    onboarding_url=coalesce(nullif(btrim(coalesce(_onboarding_url,'')),''),onboarding_url),
    last_error=nullif(left(coalesce(_last_error,''),500),''),
    metadata=case when _metadata is null then metadata else metadata || _metadata end,
    paid_at=case when _status in ('paid','provisioning','awaiting_customer','active') then coalesce(paid_at,now()) else paid_at end,
    provisioning_started_at=case when _status='provisioning' then coalesce(provisioning_started_at,now()) else provisioning_started_at end,
    activated_at=case when _status='active' then coalesce(activated_at,now()) else activated_at end,
    suspended_at=case when _status='suspended' then now() else suspended_at end,
    cancelled_at=case when _status='cancelled' then now() else cancelled_at end,
    updated_at=now()
  where id=_request_id returning * into v;
  if not found then raise exception 'PROVISIONING_REQUEST_NOT_FOUND' using errcode='22023'; end if;

  return jsonb_strip_nulls(jsonb_build_object('request_id',v.id,'store_id',v.store_id,'status',v.status,'provider',v.provider,'onboarding_url',v.onboarding_url));
end;
$$;

revoke all on function public.backend_transition_whatsapp_provisioning(uuid,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_transition_whatsapp_provisioning(uuid,text,text,text,text,text,text,jsonb) to service_role;

grant execute on function public.request_whatsapp_addon(uuid) to authenticated;
grant execute on function public.get_whatsapp_addon_provisioning(uuid) to authenticated;
