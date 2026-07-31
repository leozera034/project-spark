-- ============================================================
-- FASE 11 — Camada pública de leitura (server-only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.storefront_normalize_slug(_slug text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    substring(lower(regexp_replace(coalesce(_slug, ''), '[^a-zA-Z0-9-]', '', 'g')) from 1 for 63),
    ''
  );
$$;

-- ------------------------------------------------------------
-- 1. Resolução pública da loja pelo slug
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storefront_store(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := public.storefront_normalize_slug(_slug);
  s      record;
  v_now  timestamptz := now();
  v_local timestamp;
  v_dow  smallint;
  v_time time;
  v_by_hours boolean;
  v_open boolean;
BEGIN
  IF v_slug IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT st.id, st.slug, st.name, st.segment, st.city, st.state, st.timezone,
         st.phone, st.whatsapp, st.address_line,
         st.accepts_delivery, st.accepts_pickup
    INTO s
    FROM public.stores st
   WHERE st.slug = v_slug
     AND st.status = 'ativa'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_local := v_now AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo');
  v_dow   := extract(dow FROM v_local)::smallint;
  v_time  := v_local::time;

  SELECT EXISTS (
    SELECT 1 FROM public.store_hours h
     WHERE h.store_id = s.id
       AND h.is_active
       AND h.weekday = v_dow
       AND (
         (h.closes_at > h.opens_at AND v_time >= h.opens_at AND v_time < h.closes_at)
         OR (h.closes_at <= h.opens_at AND (v_time >= h.opens_at OR v_time < h.closes_at))
       )
  ) INTO v_by_hours;

  SELECT CASE
           WHEN cfg.manual_override_open IS NOT NULL THEN cfg.manual_override_open
           WHEN cfg.auto_open_by_hours THEN v_by_hours
           ELSE false
         END
    INTO v_open
    FROM public.store_settings cfg
   WHERE cfg.store_id = s.id;

  v_open := coalesce(v_open, v_by_hours);

  RETURN jsonb_build_object(
    'store', jsonb_build_object(
      'id', s.id,
      'slug', s.slug,
      'name', s.name,
      'segment', s.segment,
      'city', s.city,
      'state', s.state,
      'timezone', s.timezone,
      'phone', s.phone,
      'whatsapp', s.whatsapp,
      'address_line', s.address_line,
      'accepts_delivery', s.accepts_delivery,
      'accepts_pickup', s.accepts_pickup
    ),
    'settings', (
      SELECT jsonb_build_object(
        'logo_path', cfg.logo_path,
        'cover_path', cfg.cover_path,
        'brand_primary', cfg.brand_primary,
        'brand_accent', cfg.brand_accent,
        'description', cfg.description,
        'welcome_message', cfg.welcome_message,
        'closed_message', cfg.closed_message,
        'min_order_amount', cfg.min_order_amount,
        'default_prep_minutes', cfg.default_prep_minutes,
        'theme_tokens', cfg.theme_tokens
      )
      FROM public.store_settings cfg WHERE cfg.store_id = s.id
    ),
    'hours', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'weekday', h.weekday,
               'opens_at', h.opens_at,
               'closes_at', h.closes_at
             ) ORDER BY h.weekday, h.opens_at)
      FROM public.store_hours h
      WHERE h.store_id = s.id AND h.is_active
    ), '[]'::jsonb),
    'is_open', coalesce(v_open, false),
    'open_by_hours', coalesce(v_by_hours, false),
    'server_time', v_now
  );
END;
$$;

-- ------------------------------------------------------------
-- 2. Catálogo público
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storefront_catalog(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := public.storefront_normalize_slug(_slug);
  v_store uuid;
BEGIN
  IF v_slug IS NULL THEN RETURN NULL; END IF;

  SELECT st.id INTO v_store
    FROM public.stores st
   WHERE st.slug = v_slug AND st.status = 'ativa'
   LIMIT 1;

  IF v_store IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'categories', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', c.id,
               'name', c.name,
               'description', c.description,
               'image_path', c.image_path,
               'sort_order', c.sort_order
             ) ORDER BY c.sort_order, c.name)
      FROM public.categories c
      WHERE c.store_id = v_store
        AND c.is_active
        AND NOT c.is_archived
        AND EXISTS (
          SELECT 1 FROM public.products p
           WHERE p.store_id = v_store AND p.category_id = c.id
             AND p.is_available AND NOT p.is_archived
        )
    ), '[]'::jsonb),
    'products', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id,
               'category_id', p.category_id,
               'name', p.name,
               'description', p.description,
               'image_path', p.image_path,
               'base_price', p.base_price,
               'from_price', CASE
                 WHEN p.has_variants THEN (
                   SELECT min(v.price) FROM public.product_variants v
                    WHERE v.product_id = p.id AND v.is_available AND NOT v.is_archived
                 )
                 ELSE p.base_price
               END,
               'sale_mode', p.sale_mode,
               'measurement_unit', p.measurement_unit,
               'pricing_unit', p.pricing_unit,
               'unit_label', p.unit_label,
               'has_variants', p.has_variants,
               'is_sold_out', p.is_sold_out,
               'is_featured', p.is_featured,
               'minimum_quantity', p.minimum_quantity,
               'quantity_step', p.quantity_step,
               'max_quantity', p.max_quantity,
               'allows_notes', p.allows_notes,
               'has_options', EXISTS (
                 SELECT 1 FROM public.product_option_groups pog
                  WHERE pog.product_id = p.id AND pog.is_active AND NOT pog.is_archived
               ),
               'sort_order', p.sort_order
             ) ORDER BY p.sort_order, p.name)
      FROM public.products p
      WHERE p.store_id = v_store
        AND p.is_available
        AND NOT p.is_archived
    ), '[]'::jsonb)
  );
