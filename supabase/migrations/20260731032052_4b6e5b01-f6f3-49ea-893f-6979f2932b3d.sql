-- Remove instrução residual da listagem de produtos (não tinha função alguma).
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

REVOKE ALL ON FUNCTION public.list_my_catalog_products(uuid, text, uuid, text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_catalog_products(uuid, text, uuid, text, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_catalog_products(uuid, text, uuid, text, int, int) TO authenticated;

-- ============================================================
-- Storage privado do catálogo: store-catalog
-- Caminho: {store_id}/categories|products/{entity_id}/{arquivo}
-- ============================================================
CREATE OR REPLACE FUNCTION private.catalog_object_store_id(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE _first text := split_part(coalesce(_name, ''), '/', 1);
BEGIN
  IF _first ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN _first::uuid;
  END IF;
  RETURN NULL;
END;
$$;

DROP POLICY IF EXISTS "catalog_assets_read" ON storage.objects;
CREATE POLICY "catalog_assets_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'store-catalog'
    AND private.has_permission('catalog.view', private.catalog_object_store_id(name))
    AND split_part(name, '/', 2) IN ('categories', 'products')
  );

DROP POLICY IF EXISTS "catalog_assets_insert" ON storage.objects;
CREATE POLICY "catalog_assets_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-catalog'
    AND private.has_permission('catalog.update', private.catalog_object_store_id(name))
    AND split_part(name, '/', 2) IN ('categories', 'products')
    AND lower(right(name, 5)) IN ('.jpeg')
     OR (
       bucket_id = 'store-catalog'
       AND private.has_permission('catalog.update', private.catalog_object_store_id(name))
       AND split_part(name, '/', 2) IN ('categories', 'products')
       AND lower(right(name, 4)) IN ('.png', '.jpg', '.webp')
     )
  );

DROP POLICY IF EXISTS "catalog_assets_update" ON storage.objects;
CREATE POLICY "catalog_assets_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-catalog'
    AND private.has_permission('catalog.update', private.catalog_object_store_id(name))
  )
  WITH CHECK (
    bucket_id = 'store-catalog'
    AND private.has_permission('catalog.update', private.catalog_object_store_id(name))
  );

DROP POLICY IF EXISTS "catalog_assets_delete" ON storage.objects;
CREATE POLICY "catalog_assets_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-catalog'
    AND private.has_permission('catalog.update', private.catalog_object_store_id(name))
  );
