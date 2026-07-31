-- ============================================================
-- FASE 10 — RPCs do catálogo avançado
-- ============================================================

CREATE OR REPLACE FUNCTION private.assert_product_editable(_sid uuid, _product_id uuid)
RETURNS public.products
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE _p public.products;
BEGIN
  SELECT * INTO _p FROM public.products p WHERE p.id = _product_id AND p.store_id = _sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _p.is_archived THEN RAISE EXCEPTION 'PRODUCT_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  RETURN _p;
END;
$$;

CREATE OR REPLACE FUNCTION private.catalog_variant_json(_v public.product_variants)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', _v.id, 'product_id', _v.product_id, 'name', _v.name, 'price', _v.price,
    'is_default', _v.is_default, 'is_active', _v.is_available, 'is_archived', _v.is_archived,
    'sort_order', _v.sort_order, 'package_quantity', _v.package_quantity,
    'package_unit', _v.package_unit, 'updated_at', _v.updated_at)
$$;

CREATE OR REPLACE FUNCTION private.catalog_option_item_json(_i public.option_items)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', _i.id, 'option_group_id', _i.option_group_id, 'name', _i.name,
    'description', _i.description, 'additional_price', _i.additional_price,
    'max_quantity', _i.max_quantity, 'is_active', _i.is_available,
    'is_archived', _i.is_archived, 'sort_order', _i.sort_order, 'updated_at', _i.updated_at)
$$;

CREATE OR REPLACE FUNCTION private.catalog_option_group_json(_g public.option_groups)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', _g.id, 'name', _g.name, 'description', _g.description,
    'selection_type', _g.selection_type, 'is_required', _g.is_required,
    'min_selections', _g.min_selections, 'max_selections', _g.max_selections,
    'pricing_strategy', _g.pricing_strategy, 'price_effect', _g.price_effect,
    'portion_count', _g.portion_count, 'is_active', _g.is_active,
    'is_archived', _g.is_archived, 'sort_order', _g.sort_order, 'updated_at', _g.updated_at,
    'linked_product_count', (SELECT count(*) FROM public.product_option_groups pog
                              WHERE pog.option_group_id = _g.id AND pog.store_id = _g.store_id
                                AND NOT pog.is_archived),
    'items', coalesce((SELECT jsonb_agg(private.catalog_option_item_json(i)
                                ORDER BY i.is_archived, i.sort_order, i.name, i.id)
                         FROM public.option_items i
                        WHERE i.option_group_id = _g.id AND i.store_id = _g.store_id), '[]'::jsonb))
$$;

-- ---------- Modo de venda ----------
CREATE OR REPLACE FUNCTION public.update_product_sale_mode(
  _store_id uuid, _product_id uuid, _sale_mode text, _measurement_unit text DEFAULT 'unit',
  _minimum_quantity numeric DEFAULT 1, _quantity_step numeric DEFAULT 1,
  _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _row public.products;
  _mode public.product_sale_mode;
  _unit public.measurement_unit;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  IF _sale_mode NOT IN ('unit','measured','fixed_package') THEN
    RAISE EXCEPTION 'INVALID_SALE_MODE' USING ERRCODE = 'P0001'; END IF;
  IF _measurement_unit NOT IN ('unit','kg','g','l','ml') THEN
    RAISE EXCEPTION 'INVALID_MEASUREMENT_UNIT' USING ERRCODE = 'P0001'; END IF;
  _mode := _sale_mode::public.product_sale_mode;
  _unit := _measurement_unit::public.measurement_unit;

  SELECT * INTO _row FROM public.products p WHERE p.id = _product_id AND p.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _row.is_archived THEN RAISE EXCEPTION 'PRODUCT_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  IF _mode = 'measured' THEN
    IF _unit = 'unit' THEN RAISE EXCEPTION 'INVALID_MEASUREMENT_UNIT' USING ERRCODE = 'P0001'; END IF;
    IF coalesce(_minimum_quantity, 0) <= 0 OR coalesce(_quantity_step, 0) <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY_RULES' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.product_variants pv
                WHERE pv.product_id = _product_id AND pv.store_id = _sid
                  AND pv.is_available AND NOT pv.is_archived) THEN
      RAISE EXCEPTION 'MEASURED_WITH_VARIANTS' USING ERRCODE = 'P0001'; END IF;
  ELSE
    _minimum_quantity := coalesce(nullif(_minimum_quantity, 0), 1);
    _quantity_step    := coalesce(nullif(_quantity_step, 0), 1);
    IF _mode = 'unit' THEN _unit := 'unit'; END IF;
  END IF;

  UPDATE public.products
     SET sale_mode = _mode,
         measurement_unit = CASE WHEN _mode = 'measured' THEN _unit ELSE _unit END,
         minimum_quantity = _minimum_quantity,
         quantity_step = _quantity_step,
         has_variants = (_mode = 'fixed_package') OR has_variants
   WHERE id = _product_id AND store_id = _sid RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.product.sale_mode.updated', 'products', _product_id,
                                   ARRAY['sale_mode','measurement_unit','minimum_quantity','quantity_step']);
  RETURN private.catalog_product_json(_row);
