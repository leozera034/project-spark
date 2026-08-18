create or replace function public.record_mercado_pago_webhook_event(
  p_provider_event_key text,
  p_event_type text,
  p_resource_id text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_rows integer := 0;
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
    payload
  ) values (
    'mercado_pago',
    p_provider_event_key,
    p_event_type,
    nullif(btrim(p_resource_id), ''),
    true,
    'received',
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (provider, provider_event_key) do nothing;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.record_mercado_pago_webhook_event(text,text,text,jsonb) from public;
revoke all on function public.record_mercado_pago_webhook_event(text,text,text,jsonb) from anon;
revoke all on function public.record_mercado_pago_webhook_event(text,text,text,jsonb) from authenticated;
grant execute on function public.record_mercado_pago_webhook_event(text,text,text,jsonb) to service_role;
