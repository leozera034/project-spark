-- SHARK — recomendações por co-compra real
-- Retorna somente produto e força agregada. Nenhum pedido/cliente é exposto.

CREATE OR REPLACE FUNCTION public.storefront_product_recommendations(
  _slug text,
  _product_id uuid,
  _days integer DEFAULT 90,
  _limit integer DEFAULT 4
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
  v_days integer := greatest(14, least(coalesce(_days, 90), 365));
  v_limit integer := greatest(1, least(coalesce(_limit, 4), 8));
BEGIN
  IF v_slug IS NULL OR _product_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT st.id INTO v_store
  FROM public.stores st
  WHERE st.slug = v_slug AND st.status = 'ativa'
  LIMIT 1;

  IF v_store IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = _product_id AND p.store_id = v_store AND p.is_available AND NOT p.is_archived
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce((
    WITH source_orders AS (
      SELECT DISTINCT oi.order_id
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id AND o.store_id = oi.store_id
      WHERE oi.store_id = v_store
        AND oi.product_id = _product_id
        AND o.created_at >= now() - make_interval(days => v_days)
        AND o.status IN ('aceito','em_preparo','pronto','aguardando_entregador','saiu_para_entrega','aguardando_retirada','entregue','retirado')
    ), ranked AS (
      SELECT
        oi.product_id,
        count(DISTINCT oi.order_id)::integer AS together_orders,
        sum(oi.quantity)::numeric AS units
      FROM public.order_items oi
      JOIN source_orders so ON so.order_id = oi.order_id
      JOIN public.products p ON p.id = oi.product_id AND p.store_id = oi.store_id
      WHERE oi.store_id = v_store
        AND oi.product_id IS NOT NULL
        AND oi.product_id <> _product_id
        AND p.is_available
        AND NOT p.is_archived
        AND NOT p.is_sold_out
      GROUP BY oi.product_id
      ORDER BY count(DISTINCT oi.order_id) DESC, sum(oi.quantity) DESC, oi.product_id
      LIMIT v_limit
    )
    SELECT jsonb_agg(jsonb_build_object(
      'product_id', product_id,
      'together_orders', together_orders,
      'units', units
    ) ORDER BY together_orders DESC, units DESC, product_id)
    FROM ranked
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_product_recommendations(text, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_product_recommendations(text, uuid, integer, integer) TO service_role;

COMMENT ON FUNCTION public.storefront_product_recommendations(text, uuid, integer, integer) IS
  'Recomenda produtos agregando co-compras em pedidos confirmados. Server-only e sem dados pessoais.';
