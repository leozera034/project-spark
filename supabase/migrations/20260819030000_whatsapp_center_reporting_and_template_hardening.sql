create or replace function public.save_store_message_template(
  _store_id uuid,
  _id uuid,
  _code text,
  _name text,
  _purpose text,
  _body text,
  _provider_template_name text default null,
  _provider_language text default 'pt_BR',
  _provider_status text default 'draft',
  _is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _result_id uuid;
  _current public.store_message_templates%rowtype;
  _normalized_language text := coalesce(nullif(btrim(_provider_language),''),'pt_BR');
  _content_changed boolean := false;
begin
  if not private.is_store_manager(_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  if _code !~ '^[a-z0-9_.-]{2,80}$' then
    raise exception 'INVALID_TEMPLATE_CODE' using errcode='P0001';
  end if;
  if length(btrim(coalesce(_name,''))) < 2 or length(btrim(_name)) > 120 then
    raise exception 'INVALID_TEMPLATE_NAME' using errcode='P0001';
  end if;
  if _purpose not in ('transactional','marketing') then
    raise exception 'INVALID_TEMPLATE_PURPOSE' using errcode='P0001';
  end if;
  if length(btrim(coalesce(_body,''))) < 1 or length(btrim(_body)) > 4096 then
    raise exception 'INVALID_TEMPLATE_BODY' using errcode='P0001';
  end if;
  if _normalized_language !~ '^[a-z]{2}(_[A-Z]{2})?$' then
    raise exception 'INVALID_TEMPLATE_LANGUAGE' using errcode='P0001';
  end if;

  if _id is null then
    insert into public.store_message_templates(
      store_id,code,name,channel,purpose,body,provider_template_name,provider_language,provider_status,is_active
    ) values (
      _store_id,btrim(_code),btrim(_name),'whatsapp',_purpose,btrim(_body),null,_normalized_language,'draft',coalesce(_is_active,true)
    )
    returning id into _result_id;
  else
    select * into _current
    from public.store_message_templates
    where id=_id and store_id=_store_id
    for update;

    if not found then
      raise exception 'TEMPLATE_NOT_FOUND' using errcode='P0001';
    end if;

    _content_changed :=
      _current.code is distinct from btrim(_code)
      or _current.name is distinct from btrim(_name)
      or _current.purpose is distinct from _purpose
      or _current.body is distinct from btrim(_body)
      or _current.provider_language is distinct from _normalized_language;

    update public.store_message_templates
    set code=btrim(_code),
        name=btrim(_name),
        purpose=_purpose,
        body=btrim(_body),
        provider_language=_normalized_language,
        is_active=coalesce(_is_active,true),
        provider_template_name=case when _content_changed then null else _current.provider_template_name end,
        provider_status=case when _content_changed then 'draft' else _current.provider_status end,
        updated_at=now()
    where id=_id and store_id=_store_id
    returning id into _result_id;
  end if;

  return _result_id;
end;
$function$;

revoke all on function public.save_store_message_template(uuid,uuid,text,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.save_store_message_template(uuid,uuid,text,text,text,text,text,text,text,boolean) to authenticated,service_role;

create or replace function public.get_store_whatsapp_consent_summary(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _total bigint;
  _opted_in bigint;
  _opted_out bigint;
  _latest timestamptz;
begin
  perform private.require_growth_access(_store_id);

  select count(*) into _total
  from public.customers c
  where c.store_id=_store_id;

  select
    count(*) filter (where cc.opted_in),
    count(*) filter (where not cc.opted_in),
    max(coalesce(cc.revoked_at,cc.captured_at,cc.updated_at))
  into _opted_in,_opted_out,_latest
  from private.customer_channel_consents cc
  where cc.store_id=_store_id
    and cc.channel='whatsapp'
    and cc.purpose='marketing';

  return jsonb_build_object(
    'total_customers',coalesce(_total,0),
    'opted_in',coalesce(_opted_in,0),
    'opted_out',coalesce(_opted_out,0),
    'not_recorded',greatest(coalesce(_total,0)-coalesce(_opted_in,0)-coalesce(_opted_out,0),0),
    'latest_change_at',_latest
  );
end;
$function$;

revoke all on function public.get_store_whatsapp_consent_summary(uuid) from public,anon;
grant execute on function public.get_store_whatsapp_consent_summary(uuid) to authenticated,service_role;

create or replace function public.list_store_whatsapp_consents(_store_id uuid,_limit integer default 20)
returns table(
  customer_id uuid,
  customer_name text,
  phone text,
  opted_in boolean,
  source text,
  captured_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  perform private.require_growth_access(_store_id);

  return query
  select c.id,c.first_name,c.phone,cc.opted_in,cc.source,cc.captured_at,cc.revoked_at,cc.updated_at
  from private.customer_channel_consents cc
  join public.customers c on c.id=cc.customer_id and c.store_id=cc.store_id
  where cc.store_id=_store_id
    and cc.channel='whatsapp'
    and cc.purpose='marketing'
  order by cc.updated_at desc
  limit greatest(1,least(coalesce(_limit,20),100));
end;
$function$;

revoke all on function public.list_store_whatsapp_consents(uuid,integer) from public,anon;
grant execute on function public.list_store_whatsapp_consents(uuid,integer) to authenticated,service_role;

create or replace function public.list_store_whatsapp_message_history(_store_id uuid,_limit integer default 50)
returns table(
  id uuid,
  customer_id uuid,
  customer_name text,
  recipient_e164 text,
  purpose text,
  provider text,
  status text,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message text
)
language plpgsql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  perform private.require_growth_access(_store_id);

  return query
  select m.id,m.customer_id,c.first_name,m.recipient_e164,m.purpose,m.provider,m.status,
         m.queued_at,m.sent_at,m.delivered_at,m.read_at,m.failed_at,m.error_code,m.error_message
  from private.outbound_messages m
  left join public.customers c on c.id=m.customer_id and c.store_id=m.store_id
  where m.store_id=_store_id and m.channel='whatsapp'
  order by m.created_at desc
  limit greatest(1,least(coalesce(_limit,50),200));
end;
$function$;

revoke all on function public.list_store_whatsapp_message_history(uuid,integer) from public,anon;
grant execute on function public.list_store_whatsapp_message_history(uuid,integer) to authenticated,service_role;

create or replace function public.set_customer_whatsapp_marketing_consent(
  _store_id uuid,
  _customer_id uuid,
  _opted_in boolean,
  _source text default 'manual'
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _source_n text := left(coalesce(nullif(btrim(_source),''),'manual'),80);
begin
  if not private.is_store_manager(_store_id) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if not exists(select 1 from public.customers c where c.id=_customer_id and c.store_id=_store_id) then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0001';
  end if;

  insert into private.customer_channel_consents(
    store_id,customer_id,channel,purpose,opted_in,source,captured_at,revoked_at,evidence
  ) values (
    _store_id,_customer_id,'whatsapp','marketing',coalesce(_opted_in,false),_source_n,
    case when coalesce(_opted_in,false) then now() end,
    case when not coalesce(_opted_in,false) then now() end,
    jsonb_build_object('actor_user_id',auth.uid(),'source',_source_n,'recorded_at',now())
  )
  on conflict(store_id,customer_id,channel,purpose)
  do update set
    opted_in=excluded.opted_in,
    source=excluded.source,
    captured_at=case when excluded.opted_in then now() else private.customer_channel_consents.captured_at end,
    revoked_at=case when not excluded.opted_in then now() else null end,
    evidence=coalesce(private.customer_channel_consents.evidence,'{}'::jsonb) || excluded.evidence,
    updated_at=now();
  return true;
end;
$function$;

revoke all on function public.set_customer_whatsapp_marketing_consent(uuid,uuid,boolean,text) from public,anon;
grant execute on function public.set_customer_whatsapp_marketing_consent(uuid,uuid,boolean,text) to authenticated,service_role;
