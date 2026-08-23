-- Non-destructive catalog promotions contract.
-- Run with psql -v ON_ERROR_STOP=1 against a QA/staging database.

DO $$
DECLARE
  failures bigint;
BEGIN
  -- Financial invariant must remain true for every persisted order.
  SELECT count(*) INTO failures
    FROM public.orders o
   WHERE o.total_amount <> o.items_subtotal + o.delivery_fee - o.discount_total;
  IF failures > 0 THEN
    RAISE EXCEPTION 'promotion_orders_bad_total=%', failures;
  END IF;

  -- A frozen discounted line must preserve the promotion reference/snapshot.
  SELECT count(*) INTO failures
    FROM public.order_items oi
   WHERE oi.discount_total > 0
     AND (oi.promotion_id IS NULL OR oi.promotion_name IS NULL OR oi.promotion_snapshot IS NULL);
  IF failures > 0 THEN
    RAISE EXCEPTION 'discounted_items_without_promotion_snapshot=%', failures;
  END IF;

  -- Archived promotions can never be active.
  SELECT count(*) INTO failures
    FROM public.promotions p
   WHERE p.is_archived AND p.is_active;
  IF failures > 0 THEN
    RAISE EXCEPTION 'archived_active_promotions=%', failures;
  END IF;

  -- A promotion cannot target product and category simultaneously.
  SELECT count(*) INTO failures
    FROM public.promotions p
   WHERE p.product_id IS NOT NULL AND p.category_id IS NOT NULL;
  IF failures > 0 THEN
    RAISE EXCEPTION 'promotion_multiple_scopes=%', failures;
  END IF;

  -- Discounts and caps must remain positive and percentage <= 100.
  SELECT count(*) INTO failures
    FROM public.promotions p
   WHERE p.value <= 0
      OR (p.kind = 'percentual' AND p.value > 100)
      OR (p.max_discount_amount IS NOT NULL AND p.max_discount_amount <= 0)
      OR (p.starts_at IS NOT NULL AND p.ends_at IS NOT NULL AND p.ends_at <= p.starts_at);
  IF failures > 0 THEN
    RAISE EXCEPTION 'invalid_promotion_configuration=%', failures;
  END IF;
END $$;

DO $$
DECLARE
  service_can_execute boolean;
  anon_can_execute boolean;
  authenticated_can_execute boolean;
BEGIN
  SELECT has_function_privilege('service_role','public.storefront_submit_order_v2(text,jsonb)','EXECUTE')
    INTO service_can_execute;
  SELECT has_function_privilege('anon','public.storefront_submit_order_v2(text,jsonb)','EXECUTE')
    INTO anon_can_execute;
  SELECT has_function_privilege('authenticated','public.storefront_submit_order_v2(text,jsonb)','EXECUTE')
    INTO authenticated_can_execute;

  IF NOT service_can_execute THEN
    RAISE EXCEPTION 'storefront_submit_order_v2_missing_service_role_execute';
  END IF;
  IF anon_can_execute OR authenticated_can_execute THEN
    RAISE EXCEPTION 'storefront_submit_order_v2_exposed_to_browser_roles';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.create_catalog_promotion_v2(uuid,text,text,text,numeric,numeric,uuid,uuid,timestamp with time zone,timestamp with time zone,boolean,boolean)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'guarded_create_promotion_rpc_not_executable';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.set_catalog_promotion_active_v2(uuid,uuid,boolean,timestamp with time zone,boolean)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'guarded_activate_promotion_rpc_not_executable';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.create_catalog_promotion(uuid,text,text,public.promotion_type,numeric,numeric,uuid,uuid,timestamp with time zone,timestamp with time zone,boolean)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'legacy_create_promotion_rpc_exposed';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.set_catalog_promotion_active(uuid,uuid,boolean,timestamp with time zone)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'legacy_activate_promotion_rpc_exposed';
  END IF;

  IF has_function_privilege('authenticated','private.catalog_promotion_negative_margin_count(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'private_margin_guard_exposed';
  END IF;
END $$;

DO $$
DECLARE
  sid uuid;
  pid uuid;
  slug_value text;
  result jsonb;
  discount numeric;
  original_total numeric;
  final_total numeric;
BEGIN
  SELECT s.id,s.slug,p.id
    INTO sid,slug_value,pid
    FROM public.stores s
    JOIN public.products p ON p.store_id=s.id
   WHERE s.status='ativa'
     AND private.product_runtime_available(s.id,p.id,now())
     AND NOT p.has_variants
     AND NOT EXISTS (
       SELECT 1
         FROM public.product_option_groups pog
         JOIN public.option_groups og ON og.id=pog.option_group_id AND og.store_id=pog.store_id
        WHERE pog.store_id=p.store_id
          AND pog.product_id=p.id
          AND pog.is_active AND NOT pog.is_archived
          AND og.is_active AND NOT og.is_archived
          AND coalesce(pog.is_required,og.is_required)
     )
   ORDER BY s.id,p.id
   LIMIT 1;

  -- Database may intentionally have no runtime-available fixture; static checks above still apply.
  IF sid IS NULL THEN RETURN; END IF;

  INSERT INTO public.promotions(store_id,name,kind,value,product_id,is_active,is_archived)
  VALUES(sid,'[CI] promotion rollback','percentual',10,pid,true,false);

  result := public.storefront_price_with_promotions(slug_value,pid,NULL,1,'[]'::jsonb);
  IF NOT coalesce((result->>'ok')::boolean,false) THEN
    RAISE EXCEPTION 'promotion_price_not_ok=%',result;
  END IF;

  discount := coalesce((result#>>'{result,discount_total}')::numeric,0);
  original_total := coalesce((result#>>'{result,original_total}')::numeric,0);
  final_total := coalesce((result#>>'{result,final_total}')::numeric,0);

  IF discount <= 0 OR final_total <> private.money(original_total-discount) THEN
    RAISE EXCEPTION 'promotion_price_inconsistent original=% discount=% final=%',original_total,discount,final_total;
  END IF;

  -- Always abort the fixture mutation while keeping test assertions useful.
  RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='PROMOTION_CONTRACT_ROLLBACK';
EXCEPTION
  WHEN SQLSTATE 'P0002' THEN
    IF SQLERRM <> 'PROMOTION_CONTRACT_ROLLBACK' THEN RAISE; END IF;
END $$;

SELECT 'catalog_promotions_contract_passed' AS result;
