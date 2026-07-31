-- =====================================================================
-- FASE 16 — Painel real de pedidos da loja
-- =====================================================================

-- 1. Colunas de estado operacional -------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS customer_visible_message text;

ALTER TABLE public.order_status_history
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS customer_visible_message text;

-- 2. Catálogo controlado de motivos ------------------------------------
CREATE TABLE IF NOT EXISTS public.order_transition_reasons (
  code            text PRIMARY KEY,
  internal_label  text NOT NULL,
  public_message  text NOT NULL,
  applies_reject  boolean NOT NULL DEFAULT false,
  applies_cancel  boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_transition_reasons TO authenticated;
GRANT ALL    ON public.order_transition_reasons TO service_role;
ALTER TABLE public.order_transition_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reasons_read_authenticated" ON public.order_transition_reasons;
CREATE POLICY "reasons_read_authenticated"
  ON public.order_transition_reasons FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND is_active);

INSERT INTO public.order_transition_reasons
  (code, internal_label, public_message, applies_reject, applies_cancel, sort_order)
VALUES
  ('store_unavailable',   'Loja indisponível no momento',      'A loja não pôde atender este pedido agora.',            true,  true,  10),
  ('item_unavailable',    'Item sem disponibilidade',          'Um item do pedido ficou indisponível.',                 true,  true,  20),
  ('delivery_unavailable','Entrega indisponível para o endereço','Não foi possível entregar no endereço informado.',    true,  true,  30),
  ('unable_to_prepare',   'Não foi possível preparar',         'A loja não conseguiu preparar este pedido.',            true,  true,  40),
  ('customer_request',    'Pedido do cliente',                 'O pedido foi cancelado a pedido do cliente.',           false, true,  50),
  ('duplicate_order',     'Pedido duplicado',                  'Este pedido foi identificado como duplicado.',          true,  true,  60),
  ('payment_issue',       'Problema com o pagamento',          'Houve um problema com a forma de pagamento escolhida.', true,  true,  70),
  ('other',               'Outro motivo',                      'A loja não pôde seguir com este pedido.',               true,  true,  90)
ON CONFLICT (code) DO NOTHING;

-- 3. Sinais mínimos de tempo real --------------------------------------
CREATE TABLE IF NOT EXISTS public.store_order_realtime_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id       uuid NOT NULL,
  event_type     text NOT NULL,
  status_version integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '2 hours'
);

CREATE INDEX IF NOT EXISTS store_order_realtime_events_store_created_idx
  ON public.store_order_realtime_events (store_id, created_at DESC);

GRANT SELECT ON public.store_order_realtime_events TO authenticated;
GRANT ALL    ON public.store_order_realtime_events TO service_role;
ALTER TABLE public.store_order_realtime_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_events_read_own_store" ON public.store_order_realtime_events;
CREATE POLICY "realtime_events_read_own_store"
  ON public.store_order_realtime_events FOR SELECT TO authenticated
  USING (private.has_permission('orders.view_queue', store_id));

ALTER TABLE public.store_order_realtime_events REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'store_order_realtime_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.store_order_realtime_events';
  END IF;
END$$;