END;
$$;

-- ---------- Variações ----------
CREATE OR REPLACE FUNCTION public.list_product_variants(_store_id uuid, _product_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id);
BEGIN
  PERFORM private.require_permission('catalog.view', _sid);
  RETURN coalesce((SELECT jsonb_agg(private.catalog_variant_json(v)
                            ORDER BY v.is_archived, v.sort_order, v.name, v.id)
                     FROM public.product_variants v
                    WHERE v.store_id = _sid AND v.product_id = _product_id), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_product_variant(
  _store_id uuid, _product_id uuid, _name text, _price numeric,
  _package_quantity numeric DEFAULT NULL, _package_unit text DEFAULT NULL,
  _is_default boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _p public.products;
  _n text := private.clean_text(_name);
  _row public.product_variants;
  _unit public.measurement_unit;
BEGIN
  PERFORM private.require_permission('catalog.create', _sid);
  _p := private.assert_product_editable(_sid, _product_id);
  PERFORM private.assert_meaningful_name(_n, 1, 80, 'INVALID_VARIANT_NAME');
  PERFORM private.assert_plain_text(_n, 'INVALID_VARIANT_NAME');
  IF _price IS NULL OR _price < 0 OR scale(_price) > 2 THEN
    RAISE EXCEPTION 'INVALID_PRICE' USING ERRCODE = 'P0001'; END IF;
  IF _p.sale_mode = 'measured' THEN
    RAISE EXCEPTION 'MEASURED_WITH_VARIANTS' USING ERRCODE = 'P0001'; END IF;

  IF _package_unit IS NOT NULL THEN
    IF _package_unit NOT IN ('kg','g','l','ml') THEN
      RAISE EXCEPTION 'INVALID_MEASUREMENT_UNIT' USING ERRCODE = 'P0001'; END IF;
    _unit := _package_unit::public.measurement_unit;
    IF coalesce(_package_quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'INVALID_PACKAGE' USING ERRCODE = 'P0001'; END IF;
  ELSIF _package_quantity IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_PACKAGE' USING ERRCODE = 'P0001';
  END IF;

  IF _p.sale_mode = 'fixed_package' AND _unit IS NULL THEN
    RAISE EXCEPTION 'INVALID_PACKAGE' USING ERRCODE = 'P0001'; END IF;

  IF EXISTS (SELECT 1 FROM public.product_variants v
              WHERE v.product_id = _product_id AND v.store_id = _sid AND NOT v.is_archived
                AND public.normalize_label(v.name) = public.normalize_label(_n)) THEN
    RAISE EXCEPTION 'DUPLICATE_VARIANT' USING ERRCODE = 'P0001'; END IF;

  IF _is_default OR NOT EXISTS (SELECT 1 FROM public.product_variants v
        WHERE v.product_id = _product_id AND v.store_id = _sid
          AND v.is_available AND NOT v.is_archived AND v.is_default) THEN
    UPDATE public.product_variants SET is_default = false
     WHERE product_id = _product_id AND store_id = _sid AND is_default;
    _is_default := true;
  END IF;

  INSERT INTO public.product_variants
    (store_id, product_id, name, price, is_default, is_available, sort_order, package_quantity, package_unit)
  VALUES (_sid, _product_id, _n, _price, _is_default, true,
          coalesce((SELECT max(sort_order) + 1 FROM public.product_variants v
                     WHERE v.product_id = _product_id AND v.store_id = _sid), 0),
          _package_quantity, _unit)
  RETURNING * INTO _row;

  UPDATE public.products SET has_variants = true WHERE id = _product_id AND store_id = _sid;

  PERFORM private.log_config_audit(_sid, 'catalog.variant.created', 'product_variants', _row.id,
                                   ARRAY['name','price','package_quantity','package_unit']);
  RETURN private.catalog_variant_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_product_variant(
  _store_id uuid, _id uuid, _name text, _price numeric,
  _package_quantity numeric DEFAULT NULL, _package_unit text DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _row public.product_variants;
  _n text := private.clean_text(_name);
  _unit public.measurement_unit;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  SELECT * INTO _row FROM public.product_variants v WHERE v.id = _id AND v.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _row.is_archived THEN RAISE EXCEPTION 'VARIANT_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  PERFORM private.assert_meaningful_name(_n, 1, 80, 'INVALID_VARIANT_NAME');
  PERFORM private.assert_plain_text(_n, 'INVALID_VARIANT_NAME');
  IF _price IS NULL OR _price < 0 OR scale(_price) > 2 THEN
    RAISE EXCEPTION 'INVALID_PRICE' USING ERRCODE = 'P0001'; END IF;

  IF _package_unit IS NOT NULL THEN
    IF _package_unit NOT IN ('kg','g','l','ml') THEN
      RAISE EXCEPTION 'INVALID_MEASUREMENT_UNIT' USING ERRCODE = 'P0001'; END IF;
    _unit := _package_unit::public.measurement_unit;
    IF coalesce(_package_quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'INVALID_PACKAGE' USING ERRCODE = 'P0001'; END IF;
  ELSIF _package_quantity IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_PACKAGE' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.product_variants v
              WHERE v.product_id = _row.product_id AND v.store_id = _sid AND v.id <> _id
                AND NOT v.is_archived
                AND public.normalize_label(v.name) = public.normalize_label(_n)) THEN
    RAISE EXCEPTION 'DUPLICATE_VARIANT' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.product_variants
     SET name = _n, price = _price, package_quantity = _package_quantity, package_unit = _unit
   WHERE id = _id AND store_id = _sid RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.variant.updated', 'product_variants', _id,
                                   ARRAY['name','price','package_quantity','package_unit']);
  RETURN private.catalog_variant_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_default_product_variant(
  _store_id uuid, _id uuid, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _row public.product_variants;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  SELECT * INTO _row FROM public.product_variants v WHERE v.id = _id AND v.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _row.is_archived OR NOT _row.is_available THEN
    RAISE EXCEPTION 'VARIANT_UNAVAILABLE' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  UPDATE public.product_variants SET is_default = false
   WHERE product_id = _row.product_id AND store_id = _sid AND is_default AND id <> _id;
  UPDATE public.product_variants SET is_default = true
   WHERE id = _id AND store_id = _sid RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.variant.default_set', 'product_variants', _id,
                                   ARRAY['is_default']);
  RETURN private.catalog_variant_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION private.set_variant_flag(
  _store_id uuid, _id uuid, _flag text, _value boolean, _expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _row public.product_variants; _p public.products;
BEGIN
  PERFORM private.require_permission(
    CASE WHEN _flag = 'is_archived' THEN 'catalog.archive'::public.app_permission
         ELSE 'catalog.update'::public.app_permission END, _sid);
  SELECT * INTO _row FROM public.product_variants v WHERE v.id = _id AND v.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);
  SELECT * INTO _p FROM public.products p WHERE p.id = _row.product_id AND p.store_id = _sid;

  IF _flag = 'is_available' THEN
    UPDATE public.product_variants SET is_available = _value,
           is_default = CASE WHEN _value THEN is_default ELSE false END
     WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
  ELSE
    UPDATE public.product_variants SET is_archived = _value,
           is_default = CASE WHEN _value THEN false ELSE is_default END
     WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
  END IF;

  -- Um produto ativo não pode ficar sem variação padrão válida.
  IF _p.is_available AND NOT (private.product_configuration_report(_sid, _p.id) ->> 'is_valid')::boolean THEN
    RAISE EXCEPTION 'INVALID_CONFIGURATION' USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.log_config_audit(_sid,
    CASE _flag WHEN 'is_available' THEN
      CASE WHEN _value THEN 'catalog.variant.activated' ELSE 'catalog.variant.deactivated' END
    ELSE
      CASE WHEN _value THEN 'catalog.variant.archived' ELSE 'catalog.variant.restored' END
    END, 'product_variants', _id, ARRAY[_flag]);
  RETURN private.catalog_variant_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_product_variant_active(
  _store_id uuid, _id uuid, _is_active boolean, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT private.set_variant_flag(_store_id, _id, 'is_available', _is_active, _expected_updated_at)
$$;

CREATE OR REPLACE FUNCTION public.archive_product_variant(
  _store_id uuid, _id uuid, _archived boolean, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT private.set_variant_flag(_store_id, _id, 'is_archived', _archived, _expected_updated_at)
$$;

CREATE OR REPLACE FUNCTION public.reorder_product_variants(_store_id uuid, _product_id uuid, _ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _n int := coalesce(cardinality(_ids), 0);
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  IF _n = 0 OR _n <> (SELECT count(DISTINCT x) FROM unnest(_ids) x) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001'; END IF;
  IF _n <> (SELECT count(*) FROM public.product_variants v
             WHERE v.store_id = _sid AND v.product_id = _product_id
               AND NOT v.is_archived AND v.id = ANY (_ids)) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.product_variants v SET sort_order = o.position
    FROM (SELECT id, (ordinality - 1)::int AS position
            FROM unnest(_ids) WITH ORDINALITY AS t(id, ordinality)) o
   WHERE v.id = o.id AND v.store_id = _sid;

  PERFORM private.log_config_audit(_sid, 'catalog.variant.reordered', 'product_variants', NULL,
                                   ARRAY['sort_order']);
  RETURN public.list_product_variants(_sid, _product_id);
END;
$$;

-- ---------- Grupos de opções ----------
CREATE OR REPLACE FUNCTION public.list_option_groups(
  _store_id uuid DEFAULT NULL, _include_archived boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id);
BEGIN
  PERFORM private.require_permission('catalog.view', _sid);
  RETURN coalesce((SELECT jsonb_agg(private.catalog_option_group_json(g)
                            ORDER BY g.is_archived, g.sort_order, g.name, g.id)
                     FROM public.option_groups g
                    WHERE g.store_id = _sid AND (_include_archived OR NOT g.is_archived)), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_option_group(_store_id uuid, _id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _g public.option_groups;
BEGIN
  PERFORM private.require_permission('catalog.view', _sid);
  SELECT * INTO _g FROM public.option_groups g WHERE g.id = _id AND g.store_id = _sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN private.catalog_option_group_json(_g);
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_option_group_rules(
  _selection_type text, _min int, _max int, _required boolean,
  _strategy text, _effect text, _portions int)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF _selection_type NOT IN ('unica','multipla','quantidade') THEN
    RAISE EXCEPTION 'INVALID_SELECTION_TYPE' USING ERRCODE = 'P0001'; END IF;
  IF _strategy NOT IN ('sum','highest_price','average_price') THEN
    RAISE EXCEPTION 'INVALID_PRICING_STRATEGY' USING ERRCODE = 'P0001'; END IF;
  IF _effect NOT IN ('additive','replace_base') THEN
    RAISE EXCEPTION 'INVALID_PRICE_EFFECT' USING ERRCODE = 'P0001'; END IF;
  IF _min < 0 OR _max < 1 OR _max < _min THEN
    RAISE EXCEPTION 'INVALID_SELECTION_LIMITS' USING ERRCODE = 'P0001'; END IF;
  IF _required AND _min < 1 THEN
    RAISE EXCEPTION 'INVALID_SELECTION_LIMITS' USING ERRCODE = 'P0001'; END IF;
  IF _selection_type = 'unica' AND (_max <> 1 OR _portions IS NOT NULL) THEN
    RAISE EXCEPTION 'INVALID_SELECTION_LIMITS' USING ERRCODE = 'P0001'; END IF;
  IF _portions IS NOT NULL AND (_portions < 2 OR _portions > 8) THEN
    RAISE EXCEPTION 'INVALID_PORTION_COUNT' USING ERRCODE = 'P0001'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_option_group(
  _store_id uuid, _name text, _description text DEFAULT NULL,
  _selection_type text DEFAULT 'unica', _is_required boolean DEFAULT false,
  _min_selections int DEFAULT 0, _max_selections int DEFAULT 1,
  _pricing_strategy text DEFAULT 'sum', _price_effect text DEFAULT 'additive',
  _portion_count int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n text := private.clean_text(_name);
  _d text := private.clean_multiline(_description);
  _row public.option_groups;
BEGIN
  PERFORM private.require_permission('catalog.create', _sid);
  PERFORM private.assert_meaningful_name(_n, 2, 80, 'INVALID_GROUP_NAME');
  PERFORM private.assert_plain_text(_n, 'INVALID_GROUP_NAME');
  PERFORM private.assert_plain_text(_d, 'INVALID_GROUP_DESCRIPTION');
  PERFORM private.assert_option_group_rules(_selection_type, _min_selections, _max_selections,
                                            _is_required, _pricing_strategy, _price_effect, _portion_count);
  IF EXISTS (SELECT 1 FROM public.option_groups g
              WHERE g.store_id = _sid AND NOT g.is_archived
                AND public.normalize_label(g.name) = public.normalize_label(_n)) THEN
    RAISE EXCEPTION 'DUPLICATE_GROUP' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.option_groups
    (store_id, name, description, selection_type, is_required, min_selections, max_selections,
     allow_quantity, pricing_strategy, price_effect, portion_count, is_active, sort_order)
  VALUES (_sid, _n, _d, _selection_type::public.option_selection_type, _is_required,
          _min_selections, _max_selections, _selection_type = 'quantidade',
          _pricing_strategy::public.option_group_pricing_strategy,
          _price_effect::public.option_group_price_effect, _portion_count, true,
          coalesce((SELECT max(sort_order) + 1 FROM public.option_groups g WHERE g.store_id = _sid), 0))
  RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.option_group.created', 'option_groups', _row.id,
                                   ARRAY['name','selection_type','pricing_strategy','price_effect']);
  RETURN private.catalog_option_group_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_option_group(
  _store_id uuid, _id uuid, _name text, _description text DEFAULT NULL,
  _selection_type text DEFAULT 'unica', _is_required boolean DEFAULT false,
  _min_selections int DEFAULT 0, _max_selections int DEFAULT 1,
  _pricing_strategy text DEFAULT 'sum', _price_effect text DEFAULT 'additive',
  _portion_count int DEFAULT NULL, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n text := private.clean_text(_name);
  _d text := private.clean_multiline(_description);
  _row public.option_groups;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  SELECT * INTO _row FROM public.option_groups g WHERE g.id = _id AND g.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _row.is_archived THEN RAISE EXCEPTION 'GROUP_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  PERFORM private.assert_meaningful_name(_n, 2, 80, 'INVALID_GROUP_NAME');
  PERFORM private.assert_plain_text(_n, 'INVALID_GROUP_NAME');
  PERFORM private.assert_plain_text(_d, 'INVALID_GROUP_DESCRIPTION');
  PERFORM private.assert_option_group_rules(_selection_type, _min_selections, _max_selections,
                                            _is_required, _pricing_strategy, _price_effect, _portion_count);
  IF EXISTS (SELECT 1 FROM public.option_groups g
              WHERE g.store_id = _sid AND g.id <> _id AND NOT g.is_archived
                AND public.normalize_label(g.name) = public.normalize_label(_n)) THEN
    RAISE EXCEPTION 'DUPLICATE_GROUP' USING ERRCODE = 'P0001'; END IF;

  IF _price_effect = 'replace_base' AND EXISTS (
    SELECT 1 FROM public.product_option_groups pog
     WHERE pog.option_group_id = _id AND pog.store_id = _sid
       AND pog.is_active AND NOT pog.is_archived
       AND EXISTS (SELECT 1 FROM public.product_option_groups o2
                     JOIN public.option_groups g2 ON g2.id = o2.option_group_id AND g2.store_id = o2.store_id
                    WHERE o2.product_id = pog.product_id AND o2.store_id = _sid
                      AND o2.option_group_id <> _id AND o2.is_active AND NOT o2.is_archived
                      AND g2.is_active AND NOT g2.is_archived
                      AND g2.price_effect = 'replace_base')) THEN
    RAISE EXCEPTION 'MULTIPLE_REPLACE_BASE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.option_groups
     SET name = _n, description = _d,
         selection_type = _selection_type::public.option_selection_type,
         is_required = _is_required, min_selections = _min_selections,
         max_selections = _max_selections, allow_quantity = (_selection_type = 'quantidade'),
         pricing_strategy = _pricing_strategy::public.option_group_pricing_strategy,
         price_effect = _price_effect::public.option_group_price_effect,
         portion_count = _portion_count
   WHERE id = _id AND store_id = _sid RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.option_group.updated', 'option_groups', _id,
    ARRAY['name','description','selection_type','min_selections','max_selections','pricing_strategy','price_effect','portion_count']);
  RETURN private.catalog_option_group_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION private.set_option_group_flag(
  _store_id uuid, _id uuid, _flag text, _value boolean, _expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _row public.option_groups; _p record;
BEGIN
  PERFORM private.require_permission(
    CASE WHEN _flag = 'is_archived' THEN 'catalog.archive'::public.app_permission
         ELSE 'catalog.update'::public.app_permission END, _sid);
  SELECT * INTO _row FROM public.option_groups g WHERE g.id = _id AND g.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  IF _flag = 'is_active' THEN
    UPDATE public.option_groups SET is_active = _value WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
  ELSE
    UPDATE public.option_groups SET is_archived = _value,
           is_active = CASE WHEN _value THEN false ELSE is_active END
     WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
  END IF;

  FOR _p IN SELECT DISTINCT pog.product_id FROM public.product_option_groups pog
             WHERE pog.option_group_id = _id AND pog.store_id = _sid AND NOT pog.is_archived
  LOOP
    IF EXISTS (SELECT 1 FROM public.products p
                WHERE p.id = _p.product_id AND p.store_id = _sid AND p.is_available AND NOT p.is_archived)
       AND NOT (private.product_configuration_report(_sid, _p.product_id) ->> 'is_valid')::boolean THEN
      RAISE EXCEPTION 'INVALID_CONFIGURATION' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  PERFORM private.log_config_audit(_sid,
    CASE _flag WHEN 'is_active' THEN
      CASE WHEN _value THEN 'catalog.option_group.activated' ELSE 'catalog.option_group.deactivated' END
    ELSE
      CASE WHEN _value THEN 'catalog.option_group.archived' ELSE 'catalog.option_group.restored' END
    END, 'option_groups', _id, ARRAY[_flag]);
  RETURN private.catalog_option_group_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_option_group_active(
  _store_id uuid, _id uuid, _is_active boolean, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT private.set_option_group_flag(_store_id, _id, 'is_active', _is_active, _expected_updated_at)
$$;

CREATE OR REPLACE FUNCTION public.archive_option_group(
  _store_id uuid, _id uuid, _archived boolean, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT private.set_option_group_flag(_store_id, _id, 'is_archived', _archived, _expected_updated_at)
$$;

-- ---------- Itens ----------
CREATE OR REPLACE FUNCTION public.create_option_item(
  _store_id uuid, _option_group_id uuid, _name text, _additional_price numeric DEFAULT 0,
  _description text DEFAULT NULL, _max_quantity int DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n text := private.clean_text(_name);
  _d text := private.clean_multiline(_description);
  _row public.option_items;
BEGIN
  PERFORM private.require_permission('catalog.create', _sid);
  IF NOT EXISTS (SELECT 1 FROM public.option_groups g
                  WHERE g.id = _option_group_id AND g.store_id = _sid AND NOT g.is_archived) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_meaningful_name(_n, 1, 80, 'INVALID_ITEM_NAME');
  PERFORM private.assert_plain_text(_n, 'INVALID_ITEM_NAME');
  PERFORM private.assert_plain_text(_d, 'INVALID_ITEM_DESCRIPTION');
  IF _additional_price IS NULL OR _additional_price < 0 OR scale(_additional_price) > 2 THEN
    RAISE EXCEPTION 'INVALID_PRICE' USING ERRCODE = 'P0001'; END IF;
  IF coalesce(_max_quantity, 0) < 1 THEN
    RAISE EXCEPTION 'INVALID_MAX_QUANTITY' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.option_items i
              WHERE i.option_group_id = _option_group_id AND i.store_id = _sid AND NOT i.is_archived
                AND public.normalize_label(i.name) = public.normalize_label(_n)) THEN
    RAISE EXCEPTION 'DUPLICATE_ITEM' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.option_items
    (store_id, option_group_id, name, description, additional_price, max_quantity, is_available, sort_order)
  VALUES (_sid, _option_group_id, _n, _d, _additional_price, _max_quantity, true,
          coalesce((SELECT max(sort_order) + 1 FROM public.option_items i
                     WHERE i.option_group_id = _option_group_id AND i.store_id = _sid), 0))
  RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.option_item.created', 'option_items', _row.id,
                                   ARRAY['name','additional_price','max_quantity']);
  RETURN private.catalog_option_item_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_option_item(
  _store_id uuid, _id uuid, _name text, _additional_price numeric DEFAULT 0,
  _description text DEFAULT NULL, _max_quantity int DEFAULT 1,
  _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n text := private.clean_text(_name);
  _d text := private.clean_multiline(_description);
  _row public.option_items;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  SELECT * INTO _row FROM public.option_items i WHERE i.id = _id AND i.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _row.is_archived THEN RAISE EXCEPTION 'ITEM_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  PERFORM private.assert_meaningful_name(_n, 1, 80, 'INVALID_ITEM_NAME');
  PERFORM private.assert_plain_text(_n, 'INVALID_ITEM_NAME');
  PERFORM private.assert_plain_text(_d, 'INVALID_ITEM_DESCRIPTION');
  IF _additional_price IS NULL OR _additional_price < 0 OR scale(_additional_price) > 2 THEN
    RAISE EXCEPTION 'INVALID_PRICE' USING ERRCODE = 'P0001'; END IF;
  IF coalesce(_max_quantity, 0) < 1 THEN
    RAISE EXCEPTION 'INVALID_MAX_QUANTITY' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.option_items i
              WHERE i.option_group_id = _row.option_group_id AND i.store_id = _sid AND i.id <> _id
                AND NOT i.is_archived
                AND public.normalize_label(i.name) = public.normalize_label(_n)) THEN
    RAISE EXCEPTION 'DUPLICATE_ITEM' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.option_items
     SET name = _n, description = _d, additional_price = _additional_price, max_quantity = _max_quantity
   WHERE id = _id AND store_id = _sid RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.option_item.updated', 'option_items', _id,
                                   ARRAY['name','description','additional_price','max_quantity']);
  RETURN private.catalog_option_item_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION private.set_option_item_flag(
  _store_id uuid, _id uuid, _flag text, _value boolean, _expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _row public.option_items;
BEGIN
  PERFORM private.require_permission(
    CASE WHEN _flag = 'is_archived' THEN 'catalog.archive'::public.app_permission
         ELSE 'catalog.update'::public.app_permission END, _sid);
  SELECT * INTO _row FROM public.option_items i WHERE i.id = _id AND i.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  IF _flag = 'is_available' THEN
    UPDATE public.option_items SET is_available = _value WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
  ELSE
    UPDATE public.option_items SET is_archived = _value,
           is_available = CASE WHEN _value THEN false ELSE is_available END
     WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
  END IF;

  PERFORM private.log_config_audit(_sid,
    CASE _flag WHEN 'is_available' THEN
      CASE WHEN _value THEN 'catalog.option_item.activated' ELSE 'catalog.option_item.deactivated' END
    ELSE
      CASE WHEN _value THEN 'catalog.option_item.archived' ELSE 'catalog.option_item.restored' END
    END, 'option_items', _id, ARRAY[_flag]);
  RETURN private.catalog_option_item_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_option_item_active(
  _store_id uuid, _id uuid, _is_active boolean, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT private.set_option_item_flag(_store_id, _id, 'is_available', _is_active, _expected_updated_at)
$$;

CREATE OR REPLACE FUNCTION public.archive_option_item(
  _store_id uuid, _id uuid, _archived boolean, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT private.set_option_item_flag(_store_id, _id, 'is_archived', _archived, _expected_updated_at)
$$;

CREATE OR REPLACE FUNCTION public.reorder_option_items(_store_id uuid, _option_group_id uuid, _ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _n int := coalesce(cardinality(_ids), 0);
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  IF _n = 0 OR _n <> (SELECT count(DISTINCT x) FROM unnest(_ids) x) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001'; END IF;
  IF _n <> (SELECT count(*) FROM public.option_items i
             WHERE i.store_id = _sid AND i.option_group_id = _option_group_id
               AND NOT i.is_archived AND i.id = ANY (_ids)) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.option_items i SET sort_order = o.position
    FROM (SELECT id, (ordinality - 1)::int AS position
            FROM unnest(_ids) WITH ORDINALITY AS t(id, ordinality)) o
   WHERE i.id = o.id AND i.store_id = _sid;

  PERFORM private.log_config_audit(_sid, 'catalog.option_item.reordered', 'option_items', NULL,
                                   ARRAY['sort_order']);
  RETURN public.get_option_group(_sid, _option_group_id);
END;
$$;

-- ---------- Vínculo produto x grupo ----------
CREATE OR REPLACE FUNCTION public.attach_option_group_to_product(
  _store_id uuid, _product_id uuid, _option_group_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _g public.option_groups; _row public.product_option_groups;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  PERFORM private.assert_product_editable(_sid, _product_id);
  SELECT * INTO _g FROM public.option_groups g WHERE g.id = _option_group_id AND g.store_id = _sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _g.is_archived THEN RAISE EXCEPTION 'GROUP_ARCHIVED' USING ERRCODE = 'P0001'; END IF;

  IF EXISTS (SELECT 1 FROM public.product_option_groups pog
              WHERE pog.product_id = _product_id AND pog.option_group_id = _option_group_id
                AND pog.store_id = _sid AND NOT pog.is_archived) THEN
    RAISE EXCEPTION 'DUPLICATE_LINK' USING ERRCODE = 'P0001'; END IF;

  IF _g.price_effect = 'replace_base' AND EXISTS (
    SELECT 1 FROM public.product_option_groups pog
      JOIN public.option_groups g2 ON g2.id = pog.option_group_id AND g2.store_id = pog.store_id
     WHERE pog.product_id = _product_id AND pog.store_id = _sid
       AND pog.is_active AND NOT pog.is_archived
       AND g2.price_effect = 'replace_base') THEN
    RAISE EXCEPTION 'MULTIPLE_REPLACE_BASE' USING ERRCODE = 'P0001'; END IF;

  DELETE FROM public.product_option_groups
   WHERE product_id = _product_id AND option_group_id = _option_group_id AND store_id = _sid AND is_archived;

  INSERT INTO public.product_option_groups
    (store_id, product_id, option_group_id, is_required, min_selections, max_selections, sort_order, is_active)
  VALUES (_sid, _product_id, _option_group_id, _g.is_required, _g.min_selections, _g.max_selections,
          coalesce((SELECT max(sort_order) + 1 FROM public.product_option_groups pog
                     WHERE pog.product_id = _product_id AND pog.store_id = _sid), 0), true)
  RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.product_option_group.attached',
                                   'product_option_groups', _row.id, ARRAY['option_group_id']);
  RETURN jsonb_build_object('id', _row.id, 'product_id', _row.product_id,
                            'option_group_id', _row.option_group_id, 'sort_order', _row.sort_order,
                            'is_active', _row.is_active, 'updated_at', _row.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.detach_option_group_from_product(
  _store_id uuid, _product_id uuid, _option_group_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _row public.product_option_groups;
BEGIN
  PERFORM private.require_permission('catalog.archive', _sid);
  SELECT * INTO _row FROM public.product_option_groups pog
   WHERE pog.product_id = _product_id AND pog.option_group_id = _option_group_id
     AND pog.store_id = _sid AND NOT pog.is_archived FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.product_option_groups SET is_archived = true, is_active = false
   WHERE id = _row.id AND store_id = _sid RETURNING * INTO _row;

  IF EXISTS (SELECT 1 FROM public.products p
              WHERE p.id = _product_id AND p.store_id = _sid AND p.is_available AND NOT p.is_archived)
     AND NOT (private.product_configuration_report(_sid, _product_id) ->> 'is_valid')::boolean THEN
    RAISE EXCEPTION 'INVALID_CONFIGURATION' USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.log_config_audit(_sid, 'catalog.product_option_group.detached',
                                   'product_option_groups', _row.id, ARRAY['is_archived']);
  RETURN jsonb_build_object('id', _row.id, 'detached', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_product_option_groups(
  _store_id uuid, _product_id uuid, _ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _n int := coalesce(cardinality(_ids), 0);
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  IF _n = 0 OR _n <> (SELECT count(DISTINCT x) FROM unnest(_ids) x) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001'; END IF;
  IF _n <> (SELECT count(*) FROM public.product_option_groups pog
             WHERE pog.store_id = _sid AND pog.product_id = _product_id
               AND NOT pog.is_archived AND pog.id = ANY (_ids)) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.product_option_groups pog SET sort_order = o.position
    FROM (SELECT id, (ordinality - 1)::int AS position
            FROM unnest(_ids) WITH ORDINALITY AS t(id, ordinality)) o
   WHERE pog.id = o.id AND pog.store_id = _sid;

  PERFORM private.log_config_audit(_sid, 'catalog.product_option_group.reordered',
                                   'product_option_groups', NULL, ARRAY['sort_order']);
  RETURN jsonb_build_object('reordered', _n);
END;
$$;

-- ---------- Preços por variação ----------
CREATE OR REPLACE FUNCTION public.replace_variant_option_prices(
  _store_id uuid, _product_id uuid, _prices jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _e jsonb;
  _variant uuid;
  _item uuid;
  _price numeric;
  _count int := 0;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  PERFORM private.assert_product_editable(_sid, _product_id);
  IF _prices IS NULL OR jsonb_typeof(_prices) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD' USING ERRCODE = 'P0001'; END IF;

  DELETE FROM public.product_variant_option_item_prices
   WHERE store_id = _sid AND product_id = _product_id;

  FOR _e IN SELECT value FROM jsonb_array_elements(_prices) AS t(value)
  LOOP
    _variant := nullif(_e ->> 'variant_id', '')::uuid;
    _item    := nullif(_e ->> 'item_id', '')::uuid;
    _price   := nullif(_e ->> 'price', '')::numeric;

    IF _variant IS NULL OR _item IS NULL OR _price IS NULL THEN
      RAISE EXCEPTION 'INVALID_PAYLOAD' USING ERRCODE = 'P0001'; END IF;
    IF _price < 0 OR scale(_price) > 2 THEN
      RAISE EXCEPTION 'INVALID_PRICE' USING ERRCODE = 'P0001'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.product_variants v
                    WHERE v.id = _variant AND v.store_id = _sid AND v.product_id = _product_id
                      AND NOT v.is_archived) THEN
      RAISE EXCEPTION 'VARIANT_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.option_items oi
        JOIN public.product_option_groups pog
          ON pog.option_group_id = oi.option_group_id AND pog.store_id = oi.store_id
       WHERE oi.id = _item AND oi.store_id = _sid AND NOT oi.is_archived
         AND pog.product_id = _product_id AND NOT pog.is_archived) THEN
      RAISE EXCEPTION 'OPTION_INVALID' USING ERRCODE = 'P0001'; END IF;

    INSERT INTO public.product_variant_option_item_prices
      (store_id, product_id, product_variant_id, option_item_id, price)
    VALUES (_sid, _product_id, _variant, _item, _price)
    ON CONFLICT (product_variant_id, option_item_id) DO UPDATE SET price = EXCLUDED.price;
    _count := _count + 1;
  END LOOP;

  PERFORM private.log_config_audit(_sid, 'catalog.variant_option_prices.replaced',
                                   'product_variant_option_item_prices', _product_id, ARRAY['price']);
  RETURN jsonb_build_object('saved', _count);
END;
$$;

-- ---------- Construtor ----------
CREATE OR REPLACE FUNCTION public.get_product_advanced_builder(_store_id uuid, _product_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := private.resolve_store(_store_id); _p public.products;
BEGIN
  PERFORM private.require_permission('catalog.view', _sid);
  SELECT * INTO _p FROM public.products p WHERE p.id = _product_id AND p.store_id = _sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;

  RETURN jsonb_build_object(
    'product', private.catalog_product_json(_p) || jsonb_build_object(
      'sale_mode', _p.sale_mode, 'measurement_unit', _p.measurement_unit),
    'variants', coalesce((SELECT jsonb_agg(private.catalog_variant_json(v)
                            ORDER BY v.is_archived, v.sort_order, v.name, v.id)
                            FROM public.product_variants v
                           WHERE v.store_id = _sid AND v.product_id = _product_id), '[]'::jsonb),
    'groups', coalesce((SELECT jsonb_agg(
                            private.catalog_option_group_json(g)
                            || jsonb_build_object('link_id', pog.id,
                                                  'link_sort_order', pog.sort_order,
                                                  'link_is_active', pog.is_active)
                            ORDER BY pog.sort_order, g.name, g.id)
                          FROM public.product_option_groups pog
                          JOIN public.option_groups g
                            ON g.id = pog.option_group_id AND g.store_id = pog.store_id
                         WHERE pog.product_id = _product_id AND pog.store_id = _sid
                           AND NOT pog.is_archived), '[]'::jsonb),
    'variant_option_prices', coalesce((SELECT jsonb_agg(jsonb_build_object(
                            'variant_id', pp.product_variant_id,
                            'item_id', pp.option_item_id,
                            'price', pp.price))
                          FROM public.product_variant_option_item_prices pp
                         WHERE pp.store_id = _sid AND pp.product_id = _product_id), '[]'::jsonb),
    'validation', private.product_configuration_report(_sid, _product_id),
    'can', jsonb_build_object(
      'view', private.has_permission('catalog.view', _sid),
      'create', private.has_permission('catalog.create', _sid),
      'update', private.has_permission('catalog.update', _sid),
      'archive', private.has_permission('catalog.archive', _sid))
  );
END;
$$;

-- ---------- Grants ----------
DO $$
DECLARE _f record;
BEGIN
  FOR _f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
        'update_product_sale_mode','list_product_variants','create_product_variant',
        'update_product_variant','set_default_product_variant','set_product_variant_active',
        'archive_product_variant','reorder_product_variants','list_option_groups','get_option_group',
        'create_option_group','update_option_group','set_option_group_active','archive_option_group',
        'create_option_item','update_option_item','set_option_item_active','archive_option_item',
        'reorder_option_items','attach_option_group_to_product','detach_option_group_from_product',
        'reorder_product_option_groups','replace_variant_option_prices','get_product_advanced_builder')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _f.sig);
  END LOOP;
END $$;