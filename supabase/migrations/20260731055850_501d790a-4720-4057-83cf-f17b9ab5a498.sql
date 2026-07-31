-- ============================================================
-- Fase 15 — Acompanhamento público seguro do pedido
-- 1) Token de acompanhamento passa a ser guardado somente como hash SHA-256
-- 2) Função privada de projeção pública (somente leitura)
-- Rollback documentado em docs/PHASE_15_REPORT.md
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_token_hash text;

UPDATE public.orders
   SET tracking_token_hash = encode(sha256(convert_to(public_tracking_token, 'UTF8')), 'hex')
 WHERE tracking_token_hash IS NULL
   AND public_tracking_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_hash_key
  ON public.orders (tracking_token_hash);

-- O token bruto deixa de ser persistido. A coluna permanece (nullable, sem
-- default) apenas para não quebrar pedidos históricos e permitir rollback.
ALTER TABLE public.orders ALTER COLUMN public_tracking_token DROP DEFAULT;
ALTER TABLE public.orders ALTER COLUMN public_tracking_token DROP NOT NULL;
UPDATE public.orders SET public_tracking_token = NULL WHERE public_tracking_token IS NOT NULL;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_tracking_token_key;

-- ------------------------------------------------------------
-- Mapa: enum interno -> código público (o enum nunca sai do banco)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.public_order_status_code(_status public.order_status)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, private
AS $$
  SELECT CASE _status
    WHEN 'aguardando_confirmacao' THEN 'received'
    WHEN 'aceito'                 THEN 'confirmed'
    WHEN 'em_preparo'             THEN 'preparing'
    WHEN 'pronto'                 THEN 'ready'
    WHEN 'aguardando_entregador'  THEN 'waiting_delivery'
    WHEN 'saiu_para_entrega'      THEN 'out_for_delivery'
    WHEN 'aguardando_retirada'    THEN 'ready_for_pickup'
    WHEN 'entregue'               THEN 'delivered'
    WHEN 'retirado'               THEN 'picked_up'
    WHEN 'recusado'               THEN 'declined'
    WHEN 'cancelado'              THEN 'canceled'
    ELSE 'unknown'
  END
$$;

-- ------------------------------------------------------------
-- Projeção pública do pedido a partir do hash do token
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_public_order_tracking(
  _token_hash text,
  _known_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_order    public.orders;
  v_store    public.stores;
  v_settings public.store_settings;
  v_version  text;
  v_code     text;
  v_last     timestamptz;
  v_items    jsonb;
  v_timeline jsonb;
BEGIN
  IF _token_hash IS NULL OR _token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT * INTO v_order FROM public.orders o
   WHERE o.tracking_token_hash = _token_hash
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT * INTO v_store FROM public.stores s WHERE s.id = v_order.store_id;
  SELECT * INTO v_settings FROM public.store_settings ss WHERE ss.store_id = v_order.store_id;

  SELECT max(h.created_at) INTO v_last
    FROM public.order_status_history h
   WHERE h.order_id = v_order.id;

  v_last := greatest(coalesce(v_last, v_order.updated_at), v_order.updated_at);
  v_code := private.public_order_status_code(v_order.status);
  v_version := encode(
    sha256(convert_to(v_order.status::text || '|' || v_last::text, 'UTF8')), 'hex'
  );

  IF _known_version IS NOT NULL AND _known_version = v_version THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'statusVersion', v_version);
  END IF;

  SELECT coalesce(jsonb_agg(item ORDER BY item->>'sortOrder'), '[]'::jsonb) INTO v_items
  FROM (
    SELECT jsonb_build_object(
             'sortOrder', lpad(oi.sort_order::text, 6, '0'),
             'productName', oi.product_name,
             'variantName', oi.variant_name,
             'quantity', oi.quantity,
             'measurementUnit', oi.pricing_unit::text,
             'note', oi.notes,
             'lineTotal', oi.line_total,
             'options', coalesce((
               SELECT jsonb_agg(jsonb_build_object(
                        'groupName', oo.group_name,
                        'optionName', oo.option_name,
                        'quantity', oo.quantity
                      ) ORDER BY oo.group_name, oo.option_name)
                 FROM public.order_item_options oo
                WHERE oo.order_item_id = oi.id AND oo.store_id = oi.store_id
             ), '[]'::jsonb)
           ) AS item
      FROM public.order_items oi
     WHERE oi.order_id = v_order.id AND oi.store_id = v_order.store_id
  ) s;

  SELECT coalesce(jsonb_agg(entry ORDER BY (entry->>'occurredAt')::timestamptz), '[]'::jsonb)
    INTO v_timeline
  FROM (
    SELECT DISTINCT ON (private.public_order_status_code(h.to_status))
           jsonb_build_object(
             'code', private.public_order_status_code(h.to_status),
             'occurredAt', h.created_at
           ) AS entry
      FROM public.order_status_history h
     WHERE h.order_id = v_order.id AND h.store_id = v_order.store_id
     ORDER BY private.public_order_status_code(h.to_status), h.created_at
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'changed', true,
    'statusVersion', v_version,
    'orderNumber', v_order.order_number,
    'createdAt', v_order.created_at,
    'lastUpdatedAt', v_last,
    'store', jsonb_build_object(
      'slug', v_store.slug,
      'name', v_store.name,
      'logoPath', v_settings.logo_path,
      'publicPhone', v_store.phone,
      'publicWhatsapp', v_store.whatsapp
    ),
    'status', jsonb_build_object(
      'publicCode', v_code,
      'isFinal', v_code IN ('delivered', 'picked_up', 'declined', 'canceled'),
      'isSuccessful', v_code IN ('delivered', 'picked_up')
    ),
    'fulfillment', jsonb_build_object(
      'type', v_order.fulfillment::text,
      'neighborhoodName', v_order.neighborhood_snapshot,
      'estimatedMinutes', v_order.eta_minutes
    ),
    'items', v_items,
    'totals', jsonb_build_object(
      'subtotal', v_order.items_subtotal,
      'deliveryFee', v_order.delivery_fee,
      'total', v_order.total_amount
    ),
    'payment', jsonb_build_object(
      'displayName', v_order.payment_method_label,
      'publicInstructions', v_order.payment_instructions,
      'changeFor', v_order.change_for
    ),
    'timeline', v_timeline
  );
END;
$$;

REVOKE ALL ON FUNCTION private.get_public_order_tracking(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.public_order_status_code(public.order_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_public_order_tracking(text, text) TO service_role;

-- Ponte pública mínima: apenas o service_role do servidor pode chamar.
CREATE OR REPLACE FUNCTION public.storefront_order_tracking(
  _token_hash text,
  _known_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.get_public_order_tracking(_token_hash, _known_version)
$$;

REVOKE ALL ON FUNCTION public.storefront_order_tracking(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_order_tracking(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_order_tracking(text, text) TO service_role;
