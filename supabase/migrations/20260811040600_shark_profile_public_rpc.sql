-- SHARK — leitura dos perfis ativos sem acoplar o frontend aos tipos gerados do schema.
create or replace function public.list_active_category_profiles()
returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',cp.id,'code',cp.code,'name',cp.name,'description',cp.description,'icon',cp.icon,
    'default_capabilities',cp.default_capabilities,'product_templates',cp.product_templates,
    'is_active',cp.is_active,'sort_order',cp.sort_order,'created_at',cp.created_at,'updated_at',cp.updated_at
  ) order by cp.sort_order,cp.name),'[]'::jsonb)
  from public.category_profiles cp
  where cp.is_active;
$$;

grant execute on function public.list_active_category_profiles() to authenticated;
revoke all on function public.list_active_category_profiles() from anon;
