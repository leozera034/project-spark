-- SHARK legacy preflight
-- Run BEFORE applying the 20260811040000+ SHARK migration chain.
-- Read-only validation: aborts if the legacy catalog contains structural data
-- that would make backfill/migration unsafe or ambiguous.

DO $$
DECLARE
  _issues bigint;
BEGIN
  SELECT count(*) INTO _issues
  FROM public.product_option_groups pog
  LEFT JOIN public.products p
    ON p.id = pog.product_id AND p.store_id = pog.store_id
  LEFT JOIN public.option_groups og
    ON og.id = pog.option_group_id AND og.store_id = pog.store_id
  WHERE p.id IS NULL OR og.id IS NULL;
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_ORPHAN_PRODUCT_GROUP_LINKS:%', _issues; END IF;

  SELECT count(*) INTO _issues
  FROM public.product_variants v
  LEFT JOIN public.products p
    ON p.id = v.product_id AND p.store_id = v.store_id
  WHERE p.id IS NULL;
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_VARIANT_PRODUCT_MISMATCH:%', _issues; END IF;

  SELECT count(*) INTO _issues
  FROM public.option_items i
  LEFT JOIN public.option_groups g
    ON g.id = i.option_group_id AND g.store_id = i.store_id
  WHERE g.id IS NULL;
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_OPTION_ITEM_GROUP_MISMATCH:%', _issues; END IF;

  SELECT count(*) INTO _issues
  FROM public.option_groups
  WHERE min_selections < 0 OR max_selections < 1 OR min_selections > max_selections;
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_INVALID_GROUP_LIMITS:%', _issues; END IF;

  SELECT count(*) INTO _issues
  FROM (
    SELECT product_id
    FROM public.product_variants
    WHERE is_available AND NOT is_archived AND is_default
    GROUP BY product_id
    HAVING count(*) > 1
  ) q;
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_MULTIPLE_ACTIVE_DEFAULTS:%', _issues; END IF;

  SELECT count(*) INTO _issues
  FROM public.products p
  WHERE p.has_variants
    AND NOT EXISTS (
      SELECT 1 FROM public.product_variants v
      WHERE v.product_id = p.id AND v.store_id = p.store_id
        AND v.is_available AND NOT v.is_archived
    );
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_VARIANT_FLAG_WITHOUT_VARIANT:%', _issues; END IF;

  SELECT count(*) INTO _issues
  FROM public.products p
  WHERE NOT p.has_variants
    AND EXISTS (
      SELECT 1 FROM public.product_variants v
      WHERE v.product_id = p.id AND v.store_id = p.store_id
        AND v.is_available AND NOT v.is_archived
    );
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_VARIANT_EXISTS_FLAG_FALSE:%', _issues; END IF;

  SELECT count(*) INTO _issues FROM public.products WHERE base_price < 0;
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_NEGATIVE_PRODUCT_PRICE:%', _issues; END IF;

  SELECT count(*) INTO _issues FROM public.product_variants WHERE price < 0;
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_NEGATIVE_VARIANT_PRICE:%', _issues; END IF;

  SELECT count(*) INTO _issues FROM public.option_items WHERE additional_price < 0;
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_NEGATIVE_OPTION_PRICE:%', _issues; END IF;

  SELECT count(*) INTO _issues
  FROM (
    SELECT product_id, lower(trim(name)) AS normalized_name
    FROM public.product_variants
    WHERE NOT is_archived
    GROUP BY product_id, lower(trim(name))
    HAVING count(*) > 1
  ) q;
  IF _issues > 0 THEN RAISE EXCEPTION 'SHARK_PREFLIGHT_DUPLICATE_VARIANT_NAMES:%', _issues; END IF;

  RAISE NOTICE 'SHARK legacy preflight passed';
END
$$;
