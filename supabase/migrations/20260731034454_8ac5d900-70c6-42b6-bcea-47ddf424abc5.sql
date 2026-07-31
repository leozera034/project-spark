-- ============================================================
-- FASE 10 — Motor canônico de preço e validação
-- ============================================================

CREATE OR REPLACE FUNCTION private.money(_v numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT round(coalesce(_v, 0), 2)
$$;

-- ------------------------------------------------------------
-- Cálculo canônico
-- Entrada de escolhas:
--   [{ "group_id": uuid, "items": [{ "item_id": uuid, "quantity": numeric }] }]
-- Nenhum preço, regra, total ou store_id do cliente é considerado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.calculate_configured_product_price(
  _store_id   uuid,
  _product_id uuid,
  _variant_id uuid,
  _quantity   numeric,
  _selections jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _p            public.products;
  _v            public.product_variants;
  _qty          numeric := coalesce(_quantity, 1);
  _errors       text[] := ARRAY[]::text[];
  _base_unit    numeric := 0;
  _base_total   numeric := 0;
  _replace_tot  numeric;
  _additive_tot numeric := 0;
  _final_unit   numeric := 0;
  _final_total  numeric := 0;
  _breakdown    jsonb := '[]'::jsonb;
  _sel          jsonb;
  _g            record;
  _link         record;
  _items        jsonb;
  _item         jsonb;
  _it           record;
  _iqty         numeric;
  _price        numeric;
  _count_items  int;
  _sum_qty      numeric;
  _group_value  numeric;
  _acc_num      numeric;
  _acc_den      numeric;
  _max_price    numeric;
  _seen         uuid[];
  _has_variants boolean;
  _replace_seen boolean := false;
BEGIN
  SELECT * INTO _p FROM public.products p
   WHERE p.id = _product_id AND p.store_id = _store_id AND NOT p.is_archived;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('validation_errors', to_jsonb(ARRAY['PRODUCT_NOT_FOUND']));
  END IF;

  IF _selections IS NULL OR jsonb_typeof(_selections) <> 'array' THEN
    _selections := '[]'::jsonb;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_variants pv
     WHERE pv.product_id = _p.id AND pv.store_id = _store_id
       AND pv.is_available AND NOT pv.is_archived
  ) INTO _has_variants;

  IF _variant_id IS NOT NULL THEN
    SELECT * INTO _v FROM public.product_variants pv
     WHERE pv.id = _variant_id AND pv.store_id = _store_id AND pv.product_id = _p.id
       AND pv.is_available AND NOT pv.is_archived;
    IF NOT FOUND THEN _errors := _errors || 'VARIANT_INVALID'; END IF;
  ELSIF _has_variants THEN
    SELECT * INTO _v FROM public.product_variants pv
     WHERE pv.product_id = _p.id AND pv.store_id = _store_id
       AND pv.is_available AND NOT pv.is_archived AND pv.is_default
     LIMIT 1;
    IF NOT FOUND THEN _errors := _errors || 'VARIANT_REQUIRED'; END IF;
  END IF;

  IF _p.sale_mode = 'fixed_package' AND _v.id IS NULL THEN
    _errors := _errors || 'PACKAGE_REQUIRED';
  END IF;

  -- Quantidade
  IF _qty IS NULL OR _qty <= 0 THEN
    _errors := _errors || 'QUANTITY_INVALID';
    _qty := coalesce(_p.minimum_quantity, 1);
  ELSE
    IF _p.sale_mode IN ('unit', 'fixed_package') AND scale(_qty) > 0 THEN
      _errors := _errors || 'QUANTITY_INVALID';
    END IF;
    IF _qty < _p.minimum_quantity THEN
      _errors := _errors || 'QUANTITY_BELOW_MINIMUM';
    ELSIF _p.quantity_step > 0 AND mod(_qty - _p.minimum_quantity, _p.quantity_step) <> 0 THEN
      _errors := _errors || 'QUANTITY_STEP_INVALID';
    END IF;
  END IF;

  -- Preço base
  IF _p.sale_mode = 'measured' THEN
    _base_unit  := _p.base_price;
    _base_total := private.money(_p.base_price * _qty);
  ELSE
    _base_unit  := coalesce(_v.price, _p.base_price);
    _base_total := private.money(_base_unit * _qty);
  END IF;

  -- Grupos vinculados ao produto
  FOR _link IN
    SELECT pog.*, og.name, og.selection_type, og.is_required, og.pricing_strategy,
           og.price_effect, og.portion_count, og.min_selections AS g_min,
           og.max_selections AS g_max
      FROM public.product_option_groups pog
      JOIN public.option_groups og
        ON og.id = pog.option_group_id AND og.store_id = pog.store_id
     WHERE pog.product_id = _p.id AND pog.store_id = _store_id
       AND pog.is_active AND NOT pog.is_archived
       AND og.is_active AND NOT og.is_archived
     ORDER BY pog.sort_order, og.name, og.id
  LOOP
    _sel := NULL;
    SELECT s INTO _sel
      FROM jsonb_array_elements(_selections) s
     WHERE (s ->> 'group_id')::text = _link.option_group_id::text
     LIMIT 1;

    _items := coalesce(_sel -> 'items', '[]'::jsonb);
    IF jsonb_typeof(_items) <> 'array' THEN _items := '[]'::jsonb; END IF;

    _count_items := 0;
    _sum_qty     := 0;
    _acc_num     := 0;
    _acc_den     := 0;
    _max_price   := NULL;
    _seen        := ARRAY[]::uuid[];
    _group_value := 0;

    FOR _item IN SELECT value FROM jsonb_array_elements(_items) AS t(value)
    LOOP
      IF (_item ->> 'item_id') IS NULL THEN
        _errors := _errors || 'OPTION_INVALID';
        CONTINUE;
      END IF;

      SELECT * INTO _it FROM public.option_items oi
       WHERE oi.id = (_item ->> 'item_id')::uuid
         AND oi.store_id = _store_id
         AND oi.option_group_id = _link.option_group_id
         AND oi.is_available AND NOT oi.is_archived;
      IF NOT FOUND THEN
        _errors := _errors || 'OPTION_INVALID';
        CONTINUE;
      END IF;

      IF _it.id = ANY (_seen) THEN
        _errors := _errors || 'OPTION_DUPLICATED';
        CONTINUE;
      END IF;
      _seen := _seen || _it.id;

      _iqty := coalesce(nullif(_item ->> 'quantity', '')::numeric, 1);
      IF _iqty <= 0 OR scale(_iqty) > 0 THEN
        _errors := _errors || 'OPTION_QUANTITY_INVALID';
        CONTINUE;
      END IF;
      IF _link.selection_type <> 'quantidade' AND _link.portion_count IS NULL AND _iqty <> 1 THEN
        _errors := _errors || 'OPTION_QUANTITY_INVALID';
        _iqty := 1;
      END IF;
      IF _iqty > _it.max_quantity AND (_link.selection_type = 'quantidade' OR _link.portion_count IS NOT NULL) THEN
        _errors := _errors || 'OPTION_QUANTITY_ABOVE_MAX';
      END IF;

      -- Preço efetivo: específico da variação quando existir
      _price := NULL;
      IF _v.id IS NOT NULL THEN
        SELECT pp.price INTO _price
          FROM public.product_variant_option_item_prices pp
         WHERE pp.store_id = _store_id
           AND pp.product_variant_id = _v.id
           AND pp.option_item_id = _it.id;
      END IF;
      _price := coalesce(_price, _it.additional_price);

      _count_items := _count_items + 1;
      _sum_qty     := _sum_qty + _iqty;
      _acc_num     := _acc_num + (_price * _iqty);
      _acc_den     := _acc_den + _iqty;
      _max_price   := greatest(coalesce(_max_price, _price), _price);
    END LOOP;

    -- Coerência de seleção
    IF _link.portion_count IS NOT NULL THEN
      IF _count_items > 0 AND _sum_qty <> _link.portion_count THEN
        _errors := _errors || 'PORTIONS_INCOMPLETE';
      END IF;
    END IF;

    IF _link.selection_type = 'quantidade' THEN
      IF _sum_qty < coalesce(_link.min_selections, _link.g_min) THEN
        IF _link.is_required OR _sum_qty > 0 THEN _errors := _errors || 'SELECTION_BELOW_MINIMUM'; END IF;
      END IF;
      IF _sum_qty > coalesce(_link.max_selections, _link.g_max) THEN
        _errors := _errors || 'SELECTION_ABOVE_MAXIMUM';
      END IF;
    ELSE
      IF _count_items < coalesce(_link.min_selections, _link.g_min) THEN
        IF _link.is_required OR _count_items > 0 THEN _errors := _errors || 'SELECTION_BELOW_MINIMUM'; END IF;
      END IF;
      IF _count_items > coalesce(_link.max_selections, _link.g_max) THEN
        _errors := _errors || 'SELECTION_ABOVE_MAXIMUM';
      END IF;
    END IF;

    IF _count_items = 0 THEN
      CONTINUE;
    END IF;

    _group_value := CASE _link.pricing_strategy
      WHEN 'sum'           THEN _acc_num
      WHEN 'highest_price' THEN coalesce(_max_price, 0)
      WHEN 'average_price' THEN CASE WHEN _acc_den > 0 THEN _acc_num / _acc_den ELSE 0 END
      ELSE _acc_num
    END;
    _group_value := private.money(_group_value);

    IF _link.price_effect = 'replace_base' THEN
      IF _replace_seen THEN
        _errors := _errors || 'MULTIPLE_REPLACE_BASE';
      ELSE
        _replace_seen := true;
        _replace_tot  := _group_value;
      END IF;
    ELSE
      _additive_tot := _additive_tot + _group_value;
    END IF;

    _breakdown := _breakdown || jsonb_build_object(
      'group_id', _link.option_group_id,
      'group_name', _link.name,
      'pricing_strategy', _link.pricing_strategy,
      'price_effect', _link.price_effect,
      'selected_items', _count_items,
      'selected_quantity', _sum_qty,
      'value', _group_value
    );
  END LOOP;

  IF _p.sale_mode = 'measured' THEN
    _final_unit  := coalesce(_replace_tot, _base_unit);
    _base_total  := private.money(_final_unit * _qty);
    _final_total := private.money(_base_total + _additive_tot);
  ELSE
    _final_unit  := private.money(coalesce(_replace_tot, _base_unit) + _additive_tot);
    _base_total  := private.money(coalesce(_replace_tot, _base_unit) * _qty);
    _final_total := private.money(_final_unit * _qty);
  END IF;

  RETURN jsonb_build_object(
    'product_id', _p.id,
    'variant_id', _v.id,
    'sale_mode', _p.sale_mode,
    'measurement_unit', _p.measurement_unit,
    'quantity', _qty,
    'base_price', _base_unit,
    'base_total', _base_total,
    'replacement_group_total', _replace_tot,
    'additive_groups_total', private.money(_additive_tot),
    'final_unit_price', _final_unit,
    'final_total', CASE WHEN array_length(_errors, 1) IS NULL THEN _final_total ELSE NULL END,
    'breakdown', _breakdown,
    'validation_errors', to_jsonb(_errors)
  );
END;
$$;

-- ------------------------------------------------------------
-- Validação integral da configuração do produto
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.product_configuration_report(_store_id uuid, _product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _p        public.products;
  _errors   text[] := ARRAY[]::text[];
  _warnings text[] := ARRAY[]::text[];
  _active   int;
  _defaults int;
  _g        record;
  _items    int;
  _replace  int;
BEGIN
  SELECT * INTO _p FROM public.products p
   WHERE p.id = _product_id AND p.store_id = _store_id AND NOT p.is_archived;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_valid', false,
                              'errors', to_jsonb(ARRAY['PRODUCT_NOT_FOUND']),
                              'warnings', '[]'::jsonb);
  END IF;

  IF _p.base_price IS NULL OR _p.base_price < 0 THEN _errors := _errors || 'BASE_PRICE_INVALID'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.categories c
                  WHERE c.id = _p.category_id AND c.store_id = _store_id
                    AND c.is_active AND NOT c.is_archived) THEN
    _errors := _errors || 'CATEGORY_UNAVAILABLE';
  END IF;

  SELECT count(*) FILTER (WHERE pv.is_available AND NOT pv.is_archived),
         count(*) FILTER (WHERE pv.is_available AND NOT pv.is_archived AND pv.is_default)
    INTO _active, _defaults
    FROM public.product_variants pv
   WHERE pv.product_id = _p.id AND pv.store_id = _store_id;

  IF _active > 0 AND _defaults <> 1 THEN _errors := _errors || 'DEFAULT_VARIANT_REQUIRED'; END IF;

  IF _p.sale_mode = 'measured' THEN
    IF _p.measurement_unit = 'unit'   THEN _errors := _errors || 'MEASUREMENT_UNIT_REQUIRED'; END IF;
    IF _p.minimum_quantity <= 0       THEN _errors := _errors || 'MINIMUM_QUANTITY_INVALID'; END IF;
    IF _p.quantity_step    <= 0       THEN _errors := _errors || 'QUANTITY_STEP_INVALID'; END IF;
    IF _active > 0                    THEN _errors := _errors || 'MEASURED_WITH_VARIANTS'; END IF;
  ELSIF _p.sale_mode = 'fixed_package' THEN
    IF _active = 0 THEN
      _errors := _errors || 'PACKAGES_REQUIRED';
    ELSIF EXISTS (
      SELECT 1 FROM public.product_variants pv
       WHERE pv.product_id = _p.id AND pv.store_id = _store_id
         AND pv.is_available AND NOT pv.is_archived
         AND (pv.package_quantity IS NULL OR pv.package_unit IS NULL)
    ) THEN
      _errors := _errors || 'PACKAGE_DETAILS_REQUIRED';
    END IF;
  END IF;

  SELECT count(*) INTO _replace
    FROM public.product_option_groups pog
    JOIN public.option_groups og ON og.id = pog.option_group_id AND og.store_id = pog.store_id
   WHERE pog.product_id = _p.id AND pog.store_id = _store_id
     AND pog.is_active AND NOT pog.is_archived
     AND og.is_active AND NOT og.is_archived
     AND og.price_effect = 'replace_base';
  IF _replace > 1 THEN _errors := _errors || 'MULTIPLE_REPLACE_BASE'; END IF;

  FOR _g IN
    SELECT og.*, pog.min_selections AS l_min, pog.max_selections AS l_max
      FROM public.product_option_groups pog
      JOIN public.option_groups og ON og.id = pog.option_group_id AND og.store_id = pog.store_id
     WHERE pog.product_id = _p.id AND pog.store_id = _store_id
       AND pog.is_active AND NOT pog.is_archived
       AND og.is_active AND NOT og.is_archived
  LOOP
    SELECT count(*) INTO _items
      FROM public.option_items oi
     WHERE oi.option_group_id = _g.id AND oi.store_id = _store_id
       AND oi.is_available AND NOT oi.is_archived;

    IF _items = 0 THEN
      _errors := _errors || 'GROUP_WITHOUT_ITEMS';
    ELSIF _items < coalesce(_g.l_min, _g.min_selections) THEN
      _errors := _errors || 'GROUP_MINIMUM_UNREACHABLE';
    END IF;

    IF _g.is_required AND coalesce(_g.l_min, _g.min_selections) < 1 THEN
      _errors := _errors || 'GROUP_REQUIRED_WITHOUT_MINIMUM';
    END IF;

    IF _g.portion_count IS NOT NULL AND _items < 1 THEN
      _errors := _errors || 'GROUP_WITHOUT_ITEMS';
    END IF;

    IF _g.price_effect = 'replace_base' AND _active > 0 AND EXISTS (
      SELECT 1
        FROM public.product_variants pv
        CROSS JOIN public.option_items oi
       WHERE pv.product_id = _p.id AND pv.store_id = _store_id
         AND pv.is_available AND NOT pv.is_archived
         AND oi.option_group_id = _g.id AND oi.store_id = _store_id
         AND oi.is_available AND NOT oi.is_archived
         AND NOT EXISTS (
           SELECT 1 FROM public.product_variant_option_item_prices pp
            WHERE pp.store_id = _store_id
              AND pp.product_variant_id = pv.id
              AND pp.option_item_id = oi.id
         )
    ) THEN
      _warnings := _warnings || 'VARIANT_OPTION_PRICES_INCOMPLETE';
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'is_valid', array_length(_errors, 1) IS NULL,
    'errors', to_jsonb(_errors),
    'warnings', to_jsonb(_warnings)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_product_configuration(_store_id uuid, _product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _sid uuid := private.resolve_store(_store_id);
BEGIN
  PERFORM private.require_permission('catalog.view', _sid);
  RETURN private.product_configuration_report(_sid, _product_id);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_product_configuration(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_product_configuration(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_product_configuration(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.calculate_product_configuration_preview(
  _store_id   uuid,
  _product_id uuid,
  _variant_id uuid DEFAULT NULL,
  _quantity   numeric DEFAULT 1,
  _selections jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _sid uuid := private.resolve_store(_store_id);
BEGIN
  PERFORM private.require_permission('catalog.view', _sid);
  RETURN private.calculate_configured_product_price(_sid, _product_id, _variant_id, _quantity, _selections);
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_product_configuration_preview(uuid, uuid, uuid, numeric, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_product_configuration_preview(uuid, uuid, uuid, numeric, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.calculate_product_configuration_preview(uuid, uuid, uuid, numeric, jsonb) TO authenticated;

-- ------------------------------------------------------------
-- Ativação passa a exigir configuração válida
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_product_flag(
  _store_id uuid,
  _id uuid,
  _flag text,
  _value boolean,
  _expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid    uuid := private.resolve_store(_store_id);
  _row    public.products;
  _action text;
  _report jsonb;
BEGIN
  PERFORM private.require_permission(
    CASE WHEN _flag = 'is_archived' THEN 'catalog.archive'::public.app_permission
         ELSE 'catalog.update'::public.app_permission END, _sid);

  SELECT * INTO _row FROM public.products p
   WHERE p.id = _id AND p.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  IF _flag <> 'is_archived' AND _row.is_archived THEN
    RAISE EXCEPTION 'PRODUCT_ARCHIVED' USING ERRCODE = 'P0001';
  END IF;

  CASE _flag
    WHEN 'is_available' THEN
      IF _value THEN
        PERFORM private.assert_catalog_category_usable(_sid, _row.category_id);
        _report := private.product_configuration_report(_sid, _id);
        IF NOT (_report ->> 'is_valid')::boolean THEN
          RAISE EXCEPTION 'INVALID_CONFIGURATION' USING ERRCODE = 'P0001';
        END IF;
      END IF;
      UPDATE public.products SET is_available = _value WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
      _action := CASE WHEN _value THEN 'catalog.product.activated' ELSE 'catalog.product.deactivated' END;
    WHEN 'is_sold_out' THEN
      UPDATE public.products SET is_sold_out = _value WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
      _action := CASE WHEN _value THEN 'catalog.product.sold_out' ELSE 'catalog.product.available' END;
    WHEN 'is_featured' THEN
      UPDATE public.products SET is_featured = _value WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
      _action := CASE WHEN _value THEN 'catalog.product.featured' ELSE 'catalog.product.unfeatured' END;
    WHEN 'is_archived' THEN
      UPDATE public.products SET is_archived = _value WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
      _action := CASE WHEN _value THEN 'catalog.product.archived' ELSE 'catalog.product.restored' END;
    ELSE
      RAISE EXCEPTION 'INVALID_FILTER' USING ERRCODE = 'P0001';
  END CASE;

  PERFORM private.log_config_audit(_sid, _action, 'products', _id, ARRAY[_flag]);
  RETURN private.catalog_product_json(_row);
END;
$$;