create table if not exists private.whatsapp_pending_message_statuses (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null,
  status text not null check (status in ('sent','delivered','read','failed')),
  event_at timestamptz not null,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider_message_id,status,event_at)
);

create index if not exists whatsapp_pending_message_statuses_message_idx
  on private.whatsapp_pending_message_statuses(provider_message_id,event_at);

create or replace function private.apply_meta_status_to_message(
  _message_id uuid,
  _status text,
  _event_at timestamptz,
  _error_code text default null,
  _error_message text default null,
  _metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _message private.outbound_messages%rowtype;
  _incoming text := lower(coalesce(_status,''));
  _at timestamptz := coalesce(_event_at,now());
  _next text;
begin
  if _incoming not in ('sent','delivered','read','failed') then return false; end if;

  select * into _message from private.outbound_messages m where m.id=_message_id for update;
  if not found then return false; end if;

  _next := _message.status;
  if _incoming='read' then _next := 'read';
  elsif _incoming='delivered' and _message.status <> 'read' then _next := 'delivered';
  elsif _incoming='sent' and _message.status in ('queued','sending','sent') then _next := 'sent';
  elsif _incoming='failed' and _message.status not in ('delivered','read') then _next := 'failed';
  end if;

  update private.outbound_messages
  set status=_next,
      sent_at=case when _incoming in ('sent','delivered','read') then coalesce(sent_at,_at) else sent_at end,
      delivered_at=case when _incoming in ('delivered','read') then coalesce(delivered_at,_at) else delivered_at end,
      read_at=case when _incoming='read' then coalesce(read_at,_at) else read_at end,
      failed_at=case when _incoming='failed' and _next='failed' then coalesce(failed_at,_at) else failed_at end,
      error_code=case when _incoming='failed' then left(_error_code,120) else error_code end,
      error_message=case when _incoming='failed' then left(_error_message,500) else error_message end,
      metadata=coalesce(metadata,'{}'::jsonb)
        || jsonb_build_object('last_meta_status',_incoming,'last_meta_status_at',_at)
        || coalesce(_metadata,'{}'::jsonb),
      updated_at=now()
  where id=_message.id;

  return true;
end;
$function$;

revoke all on function private.apply_meta_status_to_message(uuid,text,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function private.apply_meta_status_to_message(uuid,text,timestamptz,text,text,jsonb) to service_role;

create or replace function public.apply_meta_whatsapp_message_status(
  _provider_message_id text,
  _status text,
  _event_at timestamptz,
  _error_code text default null,
  _error_message text default null,
  _metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _message_id uuid;
  _incoming text := lower(coalesce(_status,''));
  _at timestamptz := coalesce(_event_at,now());
begin
  if _incoming not in ('sent','delivered','read','failed') then return false; end if;
  if _provider_message_id is null or btrim(_provider_message_id)='' then return false; end if;

  select m.id into _message_id
  from private.outbound_messages m
  where m.provider='meta_whatsapp' and m.provider_message_id=_provider_message_id
  limit 1;

  if _message_id is null then
    insert into private.whatsapp_pending_message_statuses(
      provider_message_id,status,event_at,error_code,error_message,metadata
    ) values(
      left(_provider_message_id,512),_incoming,_at,left(_error_code,120),left(_error_message,500),coalesce(_metadata,'{}'::jsonb)
    ) on conflict(provider_message_id,status,event_at) do nothing;
    return true;
  end if;

  return private.apply_meta_status_to_message(
    _message_id,_incoming,_at,_error_code,_error_message,_metadata
  );
end;
$function$;

revoke all on function public.apply_meta_whatsapp_message_status(text,text,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_meta_whatsapp_message_status(text,text,timestamptz,text,text,jsonb) to service_role;

create or replace function public.complete_whatsapp_automation_job(
  _job_id uuid,
  _message_id uuid,
  _provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _job private.automation_jobs%rowtype;
  _message private.outbound_messages%rowtype;
  _pending record;
begin
  if _provider_message_id is null or length(btrim(_provider_message_id)) < 6 or length(_provider_message_id) > 512 then
    raise exception 'INVALID_PROVIDER_MESSAGE_ID' using errcode='P0001';
  end if;

  select * into _job from private.automation_jobs j where j.id=_job_id for update;
  if not found then raise exception 'AUTOMATION_JOB_NOT_FOUND' using errcode='P0001'; end if;
  select * into _message from private.outbound_messages m where m.id=_message_id and m.automation_job_id=_job_id for update;
  if not found then raise exception 'OUTBOUND_MESSAGE_NOT_FOUND' using errcode='P0001'; end if;

  if _message.provider_message_id is not null and _message.provider_message_id <> _provider_message_id then
    raise exception 'PROVIDER_MESSAGE_ID_CONFLICT' using errcode='P0001';
  end if;

  update private.outbound_messages
  set provider_message_id=_provider_message_id,
      status=case when status in ('delivered','read') then status else 'sent' end,
      sent_at=coalesce(sent_at,now()),
      error_code=null,error_message=null,updated_at=now()
  where id=_message_id;

  for _pending in
    select p.* from private.whatsapp_pending_message_statuses p
    where p.provider_message_id=_provider_message_id
    order by p.event_at,p.created_at
    for update
  loop
    perform private.apply_meta_status_to_message(
      _message_id,_pending.status,_pending.event_at,_pending.error_code,_pending.error_message,_pending.metadata
    );
  end loop;

  delete from private.whatsapp_pending_message_statuses p where p.provider_message_id=_provider_message_id;

  perform private.record_integration_usage(
    _message.store_id,_message.provider,'whatsapp_automation','messages',1,0,0,
    'whatsapp:accepted:'||_message.id::text,now(),
    jsonb_build_object('message_id',_message.id,'provider_message_id',_provider_message_id)
  );

  update private.automation_jobs
  set status='succeeded',locked_at=null,locked_by=null,last_error=null,updated_at=now()
  where id=_job_id;

  return true;
end;
$function$;

revoke all on function public.complete_whatsapp_automation_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_whatsapp_automation_job(uuid,uuid,text) to service_role;

delete from private.whatsapp_pending_message_statuses where created_at < now() - interval '7 days';