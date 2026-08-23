-- Non-destructive contract for merchant-managed product search aliases.
-- Run with psql -v ON_ERROR_STOP=1. Fixture mutations are rolled back.

DO $$
DECLARE failures bigint;
BEGIN
  SELECT count(*) INTO failures
    FROM public.products p
   WHERE cardinality(p.search_aliases)>12;
  IF failures>0 THEN RAISE EXCEPTION 'products_above_search_alias_limit=%',failures; END IF;

  SELECT count(*) INTO failures
    FROM public.products p
   WHERE EXISTS(
     SELECT 1 FROM unnest(p.search_aliases) alias
      WHERE alias='' OR length(alias)>40 OR alias<>public.normalize_label(alias)
   );
  IF failures>0 THEN RAISE EXCEPTION 'products_with_invalid_search_aliases=%',failures; END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.list_catalog_product_search_aliases(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy_full_search_alias_listing_still_exists';
  END IF;
  IF NOT has_function_privilege('authenticated','public.search_catalog_product_search_aliases(uuid,text,integer,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_missing_search_alias_search_execute';
  END IF;
  IF has_function_privilege('anon','public.search_catalog_product_search_aliases(uuid,text,integer,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'anon_search_alias_search_exposed';
  END IF;
  IF NOT has_function_privilege('authenticated','public.update_catalog_product_search_aliases(uuid,uuid,text[])','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_missing_search_alias_update_execute';
  END IF;
  IF has_function_privilege('anon','public.update_catalog_product_search_aliases(uuid,uuid,text[])','EXECUTE') THEN
    RAISE EXCEPTION 'anon_search_alias_update_exposed';
  END IF;
END $$;

BEGIN;

DO $$
DECLARE
  owner_user uuid;
  sid uuid;
  slug_value text;
  pid uuid;
  result jsonb;
  search_page jsonb;
  enrichment jsonb;
  aliases jsonb;
BEGIN
  SELECT ur.user_id,s.id,s.slug,p.id
    INTO owner_user,sid,slug_value,pid
    FROM public.user_roles ur
    JOIN public.stores s ON s.id=ur.store_id AND s.status='ativa'
    JOIN public.products p ON p.store_id=s.id AND NOT p.is_archived
   WHERE ur.role::text='proprietario' AND ur.is_active
   ORDER BY s.id,p.id
   LIMIT 1;

  -- Minimal databases may intentionally contain no merchant/product fixture.
  IF owner_user IS NULL THEN RETURN; END IF;

  PERFORM set_config('request.jwt.claim.sub',owner_user::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  SET LOCAL ROLE authenticated;

  result:=public.update_catalog_product_search_aliases(
    sid,
    pid,
    array['  REFRIGERANTE  ','Refrigeránte','refri','  Coca  ']
  );
  IF result->'search_aliases' <> '["refrigerante", "refri", "coca"]'::jsonb THEN
    RAISE EXCEPTION 'search_alias_normalization_invalid=%',result;
  END IF;

  search_page:=public.search_catalog_product_search_aliases(sid,'REFRIGERÁNTE',50,0);
  IF NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(search_page->'items') item
     WHERE item->>'product_id'=pid::text
  ) THEN
    RAISE EXCEPTION 'normalized_search_alias_not_found=%',search_page;
  END IF;

  RESET ROLE;
  enrichment:=public.storefront_catalog_enrichment(slug_value);
  SELECT item->'search_aliases' INTO aliases
    FROM jsonb_array_elements(enrichment->'products') item
   WHERE item->>'product_id'=pid::text;

  IF aliases <> '["refrigerante", "refri", "coca"]'::jsonb THEN
    RAISE EXCEPTION 'search_alias_enrichment_invalid=%',aliases;
  END IF;
END $$;

ROLLBACK;

SELECT 'product_search_aliases_contract_passed' AS result;
