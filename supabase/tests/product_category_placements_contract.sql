-- Non-destructive contract for catalog product category placements.
-- Run with psql -v ON_ERROR_STOP=1. Fixture mutations are rolled back.

DO $$
DECLARE
  failures bigint;
BEGIN
  SELECT count(*) INTO failures
    FROM public.product_category_placements pcp
    JOIN public.products p
      ON p.id=pcp.product_id AND p.store_id=pcp.store_id
   WHERE p.category_id=pcp.category_id;
  IF failures > 0 THEN
    RAISE EXCEPTION 'category_placements_redundant_with_primary=%',failures;
  END IF;

  SELECT count(*) INTO failures
    FROM public.product_category_placements pcp
    LEFT JOIN public.products p
      ON p.id=pcp.product_id AND p.store_id=pcp.store_id
    LEFT JOIN public.categories c
      ON c.id=pcp.category_id AND c.store_id=pcp.store_id
   WHERE p.id IS NULL OR c.id IS NULL;
  IF failures > 0 THEN
    RAISE EXCEPTION 'category_placements_cross_store_or_orphan=%',failures;
  END IF;

  SELECT count(*) INTO failures
    FROM (
      SELECT store_id,product_id,count(*) AS placement_count
        FROM public.product_category_placements
       GROUP BY store_id,product_id
      HAVING count(*) > 8
    ) excessive;
  IF failures > 0 THEN
    RAISE EXCEPTION 'category_placements_above_limit=%',failures;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT has_function_privilege('authenticated','public.list_catalog_product_category_placements(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_missing_category_placement_list_execute';
  END IF;
  IF has_function_privilege('anon','public.list_catalog_product_category_placements(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'anon_category_placement_list_exposed';
  END IF;

  IF NOT has_function_privilege('authenticated','public.set_catalog_product_category_placements(uuid,uuid,uuid[])','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_missing_category_placement_set_execute';
  END IF;
  IF has_function_privilege('anon','public.set_catalog_product_category_placements(uuid,uuid,uuid[])','EXECUTE') THEN
    RAISE EXCEPTION 'anon_category_placement_set_exposed';
  END IF;

  IF NOT has_function_privilege('service_role','public.storefront_catalog_enrichment(text)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role_missing_storefront_catalog_enrichment_execute';
  END IF;
  IF has_function_privilege('anon','public.storefront_catalog_enrichment(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.storefront_catalog_enrichment(text)','EXECUTE') THEN
    RAISE EXCEPTION 'storefront_catalog_enrichment_exposed_to_browser_roles';
  END IF;

  IF has_table_privilege('authenticated','public.product_category_placements','INSERT')
     OR has_table_privilege('authenticated','public.product_category_placements','UPDATE')
     OR has_table_privilege('authenticated','public.product_category_placements','DELETE')
     OR has_table_privilege('anon','public.product_category_placements','SELECT') THEN
    RAISE EXCEPTION 'category_placements_table_exposed_directly';
  END IF;
END $$;

BEGIN;

DO $$
DECLARE
  owner_user uuid;
  sid uuid;
  slug_value text;
  pid uuid;
  primary_category uuid;
  extra_category uuid;
  result jsonb;
  enrichment jsonb;
  category_ids jsonb;
BEGIN
  SELECT ur.user_id,s.id,s.slug,p.id,p.category_id,c.id
    INTO owner_user,sid,slug_value,pid,primary_category,extra_category
    FROM public.user_roles ur
    JOIN public.stores s ON s.id=ur.store_id AND s.status='ativa'
    JOIN public.products p ON p.store_id=s.id AND NOT p.is_archived
    JOIN public.categories c
      ON c.store_id=s.id
     AND c.id<>p.category_id
     AND c.is_active
     AND NOT c.is_archived
   WHERE ur.role::text='proprietario'
     AND ur.is_active
   ORDER BY s.id,p.id,c.sort_order,c.id
   LIMIT 1;

  -- A minimal/staging database may intentionally contain no eligible fixture.
  IF owner_user IS NULL THEN RETURN; END IF;

  PERFORM set_config('request.jwt.claim.sub',owner_user::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  SET LOCAL ROLE authenticated;

  result:=public.set_catalog_product_category_placements(sid,pid,array[extra_category]);
  IF NOT ((result->'category_ids') ? primary_category::text)
     OR NOT ((result->'category_ids') ? extra_category::text) THEN
    RAISE EXCEPTION 'merchant_category_placement_result_invalid=%',result;
  END IF;

  RESET ROLE;
  enrichment:=public.storefront_catalog_enrichment(slug_value);
  SELECT item->'category_ids' INTO category_ids
    FROM jsonb_array_elements(enrichment->'products') item
   WHERE item->>'product_id'=pid::text;

  IF category_ids IS NULL
     OR NOT (category_ids ? primary_category::text)
     OR NOT (category_ids ? extra_category::text) THEN
    RAISE EXCEPTION 'storefront_category_placement_enrichment_invalid product=% category_ids=%',pid,category_ids;
  END IF;
END $$;

ROLLBACK;

SELECT 'product_category_placements_contract_passed' AS result;
