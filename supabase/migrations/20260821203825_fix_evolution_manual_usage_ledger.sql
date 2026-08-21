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

  select m.id into v_id
  from private.outbound_messages m
  where m.store_id=_store_id
    and m.provider='evolution_api'
    and m.provider_message_id=_provider_message_id
  limit 1;

  if v_id is null then
    insert into private.outbound_messages(
      store_id,customer_id,channel,purpose,recipient_e164,provider,provider_message_id,
      status,body_snapshot,sent_at,metadata
    ) values(
      _store_id,v_customer_id,'whatsapp','transactional',_recipient_e164,'evolution_api',
      left(btrim(_provider_message_id),512),'sent',left(_body,4096),now(),
      jsonb_build_object('source','manual','actor_user_id',_actor_user_id)
    ) returning id into v_id;
  end if;

  perform private.record_integration_usage(
    _store_id,
    'evolution_api',
    'whatsapp_automation',
    'messages',
    1,
    0,
    0,
    'whatsapp:manual:' || left(btrim(_provider_message_id),120),
    now(),
    jsonb_build_object(
      'source','manual',
      'outbound_message_id',v_id,
      'provider_message_id',left(btrim(_provider_message_id),512)
    )
  );

  return v_id;
end;
$$;

revoke all on function public.backend_record_evolution_manual_send(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.backend_record_evolution_manual_send(uuid,text,text,text,uuid) to service_role;
