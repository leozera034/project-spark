insert into public.category_profiles(code,name,description,icon,default_capabilities,product_templates,is_active,sort_order,default_banner_url)
values(
  'outros',
  'Outro tipo de negócio',
  'Para operações que ainda não possuem um modelo específico na Comandiva. A estrutura começa genérica e a demanda fica registrada para criação de novos modelos.',
  'Store',
  '{"supports_simple_products":true,"supports_options":true,"supports_variants":true}'::jsonb,
  '[{"type":"simple","label":"Produto simples","capabilities":{"supports_options":true}}]'::jsonb,
  true,
  999,
  null
)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  icon=excluded.icon,
  default_capabilities=excluded.default_capabilities,
  product_templates=excluded.product_templates,
  is_active=true,
  sort_order=excluded.sort_order,
  updated_at=now();

create table if not exists public.store_other_profile_requests(
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  business_type_label text not null,
  normalized_label text not null,
  source text not null default 'onboarding',
  selection_count integer not null default 1 check(selection_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'pending' check(status in ('pending','planned','modeled','ignored')),
  mapped_profile_code text,
  admin_notes text,
  unique(store_id, normalized_label)
);

create index if not exists idx_store_other_profile_requests_normalized on public.store_other_profile_requests(normalized_label,status,last_seen_at desc);
create index if not exists idx_store_other_profile_requests_status on public.store_other_profile_requests(status,last_seen_at desc);

alter table public.store_other_profile_requests enable row level security;
revoke all on public.store_other_profile_requests from anon, authenticated;

create or replace function private.normalize_business_type_label(_label text)
returns text language sql immutable set search_path='public','pg_temp' as $$
  select trim(both ' ' from regexp_replace(
    translate(lower(trim(coalesce(_label,''))),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function public.apply_onboarding_store_profile(
  _store_id uuid,
  _profile_code text,
  _other_label text default null,
  _source text default 'onboarding'
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  _profile public.category_profiles;
  _label text;
  _normalized text;
begin
  select * into _profile
  from public.category_profiles
  where code=lower(trim(coalesce(_profile_code,''))) and is_active
  limit 1;
  if not found then raise exception 'CATEGORY_PROFILE_NOT_FOUND' using errcode='P0001'; end if;

  if _profile.code='outros' then
    _label := nullif(trim(coalesce(_other_label,'')),'');
    if _label is null or length(_label) < 2 or length(_label) > 80 then
      raise exception 'OTHER_BUSINESS_TYPE_REQUIRED' using errcode='P0001';
    end if;
    _normalized := private.normalize_business_type_label(_label);
    if length(_normalized) < 2 then raise exception 'OTHER_BUSINESS_TYPE_REQUIRED' using errcode='P0001'; end if;
  else
    _label := _profile.name;
  end if;

  update public.stores
     set category_profile_id=_profile.id,
         segment=_label,
         updated_at=now()
   where id=_store_id;
  if not found then raise exception 'STORE_NOT_FOUND' using errcode='P0001'; end if;

  if _profile.code='outros' then
    insert into public.store_other_profile_requests(store_id,business_type_label,normalized_label,source)
    values(_store_id,_label,_normalized,coalesce(nullif(trim(_source),''),'onboarding'))
    on conflict(store_id,normalized_label) do update
      set business_type_label=excluded.business_type_label,
          source=excluded.source,
          selection_count=public.store_other_profile_requests.selection_count+1,
          last_seen_at=now();
  end if;

  return jsonb_build_object('ok',true,'profile_code',_profile.code,'profile_name',_profile.name,'segment',_label,'default_banner_url',_profile.default_banner_url);
end;
$$;
revoke all on function public.apply_onboarding_store_profile(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_onboarding_store_profile(uuid,text,text,text) to service_role;

create or replace function public.apply_catalog_starter_template_v2(_store_id uuid,_profile_code text,_other_label text default null)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  _result jsonb;
  _sid uuid := private.resolve_store(_store_id);
  _profile public.category_profiles;
  _label text;
  _normalized text;
begin
  perform private.require_permission('catalog.create',_sid);
  if lower(trim(coalesce(_profile_code,'')))='outros' then
    select * into _profile from public.category_profiles where code='outros' and is_active limit 1;
    if not found then raise exception 'CATEGORY_PROFILE_NOT_FOUND' using errcode='P0001'; end if;
    _label := nullif(trim(coalesce(_other_label,'')),'');
    if _label is null or length(_label)<2 or length(_label)>80 then raise exception 'OTHER_BUSINESS_TYPE_REQUIRED' using errcode='P0001'; end if;
    _normalized := private.normalize_business_type_label(_label);
    update public.stores set category_profile_id=_profile.id,segment=_label,updated_at=now() where id=_sid;
    insert into public.store_other_profile_requests(store_id,business_type_label,normalized_label,source)
    values(_sid,_label,_normalized,'catalog')
    on conflict(store_id,normalized_label) do update set
      business_type_label=excluded.business_type_label,
      selection_count=public.store_other_profile_requests.selection_count+1,
      last_seen_at=now(),
      source='catalog';
  end if;
  _result := public.apply_catalog_starter_template(_sid,_profile_code);
  return _result || jsonb_build_object('other_business_type',case when lower(trim(coalesce(_profile_code,'')))='outros' then trim(_other_label) else null end);
end;
$$;
grant execute on function public.apply_catalog_starter_template_v2(uuid,text,text) to authenticated;

create or replace function public.admin_list_other_profile_demand()
returns jsonb
language plpgsql
stable security definer
set search_path='public','private','pg_temp'
as $$
declare _out jsonb;
begin
  perform private.require_platform_permission('platform.stores.view');
  select jsonb_build_object(
    'summary',coalesce((select jsonb_agg(x order by (x->>'stores')::int desc, x->>'label') from (
      select jsonb_build_object('label',min(r.business_type_label),'normalized_label',r.normalized_label,'stores',count(distinct r.store_id),'selections',sum(r.selection_count),'last_seen_at',max(r.last_seen_at),'status',min(r.status)) x
      from public.store_other_profile_requests r group by r.normalized_label
    ) q),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'store_id',r.store_id,'store_name',s.name,'label',r.business_type_label,'normalized_label',r.normalized_label,'source',r.source,'selection_count',r.selection_count,'first_seen_at',r.first_seen_at,'last_seen_at',r.last_seen_at,'status',r.status,'mapped_profile_code',r.mapped_profile_code,'admin_notes',r.admin_notes) order by r.last_seen_at desc) from public.store_other_profile_requests r join public.stores s on s.id=r.store_id),'[]'::jsonb)
  ) into _out;
  return _out;
end;
$$;
grant execute on function public.admin_list_other_profile_demand() to authenticated;
