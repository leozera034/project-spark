-- SHARK post-migration contract
-- Run AFTER the complete 20260811040000+ migration chain on the Lovable Supabase.
-- Read-only validation of final schema, security and integrity guards.

DO $$
DECLARE
  _issues bigint;
BEGIN
  -- Final schema objects.
  IF to_regclass('public.category_profiles') IS NULL THEN raise exception 'SHARK_POST_CATEGORY_PROFILES_MISSING'; END IF;
  IF to_regclass('public.inventory_reservations') IS NULL THEN raise exception 'SHARK_POST_INVENTORY_RESERVATIONS_MISSING'; END IF;
  IF to_regclass('public.product_variant_option_group_rules') IS NULL THEN raise exception 'SHARK_POST_VARIANT_GROUP_RULES_MISSING'; END IF;

  IF NOT EXISTS (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='product_type') THEN raise exception 'SHARK_POST_PRODUCT_TYPE_MISSING'; END IF;
  IF NOT EXISTS (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='capabilities') THEN raise exception 'SHARK_POST_CAPABILITIES_MISSING'; END IF;
  IF NOT EXISTS (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='stock_quantity') THEN raise exception 'SHARK_POST_PRODUCT_STOCK_MISSING'; END IF;
  IF NOT EXISTS (select 1 from information_schema.columns where table_schema='public' and table_name='product_variants' and column_name='max_flavors') THEN raise exception 'SHARK_POST_MAX_FLAVORS_MISSING'; END IF;
  IF NOT EXISTS (select 1 from information_schema.columns where table_schema='public' and table_name='product_variants' and column_name='flavor_parts') THEN raise exception 'SHARK_POST_FLAVOR_PARTS_MISSING'; END IF;
  IF NOT EXISTS (select 1 from information_schema.columns where table_schema='public' and table_name='option_groups' and column_name='included_selections') THEN raise exception 'SHARK_POST_INCLUDED_SELECTIONS_MISSING'; END IF;

  -- Canonical functions.
  IF to_regprocedure('public.storefront_popular_products(text,integer,integer)') IS NULL THEN raise exception 'SHARK_POST_POPULARITY_RPC_MISSING'; END IF;
  IF to_regprocedure('public.storefront_product_recommendations(text,uuid,integer,integer)') IS NULL THEN raise exception 'SHARK_POST_RECOMMENDATIONS_RPC_MISSING'; END IF;
  IF to_regprocedure('public.update_product_inventory_v2(uuid,uuid,boolean,numeric,numeric,timestamp with time zone)') IS NULL THEN raise exception 'SHARK_POST_INVENTORY_V2_MISSING'; END IF;
  IF to_regprocedure('private.calculate_configured_product_price(uuid,uuid,uuid,numeric,jsonb)') IS NULL THEN raise exception 'SHARK_POST_CANONICAL_PRICING_MISSING'; END IF;
  IF to_regprocedure('private.assert_shark_capabilities(jsonb)') IS NULL THEN raise exception 'SHARK_POST_CAPABILITY_ASSERT_MISSING'; END IF;
  IF to_regprocedure('private.validate_shark_combo_item_integrity()') IS NULL THEN raise exception 'SHARK_POST_COMBO_GUARD_MISSING'; END IF;
  IF to_regprocedure('private.sync_shark_variant_flavor_capacity()') IS NULL THEN raise exception 'SHARK_POST_MULTIFLAVOR_SYNC_MISSING'; END IF;

  -- Public/browser attack surface.
  IF has_function_privilege('anon','public.storefront_product(text,uuid)','EXECUTE') THEN raise exception 'SHARK_POST_ANON_STOREFRONT_PRODUCT_RPC_EXPOSED'; END IF;
  IF has_function_privilege('authenticated','public.storefront_product(text,uuid)','EXECUTE') THEN raise exception 'SHARK_POST_AUTH_STOREFRONT_PRODUCT_RPC_EXPOSED'; END IF;
  IF has_function_privilege('anon','public.storefront_popular_products(text,integer,integer)','EXECUTE') THEN raise exception 'SHARK_POST_ANON_POPULARITY_EXPOSED'; END IF;
  IF has_function_privilege('authenticated','public.storefront_popular_products(text,integer,integer)','EXECUTE') THEN raise exception 'SHARK_POST_AUTH_POPULARITY_EXPOSED'; END IF;
  IF has_function_privilege('anon','public.storefront_product_recommendations(text,uuid,integer,integer)','EXECUTE') THEN raise exception 'SHARK_POST_ANON_RECOMMENDATIONS_EXPOSED'; END IF;
  IF has_function_privilege('authenticated','public.storefront_product_recommendations(text,uuid,integer,integer)','EXECUTE') THEN raise exception 'SHARK_POST_AUTH_RECOMMENDATIONS_EXPOSED'; END IF;
  IF has_function_privilege('authenticated','public.update_product_inventory(uuid,uuid,boolean,numeric,numeric)','EXECUTE') THEN raise exception 'SHARK_POST_LEGACY_INVENTORY_WRITE_STILL_EXPOSED'; END IF;
  IF NOT has_function_privilege('authenticated','public.update_product_inventory_v2(uuid,uuid,boolean,numeric,numeric,timestamp with time zone)','EXECUTE') THEN raise exception 'SHARK_POST_INVENTORY_V2_NOT_AVAILABLE'; END IF;
  IF has_function_privilege('anon','private.validate_shark_combo_item_integrity()','EXECUTE') OR has_function_privilege('authenticated','private.validate_shark_combo_item_integrity()','EXECUTE') THEN raise exception 'SHARK_POST_PRIVATE_COMBO_GUARD_EXPOSED'; END IF;
  IF has_function_privilege('anon','private.sync_shark_variant_flavor_capacity()','EXECUTE') OR has_function_privilege('authenticated','private.sync_shark_variant_flavor_capacity()','EXECUTE') THEN raise exception 'SHARK_POST_PRIVATE_MULTIFLAVOR_SYNC_EXPOSED'; END IF;

  -- Required integrity triggers.
  IF NOT EXISTS (select 1 from pg_trigger where tgrelid='public.order_items'::regclass and tgname='trg_shark_reserve_product_inventory' and not tgisinternal) THEN raise exception 'SHARK_POST_PRODUCT_RESERVATION_TRIGGER_MISSING'; END IF;
  IF NOT EXISTS (select 1 from pg_trigger where tgrelid='public.order_item_options'::regclass and tgname='trg_shark_reserve_option_inventory' and not tgisinternal) THEN raise exception 'SHARK_POST_OPTION_RESERVATION_TRIGGER_MISSING'; END IF;
  IF NOT EXISTS (select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='trg_shark_release_inventory' and not tgisinternal) THEN raise exception 'SHARK_POST_RELEASE_INVENTORY_TRIGGER_MISSING'; END IF;
  IF NOT EXISTS (select 1 from pg_trigger where tgrelid='public.product_variant_option_group_rules'::regclass and tgname='trg_shark_validate_variant_group_rule' and not tgisinternal) THEN raise exception 'SHARK_POST_VARIANT_GROUP_RULE_TRIGGER_MISSING'; END IF;
  IF NOT EXISTS (select 1 from pg_trigger where tgrelid='public.option_items'::regclass and tgname='trg_shark_combo_item_integrity' and not tgisinternal) THEN raise exception 'SHARK_POST_COMBO_INTEGRITY_TRIGGER_MISSING'; END IF;
  IF NOT EXISTS (select 1 from pg_trigger where tgrelid='public.product_variants'::regclass and tgname='trg_shark_variant_flavor_capacity' and not tgisinternal) THEN raise exception 'SHARK_POST_MULTIFLAVOR_SYNC_TRIGGER_MISSING'; END IF;

  -- Final data invariants.
  select count(*) into _issues
  from public.products p
  where p.capabilities @> '{"burger_experience":true}'::jsonb
    and p.capabilities @> '{"meal_experience":true}'::jsonb;
  IF _issues>0 THEN raise exception 'SHARK_POST_CONFLICTING_EXPERIENCES:%',_issues; END IF;

  select count(*) into _issues
  from public.product_variants v
  where v.max_flavors is not null and v.flavor_parts is not null and v.max_flavors>v.flavor_parts;
  IF _issues>0 THEN raise exception 'SHARK_POST_INVALID_FLAVOR_STRUCTURE:%',_issues; END IF;

  select count(*) into _issues
  from public.product_variant_option_group_rules r
  join public.product_variants v on v.id=r.product_variant_id and v.store_id=r.store_id
  where v.product_id<>r.product_id;
  IF _issues>0 THEN raise exception 'SHARK_POST_VARIANT_RULE_PRODUCT_MISMATCH:%',_issues; END IF;

  select count(*) into _issues
  from public.product_variant_option_group_rules r
  left join public.product_option_groups pog
    on pog.store_id=r.store_id and pog.product_id=r.product_id and pog.option_group_id=r.option_group_id and not pog.is_archived
  where pog.id is null;
  IF _issues>0 THEN raise exception 'SHARK_POST_VARIANT_RULE_GROUP_MISMATCH:%',_issues; END IF;

  -- Size is modeled by variants. Generated Shark size option groups must not survive.
  select count(*) into _issues
  from public.option_groups og
  where og.role='size'
    and coalesce((og.configuration->>'shark_draft')::boolean,false)=true
    and og.configuration->>'shark_starter_key'='size';
  IF _issues>0 THEN raise exception 'SHARK_POST_DUPLICATE_SIZE_DRAFTS:%',_issues; END IF;

  -- Multi-flavor physical capacity belongs to variants, never to a stale link override.
  select count(*) into _issues
  from public.product_option_groups pog
  join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
  join public.products p on p.id=pog.product_id and p.store_id=pog.store_id
  where not pog.is_archived and not og.is_archived and not p.is_archived
    and og.role='flavor'
    and coalesce((p.capabilities->>'multi_flavor')::boolean,false)
    and pog.max_selections is not null;
  IF _issues>0 THEN raise exception 'SHARK_POST_STALE_MULTIFLAVOR_LINK_MAX:%',_issues; END IF;

  -- Existing combo references must keep variant/product coherence.
  select count(*) into _issues
  from public.option_items i
  join public.product_variants v on v.id=i.linked_variant_id and v.store_id=i.store_id
  where i.linked_variant_id is not null
    and i.linked_product_id is distinct from v.product_id;
  IF _issues>0 THEN raise exception 'SHARK_POST_COMBO_VARIANT_PRODUCT_MISMATCH:%',_issues; END IF;

  -- Detect any pre-existing indirect combo cycle. UNION (not UNION ALL) guarantees termination.
  with recursive edges as (
    select distinct pog.store_id,pog.product_id as source_product,i.linked_product_id as target_product
    from public.product_option_groups pog
    join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
    join public.option_items i on i.option_group_id=og.id and i.store_id=og.store_id
    where not pog.is_archived and not og.is_archived and not i.is_archived
      and og.role='combo_step' and i.linked_product_id is not null
  ), walk(store_id,origin,current_product) as (
    select store_id,source_product,target_product from edges
    union
    select w.store_id,w.origin,e.target_product
    from walk w
    join edges e on e.store_id=w.store_id and e.source_product=w.current_product
  )
  select count(*) into _issues from walk where origin=current_product;
  IF _issues>0 THEN raise exception 'SHARK_POST_COMBO_CYCLE:%',_issues; END IF;

  raise notice 'SHARK post-migration contract passed';
END
$$;
