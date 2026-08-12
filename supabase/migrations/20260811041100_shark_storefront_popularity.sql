-- SHARK — ranking público agregado de popularidade
-- Não expõe pedidos/clientes: retorna somente produto, unidades e quantidade de pedidos.

CREATE OR REPLACE FUNCTION public.storefront_popular_products(
  _slug text,
  _days integer DEFAULT 60,
  _limit integer DEFAULT 8
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
  v_days integer := greatest(7, least(coalesce(_days, 60), 180));
  v_limit integer := greatest(1, least(coalesce(_limit, 8), 20));
BEGIN
  IF v_slug IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT st.id
    INTO v_store
    FROM public.stores st
   WHERE st.slug = v_slug
     AND st.status = 'ativa'
   LIMIT 1;

  IF v_store IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'product_id', ranked.product_id,
        'units', ranked.units,
        'order_count', ranked.order_count
      )
      ORDER BY ranked.units DESC, ranked.order_count DESC, ranked.product_id
    )
    FROM (
      SELECT
        oi.product_id,
        sum(oi.quantity)::numeric AS units,
        count(DISTINCT oi.order_id)::integer AS order_count
      FROM public.order_items oi
      JOIN public.orders o
        ON o.id = oi.order_id
       AND o.store_id = oi.store_id
      JOIN public.products p
        ON p.id = oi.product_id
       AND p.store_id = oi.store_id
      WHERE oi.store_id = v_store
        AND oi.product_id IS NOT NULL
        AND o.created_at >= now() - make_interval(days => v_days)
        AND o.status IN (
          'aceito',
          'em_preparo',
          'pronto',
          'aguardando_entregador',
          'saiu_para_entrega',
          'aguardando_retirada',
          'entregue',
          'retirado'
        )
        AND p.is_available
        AND NOT p.is_archived
      GROUP BY oi.product_id
      ORDER BY sum(oi.quantity) DESC, count(DISTINCT oi.order_id) DESC, oi.product_id
      LIMIT v_limit
    ) ranked
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_popular_products(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_popular_products(text, integer, integer) TO service_role;

COMMENT ON FUNCTION public.storefront_popular_products(text, integer, integer) IS
  'Ranking agregado e privacy-safe de produtos realmente pedidos. Uso server-only pelo storefront.';
