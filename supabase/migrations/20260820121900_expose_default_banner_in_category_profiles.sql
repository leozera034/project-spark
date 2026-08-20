create or replace function public.list_active_category_profiles()
returns jsonb
language sql
stable
set search_path to 'public','pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',cp.id,
    'code',cp.code,
    'name',cp.name,
    'description',cp.description,
    'icon',cp.icon,
    'default_banner_url',cp.default_banner_url,
    'default_capabilities',cp.default_capabilities,
    'product_templates',cp.product_templates,
    'is_active',cp.is_active,
    'sort_order',cp.sort_order,
    'created_at',cp.created_at,
    'updated_at',cp.updated_at
  ) order by cp.sort_order,cp.name),'[]'::jsonb)
  from public.category_profiles cp
  where cp.is_active;
$$;

create or replace function public.get_store_category_profile(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','pg_temp'
as $$
declare out jsonb;
begin
  if not private.is_store_member(_store_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select case when cp.id is null then null else jsonb_build_object(
    'id',cp.id,
    'code',cp.code,
    'name',cp.name,
    'description',cp.description,
    'icon',cp.icon,
    'default_banner_url',cp.default_banner_url,
    'default_capabilities',cp.default_capabilities,
    'product_templates',cp.product_templates
  ) end
  into out
  from public.stores s
  left join public.category_profiles cp on cp.id=s.category_profile_id and cp.is_active
  where s.id=_store_id;
  return out;
end;
$$;
