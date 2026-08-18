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

comment on function public.finalize_mercado_pago_webhook_event(text,text,jsonb,text)
is 'Service-role-only finalizer for validated Mercado Pago webhook inbox events. Stores only a sanitized provider snapshot.';
