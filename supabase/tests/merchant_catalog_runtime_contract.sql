-- Merchant catalog runtime availability contract.
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/merchant_catalog_runtime_contract.sql

DO $$
DECLARE
  helper_definition text;
  reserve_definition text;
  availability_definition text;
  catalog_definition text;
  serializer_definition text;
BEGIN
  helper_definition := pg_get_functiondef(
    'private.product_runtime_available(uuid,uuid,timestamp with time zone)'::regprocedure
  );

  IF helper_definition NOT ILIKE '%available_weekdays%'
     OR helper_definition NOT ILIKE '%available_from%'
     OR helper_definition NOT ILIKE '%available_to%'
     OR helper_definition NOT ILIKE '%stock_quantity%'
     OR helper_definition NOT ILIKE '%has_variants%' THEN
    RAISE EXCEPTION 'Product runtime availability helper is incomplete';
  END IF;

  IF pg_get_functiondef('public.storefront_catalog(text)'::regprocedure)
       NOT ILIKE '%private.product_runtime_available%'
     OR pg_get_functiondef('public.storefront_product(text,uuid)'::regprocedure)
       NOT ILIKE '%private.product_runtime_available%'
     OR pg_get_functiondef('public.storefront_price(text,uuid,uuid,numeric,jsonb)'::regprocedure)
       NOT ILIKE '%private.product_runtime_available%' THEN
    RAISE EXCEPTION 'Storefront reads/pricing must use the authoritative runtime availability helper';
  END IF;

  IF pg_get_functiondef('public.storefront_price(text,uuid,uuid,numeric,jsonb)'::regprocedure)
       NOT ILIKE '%quantity_limit%' THEN
    RAISE EXCEPTION 'Storefront pricing must enforce product max_quantity';
  END IF;

  reserve_definition := pg_get_functiondef(
    'private.reserve_product_inventory_from_order_item()'::regprocedure
  );

  IF reserve_definition NOT ILIKE '%PRODUCT_RUNTIME_UNAVAILABLE%'
     OR reserve_definition NOT ILIKE '%PRODUCT_MAX_QUANTITY_EXCEEDED%'
     OR reserve_definition NOT ILIKE '%reserve_product_inventory%' THEN
    RAISE EXCEPTION 'Checkout inventory trigger must enforce runtime availability and quantity limits before stock reservation';
  END IF;

  IF pg_get_functiondef('public.storefront_submit_order(text,jsonb)'::regprocedure)
       NOT ILIKE '%unavailable_now%'
     OR pg_get_functiondef('public.storefront_submit_order(text,jsonb)'::regprocedure)
       NOT ILIKE '%quantity_limit%' THEN
    RAISE EXCEPTION 'Public checkout must map authoritative product availability errors';
  END IF;

  availability_definition := pg_get_functiondef(
    'public.update_catalog_product_availability(uuid,uuid,smallint[],time without time zone,time without time zone,integer,numeric,numeric,timestamp with time zone)'::regprocedure
  );

  IF availability_definition NOT ILIKE '%require_permission%catalog.update%'
     OR availability_definition NOT ILIKE '%available_weekdays%'
     OR availability_definition NOT ILIKE '%stock_quantity%'
     OR availability_definition NOT ILIKE '%max_quantity%' THEN
    RAISE EXCEPTION 'Merchant availability editor RPC must enforce permission and persist schedule/inventory rules';
  END IF;

  serializer_definition := pg_get_functiondef('private.catalog_product_json(public.products)'::regprocedure);
  IF serializer_definition NOT ILIKE '%runtime_available%'
     OR serializer_definition NOT ILIKE '%low_stock_threshold%'
     OR serializer_definition NOT ILIKE '%available_weekdays%' THEN
    RAISE EXCEPTION 'Merchant product serializer must expose runtime availability and stock health';
  END IF;

  catalog_definition := pg_get_functiondef('public.storefront_catalog(text)'::regprocedure);
  IF catalog_definition NOT ILIKE '%is_best_seller%'
     OR catalog_definition NOT ILIKE '%30 days%'
     OR catalog_definition NOT ILIKE '%order_items%'
     OR catalog_definition NOT ILIKE '%order_payment_operational_ready%' THEN
    RAISE EXCEPTION 'Public catalog must derive best sellers from recent operationally valid order history';
  END IF;
END $$;

SELECT 'merchant_catalog_runtime_contract_passed' AS result;
