-- ============================================================
-- FASE 09 — Catálogo básico: RPCs, validação, auditoria
-- Deny-by-default. Nenhuma policy nova para anon. Sem hard delete.
-- ============================================================

-- ---------- Helpers de texto ----------
CREATE OR REPLACE FUNCTION private.clean_text(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(regexp_replace(btrim(regexp_replace(coalesce(_value, ''), '[\u0000-\u001F\u007F]', ' ', 'g')), '[ \t]+', ' ', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION private.clean_multiline(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(btrim(regexp_replace(coalesce(_value, ''), '[\u0000-\u0009\u000B-\u001F\u007F]', ' ', 'g')), '')
$$;

-- Recusa marcação: nada de HTML, script ou CSS vindo do lojista.
CREATE OR REPLACE FUNCTION private.assert_plain_text(_value text, _code text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _value IS NULL THEN RETURN; END IF;
  IF _value ~* '<[a-z/!?]' OR _value ~* '</[a-z]' OR _value ~* 'javascript:' OR _value ~* 'data:text/html' THEN
    RAISE EXCEPTION '%', _code USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Precisa ter ao menos uma letra ou dígito: recusa nomes só de símbolos.
CREATE OR REPLACE FUNCTION private.assert_meaningful_name(_value text, _min int, _max int, _code text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _value IS NULL
     OR char_length(_value) < _min
     OR char_length(_value) > _max
     OR _value !~ '[[:alnum:]]' THEN
    RAISE EXCEPTION '%', _code USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---------- Serialização ----------
CREATE OR REPLACE FUNCTION private.catalog_category_json(_c public.categories)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', _c.id,
    'name', _c.name,
    'description', _c.description,
    'image_path', _c.image_path,
    'is_active', _c.is_active,
    'is_archived', _c.is_archived,
    'sort_order', _c.sort_order,
    'updated_at', _c.updated_at,
    'product_count', (
      SELECT count(*) FROM public.products p
       WHERE p.store_id = _c.store_id AND p.category_id = _c.id AND NOT p.is_archived
    )
  )
$$;

CREATE OR REPLACE FUNCTION private.catalog_product_json(_p public.products)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', _p.id,
    'category_id', _p.category_id,
    'category_name', (SELECT c.name FROM public.categories c
                       WHERE c.id = _p.category_id AND c.store_id = _p.store_id),
    'name', _p.name,
    'description', _p.description,
    'image_path', _p.image_path,
    'base_price', _p.base_price,
    'pricing_unit', _p.pricing_unit,
    'minimum_quantity', _p.minimum_quantity,
    'quantity_step', _p.quantity_step,
    'allows_notes', _p.allows_notes,
    'is_active', _p.is_available,
    'is_featured', _p.is_featured,
    'is_sold_out', _p.is_sold_out,
    'is_archived', _p.is_archived,
    'has_variants', _p.has_variants,
    'sort_order', _p.sort_order,
    'updated_at', _p.updated_at
  )
$$;

-- ---------- Visão geral ----------
CREATE OR REPLACE FUNCTION public.get_my_catalog_overview(_store_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
BEGIN
  PERFORM private.require_permission('catalog.view', _sid);

  RETURN jsonb_build_object(
    'store_id', _sid,
    'counts', jsonb_build_object(
      'categories_active',  (SELECT count(*) FROM public.categories c
                              WHERE c.store_id = _sid AND c.is_active AND NOT c.is_archived),
      'categories_total',   (SELECT count(*) FROM public.categories c
                              WHERE c.store_id = _sid AND NOT c.is_archived),
      'products_active',    (SELECT count(*) FROM public.products p
                              WHERE p.store_id = _sid AND p.is_available AND NOT p.is_archived),
      'products_total',     (SELECT count(*) FROM public.products p
                              WHERE p.store_id = _sid AND NOT p.is_archived),
      'products_sold_out',  (SELECT count(*) FROM public.products p
                              WHERE p.store_id = _sid AND p.is_sold_out AND NOT p.is_archived),
      'products_featured',  (SELECT count(*) FROM public.products p
                              WHERE p.store_id = _sid AND p.is_featured AND NOT p.is_archived),
      'products_archived',  (SELECT count(*) FROM public.products p
                              WHERE p.store_id = _sid AND p.is_archived)
    ),
    'can', jsonb_build_object(
      'view',    private.has_permission('catalog.view', _sid),
      'create',  private.has_permission('catalog.create', _sid),
      'update',  private.has_permission('catalog.update', _sid),
      'archive', private.has_permission('catalog.archive', _sid)
    )
  );
END;
$$;

-- ---------- Categorias ----------
CREATE OR REPLACE FUNCTION public.list_my_catalog_categories(
  _store_id uuid DEFAULT NULL,
  _include_archived boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
BEGIN
  PERFORM private.require_permission('catalog.view', _sid);

  RETURN coalesce((
    SELECT jsonb_agg(private.catalog_category_json(c) ORDER BY c.is_archived, c.sort_order, c.name, c.id)
      FROM public.categories c
     WHERE c.store_id = _sid
       AND (_include_archived OR NOT c.is_archived)
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_catalog_category(
  _store_id uuid,
  _name text,
  _description text DEFAULT NULL,
  _is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid  uuid := private.resolve_store(_store_id);
  _n    text := private.clean_text(_name);
  _d    text := private.clean_multiline(_description);
  _row  public.categories;
BEGIN
  PERFORM private.require_permission('catalog.create', _sid);
  PERFORM private.assert_meaningful_name(_n, 2, 80, 'INVALID_NAME');
  PERFORM private.assert_plain_text(_n, 'INVALID_NAME');
  PERFORM private.assert_plain_text(_d, 'INVALID_DESCRIPTION');
  IF _d IS NOT NULL AND char_length(_d) > 300 THEN
    RAISE EXCEPTION 'INVALID_DESCRIPTION' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.categories c
     WHERE c.store_id = _sid AND NOT c.is_archived
       AND public.normalize_label(c.name) = public.normalize_label(_n)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_CATEGORY' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.categories (store_id, name, description, is_active, sort_order)
  VALUES (
    _sid, _n, _d, coalesce(_is_active, true),
    coalesce((SELECT max(c.sort_order) + 1 FROM public.categories c
               WHERE c.store_id = _sid AND NOT c.is_archived), 0)
  )
  RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.category.created', 'categories', _row.id,
                                   ARRAY['name','description','is_active']);
  RETURN private.catalog_category_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_catalog_category(
  _store_id uuid,
  _id uuid,
  _name text,
  _description text,
  _is_active boolean,
  _expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n   text := private.clean_text(_name);
  _d   text := private.clean_multiline(_description);
  _row public.categories;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  PERFORM private.assert_meaningful_name(_n, 2, 80, 'INVALID_NAME');
  PERFORM private.assert_plain_text(_n, 'INVALID_NAME');
  PERFORM private.assert_plain_text(_d, 'INVALID_DESCRIPTION');

  SELECT * INTO _row FROM public.categories c
   WHERE c.id = _id AND c.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  IF EXISTS (
    SELECT 1 FROM public.categories c
     WHERE c.store_id = _sid AND c.id <> _id AND NOT c.is_archived
       AND public.normalize_label(c.name) = public.normalize_label(_n)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_CATEGORY' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.categories c
     SET name = _n, description = _d, is_active = coalesce(_is_active, c.is_active)
   WHERE c.id = _id AND c.store_id = _sid
  RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.category.updated', 'categories', _id,
                                   ARRAY['name','description','is_active']);
  RETURN private.catalog_category_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_catalog_category_active(
  _store_id uuid,
  _id uuid,
  _is_active boolean,
  _expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _row public.categories;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);

  SELECT * INTO _row FROM public.categories c
   WHERE c.id = _id AND c.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _row.is_archived THEN RAISE EXCEPTION 'CATEGORY_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  UPDATE public.categories SET is_active = _is_active
   WHERE id = _id AND store_id = _sid RETURNING * INTO _row;

  PERFORM private.log_config_audit(
    _sid,
    CASE WHEN _is_active THEN 'catalog.category.activated' ELSE 'catalog.category.deactivated' END,
    'categories', _id, ARRAY['is_active']);
  RETURN private.catalog_category_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_catalog_category(
  _store_id uuid,
  _id uuid,
  _archived boolean,
  _expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _row public.categories;
BEGIN
  PERFORM private.require_permission('catalog.archive', _sid);

  SELECT * INTO _row FROM public.categories c
   WHERE c.id = _id AND c.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  -- Restaurar exige que o nome ainda esteja livre.
  IF NOT _archived AND EXISTS (
    SELECT 1 FROM public.categories c
     WHERE c.store_id = _sid AND c.id <> _id AND NOT c.is_archived
       AND public.normalize_label(c.name) = public.normalize_label(_row.name)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_CATEGORY' USING ERRCODE = 'P0001';
  END IF;

  -- Produtos NÃO são apagados nem movidos: apenas seguem a categoria.
  UPDATE public.categories SET is_archived = _archived
   WHERE id = _id AND store_id = _sid RETURNING * INTO _row;

  PERFORM private.log_config_audit(
    _sid,
    CASE WHEN _archived THEN 'catalog.category.archived' ELSE 'catalog.category.restored' END,
    'categories', _id, ARRAY['is_archived']);
  RETURN private.catalog_category_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_catalog_categories(
  _store_id uuid,
  _ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n   int  := coalesce(cardinality(_ids), 0);
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);

  IF _n = 0 THEN RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001'; END IF;
  IF _n <> (SELECT count(DISTINCT x) FROM unnest(_ids) x) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001';
  END IF;
  IF _n <> (SELECT count(*) FROM public.categories c
             WHERE c.store_id = _sid AND NOT c.is_archived AND c.id = ANY (_ids)) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.categories c
     SET sort_order = o.position
    FROM (SELECT id, (ordinality - 1)::int AS position
            FROM unnest(_ids) WITH ORDINALITY AS t(id, ordinality)) o
   WHERE c.id = o.id AND c.store_id = _sid;

  PERFORM private.log_config_audit(_sid, 'catalog.category.reordered', 'categories', NULL,
                                   ARRAY['sort_order']);
  RETURN public.list_my_catalog_categories(_sid, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_catalog_category_image(
  _store_id uuid,
  _id uuid,
  _image_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _row public.categories;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);

  IF _image_path IS NOT NULL AND _image_path !~ ('^' || _sid::text || '/categories/' || _id::text || '/[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'INVALID_ASSET_PATH' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.categories SET image_path = _image_path
   WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;

  PERFORM private.log_config_audit(_sid, 'catalog.category.image.updated', 'categories', _id,
                                   ARRAY['image_path']);
  RETURN private.catalog_category_json(_row);
END;
$$;

-- ---------- Produtos ----------
CREATE OR REPLACE FUNCTION public.list_my_catalog_products(
  _store_id uuid DEFAULT NULL,
  _search text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _status text DEFAULT 'todos',
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid    uuid := private.resolve_store(_store_id);
  _q      text := public.normalize_label(coalesce(_search, ''));
  _st     text := coalesce(nullif(_status, ''), 'todos');
  _lim    int  := least(greatest(coalesce(_limit, 20), 1), 50);
  _off    int  := greatest(coalesce(_offset, 0), 0);
  _total  int;
  _items  jsonb;
BEGIN
  PERFORM private.require_permission('catalog.view', _sid);

  IF _st NOT IN ('todos','ativos','inativos','esgotados','destaques','arquivados') THEN
    RAISE EXCEPTION 'INVALID_FILTER' USING ERRCODE = 'P0001';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _unused_catalog_noop (x int) ON COMMIT DROP;

  WITH base AS (
    SELECT p.*
      FROM public.products p
      LEFT JOIN public.categories c
        ON c.id = p.category_id AND c.store_id = p.store_id
     WHERE p.store_id = _sid
       AND (_category_id IS NULL OR p.category_id = _category_id)
       AND CASE _st
             WHEN 'arquivados' THEN p.is_archived
             WHEN 'ativos'     THEN NOT p.is_archived AND p.is_available
             WHEN 'inativos'   THEN NOT p.is_archived AND NOT p.is_available
             WHEN 'esgotados'  THEN NOT p.is_archived AND p.is_sold_out
             WHEN 'destaques'  THEN NOT p.is_archived AND p.is_featured
             ELSE NOT p.is_archived
           END
       AND (
         _q = '' OR public.normalize_label(p.name) LIKE '%' || _q || '%'
                 OR public.normalize_label(coalesce(c.name, '')) LIKE '%' || _q || '%'
       )
  )
  SELECT count(*)::int,
         coalesce((
           SELECT jsonb_agg(private.catalog_product_json(b) ORDER BY b.sort_order, b.name, b.id)
             FROM (SELECT * FROM base ORDER BY sort_order, name, id LIMIT _lim OFFSET _off) b
         ), '[]'::jsonb)
    INTO _total, _items
    FROM base;

  RETURN jsonb_build_object(
    'items', _items,
    'total', _total,
    'limit', _lim,
    'offset', _off,
    'has_more', (_off + _lim) < _total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_catalog_product(_store_id uuid, _id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _row public.products;
BEGIN
  PERFORM private.require_permission('catalog.view', _sid);
  SELECT * INTO _row FROM public.products p WHERE p.id = _id AND p.store_id = _sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN private.catalog_product_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_catalog_category_usable(_sid uuid, _category_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _c public.categories;
BEGIN
  SELECT * INTO _c FROM public.categories c WHERE c.id = _category_id AND c.store_id = _sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'CATEGORY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF _c.is_archived THEN RAISE EXCEPTION 'CATEGORY_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_product_price(_price numeric)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _price IS NULL OR _price <> _price OR _price < 0 OR _price > 999999.99 OR scale(_price) > 2 THEN
    RAISE EXCEPTION 'INVALID_PRICE' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_simple_product(
  _store_id uuid,
  _category_id uuid,
  _name text,
  _description text DEFAULT NULL,
  _base_price numeric DEFAULT 0,
  _allows_notes boolean DEFAULT true,
  _is_active boolean DEFAULT true,
  _is_featured boolean DEFAULT false,
  _is_sold_out boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n   text := private.clean_text(_name);
  _d   text := private.clean_multiline(_description);
  _row public.products;
BEGIN
  PERFORM private.require_permission('catalog.create', _sid);
  PERFORM private.assert_meaningful_name(_n, 2, 120, 'INVALID_NAME');
  PERFORM private.assert_plain_text(_n, 'INVALID_NAME');
  PERFORM private.assert_plain_text(_d, 'INVALID_DESCRIPTION');
  IF _d IS NOT NULL AND char_length(_d) > 600 THEN
    RAISE EXCEPTION 'INVALID_DESCRIPTION' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.assert_product_price(_base_price);
  PERFORM private.assert_catalog_category_usable(_sid, _category_id);

  INSERT INTO public.products (
    store_id, category_id, name, description, base_price,
    pricing_unit, minimum_quantity, quantity_step, allows_notes,
    is_available, is_featured, is_sold_out, has_variants, sort_order
  ) VALUES (
    _sid, _category_id, _n, _d, _base_price,
    'unidade', 1, 1, coalesce(_allows_notes, true),
    coalesce(_is_active, true), coalesce(_is_featured, false), coalesce(_is_sold_out, false), false,
    coalesce((SELECT max(p.sort_order) + 1 FROM public.products p
               WHERE p.store_id = _sid AND p.category_id = _category_id AND NOT p.is_archived), 0)
  )
  RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.product.created', 'products', _row.id,
                                   ARRAY['name','category_id','base_price','is_available']);
  RETURN private.catalog_product_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_simple_product(
  _store_id uuid,
  _id uuid,
  _category_id uuid,
  _name text,
  _description text,
  _base_price numeric,
  _allows_notes boolean,
  _expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n   text := private.clean_text(_name);
  _d   text := private.clean_multiline(_description);
  _row public.products;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);
  PERFORM private.assert_meaningful_name(_n, 2, 120, 'INVALID_NAME');
  PERFORM private.assert_plain_text(_n, 'INVALID_NAME');
  PERFORM private.assert_plain_text(_d, 'INVALID_DESCRIPTION');
  PERFORM private.assert_product_price(_base_price);

  SELECT * INTO _row FROM public.products p
   WHERE p.id = _id AND p.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);

  IF _category_id <> _row.category_id THEN
    PERFORM private.assert_catalog_category_usable(_sid, _category_id);
  END IF;

  UPDATE public.products p
     SET category_id  = _category_id,
         name         = _n,
         description  = _d,
         base_price   = _base_price,
         allows_notes = coalesce(_allows_notes, p.allows_notes)
   WHERE p.id = _id AND p.store_id = _sid
  RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.product.updated', 'products', _id,
                                   ARRAY['name','description','category_id','base_price','allows_notes']);
  RETURN private.catalog_product_json(_row);
END;
$$;

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
      IF _value THEN PERFORM private.assert_catalog_category_usable(_sid, _row.category_id); END IF;
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

CREATE OR REPLACE FUNCTION public.set_product_active(
  _store_id uuid, _id uuid, _is_active boolean, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT private.set_product_flag(_store_id, _id, 'is_available', _is_active, _expected_updated_at)
$$;

CREATE OR REPLACE FUNCTION public.set_product_sold_out(
  _store_id uuid, _id uuid, _is_sold_out boolean, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT private.set_product_flag(_store_id, _id, 'is_sold_out', _is_sold_out, _expected_updated_at)
$$;

CREATE OR REPLACE FUNCTION public.set_product_featured(
  _store_id uuid, _id uuid, _is_featured boolean, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT private.set_product_flag(_store_id, _id, 'is_featured', _is_featured, _expected_updated_at)
$$;

CREATE OR REPLACE FUNCTION public.archive_catalog_product(
  _store_id uuid, _id uuid, _archived boolean, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT private.set_product_flag(_store_id, _id, 'is_archived', _archived, _expected_updated_at)
$$;

CREATE OR REPLACE FUNCTION public.move_product_to_category(
  _store_id uuid,
  _id uuid,
  _category_id uuid,
  _expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _row public.products;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);

  SELECT * INTO _row FROM public.products p
   WHERE p.id = _id AND p.store_id = _sid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.assert_version(_expected_updated_at, _row.updated_at);
  PERFORM private.assert_catalog_category_usable(_sid, _category_id);

  UPDATE public.products
     SET category_id = _category_id,
         sort_order  = coalesce((SELECT max(p.sort_order) + 1 FROM public.products p
                                  WHERE p.store_id = _sid AND p.category_id = _category_id
                                    AND NOT p.is_archived), 0)
   WHERE id = _id AND store_id = _sid
  RETURNING * INTO _row;

  PERFORM private.log_config_audit(_sid, 'catalog.product.moved', 'products', _id,
                                   ARRAY['category_id','sort_order']);
  RETURN private.catalog_product_json(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_catalog_products(
  _store_id uuid,
  _category_id uuid,
  _ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _n   int  := coalesce(cardinality(_ids), 0);
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);

  IF _n = 0 OR _category_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001';
  END IF;
  IF _n <> (SELECT count(DISTINCT x) FROM unnest(_ids) x) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001';
  END IF;
  IF _n <> (SELECT count(*) FROM public.products p
             WHERE p.store_id = _sid AND p.category_id = _category_id
               AND NOT p.is_archived AND p.id = ANY (_ids)) THEN
    RAISE EXCEPTION 'INVALID_ORDER' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.products p
     SET sort_order = o.position
    FROM (SELECT id, (ordinality - 1)::int AS position
            FROM unnest(_ids) WITH ORDINALITY AS t(id, ordinality)) o
   WHERE p.id = o.id AND p.store_id = _sid AND p.category_id = _category_id;

  PERFORM private.log_config_audit(_sid, 'catalog.product.reordered', 'products', NULL,
                                   ARRAY['sort_order']);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_product_image(
  _store_id uuid,
  _id uuid,
  _image_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := private.resolve_store(_store_id);
  _row public.products;
BEGIN
  PERFORM private.require_permission('catalog.update', _sid);

  IF _image_path IS NOT NULL AND _image_path !~ ('^' || _sid::text || '/products/' || _id::text || '/[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'INVALID_ASSET_PATH' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.products SET image_path = _image_path
   WHERE id = _id AND store_id = _sid RETURNING * INTO _row;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001'; END IF;

  PERFORM private.log_config_audit(_sid, 'catalog.product.image.updated', 'products', _id,
                                   ARRAY['image_path']);
  RETURN private.catalog_product_json(_row);
END;
$$;

-- ---------- Grants: apenas usuários autenticados ----------
DO $$
DECLARE _fn text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'public.get_my_catalog_overview(uuid)',
    'public.list_my_catalog_categories(uuid, boolean)',
    'public.create_catalog_category(uuid, text, text, boolean)',
    'public.update_catalog_category(uuid, uuid, text, text, boolean, timestamptz)',
    'public.set_catalog_category_active(uuid, uuid, boolean, timestamptz)',
    'public.archive_catalog_category(uuid, uuid, boolean, timestamptz)',
    'public.reorder_catalog_categories(uuid, uuid[])',
    'public.set_catalog_category_image(uuid, uuid, text)',
    'public.list_my_catalog_products(uuid, text, uuid, text, int, int)',
    'public.get_my_catalog_product(uuid, uuid)',
    'public.create_simple_product(uuid, uuid, text, text, numeric, boolean, boolean, boolean, boolean)',
    'public.update_simple_product(uuid, uuid, uuid, text, text, numeric, boolean, timestamptz)',
    'public.set_product_active(uuid, uuid, boolean, timestamptz)',
    'public.set_product_sold_out(uuid, uuid, boolean, timestamptz)',
    'public.set_product_featured(uuid, uuid, boolean, timestamptz)',
    'public.archive_catalog_product(uuid, uuid, boolean, timestamptz)',
    'public.move_product_to_category(uuid, uuid, uuid, timestamptz)',
    'public.reorder_catalog_products(uuid, uuid, uuid[])',
    'public.set_product_image(uuid, uuid, text)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', _fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', _fn);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.set_product_flag(uuid, uuid, text, boolean, timestamptz) FROM PUBLIC;