END;
$$;

-- ------------------------------------------------------------
-- 3. Detalhe público do produto
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storefront_product(_slug text, _product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := public.storefront_normalize_slug(_slug);
  v_store uuid;
  p record;
BEGIN
  IF v_slug IS NULL OR _product_id IS NULL THEN RETURN NULL; END IF;

  SELECT st.id INTO v_store
    FROM public.stores st
   WHERE st.slug = v_slug AND st.status = 'ativa'
   LIMIT 1;
  IF v_store IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO p
    FROM public.products pr
   WHERE pr.id = _product_id
     AND pr.store_id = v_store
     AND pr.is_available
     AND NOT pr.is_archived
   LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'product', jsonb_build_object(
      'id', p.id,
      'category_id', p.category_id,
      'name', p.name,
      'description', p.description,
      'image_path', p.image_path,
      'base_price', p.base_price,
      'sale_mode', p.sale_mode,
      'measurement_unit', p.measurement_unit,
      'pricing_unit', p.pricing_unit,
      'unit_label', p.unit_label,
      'has_variants', p.has_variants,
      'is_sold_out', p.is_sold_out,
      'minimum_quantity', p.minimum_quantity,
      'quantity_step', p.quantity_step,
      'max_quantity', p.max_quantity,
      'allows_notes', p.allows_notes
    ),
    'variants', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', v.id,
               'name', v.name,
               'price', v.price,
               'is_default', v.is_default,
               'package_quantity', v.package_quantity,
               'package_unit', v.package_unit
             ) ORDER BY v.sort_order, v.name)
      FROM public.product_variants v
      WHERE v.product_id = p.id AND v.store_id = v_store
        AND v.is_available AND NOT v.is_archived
    ), '[]'::jsonb),
    'option_groups', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', g.id,
               'link_id', pog.id,
               'name', g.name,
               'description', g.description,
               'selection_type', g.selection_type,
               'is_required', coalesce(pog.is_required, g.is_required),
               'min_selections', coalesce(pog.min_selections, g.min_selections),
               'max_selections', coalesce(pog.max_selections, g.max_selections),
               'allow_quantity', g.allow_quantity,
               'pricing_strategy', g.pricing_strategy,
               'price_effect', g.price_effect,
               'portion_count', g.portion_count,
               'sort_order', pog.sort_order,
               'items', coalesce((
                 SELECT jsonb_agg(jsonb_build_object(
                          'id', i.id,
                          'name', i.name,
                          'description', i.description,
                          'additional_price', coalesce(vp.price, i.additional_price),
                          'max_quantity', i.max_quantity
                        ) ORDER BY i.sort_order, i.name)
                 FROM public.option_items i
                 LEFT JOIN public.product_variant_option_item_prices vp
                        ON vp.option_item_id = i.id
                       AND vp.product_id = p.id
                       AND vp.product_variant_id = (
                         SELECT dv.id FROM public.product_variants dv
                          WHERE dv.product_id = p.id AND dv.is_default AND dv.is_available
                          LIMIT 1
                       )
                 WHERE i.option_group_id = g.id
                   AND i.store_id = v_store
                   AND i.is_available
                   AND NOT i.is_archived
               ), '[]'::jsonb)
             ) ORDER BY pog.sort_order, g.name)
      FROM public.product_option_groups pog
      JOIN public.option_groups g
        ON g.id = pog.option_group_id AND g.store_id = v_store
      WHERE pog.product_id = p.id
        AND pog.store_id = v_store
        AND pog.is_active AND NOT pog.is_archived
        AND g.is_active AND NOT g.is_archived
    ), '[]'::jsonb)
  );
END;
$$;

-- ------------------------------------------------------------
-- 4. Cálculo público canônico (com validação de posse)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storefront_price(
  _slug text,
  _product_id uuid,
  _variant_id uuid DEFAULT NULL,
  _quantity numeric DEFAULT 1,
  _selections jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := public.storefront_normalize_slug(_slug);
  v_store uuid;
  v_count int;
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

  -- produto pertence à loja e está publicável
  IF NOT EXISTS (
    SELECT 1 FROM public.products p
     WHERE p.id = _product_id AND p.store_id = v_store
       AND p.is_available AND NOT p.is_archived
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'product_not_found');
  END IF;

  -- variação pertence ao produto
  IF _variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants v
     WHERE v.id = _variant_id AND v.product_id = _product_id AND v.store_id = v_store
       AND v.is_available AND NOT v.is_archived
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'variant_not_found');
  END IF;

  -- toda opção enviada pertence a um grupo realmente ligado a este produto
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

  RETURN jsonb_build_object(
    'ok', true,
    'result', private.calculate_configured_product_price(
      v_store, _product_id, _variant_id, _quantity, coalesce(_selections, '[]'::jsonb)
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'calculation_failed');
END;
$$;

-- ------------------------------------------------------------
-- Acesso: somente o servidor
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.storefront_normalize_slug(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storefront_store(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storefront_catalog(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storefront_product(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storefront_price(text, uuid, uuid, numeric, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.storefront_store(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.storefront_catalog(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.storefront_product(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.storefront_price(text, uuid, uuid, numeric, jsonb) TO service_role;