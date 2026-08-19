-- Meta onboarding may only start after the paid add-on entered provisioning.
-- Existing provider connection completion remains authoritative for connection data.

create or replace function public.begin_store_meta_whatsapp_onboarding(_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  actor uuid := auth.uid();
  req private.whatsapp_provisioning_requests%rowtype;
  session_id uuid;
  expires_at timestamptz := now() + interval '20 minutes';
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  perform private.require_growth_access(_store_id);

  select * into req
  from private.whatsapp_provisioning_requests
  where store_id=_store_id
    and status in ('paid','provisioning','awaiting_customer','active','degraded')
  order by created_at desc limit 1
  for update;
  if not found then raise exception 'WHATSAPP_ADDON_NOT_PAID' using errcode='42501'; end if;
  if req.status='active' then raise exception 'WHATSAPP_ALREADY_ACTIVE' using errcode='22023'; end if;

  -- Reuse an unexpired open session to make browser retries idempotent.
  select id, expires_at into session_id, expires_at
  from private.meta_whatsapp_onboarding_sessions
  where store_id=_store_id and actor_user_id=actor
    and status in ('pending','processing') and expires_at > now()
  order by created_at desc limit 1;

  if session_id is null then
    insert into private.meta_whatsapp_onboarding_sessions(store_id,actor_user_id,status,expires_at)
    values(_store_id,actor,'pending',expires_at)
    returning id into session_id;
  end if;

  update private.whatsapp_provisioning_requests
  set provider='meta_whatsapp',
      status=case when status='paid' then 'awaiting_customer' else status end,
      provisioning_started_at=coalesce(provisioning_started_at,now()),
      updated_at=now(),
      metadata=metadata || jsonb_build_object('meta_onboarding_session_id',session_id)
  where id=req.id;

  return jsonb_build_object('session_id',session_id,'expires_at',expires_at);
end;
$$;

grant execute on function public.begin_store_meta_whatsapp_onboarding(uuid) to authenticated;
revoke all on function public.begin_store_meta_whatsapp_onboarding(uuid) from anon;

create or replace function private.trg_activate_whatsapp_provisioning_from_provider_account()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
begin
  if new.provider='meta_whatsapp' and new.status='connected'
     and (tg_op='INSERT' or old.status is distinct from new.status) then
    update private.whatsapp_provisioning_requests
    set provider='meta_whatsapp', status='active', activated_at=coalesce(activated_at,now()),
        last_error=null, updated_at=now(),
        metadata=metadata || jsonb_build_object('provider_account_id',new.id)
    where id=(select id from private.whatsapp_provisioning_requests
              where store_id=new.store_id and status in ('paid','provisioning','awaiting_customer','degraded')
              order by created_at desc limit 1);
  elsif new.provider='meta_whatsapp' and new.status in ('error','disconnected')
        and (tg_op='INSERT' or old.status is distinct from new.status) then
    update private.whatsapp_provisioning_requests
    set status=case when new.status='disconnected' then 'suspended' else 'degraded' end,
        last_error=left(coalesce(new.last_error,'provider_account_'||new.status),500), updated_at=now()
    where id=(select id from private.whatsapp_provisioning_requests
              where store_id=new.store_id and status in ('provisioning','awaiting_customer','active','degraded')
              order by created_at desc limit 1);
  end if;
  return new;
end;
$$;

revoke all on function private.trg_activate_whatsapp_provisioning_from_provider_account() from public,anon,authenticated;

drop trigger if exists trg_activate_whatsapp_provisioning_from_provider_account on private.integration_provider_accounts;
create trigger trg_activate_whatsapp_provisioning_from_provider_account
after insert or update of status on private.integration_provider_accounts
for each row execute function private.trg_activate_whatsapp_provisioning_from_provider_account();
