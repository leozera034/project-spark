alter table private.billing_webhook_events
  add column if not exists processing_started_at timestamptz;

create or replace function public.claim_mercado_pago_webhook_event(
  p_provider_event_key text,
  p_event_type text,
  p_resource_id text,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_rows integer := 0;
  v_status text;
  v_started_at timestamptz;
begin
  if p_provider_event_key is null or btrim(p_provider_event_key) = '' or length(p_provider_event_key) > 300 then
    raise exception 'invalid_provider_event_key';
  end if;
  if p_event_type is null or btrim(p_event_type) = '' or length(p_event_type) > 200 then
    raise exception 'invalid_event_type';
  end if;
  if p_resource_id is not null and length(p_resource_id) > 300 then
    raise exception 'invalid_resource_id';
  end if;

  insert into private.billing_webhook_events (
    provider,
    provider_event_key,
    event_type,
    resource_id,
    signature_valid,
    processing_status,
    payload,
    processing_started_at
  ) values (
    'mercado_pago',
    p_provider_event_key,
    p_event_type,
    nullif(btrim(p_resource_id), ''),
    true,
    'received',
    coalesce(p_payload, '{}'::jsonb),
    now()
  )
  on conflict (provider, provider_event_key) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    return 'process';
  end if;

  select processing_status, processing_started_at
    into v_status, v_started_at
  from private.billing_webhook_events
  where provider = 'mercado_pago'
    and provider_event_key = p_provider_event_key
  for update;

  if not found then
    return 'missing';
  end if;

  if v_status in ('processed', 'ignored') then
    return 'duplicate';
  end if;

  if v_status = 'failed'
     or (v_status = 'received' and (v_started_at is null or v_started_at < now() - interval '2 minutes')) then
    update private.billing_webhook_events
    set processing_status = 'received',
        processing_started_at = now(),
        processed_at = null,
        last_error = null
    where provider = 'mercado_pago'
      and provider_event_key = p_provider_event_key;
    return 'process';
  end if;

  if v_status = 'received' then
    return 'busy';
  end if;

  return 'missing';
end;
$$;

revoke all on function public.claim_mercado_pago_webhook_event(text,text,text,jsonb) from public;
revoke all on function public.claim_mercado_pago_webhook_event(text,text,text,jsonb) from anon;
revoke all on function public.claim_mercado_pago_webhook_event(text,text,text,jsonb) from authenticated;
grant execute on function public.claim_mercado_pago_webhook_event(text,text,text,jsonb) to service_role;

create or replace function public.finalize_mercado_pago_webhook_event(
  p_provider_event_key text,
  p_processing_status text,
  p_provider_snapshot jsonb default null,
  p_last_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_rows integer := 0;
begin
  if p_provider_event_key is null
     or btrim(p_provider_event_key) = ''
     or length(p_provider_event_key) > 300 then
    raise exception 'invalid_provider_event_key';
  end if;

  if p_processing_status not in ('processed', 'ignored', 'failed') then
    raise exception 'invalid_processing_status';
  end if;

  if p_last_error is not null and length(p_last_error) > 500 then
    raise exception 'invalid_last_error';
  end if;

  update private.billing_webhook_events
  set processing_status = p_processing_status,
      attempt_count = attempt_count + 1,
      payload = case
        when p_provider_snapshot is null then payload
        else payload || jsonb_build_object('provider_snapshot', p_provider_snapshot)
      end,
      processed_at = case
        when p_processing_status in ('processed', 'ignored') then now()
        else null
      end,
      last_error = nullif(btrim(coalesce(p_last_error, '')), '')
  where provider = 'mercado_pago'
    and provider_event_key = p_provider_event_key;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.finalize_mercado_pago_webhook_event(text,text,jsonb,text) from public;
revoke all on function public.finalize_mercado_pago_webhook_event(text,text,jsonb,text) from anon;
revoke all on function public.finalize_mercado_pago_webhook_event(text,text,jsonb,text) from authenticated;
grant execute on function public.finalize_mercado_pago_webhook_event(text,text,jsonb,text) to service_role;

comment on function public.claim_mercado_pago_webhook_event(text,text,text,jsonb)
is 'Service-role-only idempotent claim for validated Mercado Pago webhooks. Failed/stale claims may be retried; active claims return busy.';

comment on function public.finalize_mercado_pago_webhook_event(text,text,jsonb,text)
is 'Service-role-only finalizer for validated Mercado Pago webhook inbox events. Stores only a sanitized provider snapshot.';
