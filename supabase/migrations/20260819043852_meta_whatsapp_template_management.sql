alter table public.store_message_templates
  add column if not exists provider_category text,
  add column if not exists provider_submission_error text,
  add column if not exists provider_submitted_at timestamptz,
  add column if not exists provider_synced_at timestamptz;

do $$ begin
  alter table public.store_message_templates
    add constraint store_message_templates_provider_category
    check (provider_category is null or provider_category in ('UTILITY','MARKETING','AUTHENTICATION'));
exception when duplicate_object then null; end $$;

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
  _result uuid;
  _code_n text;
  _name_n text;
  _body_n text;
  _language_n text;
  _existing public.store_message_templates%rowtype;
  _provider_content_changed boolean := false;
begin
  if not private.is_store_manager(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  _code_n := lower(btrim(coalesce(_code,'')));
  _name_n := btrim(coalesce(_name,''));
  _body_n := btrim(coalesce(_body,''));
  _language_n := coalesce(nullif(btrim(_provider_language),''),'pt_BR');
  if _code_n !~ '^[a-z0-9_.-]+$' then raise exception 'INVALID_TEMPLATE_CODE' using errcode='P0001'; end if;
  if char_length(_name_n) not between 2 and 120 then raise exception 'INVALID_TEMPLATE_NAME' using errcode='P0001'; end if;
  if char_length(_body_n) not between 1 and 4096 then raise exception 'INVALID_TEMPLATE_BODY' using errcode='P0001'; end if;
  if _purpose not in ('transactional','marketing') then raise exception 'INVALID_TEMPLATE_PURPOSE' using errcode='P0001'; end if;
  if char_length(_language_n) not between 2 and 20 then raise exception 'INVALID_TEMPLATE_LANGUAGE' using errcode='P0001'; end if;
  if coalesce(_provider_status,'draft') <> 'draft' then raise exception 'PROVIDER_STATUS_BACKEND_ONLY' using errcode='P0001'; end if;

  if _id is null then
    insert into public.store_message_templates(
      store_id,code,name,purpose,body,provider_template_name,provider_language,provider_status,is_active
    ) values(
      _store_id,_code_n,_name_n,_purpose,_body_n,null,_language_n,'draft',coalesce(_is_active,true)
    ) returning id into _result;
  else
    select * into _existing
    from public.store_message_templates t
    where t.id=_id and t.store_id=_store_id
    for update;
    if not found then raise exception 'TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;

    _provider_content_changed :=
      _existing.body is distinct from _body_n
      or _existing.purpose is distinct from _purpose
      or _existing.provider_language is distinct from _language_n;

    update public.store_message_templates
    set code=_code_n,
        name=_name_n,
        purpose=_purpose,
        body=_body_n,
        provider_template_name=_existing.provider_template_name,
        provider_template_id=_existing.provider_template_id,
        provider_language=_language_n,
        provider_status=case when _provider_content_changed then 'draft' else _existing.provider_status end,
        provider_category=case when _provider_content_changed then _existing.provider_category else _existing.provider_category end,
        provider_rejection_reason=case when _provider_content_changed then null else _existing.provider_rejection_reason end,
        provider_submission_error=null,
        provider_status_updated_at=case when _provider_content_changed then now() else _existing.provider_status_updated_at end,
        is_active=coalesce(_is_active,true),
        updated_at=now()
    where id=_id and store_id=_store_id
    returning id into _result;
  end if;
  return _result;
end;
$function$;

revoke all on function public.save_store_message_template(uuid,uuid,text,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.save_store_message_template(uuid,uuid,text,text,text,text,text,text,text,boolean) to authenticated;

drop function if exists public.list_store_message_templates(uuid);
create function public.list_store_message_templates(_store_id uuid)
returns table(
  id uuid,
  code text,
  name text,
  channel text,
  purpose text,
  body text,
  provider_template_name text,
  provider_template_id text,
  provider_language text,
  provider_status text,
  provider_category text,
  provider_rejection_reason text,
  provider_submission_error text,
  provider_submitted_at timestamptz,
  provider_synced_at timestamptz,
  provider_status_updated_at timestamptz,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  perform private.require_growth_access(_store_id);
  return query
  select
    t.id,t.code,t.name,t.channel,t.purpose,t.body,
    t.provider_template_name,t.provider_template_id,t.provider_language,t.provider_status,
    t.provider_category,t.provider_rejection_reason,t.provider_submission_error,
    t.provider_submitted_at,t.provider_synced_at,t.provider_status_updated_at,
    t.is_active,t.created_at,t.updated_at
  from public.store_message_templates t
  where t.store_id=_store_id
  order by t.updated_at desc;
end;
$function$;
revoke all on function public.list_store_message_templates(uuid) from public,anon;
grant execute on function public.list_store_message_templates(uuid) to authenticated;

create or replace function public.get_meta_whatsapp_template_operation_context(
  _store_id uuid,
  _actor_user_id uuid,
  _template_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _account private.integration_provider_accounts%rowtype;
  _template public.store_message_templates%rowtype;
  _waba_id text;
  _graph_version text;
  _provider_name text;
  _base_name text;
  _category text;
begin
  if _store_id is null or _actor_user_id is null or not exists(
    select 1
    from public.user_profiles p
    join public.user_roles r on r.user_id=p.id
    where p.id=_actor_user_id
      and p.is_active
      and r.is_active
      and r.store_id=_store_id
      and r.role in ('proprietario','gerente')
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  if not private.store_has_entitlement(_store_id,'whatsapp_automation') then
    raise exception 'WHATSAPP_AUTOMATION_ENTITLEMENT_REQUIRED' using errcode='P0001';
  end if;

  select * into _account
  from private.integration_provider_accounts a
  where a.store_id=_store_id
    and a.provider='meta_whatsapp'
    and a.connection_key='default'
    and a.status='connected'
  order by a.connected_at desc nulls last,a.created_at desc
  limit 1;
  if not found then raise exception 'WHATSAPP_PROVIDER_NOT_CONNECTED' using errcode='P0001'; end if;
  if nullif(btrim(_account.credential_ref),'') is null then raise exception 'WHATSAPP_PROVIDER_CREDENTIAL_MISSING' using errcode='P0001'; end if;

  _waba_id := nullif(btrim(coalesce(_account.public_config->>'waba_id',_account.external_account_id)),'');
  _graph_version := nullif(btrim(_account.public_config->>'graph_api_version'),'');
  if _waba_id is null or _waba_id !~ '^[0-9]{5,40}$' then raise exception 'WHATSAPP_WABA_ID_MISSING' using errcode='P0001'; end if;
  if _graph_version is null or _graph_version !~ '^v[0-9]{1,3}\.[0-9]{1,2}$' then raise exception 'WHATSAPP_GRAPH_VERSION_MISSING' using errcode='P0001'; end if;

  if _template_id is null then
    return jsonb_build_object(
      'store_id',_store_id,
      'credential_ref',_account.credential_ref,
      'waba_id',_waba_id,
      'graph_api_version',_graph_version
    );
  end if;

  select * into _template
  from public.store_message_templates t
  where t.id=_template_id and t.store_id=_store_id and t.channel='whatsapp';
  if not found then raise exception 'TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;

  _base_name := regexp_replace(lower(coalesce(_template.code,'')),'[^a-z0-9_]+','_','g');
  _base_name := regexp_replace(_base_name,'_+','_','g');
  _base_name := trim(both '_' from _base_name);
  if _base_name='' then raise exception 'INVALID_TEMPLATE_CODE' using errcode='P0001'; end if;
  _provider_name := coalesce(nullif(btrim(_template.provider_template_name),''),'comandiva_'||left(_base_name,100));
  _category := case when _template.purpose='marketing' then 'MARKETING' else 'UTILITY' end;

  return jsonb_build_object(
    'store_id',_store_id,
    'template_id',_template.id,
    'credential_ref',_account.credential_ref,
    'waba_id',_waba_id,
    'graph_api_version',_graph_version,
    'provider_template_id',_template.provider_template_id,
    'provider_template_name',_provider_name,
    'provider_status',_template.provider_status,
    'provider_language',_template.provider_language,
    'provider_category',_category,
    'purpose',_template.purpose,
    'body',_template.body,
    'is_active',_template.is_active
  );
end;
$function$;

create or replace function public.record_meta_whatsapp_template_submission(
  _store_id uuid,
  _template_id uuid,
  _provider_template_id text,
  _provider_template_name text,
  _provider_language text,
  _provider_status text,
  _provider_category text
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _mapped_status text;
  _category text := upper(coalesce(_provider_category,''));
begin
  _mapped_status := case upper(coalesce(_provider_status,''))
    when 'APPROVED' then 'approved'
    when 'REINSTATED' then 'approved'
    when 'REJECTED' then 'rejected'
    when 'DISABLED' then 'rejected'
    when 'FLAGGED' then 'rejected'
    when 'PENDING_DELETION' then 'rejected'
    when 'DELETED' then 'rejected'
    else 'pending'
  end;
  if _category not in ('UTILITY','MARKETING','AUTHENTICATION') then _category := null; end if;

  update public.store_message_templates
  set provider_template_id=coalesce(nullif(btrim(_provider_template_id),''),provider_template_id),
      provider_template_name=nullif(btrim(_provider_template_name),''),
      provider_language=coalesce(nullif(btrim(_provider_language),''),provider_language),
      provider_status=_mapped_status,
      provider_category=_category,
      provider_rejection_reason=null,
      provider_submission_error=null,
      provider_submitted_at=now(),
      provider_synced_at=now(),
      provider_status_updated_at=now(),
      updated_at=now()
  where id=_template_id and store_id=_store_id and channel='whatsapp';
  if not found then raise exception 'TEMPLATE_NOT_FOUND' using errcode='P0001'; end if;
  return true;
end;
$function$;

create or replace function public.record_meta_whatsapp_template_submission_failure(
  _store_id uuid,
  _template_id uuid,
  _error_message text
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  update public.store_message_templates
  set provider_submission_error=left(coalesce(nullif(btrim(_error_message),''),'Meta template submission failed.'),500),
      updated_at=now()
  where id=_template_id and store_id=_store_id and channel='whatsapp';
  return found;
end;
$function$;

create or replace function public.apply_meta_whatsapp_template_snapshot(
  _waba_id text,
  _provider_template_id text,
  _template_name text,
  _language text,
  _status text,
  _category text,
  _reason text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _store_id uuid;
  _mapped_status text;
  _mapped_category text := upper(coalesce(_category,''));
  _count integer;
begin
  select a.store_id into _store_id
  from private.integration_provider_accounts a
  where a.provider='meta_whatsapp'
    and a.status='connected'
    and a.store_id is not null
    and (a.external_account_id=_waba_id or a.public_config->>'waba_id'=_waba_id)
  order by a.connected_at desc nulls last,a.created_at desc
  limit 1;
  if _store_id is null then return 0; end if;

  _mapped_status := case upper(coalesce(_status,''))
    when 'APPROVED' then 'approved'
    when 'REINSTATED' then 'approved'
    when 'PENDING' then 'pending'
    when 'IN_APPEAL' then 'pending'
    else 'rejected'
  end;
  if _mapped_category not in ('UTILITY','MARKETING','AUTHENTICATION') then _mapped_category := null; end if;

  update public.store_message_templates t
  set provider_status=_mapped_status,
      provider_template_id=coalesce(nullif(btrim(_provider_template_id),''),t.provider_template_id),
      provider_template_name=coalesce(nullif(btrim(_template_name),''),t.provider_template_name),
      provider_language=coalesce(nullif(btrim(_language),''),t.provider_language),
      provider_category=coalesce(_mapped_category,t.provider_category),
      provider_rejection_reason=case when _mapped_status='rejected' then left(coalesce(_reason,upper(coalesce(_status,''))),500) else null end,
      provider_submission_error=null,
      provider_synced_at=now(),
      provider_status_updated_at=now(),
      updated_at=now()
  where t.store_id=_store_id
    and t.channel='whatsapp'
    and (
      (nullif(btrim(_provider_template_id),'') is not null and t.provider_template_id=_provider_template_id)
      or (
        t.provider_template_name=_template_name
        and replace(lower(t.provider_language),'-','_')=replace(lower(_language),'-','_')
      )
    );

  get diagnostics _count = row_count;
  return _count;
end;
$function$;

create or replace function public.record_meta_whatsapp_template_sync(
  _store_id uuid,
  _template_count integer
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  update private.integration_provider_accounts a
  set public_config=coalesce(a.public_config,'{}'::jsonb) || jsonb_build_object(
        'template_count',greatest(coalesce(_template_count,0),0),
        'templates_synced_at',now()
      ),
      last_health_at=now(),
      last_error=null,
      updated_at=now()
  where a.store_id=_store_id
    and a.provider='meta_whatsapp'
    and a.connection_key='default'
    and a.status='connected';
  return found;
end;
$function$;

create or replace function public.apply_meta_whatsapp_template_status(
  _waba_id text,
  _provider_template_id text,
  _template_name text,
  _language text,
  _event text,
  _reason text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _store_id uuid;
  _mapped_status text;
  _count integer;
begin
  select a.store_id into _store_id
  from private.integration_provider_accounts a
  where a.provider='meta_whatsapp'
    and a.status='connected'
    and a.store_id is not null
    and (a.external_account_id=_waba_id or a.public_config->>'waba_id'=_waba_id)
  order by a.connected_at desc nulls last,a.created_at desc
  limit 1;
  if _store_id is null then return 0; end if;

  _mapped_status := case upper(coalesce(_event,''))
    when 'APPROVED' then 'approved'
    when 'REINSTATED' then 'approved'
    when 'PENDING' then 'pending'
    when 'IN_APPEAL' then 'pending'
    else 'rejected'
  end;

  update public.store_message_templates t
  set provider_status=_mapped_status,
      provider_template_id=coalesce(nullif(btrim(_provider_template_id),''),t.provider_template_id),
      provider_rejection_reason=case when _mapped_status='rejected' then left(coalesce(_reason,upper(coalesce(_event,''))),500) else null end,
      provider_submission_error=null,
      provider_synced_at=now(),
      provider_status_updated_at=now(),
      updated_at=now()
  where t.store_id=_store_id
    and t.channel='whatsapp'
    and t.provider_template_name=_template_name
    and replace(lower(t.provider_language),'-','_')=replace(lower(_language),'-','_');

  get diagnostics _count = row_count;
  return _count;
end;
$function$;

revoke all on function public.get_meta_whatsapp_template_operation_context(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_meta_whatsapp_template_submission(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.record_meta_whatsapp_template_submission_failure(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.apply_meta_whatsapp_template_snapshot(text,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.record_meta_whatsapp_template_sync(uuid,integer) from public,anon,authenticated;
revoke all on function public.apply_meta_whatsapp_template_status(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.get_meta_whatsapp_template_operation_context(uuid,uuid,uuid) to service_role;
grant execute on function public.record_meta_whatsapp_template_submission(uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.record_meta_whatsapp_template_submission_failure(uuid,uuid,text) to service_role;
grant execute on function public.apply_meta_whatsapp_template_snapshot(text,text,text,text,text,text,text) to service_role;
grant execute on function public.record_meta_whatsapp_template_sync(uuid,integer) to service_role;
grant execute on function public.apply_meta_whatsapp_template_status(text,text,text,text,text,text) to service_role;
