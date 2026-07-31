CREATE OR REPLACE FUNCTION public.storefront_price(_slug text, _product_id uuid, _variant_id uuid DEFAULT NULL::uuid, _quantity numeric DEFAULT 1, _selections jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_slug text := public.storefront_normalize_slug(_slug);
  v_store uuid;
  v_count int;
  v_grouped jsonb;
BEGIN
  IF v_slug IS NULL OR _product_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  IF jsonb_typeof(coalesce(_selections, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(_selections, '[]'::jsonb)) > 60 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  SELECT st.id INTO v_store
    FROM public.stores st
   WHERE st.slug = v_slug AND st.status = 'ativa' LIMIT 1;
  IF v_store IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products p
     WHERE p.id = _product_id AND p.store_id = v_store
       AND p.is_available AND NOT p.is_archived
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'product_not_found');
  END IF;

  IF _variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants v
     WHERE v.id = _variant_id AND v.product_id = _product_id AND v.store_id = v_store
       AND v.is_available AND NOT v.is_archived
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'variant_not_found');
  END IF;

  SELECT count(*) INTO v_count
  FROM jsonb_array_elements(coalesce(_selections, '[]'::jsonb)) AS sel
  WHERE NOT EXISTS (
    SELECT 1
      FROM public.option_items i
      JOIN public.product_option_groups pog
        ON pog.option_group_id = i.option_group_id
       AND pog.product_id = _product_id
       AND pog.store_id = v_store
       AND pog.is_active AND NOT pog.is_archived
     WHERE i.id = NULLIF(sel->>'option_item_id', '')::uuid
       AND i.store_id = v_store
       AND i.is_available AND NOT i.is_archived
  );

  IF v_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_selection');
  END IF;

  -- Converte a lista plana enviada pelo cliente para o formato agrupado
  -- esperado por private.calculate_configured_product_price.
  SELECT coalesce(jsonb_agg(g), '[]'::jsonb) INTO v_grouped
  FROM (
    SELECT jsonb_build_object(
             'group_id', sel->>'option_group_id',
             'items', jsonb_agg(
               jsonb_build_object(
                 'item_id', sel->>'option_item_id',
                 'quantity', coalesce(nullif(sel->>'quantity','')::numeric, 1)
               )
             )
           ) AS g
      FROM jsonb_array_elements(coalesce(_selections, '[]'::jsonb)) AS sel
     WHERE sel->>'option_group_id' IS NOT NULL
     GROUP BY sel->>'option_group_id'
  ) s;

  RETURN jsonb_build_object(
    'ok', true,
    'result', private.calculate_configured_product_price(
      v_store, _product_id, _variant_id, _quantity, v_grouped
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'calculation_failed');
END;
$function$;

REVOKE ALL ON FUNCTION public.storefront_price(text, uuid, uuid, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_price(text, uuid, uuid, numeric, jsonb) TO service_role;