create or replace function private.resolve_store_profile_marker()
returns trigger
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  _profile public.category_profiles;
  _code text;
  _label text;
begin
  if new.category_profile_id is not null then return new; end if;
  if new.segment like '__profile__:%' then
    _code := lower(trim(substr(new.segment, length('__profile__:') + 1)));
    select * into _profile from public.category_profiles where code=_code and is_active limit 1;
    if not found or _profile.code='outros' then raise exception 'CATEGORY_PROFILE_NOT_FOUND' using errcode='P0001'; end if;
    new.category_profile_id := _profile.id;
    new.segment := _profile.name;
  elsif new.segment like '__other__:%' then
    _label := trim(substr(new.segment, length('__other__:') + 1));
    if length(_label)<2 or length(_label)>80 then raise exception 'OTHER_BUSINESS_TYPE_REQUIRED' using errcode='P0001'; end if;
    select * into _profile from public.category_profiles where code='outros' and is_active limit 1;
    if not found then raise exception 'CATEGORY_PROFILE_NOT_FOUND' using errcode='P0001'; end if;
    new.category_profile_id := _profile.id;
    new.segment := _label;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_resolve_store_profile_marker on public.stores;
create trigger trg_resolve_store_profile_marker
before insert or update of segment on public.stores
for each row execute function private.resolve_store_profile_marker();

create or replace function private.record_other_profile_demand_from_store()
returns trigger
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  _code text;
  _normalized text;
begin
  if new.category_profile_id is null then return new; end if;
  select code into _code from public.category_profiles where id=new.category_profile_id;
  if _code <> 'outros' then return new; end if;
  if nullif(trim(coalesce(new.segment,'')),'') is null then return new; end if;
  if tg_op='UPDATE' and new.category_profile_id is not distinct from old.category_profile_id and new.segment is not distinct from old.segment then return new; end if;
  _normalized := private.normalize_business_type_label(new.segment);
  if length(_normalized)<2 then return new; end if;
  insert into public.store_other_profile_requests(store_id,business_type_label,normalized_label,source)
  values(new.id,trim(new.segment),_normalized,'store_profile')
  on conflict(store_id,normalized_label) do update
    set business_type_label=excluded.business_type_label,
        selection_count=public.store_other_profile_requests.selection_count+1,
        last_seen_at=now();
  return new;
end;
$$;

drop trigger if exists trg_record_other_profile_demand_from_store on public.stores;
create trigger trg_record_other_profile_demand_from_store
after insert or update of category_profile_id,segment on public.stores
for each row execute function private.record_other_profile_demand_from_store();

create or replace function public.apply_onboarding_store_profile(_store_id uuid,_profile_code text,_other_label text default null,_source text default 'onboarding')
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare _profile public.category_profiles; _label text;
begin
  select * into _profile from public.category_profiles where code=lower(trim(coalesce(_profile_code,''))) and is_active limit 1;
  if not found then raise exception 'CATEGORY_PROFILE_NOT_FOUND' using errcode='P0001'; end if;
  if _profile.code='outros' then _label:=nullif(trim(coalesce(_other_label,'')),''); if _label is null or length(_label)<2 or length(_label)>80 then raise exception 'OTHER_BUSINESS_TYPE_REQUIRED' using errcode='P0001'; end if; else _label:=_profile.name; end if;
  update public.stores set category_profile_id=_profile.id,segment=_label,updated_at=now() where id=_store_id;
  if not found then raise exception 'STORE_NOT_FOUND' using errcode='P0001'; end if;
  update public.store_other_profile_requests set source=coalesce(nullif(trim(_source),''),source) where store_id=_store_id and _profile.code='outros' and normalized_label=private.normalize_business_type_label(_label);
  return jsonb_build_object('ok',true,'profile_code',_profile.code,'profile_name',_profile.name,'segment',_label,'default_banner_url',_profile.default_banner_url);
end;
$$;
revoke all on function public.apply_onboarding_store_profile(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_onboarding_store_profile(uuid,text,text,text) to service_role;

create or replace function public.apply_catalog_starter_template_v2(_store_id uuid,_profile_code text,_other_label text default null)
returns jsonb language plpgsql security definer set search_path='public','private','pg_temp' as $$
declare _result jsonb; _sid uuid:=private.resolve_store(_store_id); _profile public.category_profiles; _label text;
begin
  perform private.require_permission('catalog.create',_sid);
  if lower(trim(coalesce(_profile_code,'')))='outros' then
    select * into _profile from public.category_profiles where code='outros' and is_active limit 1;
    if not found then raise exception 'CATEGORY_PROFILE_NOT_FOUND' using errcode='P0001'; end if;
    _label:=nullif(trim(coalesce(_other_label,'')),'');
    if _label is null or length(_label)<2 or length(_label)>80 then raise exception 'OTHER_BUSINESS_TYPE_REQUIRED' using errcode='P0001'; end if;
    update public.stores set category_profile_id=_profile.id,segment=_label,updated_at=now() where id=_sid;
    update public.store_other_profile_requests set source='catalog' where store_id=_sid and normalized_label=private.normalize_business_type_label(_label);
  end if;
  _result:=public.apply_catalog_starter_template(_sid,_profile_code);
  return _result || jsonb_build_object('other_business_type',case when lower(trim(coalesce(_profile_code,'')))='outros' then trim(_other_label) else null end);
end;
$$;
grant execute on function public.apply_catalog_starter_template_v2(uuid,text,text) to authenticated;
