-- SECURITY DEFINER operational RPCs are intended for signed-in store/courier
-- users (or service-role backend flows), not anonymous callers. Keep the two
-- explicit storefront RPCs public and close anonymous execution everywhere else.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as fn
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        'apply_catalog_starter_template_v2',
        'bulk_upsert_store_neighborhoods',
        'cancel_returned_delivery',
        'complete_my_delivery_return',
        'create_product_from_template',
        'get_my_store_business_report_summary',
        'get_my_store_operational_alerts',
        'get_store_delivery_pricing_config',
        'list_delivery_neighborhood_distance_candidates',
        'list_my_store_returned_deliveries',
        'list_professional_services',
        'list_store_professional_service_orders',
        'replace_store_delivery_radius_bands',
        'request_professional_service',
        'retry_returned_delivery',
        'start_my_delivery_return',
        'update_store_delivery_pricing_config'
      ])
  loop
    execute format('revoke execute on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated, service_role', r.fn);
  end loop;
end $$;
