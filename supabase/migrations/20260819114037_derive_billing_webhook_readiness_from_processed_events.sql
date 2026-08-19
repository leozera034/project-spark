create or replace function private.mark_billing_provider_webhook_readiness_from_event()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  _topic text;
begin
  if new.provider <> 'mercado_pago'
     or not coalesce(new.signature_valid,false)
     or new.processing_status <> 'processed' then
    return new;
  end if;

  if tg_op='UPDATE' and old.processing_status='processed' then
    return new;
  end if;

  _topic := split_part(coalesce(new.event_type,''),':',1);
  if _topic not in ('subscription_preapproval','subscription_authorized_payment','payment') then
    return new;
  end if;

  insert into private.billing_provider_runtime_readiness (
    provider, environment,
    webhook_secret_configured, webhook_secret_checked_at,
    webhook_delivery_verified, last_valid_webhook_at,
    last_valid_webhook_event_type, last_valid_webhook_event_key, last_valid_webhook_resource_id,
    last_error, updated_at
  ) values (
    'mercado_pago','test',
    true,now(),
    true,now(),
    left(new.event_type,200),left(new.provider_event_key,300),left(coalesce(new.resource_id,''),300),
    null,now()
  )
  on conflict (provider,environment) do update set
    webhook_secret_configured=true,
    webhook_secret_checked_at=now(),
    webhook_delivery_verified=true,
    last_valid_webhook_at=now(),
    last_valid_webhook_event_type=excluded.last_valid_webhook_event_type,
    last_valid_webhook_event_key=excluded.last_valid_webhook_event_key,
    last_valid_webhook_resource_id=excluded.last_valid_webhook_resource_id,
    last_error=null,
    updated_at=now();

  return new;
exception when others then
  -- Billing event recording must never fail because readiness telemetry failed.
  return new;
end;
$function$;

revoke all on function private.mark_billing_provider_webhook_readiness_from_event() from public, anon, authenticated;

drop trigger if exists trg_billing_provider_webhook_readiness on private.billing_webhook_events;
create trigger trg_billing_provider_webhook_readiness
after insert or update of processing_status on private.billing_webhook_events
for each row execute function private.mark_billing_provider_webhook_readiness_from_event();
