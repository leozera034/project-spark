-- SHARK environment preflight
-- Execute BEFORE 20260811040000+ on the Lovable-managed Supabase.
-- Read-only: validates the legacy schema/functions that the migration chain extends.

DO $$
DECLARE
  _missing text[] := array[]::text[];
BEGIN
  -- Core tenant/catalog tables.
  IF to_regclass('public.stores') IS NULL THEN _missing := _missing || 'public.stores'; END IF;
  IF to_regclass('public.categories') IS NULL THEN _missing := _missing || 'public.categories'; END IF;
  IF to_regclass('public.products') IS NULL THEN _missing := _missing || 'public.products'; END IF;
  IF to_regclass('public.product_variants') IS NULL THEN _missing := _missing || 'public.product_variants'; END IF;
  IF to_regclass('public.option_groups') IS NULL THEN _missing := _missing || 'public.option_groups'; END IF;
  IF to_regclass('public.option_items') IS NULL THEN _missing := _missing || 'public.option_items'; END IF;
  IF to_regclass('public.product_option_groups') IS NULL THEN _missing := _missing || 'public.product_option_groups'; END IF;
  IF to_regclass('public.product_variant_option_item_prices') IS NULL THEN _missing := _missing || 'public.product_variant_option_item_prices'; END IF;
  IF to_regclass('public.orders') IS NULL THEN _missing := _missing || 'public.orders'; END IF;
  IF to_regclass('public.order_items') IS NULL THEN _missing := _missing || 'public.order_items'; END IF;
  IF to_regclass('public.order_item_options') IS NULL THEN _missing := _missing || 'public.order_item_options'; END IF;

  -- Functions reused/replaced by the SHARK chain.
  IF to_regprocedure('public.storefront_normalize_slug(text)') IS NULL THEN _missing := _missing || 'public.storefront_normalize_slug(text)'; END IF;
  IF to_regprocedure('public.storefront_submit_order(text,jsonb)') IS NULL
     AND to_regprocedure('private.storefront_submit_order(text,jsonb)') IS NULL THEN
    _missing := _missing || 'storefront_submit_order(text,jsonb)';
  END IF;
  IF to_regprocedure('private.resolve_store(uuid)') IS NULL THEN _missing := _missing || 'private.resolve_store(uuid)'; END IF;
  IF to_regprocedure('private.require_permission(text,uuid)') IS NULL
     AND to_regprocedure('private.require_permission(public.app_permission,uuid)') IS NULL THEN
    _missing := _missing || 'private.require_permission(...,uuid)';
  END IF;
  IF to_regprocedure('private.log_config_audit(uuid,text,text,uuid,text[])') IS NULL THEN _missing := _missing || 'private.log_config_audit(uuid,text,text,uuid,text[])'; END IF;
  IF to_regprocedure('private.clean_text(text)') IS NULL THEN _missing := _missing || 'private.clean_text(text)'; END IF;
  IF to_regprocedure('private.assert_meaningful_name(text,integer,integer,text)') IS NULL THEN _missing := _missing || 'private.assert_meaningful_name(text,integer,integer,text)'; END IF;
  IF to_regprocedure('private.money(numeric)') IS NULL THEN _missing := _missing || 'private.money(numeric)'; END IF;
  IF to_regprocedure('private.is_platform_admin()') IS NULL THEN _missing := _missing || 'private.is_platform_admin()'; END IF;

  -- Types/enums used by casts and signatures.
  IF to_regtype('public.option_selection_type') IS NULL THEN _missing := _missing || 'public.option_selection_type'; END IF;
  IF to_regtype('public.order_status') IS NULL THEN _missing := _missing || 'public.order_status'; END IF;
  IF to_regtype('public.pricing_unit') IS NULL THEN _missing := _missing || 'public.pricing_unit'; END IF;

  IF cardinality(_missing) > 0 THEN
    RAISE EXCEPTION 'SHARK_ENVIRONMENT_PREFLIGHT_MISSING:%', array_to_string(_missing, ', ');
  END IF;

  -- Composite tenant keys required by combo FKs.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid='public.products'::regclass
      AND c.contype IN ('p','u')
      AND (
        SELECT array_agg(a.attname ORDER BY u.ordinality)
        FROM unnest(c.conkey) WITH ORDINALITY u(attnum,ordinality)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=u.attnum
      ) = ARRAY['id','store_id']::name[]
  ) THEN
    RAISE EXCEPTION 'SHARK_ENVIRONMENT_PREFLIGHT_PRODUCTS_ID_STORE_UNIQUE_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid='public.product_variants'::regclass
      AND c.contype IN ('p','u')
      AND (
        SELECT array_agg(a.attname ORDER BY u.ordinality)
        FROM unnest(c.conkey) WITH ORDINALITY u(attnum,ordinality)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=u.attnum
      ) = ARRAY['id','store_id']::name[]
  ) THEN
    RAISE EXCEPTION 'SHARK_ENVIRONMENT_PREFLIGHT_VARIANTS_ID_STORE_UNIQUE_REQUIRED';
  END IF;

  -- The current public checkout must not coexist with a stale private implementation.
  -- Either only public exists (expected before 41100), or only private exists after it.
  IF to_regprocedure('public.storefront_submit_order(text,jsonb)') IS NOT NULL
     AND to_regprocedure('private.storefront_submit_order(text,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'SHARK_ENVIRONMENT_PREFLIGHT_AMBIGUOUS_CHECKOUT_IMPLEMENTATION';
  END IF;

  RAISE NOTICE 'SHARK environment preflight passed';
END
$$;