-- 4. Índices operacionais ----------------------------------------------
CREATE INDEX IF NOT EXISTS orders_store_status_created_idx      ON public.orders (store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_store_fulfillment_status_idx  ON public.orders (store_id, fulfillment, status);
CREATE INDEX IF NOT EXISTS orders_store_number_idx              ON public.orders (store_id, order_number);
CREATE INDEX IF NOT EXISTS orders_store_updated_idx             ON public.orders (store_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS order_items_store_order_idx          ON public.order_items (store_id, order_id);
CREATE INDEX IF NOT EXISTS order_item_options_store_item_idx    ON public.order_item_options (store_id, order_item_id);
CREATE INDEX IF NOT EXISTS order_status_history_store_order_idx ON public.order_status_history (store_id, order_id, created_at);

-- 5. Permissões novas ---------------------------------------------------
CREATE OR REPLACE FUNCTION private.permission_roles(_permission app_permission)
 RETURNS app_role[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE _permission
    WHEN 'store.view_basic'              THEN ARRAY['proprietario','gerente','atendente','cozinha']::public.app_role[]
    WHEN 'store.update_profile'          THEN ARRAY['proprietario']::public.app_role[]
    WHEN 'store.manage_settings'         THEN ARRAY['proprietario','gerente']::public.app_role[]
    WHEN 'store.manage_hours'            THEN ARRAY['proprietario','gerente']::public.app_role[]
    WHEN 'store.manage_neighborhoods'    THEN ARRAY['proprietario','gerente']::public.app_role[]
    WHEN 'store.manage_payment_methods'  THEN ARRAY['proprietario','gerente']::public.app_role[]

    WHEN 'catalog.view'                  THEN ARRAY['proprietario','gerente','atendente','cozinha']::public.app_role[]
    WHEN 'catalog.create'                THEN ARRAY['proprietario','gerente']::public.app_role[]
    WHEN 'catalog.update'                THEN ARRAY['proprietario','gerente']::public.app_role[]
    WHEN 'catalog.archive'               THEN ARRAY['proprietario','gerente']::public.app_role[]

    WHEN 'orders.view_queue'             THEN ARRAY['proprietario','gerente','atendente']::public.app_role[]
    WHEN 'orders.view_customer_contact'  THEN ARRAY['proprietario','gerente','atendente']::public.app_role[]
    WHEN 'orders.view_history'           THEN ARRAY['proprietario','gerente','atendente']::public.app_role[]
    WHEN 'orders.accept'                 THEN ARRAY['proprietario','gerente','atendente']::public.app_role[]
    WHEN 'orders.reject'                 THEN ARRAY['proprietario','gerente','atendente']::public.app_role[]
    WHEN 'orders.start_preparation'      THEN ARRAY['proprietario','gerente','atendente','cozinha']::public.app_role[]
    WHEN 'orders.mark_ready'             THEN ARRAY['proprietario','gerente','atendente','cozinha']::public.app_role[]
    WHEN 'orders.complete_pickup'        THEN ARRAY['proprietario','gerente','atendente']::public.app_role[]
    WHEN 'orders.cancel'                 THEN ARRAY['proprietario','gerente']::public.app_role[]

    WHEN 'kitchen.view'                  THEN ARRAY['proprietario','gerente','cozinha']::public.app_role[]
    WHEN 'kitchen.start_preparation'     THEN ARRAY['proprietario','gerente','cozinha']::public.app_role[]
    WHEN 'kitchen.mark_ready'            THEN ARRAY['proprietario','gerente','cozinha']::public.app_role[]

    WHEN 'team.view'                     THEN ARRAY['proprietario','gerente']::public.app_role[]
    WHEN 'team.invite'                   THEN ARRAY['proprietario']::public.app_role[]
    WHEN 'team.change_role'              THEN ARRAY['proprietario']::public.app_role[]
    WHEN 'team.disable'                  THEN ARRAY['proprietario']::public.app_role[]

    WHEN 'couriers.view'                 THEN ARRAY['proprietario','gerente','atendente']::public.app_role[]
    WHEN 'couriers.create'               THEN ARRAY['proprietario','gerente']::public.app_role[]
    WHEN 'couriers.update'               THEN ARRAY['proprietario','gerente']::public.app_role[]
    WHEN 'couriers.assign'               THEN ARRAY['proprietario','gerente','atendente']::public.app_role[]
    WHEN 'couriers.reset_access'         THEN ARRAY['proprietario','gerente']::public.app_role[]

    WHEN 'courier.view_self'                THEN ARRAY['entregador']::public.app_role[]
    WHEN 'courier.view_offered_deliveries'  THEN ARRAY['entregador']::public.app_role[]
    WHEN 'courier.view_assigned_delivery'   THEN ARRAY['entregador']::public.app_role[]
    WHEN 'courier.update_delivery_status'   THEN ARRAY['entregador']::public.app_role[]
    WHEN 'courier.register_incident'        THEN ARRAY['entregador']::public.app_role[]

    WHEN 'reports.view_operational'      THEN ARRAY['proprietario','gerente']::public.app_role[]
    WHEN 'subscription.view'             THEN ARRAY['proprietario']::public.app_role[]

    WHEN 'platform.stores.view'              THEN ARRAY['admin_plataforma']::public.app_role[]
    WHEN 'platform.stores.create'            THEN ARRAY['admin_plataforma']::public.app_role[]
    WHEN 'platform.stores.update'            THEN ARRAY['admin_plataforma']::public.app_role[]
    WHEN 'platform.stores.suspend'           THEN ARRAY['admin_plataforma']::public.app_role[]
    WHEN 'platform.stores.reactivate'        THEN ARRAY['admin_plataforma']::public.app_role[]
    WHEN 'platform.plans.view'               THEN ARRAY['admin_plataforma']::public.app_role[]
    WHEN 'platform.plans.manage'             THEN ARRAY['admin_plataforma']::public.app_role[]
    WHEN 'platform.billing.view'             THEN ARRAY['admin_plataforma']::public.app_role[]
    WHEN 'platform.billing.register_payment' THEN ARRAY['admin_plataforma']::public.app_role[]
    WHEN 'platform.audit.view'               THEN ARRAY['admin_plataforma']::public.app_role[]
    WHEN 'platform.support.open_context'     THEN ARRAY['admin_plataforma']::public.app_role[]
    ELSE '{}'::public.app_role[]
  END
$function$;

-- 6. Ações permitidas derivadas do estado real -------------------------
CREATE OR REPLACE FUNCTION private.order_allowed_actions(
  _status public.order_status,
  _fulfillment public.fulfillment_type,
  _store_id uuid
) RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  SELECT coalesce(array_agg(a ORDER BY ord), '{}'::text[])
  FROM (
    VALUES
      ('accept',            1, _status = 'aguardando_confirmacao' AND private.has_permission('orders.accept', _store_id)),
      ('start_preparation', 2, _status = 'aceito'                 AND private.has_permission('orders.start_preparation', _store_id)),
      ('mark_ready',        3, _status = 'em_preparo'             AND private.has_permission('orders.mark_ready', _store_id)),
      ('complete_pickup',   4, _status = 'aguardando_retirada' AND _fulfillment = 'retirada'
                                                                  AND private.has_permission('orders.complete_pickup', _store_id)),
      ('reject',            5, _status = 'aguardando_confirmacao' AND private.has_permission('orders.reject', _store_id)),
      ('cancel',            6, _status IN ('aguardando_confirmacao','aceito','em_preparo','pronto','aguardando_retirada','aguardando_entregador')
                                                                  AND private.has_permission('orders.cancel', _store_id))
  ) AS t(a, ord, ok)
  WHERE ok
$function$;

REVOKE ALL ON FUNCTION private.order_allowed_actions(public.order_status, public.fulfillment_type, uuid) FROM PUBLIC;

-- 7. Helper privado de transição ---------------------------------------
CREATE OR REPLACE FUNCTION private.transition_store_order(
  _store_id uuid,
  _order_id uuid,
  _action text,
  _expected_version integer,
  _reason_code text DEFAULT NULL,
  _internal_note text DEFAULT NULL,
  _customer_message text DEFAULT NULL
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _uid        uuid := auth.uid();
  _store      uuid;
  _perm       public.app_permission;
  _from       public.order_status;
  _to         public.order_status;
  _fulfil     public.fulfillment_type;
  _order      public.orders;
  _updated    public.orders;
  _needs_reason boolean := _action IN ('reject','cancel');
  _reason     public.order_transition_reasons;
  _note       text;
  _message    text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  _store := private.resolve_store(_store_id);

  _perm := CASE _action
    WHEN 'accept'            THEN 'orders.accept'
    WHEN 'reject'            THEN 'orders.reject'
    WHEN 'start_preparation' THEN 'orders.start_preparation'
    WHEN 'mark_ready'        THEN 'orders.mark_ready'
    WHEN 'complete_pickup'   THEN 'orders.complete_pickup'
    WHEN 'cancel'            THEN 'orders.cancel'
    ELSE NULL
  END::public.app_permission;

  IF _perm IS NULL THEN
    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = 'P0001';
  END IF;
  IF NOT private.has_permission(_perm, _store) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _order FROM public.orders o
   WHERE o.id = _order_id AND o.store_id = _store;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  _from   := _order.status;
  _fulfil := _order.fulfillment;

  IF _expected_version IS NULL OR _expected_version <> _order.version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  -- Destino escolhido pelo servidor, nunca pelo cliente.
  _to := CASE
    WHEN _action = 'accept'            AND _from = 'aguardando_confirmacao' THEN 'aceito'
    WHEN _action = 'reject'            AND _from = 'aguardando_confirmacao' THEN 'recusado'
    WHEN _action = 'start_preparation' AND _from = 'aceito'                 THEN 'em_preparo'
    WHEN _action = 'mark_ready'        AND _from = 'em_preparo' AND _fulfil = 'retirada' THEN 'aguardando_retirada'
    WHEN _action = 'mark_ready'        AND _from = 'em_preparo' AND _fulfil = 'entrega'  THEN 'pronto'
    WHEN _action = 'complete_pickup'   AND _from = 'aguardando_retirada' AND _fulfil = 'retirada' THEN 'retirado'
    WHEN _action = 'cancel'            AND _from IN ('aguardando_confirmacao','aceito','em_preparo','pronto','aguardando_retirada','aguardando_entregador') THEN 'cancelado'
    ELSE NULL
  END::public.order_status;

  IF _to IS NULL THEN
    RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'P0001';
  END IF;

  IF _needs_reason THEN
    IF _reason_code IS NULL THEN
      RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO _reason FROM public.order_transition_reasons r
     WHERE r.code = _reason_code AND r.is_active
       AND ((_action = 'reject' AND r.applies_reject) OR (_action = 'cancel' AND r.applies_cancel));
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  _note := nullif(btrim(coalesce(_internal_note, '')), '');
  IF _note IS NOT NULL AND length(_note) > 500 THEN
    RAISE EXCEPTION 'INVALID_INTERNAL_NOTE' USING ERRCODE = 'P0001';
  END IF;

  _message := nullif(btrim(coalesce(_customer_message, '')), '');
  IF _message IS NOT NULL THEN
    IF length(_message) > 160 OR _message ~ '[<>]' THEN
      RAISE EXCEPTION 'INVALID_PUBLIC_MESSAGE' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF _needs_reason AND _message IS NULL THEN
    _message := _reason.public_message;
  END IF;

  UPDATE public.orders o
     SET status = _to,
         version = o.version + 1,
         updated_at = now(),
         reason_code = CASE WHEN _needs_reason THEN _reason_code ELSE o.reason_code END,
         internal_note = coalesce(_note, o.internal_note),
         customer_visible_message = CASE WHEN _needs_reason THEN _message ELSE o.customer_visible_message END,
         accepted_at = CASE WHEN _to = 'aceito' THEN now() ELSE o.accepted_at END,
         ready_at    = CASE WHEN _to IN ('pronto','aguardando_retirada') THEN now() ELSE o.ready_at END,
         finished_at = CASE WHEN _to IN ('retirado','recusado','cancelado') THEN now() ELSE o.finished_at END,
         rejection_reason    = CASE WHEN _to = 'recusado'  THEN _reason_code ELSE o.rejection_reason END,
         cancellation_reason = CASE WHEN _to = 'cancelado' THEN _reason_code ELSE o.cancellation_reason END
   WHERE o.id = _order_id
     AND o.store_id = _store
     AND o.version = _expected_version
     AND o.status = _from
  RETURNING * INTO _updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.order_status_history
    (store_id, order_id, from_status, to_status, actor_kind, actor_user_id,
     reason, action, reason_code, internal_note, customer_visible_message)
  VALUES
    (_store, _order_id, _from, _to, 'loja', _uid,
     CASE WHEN _needs_reason THEN _reason_code ELSE NULL END,
     _action,
     CASE WHEN _needs_reason THEN _reason_code ELSE NULL END,
     _note,
     CASE WHEN _needs_reason THEN _message ELSE NULL END);

  INSERT INTO public.audit_logs
    (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES
    (_store, _uid, 'loja',
     CASE _action
       WHEN 'accept'            THEN 'order.accepted'
       WHEN 'reject'            THEN 'order.rejected'
       WHEN 'start_preparation' THEN 'order.preparation_started'
       WHEN 'mark_ready'        THEN 'order.marked_ready'
       WHEN 'complete_pickup'   THEN 'order.pickup_completed'
       WHEN 'cancel'            THEN 'order.canceled'
     END,
     'orders', _order_id,
     jsonb_build_object(
       'fromStatus', _from::text,
       'toStatus', _to::text,
       'reasonCode', CASE WHEN _needs_reason THEN _reason_code ELSE NULL END,
       'version', _updated.version
     ));

  INSERT INTO public.store_order_realtime_events
    (store_id, order_id, event_type, status_version)
  VALUES (_store, _order_id, 'order.status_changed', _updated.version);

  DELETE FROM public.store_order_realtime_events e
   WHERE e.store_id = _store AND e.expires_at < now();

  RETURN jsonb_build_object(
    'ok', true,
    'orderId', _order_id,
    'status', _to::text,
    'version', _updated.version,
    'allowedActions', to_jsonb(private.order_allowed_actions(_to, _fulfil, _store))
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.transition_store_order(uuid, uuid, text, integer, text, text, text) FROM PUBLIC;

-- 8. Wrappers públicos de escrita --------------------------------------
CREATE OR REPLACE FUNCTION public.accept_store_order(
  _store_id uuid, _order_id uuid, _expected_version integer, _internal_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp' AS $function$
  SELECT private.transition_store_order(_store_id, _order_id, 'accept', _expected_version, NULL, _internal_note, NULL)
$function$;

CREATE OR REPLACE FUNCTION public.start_store_order_preparation(
  _store_id uuid, _order_id uuid, _expected_version integer, _internal_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp' AS $function$
  SELECT private.transition_store_order(_store_id, _order_id, 'start_preparation', _expected_version, NULL, _internal_note, NULL)
$function$;

CREATE OR REPLACE FUNCTION public.mark_store_order_ready(
  _store_id uuid, _order_id uuid, _expected_version integer, _internal_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp' AS $function$
  SELECT private.transition_store_order(_store_id, _order_id, 'mark_ready', _expected_version, NULL, _internal_note, NULL)
$function$;

CREATE OR REPLACE FUNCTION public.complete_store_pickup_order(
  _store_id uuid, _order_id uuid, _expected_version integer, _internal_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp' AS $function$
  SELECT private.transition_store_order(_store_id, _order_id, 'complete_pickup', _expected_version, NULL, _internal_note, NULL)
$function$;

CREATE OR REPLACE FUNCTION public.reject_store_order(
  _store_id uuid, _order_id uuid, _expected_version integer,
  _reason_code text, _internal_note text DEFAULT NULL, _customer_message text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp' AS $function$
  SELECT private.transition_store_order(_store_id, _order_id, 'reject', _expected_version, _reason_code, _internal_note, _customer_message)
$function$;

CREATE OR REPLACE FUNCTION public.cancel_store_order(
  _store_id uuid, _order_id uuid, _expected_version integer,
  _reason_code text, _internal_note text DEFAULT NULL, _customer_message text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','private','pg_temp' AS $function$
  SELECT private.transition_store_order(_store_id, _order_id, 'cancel', _expected_version, _reason_code, _internal_note, _customer_message)
$function$;

REVOKE ALL ON FUNCTION public.accept_store_order(uuid,uuid,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_store_order_preparation(uuid,uuid,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_store_order_ready(uuid,uuid,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_store_pickup_order(uuid,uuid,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_store_order(uuid,uuid,integer,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_store_order(uuid,uuid,integer,text,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_store_order(uuid,uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_store_order_preparation(uuid,uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_store_order_ready(uuid,uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_store_pickup_order(uuid,uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_store_order(uuid,uuid,integer,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_store_order(uuid,uuid,integer,text,text,text) TO authenticated;

-- 9. Projeções de leitura ----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_store_order_counts(_store_id uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public','private','pg_temp'
AS $function$
DECLARE _store uuid; _out jsonb;
BEGIN
  _store := private.resolve_store(_store_id);
  IF NOT private.has_permission('orders.view_queue', _store) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_object_agg(k, n) INTO _out FROM (
    SELECT o.status::text AS k, count(*) AS n
      FROM public.orders o
     WHERE o.store_id = _store
       AND (o.status NOT IN ('entregue','retirado','recusado','cancelado')
            OR o.created_at > now() - interval '2 days')
     GROUP BY o.status
  ) s;

  RETURN jsonb_build_object('storeId', _store, 'byStatus', coalesce(_out, '{}'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_store_orders(
  _store_id uuid DEFAULT NULL,
  _statuses text[] DEFAULT NULL,
  _fulfillment text DEFAULT NULL,
  _search text DEFAULT NULL,
  _delayed_only boolean DEFAULT false,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit integer DEFAULT 30,
  _cursor timestamptz DEFAULT NULL,
  _cursor_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public','private','pg_temp'
AS $function$
DECLARE
  _store uuid;
  _lim   integer := least(greatest(coalesce(_limit, 30), 1), 50);
  _q     text    := nullif(btrim(coalesce(_search, '')), '');
  _num   integer := NULL;
  _rows  jsonb;
BEGIN
  _store := private.resolve_store(_store_id);
  IF NOT private.has_permission('orders.view_queue', _store) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  IF _q IS NOT NULL AND _q ~ '^[0-9]+$' AND length(_q) <= 9 THEN
    _num := _q::integer;
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.ord), '[]'::jsonb) INTO _rows
  FROM (
    SELECT
      o.created_at AS ord,
      o.id                        AS "id",
      o.order_number              AS "orderNumber",
      o.created_at                AS "createdAt",
      o.updated_at                AS "updatedAt",
      o.status::text              AS "status",
      private.public_order_status_code(o.status) AS "publicCode",
      o.fulfillment::text         AS "fulfillment",
      split_part(btrim(o.customer_name), ' ', 1) AS "customerFirstName",
      (SELECT count(*) FROM public.order_items i WHERE i.order_id = o.id AND i.store_id = o.store_id) AS "itemCount",
      o.total_amount              AS "total",
      o.payment_method_label      AS "paymentLabel",
      o.eta_minutes               AS "etaMinutes",
      o.version                   AS "version",
      (o.status NOT IN ('entregue','retirado','recusado','cancelado')
        AND o.eta_minutes IS NOT NULL
        AND now() > o.created_at + make_interval(mins => o.eta_minutes + 10)) AS "isDelayed",
      GREATEST(0, (EXTRACT(EPOCH FROM (now() - o.created_at)) / 60)::int - coalesce(o.eta_minutes, 0) - 10) AS "delayMinutes",
      to_jsonb(private.order_allowed_actions(o.status, o.fulfillment, o.store_id)) AS "allowedActions"
    FROM public.orders o
    WHERE o.store_id = _store
      AND (_statuses IS NULL OR o.status::text = ANY (_statuses))
      AND (_fulfillment IS NULL OR o.fulfillment::text = _fulfillment)
      AND (_from IS NULL OR o.created_at >= _from)
      AND (_to   IS NULL OR o.created_at <= _to)
      AND (_cursor IS NULL OR (o.created_at, o.id) < (_cursor, coalesce(_cursor_id, o.id)))
      AND (
        _q IS NULL
        OR (_num IS NOT NULL AND o.order_number = _num)
        OR o.customer_name ILIKE '%' || _q || '%'
        OR (length(_q) >= 4 AND regexp_replace(o.customer_phone, '\D', '', 'g') LIKE '%' || regexp_replace(_q, '\D', '', 'g') || '%'
            AND private.has_permission('orders.view_customer_contact', _store))
      )
      AND (
        NOT coalesce(_delayed_only, false)
        OR (o.status NOT IN ('entregue','retirado','recusado','cancelado')
            AND o.eta_minutes IS NOT NULL
            AND now() > o.created_at + make_interval(mins => o.eta_minutes + 10))
      )
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT _lim
  ) t;

  RETURN jsonb_build_object('storeId', _store, 'orders', _rows, 'limit', _lim);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_store_order_detail(_store_id uuid, _order_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public','private','pg_temp'
AS $function$
DECLARE
  _store uuid;
  _o     public.orders;
  _items jsonb;
  _contact boolean;
BEGIN
  _store := private.resolve_store(_store_id);
  IF NOT private.has_permission('orders.view_queue', _store) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _o FROM public.orders o WHERE o.id = _order_id AND o.store_id = _store;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  _contact := private.has_permission('orders.view_customer_contact', _store);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'productName', i.product_name,
           'variantName', i.variant_name,
           'quantity', i.quantity,
           'pricingUnit', i.pricing_unit::text,
           'unitPrice', i.unit_price,
           'lineTotal', i.line_total,
           'notes', i.notes,
           'options', coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'groupName', op.group_name,
                      'optionName', op.option_name,
                      'quantity', op.quantity
                    ) ORDER BY op.group_name, op.option_name)
               FROM public.order_item_options op
              WHERE op.order_item_id = i.id AND op.store_id = i.store_id), '[]'::jsonb)
         ) ORDER BY i.sort_order), '[]'::jsonb) INTO _items
    FROM public.order_items i
   WHERE i.order_id = _o.id AND i.store_id = _store;

  RETURN jsonb_build_object(
    'id', _o.id,
    'orderNumber', _o.order_number,
    'createdAt', _o.created_at,
    'updatedAt', _o.updated_at,
    'status', _o.status::text,
    'publicCode', private.public_order_status_code(_o.status),
    'fulfillment', _o.fulfillment::text,
    'version', _o.version,
    'etaMinutes', _o.eta_minutes,
    'customer', jsonb_build_object(
      'firstName', split_part(btrim(_o.customer_name), ' ', 1),
      'fullName', CASE WHEN _contact THEN _o.customer_name ELSE NULL END,
      'phone', CASE WHEN _contact THEN coalesce(_o.customer_phone_display, _o.customer_phone) ELSE NULL END
    ),
    'delivery', CASE WHEN _o.fulfillment = 'entrega'
      THEN jsonb_build_object(
        'neighborhood', _o.neighborhood_snapshot,
        'address', CASE WHEN _contact THEN _o.address_snapshot ELSE NULL END)
      ELSE NULL END,
    'items', _items,
    'notes', _o.customer_notes,
    'payment', jsonb_build_object(
      'label', _o.payment_method_label,
      'kind', _o.payment_method_kind,
      'changeFor', _o.change_for,
      'needsChange', _o.payment_needs_change,
      'instructions', _o.payment_instructions
    ),
    'totals', jsonb_build_object(
      'subtotal', _o.items_subtotal,
      'deliveryFee', _o.delivery_fee,
      'discount', _o.discount_total,
      'total', _o.total_amount
    ),
    'resolution', jsonb_build_object(
      'reasonCode', _o.reason_code,
      'internalNote', _o.internal_note,
      'customerMessage', _o.customer_visible_message
    ),
    'isDelayed', (_o.status NOT IN ('entregue','retirado','recusado','cancelado')
                  AND _o.eta_minutes IS NOT NULL
                  AND now() > _o.created_at + make_interval(mins => _o.eta_minutes + 10)),
    'allowedActions', to_jsonb(private.order_allowed_actions(_o.status, _o.fulfillment, _store))
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_store_order_history(_store_id uuid, _order_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public','private','pg_temp'
AS $function$
DECLARE _store uuid; _rows jsonb;
BEGIN
  _store := private.resolve_store(_store_id);
  IF NOT private.has_permission('orders.view_history', _store) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = _order_id AND o.store_id = _store) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'occurredAt', h.created_at,
           'fromStatus', h.from_status::text,
           'toStatus', h.to_status::text,
           'action', h.action,
           'actorKind', h.actor_kind,
           'actorName', p.full_name,
           'reasonCode', h.reason_code,
           'internalNote', h.internal_note,
           'customerMessage', h.customer_visible_message
         ) ORDER BY h.created_at), '[]'::jsonb) INTO _rows
    FROM public.order_status_history h
    LEFT JOIN public.user_profiles p ON p.id = h.actor_user_id
   WHERE h.order_id = _order_id AND h.store_id = _store;

  RETURN jsonb_build_object('orderId', _order_id, 'entries', _rows);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_store_order_counts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_store_orders(uuid, text[], text, text, boolean, timestamptz, timestamptz, integer, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_store_order_detail(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_store_order_history(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_store_order_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_store_orders(uuid, text[], text, text, boolean, timestamptz, timestamptz, integer, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_store_order_detail(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_store_order_history(uuid, uuid) TO authenticated;

-- 10. Mensagem pública no acompanhamento -------------------------------
CREATE OR REPLACE FUNCTION private.get_public_order_tracking(_token_hash text, _known_version text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
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
    sha256(convert_to(v_order.status::text || '|' || v_order.version::text || '|' || v_last::text, 'UTF8')), 'hex'
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
      'isSuccessful', v_code IN ('delivered', 'picked_up'),
      'publicMessage', v_order.customer_visible_message
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
$function$;