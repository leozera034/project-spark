-- Couple the generic add-on billing lifecycle to WhatsApp provisioning.
-- Payment/provider reconciliation remains authoritative; no browser action can mark provisioning paid.

create or replace function private.sync_whatsapp_provisioning_from_subscription(_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  s public.store_addon_subscriptions%rowtype;
  addon_code text;
  target_status text;
  req_id uuid;
begin
  select * into s from public.store_addon_subscriptions where id=_subscription_id;
  if not found then return; end if;

  select code into addon_code from public.addon_catalog where id=s.addon_id;
  if addon_code is distinct from 'whatsapp_automation' then return; end if;

  target_status := case s.status
    when 'active' then 'paid'
    when 'trial' then 'paid'
    when 'suspended' then 'suspended'
    when 'cancelled' then 'cancelled'
    else null
  end;
  if target_status is null then return; end if;

  select id into req_id
  from private.whatsapp_provisioning_requests
  where store_id=s.store_id
    and status in ('awaiting_payment','paid','provisioning','awaiting_customer','active','degraded','suspended')
  order by created_at desc limit 1
  for update;

  if req_id is null and target_status='paid' then
    insert into private.whatsapp_provisioning_requests(store_id,status,checkout_reference,paid_at,metadata)
    values(s.store_id,'paid',s.id::text,now(),jsonb_build_object('addon_subscription_id',s.id,'source','billing'));
    return;
  end if;
  if req_id is null then return; end if;

  -- Never regress an already provisioned channel to paid when billing replays an
  -- authorized callback. Billing may suspend/cancel it, but successful provider
  -- provisioning owns the active lifecycle.
  if target_status='paid' then
    update private.whatsapp_provisioning_requests
    set status=case when status='awaiting_payment' then 'paid' else status end,
        checkout_reference=coalesce(checkout_reference,s.id::text),
        paid_at=coalesce(paid_at,now()),
        metadata=metadata || jsonb_build_object('addon_subscription_id',s.id,'source','billing'),
        updated_at=now()
    where id=req_id;
  elsif target_status='suspended' then
    update private.whatsapp_provisioning_requests
    set status='suspended',suspended_at=now(),updated_at=now(),
        metadata=metadata || jsonb_build_object('addon_subscription_id',s.id,'source','billing')
    where id=req_id and status <> 'cancelled';
  elsif target_status='cancelled' then
    update private.whatsapp_provisioning_requests
    set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),updated_at=now(),
        metadata=metadata || jsonb_build_object('addon_subscription_id',s.id,'source','billing')
    where id=req_id;
  end if;
end;
$$;

revoke all on function private.sync_whatsapp_provisioning_from_subscription(uuid) from public,anon,authenticated;
grant execute on function private.sync_whatsapp_provisioning_from_subscription(uuid) to service_role;

create or replace function private.trg_sync_whatsapp_provisioning_from_billing()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    perform private.sync_whatsapp_provisioning_from_subscription(new.id);
  end if;
  return new;
end;
$$;

revoke all on function private.trg_sync_whatsapp_provisioning_from_billing() from public,anon,authenticated;

drop trigger if exists trg_sync_whatsapp_provisioning_from_billing on public.store_addon_subscriptions;
create trigger trg_sync_whatsapp_provisioning_from_billing
after insert or update of status on public.store_addon_subscriptions
for each row execute function private.trg_sync_whatsapp_provisioning_from_billing();
