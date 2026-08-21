create or replace function public.get_store_evolution_whatsapp_connection(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_account private.integration_provider_accounts%rowtype;
  v_request private.whatsapp_provisioning_requests%rowtype;
  v_paid boolean := false;
  v_entitled boolean := false;
begin
  perform private.require_growth_access(_store_id);

  select exists(
    select 1
    from public.store_addon_subscriptions s
    join public.addon_catalog a on a.id=s.addon_id
    where s.store_id=_store_id
      and a.code='whatsapp_automation'
      and s.status in ('active','complimentary')
  ) into v_paid;

  v_entitled := private.store_has_entitlement(_store_id,'whatsapp_automation');

  select * into v_account
  from private.integration_provider_accounts a
  where a.store_id=_store_id
    and a.provider='evolution_api'
    and a.connection_key='whatsapp_primary'
  order by a.updated_at desc
  limit 1;

  select * into v_request
  from private.whatsapp_provisioning_requests r
  where r.store_id=_store_id
  order by r.created_at desc
  limit 1;

  return jsonb_strip_nulls(jsonb_build_object(
    'configured', v_account.id is not null,
    'connected', coalesce(v_account.status='connected',false),
    'status', coalesce(v_account.status,'disconnected'),
    'instance_name', coalesce(v_account.public_config->>'instance_name',v_account.external_account_id),
    'display_phone_number', v_account.public_config->>'display_phone_number',
    'connected_at', v_account.connected_at,
    'last_health_at', v_account.last_health_at,
    'last_error', v_account.last_error,
    'provisioning_request_id', v_request.id,
    'provisioning_status', coalesce(v_request.status,'not_requested'),
    'paid_subscription', v_paid,
    'automatic_entitled', v_entitled,
    'can_provision', v_paid and v_entitled
  ));
end;
$$;

revoke all on function public.get_store_evolution_whatsapp_connection(uuid) from public,anon;
grant execute on function public.get_store_evolution_whatsapp_connection(uuid) to authenticated;

create or replace function public.backend_mark_evolution_whatsapp_state(
  _store_id uuid,
  _instance_name text,
  _state text,
  _display_phone_number text default null,
  _last_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_state text := lower(btrim(coalesce(_state,'')));
  v_status text;
  v_request_id uuid;
  v_account jsonb;
begin
  if v_state in ('open','connected') then
    v_status := 'connected';
  elsif v_state in ('connecting','pending','created') then
    v_status := 'pending';
  elsif v_state in ('close','closed','disconnected') then
    v_status := 'disconnected';
  elsif v_state in ('disabled') then
    v_status := 'disabled';
  else
    v_status := 'degraded';
  end if;

  select public.backend_upsert_evolution_whatsapp_account(
    _store_id,_instance_name,v_status,_display_phone_number,_last_error
  ) into v_account;

  select id into v_request_id
  from private.whatsapp_provisioning_requests
  where store_id=_store_id
    and status in ('paid','provisioning','awaiting_customer','active','degraded','suspended')
  order by created_at desc
  limit 1
  for update;

  if v_request_id is not null then
    if v_status='connected' then
      perform public.backend_transition_whatsapp_provisioning(
        v_request_id,'active','evolution_api',null,_instance_name,null,null,
        jsonb_build_object('connection_type','WHATSAPP-BAILEYS','self_service',true)
      );
    elsif v_status='pending' then
      perform public.backend_transition_whatsapp_provisioning(
        v_request_id,'awaiting_customer','evolution_api',null,_instance_name,null,null,
        jsonb_build_object('connection_type','WHATSAPP-BAILEYS','self_service',true)
      );
    elsif v_status='degraded' then
      perform public.backend_transition_whatsapp_provisioning(
        v_request_id,'degraded','evolution_api',null,_instance_name,null,_last_error,
        jsonb_build_object('connection_type','WHATSAPP-BAILEYS','self_service',true)
      );
    elsif v_status='disconnected' and exists(
      select 1 from public.store_addon_subscriptions s
      join public.addon_catalog a on a.id=s.addon_id
      where s.store_id=_store_id and a.code='whatsapp_automation' and s.status in ('active','complimentary')
    ) then
      update private.whatsapp_provisioning_requests
      set status='awaiting_customer',provider='evolution_api',provider_reference=_instance_name,
          last_error=nullif(left(coalesce(_last_error,''),500),''),updated_at=now()
      where id=v_request_id and status not in ('suspended','cancelled');
    end if;
  end if;

  return v_account;
end;
$$;

revoke all on function public.backend_mark_evolution_whatsapp_state(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.backend_mark_evolution_whatsapp_state(uuid,text,text,text,text) to service_role;

create or replace function public.prepare_evolution_manual_send(
  _store_id uuid,
  _phone text,
  _body text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_phone text;
  v_body text := btrim(coalesce(_body,''));
  v_account private.integration_provider_accounts%rowtype;
begin
  perform private.require_growth_access(_store_id);
  perform private.require_store_entitlement(_store_id,'whatsapp_automation');

  if length(v_body) < 1 or length(v_body) > 4096 then
    raise exception 'INVALID_MESSAGE_BODY' using errcode='22023';
  end if;

  v_phone := private.normalize_whatsapp_e164(_phone);
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'INVALID_WHATSAPP_PHONE' using errcode='22023';
  end if;

  select * into v_account
  from private.integration_provider_accounts a
  where a.store_id=_store_id
    and a.provider='evolution_api'
    and a.connection_key='whatsapp_primary'
    and a.status='connected'
  order by a.connected_at desc nulls last,a.updated_at desc
  limit 1;

  if not found then
    raise exception 'EVOLUTION_WHATSAPP_NOT_CONNECTED' using errcode='P0001';
  end if;

  return jsonb_build_object(
    'recipient_e164',v_phone,
    'body',v_body,
    'instance_name',coalesce(v_account.public_config->>'instance_name',v_account.external_account_id)
  );
end;
$$;

revoke all on function public.prepare_evolution_manual_send(uuid,text,text) from public,anon;
grant execute on function public.prepare_evolution_manual_send(uuid,text,text) to authenticated;

create or replace function public.backend_record_evolution_manual_send(
  _store_id uuid,
  _recipient_e164 text,
  _body text,
  _provider_message_id text,
  _actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_id uuid;
  v_customer_id uuid;
begin
  if _provider_message_id is null or length(btrim(_provider_message_id)) < 6 then
    raise exception 'INVALID_PROVIDER_MESSAGE_ID' using errcode='22023';
  end if;

  select c.id into v_customer_id
  from public.customers c
  where c.store_id=_store_id
    and private.normalize_whatsapp_e164(c.phone)=_recipient_e164
  order by c.updated_at desc
  limit 1;

  insert into private.outbound_messages(
    store_id,customer_id,channel,purpose,recipient_e164,provider,provider_message_id,
    status,body_snapshot,sent_at,metadata
  ) values(
    _store_id,v_customer_id,'whatsapp','transactional',_recipient_e164,'evolution_api',
    left(btrim(_provider_message_id),512),'sent',left(_body,4096),now(),
    jsonb_build_object('source','manual','actor_user_id',_actor_user_id)
  ) returning id into v_id;

  perform private.record_integration_usage(
    _store_id,'evolution_api','whatsapp_automation','messages',1,
    jsonb_build_object('source','manual','outbound_message_id',v_id)
  );

  return v_id;
end;
$$;

revoke all on function public.backend_record_evolution_manual_send(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.backend_record_evolution_manual_send(uuid,text,text,text,uuid) to service_role;
