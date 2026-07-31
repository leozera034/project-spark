-- =====================================================================
-- FASE 17 — Modo Cozinha: projeção mínima e ações de preparo
-- =====================================================================

-- 1. Sinais em tempo real visíveis também para a cozinha ---------------
DROP POLICY IF EXISTS "realtime_events_read_own_store" ON public.store_order_realtime_events;
CREATE POLICY "realtime_events_read_own_store"
  ON public.store_order_realtime_events FOR SELECT TO authenticated
  USING (
    private.has_permission('orders.view_queue', store_id)
    OR private.has_permission('kitchen.view', store_id)
  );

-- 2. Índices para as filas da cozinha ----------------------------------
CREATE INDEX IF NOT EXISTS orders_store_status_accepted_idx
  ON public.orders (store_id, status, accepted_at);
CREATE INDEX IF NOT EXISTS order_items_store_order_sort_idx
  ON public.order_items (store_id, order_id, sort_order);

-- 3. Ações permitidas na cozinha (derivadas no servidor) ---------------
CREATE OR REPLACE FUNCTION private.kitchen_allowed_actions(
  _status public.order_status,
  _store_id uuid
) RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  SELECT coalesce(array_agg(a ORDER BY ord), '{}'::text[])
  FROM (
    VALUES
      ('start_preparation', 1, _status = 'aceito'
          AND private.has_permission('kitchen.start_preparation', _store_id)
          AND private.has_permission('orders.start_preparation', _store_id)),
      ('mark_ready', 2, _status = 'em_preparo'
          AND private.has_permission('kitchen.mark_ready', _store_id)
          AND private.has_permission('orders.mark_ready', _store_id))
  ) AS t(a, ord, ok)
  WHERE ok
$function$;

REVOKE ALL ON FUNCTION private.kitchen_allowed_actions(public.order_status, uuid) FROM PUBLIC;

-- 4. Projeção mínima da cozinha ----------------------------------------
-- Sem cliente, telefone, endereço, bairro, modalidade, pagamento, valores,
-- token, idempotência, motivo interno ou entregador.
CREATE OR REPLACE FUNCTION public.list_my_kitchen_orders(_store_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _store uuid;
  _rows  jsonb;
BEGIN
  _store := private.resolve_store(_store_id);
  IF NOT private.has_permission('kitchen.view', _store) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.ord_bucket, t.ord_time, t.ord_id), '[]'::jsonb)
    INTO _rows
  FROM (
    SELECT
      CASE WHEN o.status = 'em_preparo' THEN 0 ELSE 1 END AS ord_bucket,
      coalesce(prep.started_at, o.accepted_at, o.created_at)  AS ord_time,
      o.id                                                    AS ord_id,
      o.id                                                    AS "orderId",
      o.order_number                                          AS "orderNumber",
      o.status::text                                          AS "status",
      o.version                                               AS "version",
      o.created_at                                            AS "createdAt",
      o.accepted_at                                           AS "acceptedAt",
      prep.started_at                                         AS "preparationStartedAt",
      o.eta_minutes                                           AS "estimatedPreparationMinutes",
      now()                                                   AS "serverNow",
      (now() > coalesce(o.accepted_at, o.created_at)
        + make_interval(mins => coalesce(o.eta_minutes, 30)))  AS "isDelayed",
      GREATEST(0, (EXTRACT(EPOCH FROM (
        now() - (coalesce(o.accepted_at, o.created_at)
                 + make_interval(mins => coalesce(o.eta_minutes, 30)))
      )) / 60)::int)                                          AS "delayMinutes",
      CASE
        WHEN now() > coalesce(o.accepted_at, o.created_at)
             + make_interval(mins => coalesce(o.eta_minutes, 30)) THEN 'delayed'
        WHEN now() > coalesce(o.accepted_at, o.created_at)
             + make_interval(secs => (coalesce(o.eta_minutes, 30) * 45)) THEN 'attention'
        ELSE 'normal'
      END                                                     AS "urgencyLevel",
      to_jsonb(private.kitchen_allowed_actions(o.status, o.store_id)) AS "allowedActions",
      coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'itemId',          i.id,
                 'displayOrder',    i.sort_order,
                 'quantity',        i.quantity,
                 'measurementUnit', i.pricing_unit::text,
                 'productName',     i.product_name,
                 'variantName',     i.variant_name,
                 'note',            nullif(btrim(coalesce(i.notes, '')), ''),
                 'optionGroups',    coalesce((
                   SELECT jsonb_agg(jsonb_build_object(
                            'groupName',   g."groupName",
                            'itemName',    g."itemName",
                            'quantity',    g."quantity",
                            'portionLabel', g."portionLabel"
                          ) ORDER BY g."groupName", g."itemName")
                     FROM (
                       SELECT
                         op.group_name  AS "groupName",
                         op.option_name AS "itemName",
                         op.quantity    AS "quantity",
                         CASE
                           WHEN sum(op.quantity) OVER (PARTITION BY op.group_name) > 1
                             THEN op.quantity::text || '/'
                                  || (sum(op.quantity) OVER (PARTITION BY op.group_name))::text
                           ELSE NULL
                         END AS "portionLabel"
                       FROM public.order_item_options op
                      WHERE op.order_item_id = i.id
                        AND op.store_id = i.store_id
                     ) g
                 ), '[]'::jsonb)
               ) ORDER BY i.sort_order, i.id)
          FROM public.order_items i
         WHERE i.order_id = o.id AND i.store_id = o.store_id
      ), '[]'::jsonb)                                         AS "items"
    FROM public.orders o
    LEFT JOIN LATERAL (
      SELECT max(h.created_at) AS started_at
        FROM public.order_status_history h
       WHERE h.order_id = o.id
         AND h.store_id = o.store_id
         AND h.to_status = 'em_preparo'
    ) prep ON true
    WHERE o.store_id = _store
      AND o.status IN ('aceito', 'em_preparo')
  ) t;

  RETURN jsonb_build_object('storeId', _store, 'serverNow', now(), 'orders', _rows);
END;
$function$;

REVOKE ALL ON FUNCTION public.list_my_kitchen_orders(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_kitchen_orders(uuid) TO authenticated;