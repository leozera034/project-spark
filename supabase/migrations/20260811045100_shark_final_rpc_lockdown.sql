-- SHARK — lockdown final de RPCs server-only.
-- Executado no fim da cadeia para neutralizar grants históricos acidentais.
-- RPCs administrativas do catálogo permanecem authenticated conforme seus contratos.

do $$
begin
  if to_regprocedure('public.storefront_product(text,uuid)') is not null then
    execute 'revoke all on function public.storefront_product(text,uuid) from public,anon,authenticated';
    execute 'grant execute on function public.storefront_product(text,uuid) to service_role';
  end if;

  if to_regprocedure('public.storefront_experience_profile(text)') is not null then
    execute 'revoke all on function public.storefront_experience_profile(text) from public,anon,authenticated';
    execute 'grant execute on function public.storefront_experience_profile(text) to service_role';
  end if;

  if to_regprocedure('public.storefront_variant_flavor_structure(text,uuid)') is not null then
    execute 'revoke all on function public.storefront_variant_flavor_structure(text,uuid) from public,anon,authenticated';
    execute 'grant execute on function public.storefront_variant_flavor_structure(text,uuid) to service_role';
  end if;

  if to_regprocedure('public.storefront_combo_available_choices(text,uuid)') is not null then
    execute 'revoke all on function public.storefront_combo_available_choices(text,uuid) from public,anon,authenticated';
    execute 'grant execute on function public.storefront_combo_available_choices(text,uuid) to service_role';
  end if;

  if to_regprocedure('public.storefront_variant_group_rules(text,uuid)') is not null then
    execute 'revoke all on function public.storefront_variant_group_rules(text,uuid) from public,anon,authenticated';
    execute 'grant execute on function public.storefront_variant_group_rules(text,uuid) to service_role';
  end if;

  if to_regprocedure('public.storefront_popular_products(text,integer,integer)') is not null then
    execute 'revoke all on function public.storefront_popular_products(text,integer,integer) from public,anon,authenticated';
    execute 'grant execute on function public.storefront_popular_products(text,integer,integer) to service_role';
  end if;

  if to_regprocedure('public.storefront_product_recommendations(text,uuid,integer,integer)') is not null then
    execute 'revoke all on function public.storefront_product_recommendations(text,uuid,integer,integer) from public,anon,authenticated';
    execute 'grant execute on function public.storefront_product_recommendations(text,uuid,integer,integer) to service_role';
  end if;

  if to_regprocedure('public.storefront_submit_order(text,jsonb)') is not null then
    execute 'revoke all on function public.storefront_submit_order(text,jsonb) from public,anon,authenticated';
    execute 'grant execute on function public.storefront_submit_order(text,jsonb) to service_role';
  end if;
end
$$;

comment on function public.list_active_category_profiles() is
  'Admin catalog helper. Authenticated access is intentional; storefront server-only RPCs are locked separately by SHARK final lockdown.';
