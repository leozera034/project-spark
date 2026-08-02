-- Fase 18 — Bloco B: estrutura de entregadores e entregas.

-- 1. Entregadores: conta ativa (status) separada de presença (is_online/last_seen_at).
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS can_accept_deliveries boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

COMMENT ON COLUMN public.couriers.can_accept_deliveries IS 'Permissao administrativa para receber/aceitar entregas. Nao e presenca online nem conta ativa.';
COMMENT ON COLUMN public.couriers.is_online IS 'Presenca declarada pelo proprio entregador (Fase 19). A loja nunca marca online.';
COMMENT ON COLUMN public.couriers.last_seen_at IS 'Ultima atividade observada do entregador. Somente leitura para a loja.';

-- 2. Entregas: versao para concorrencia e rastro de quem atribuiu.
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason_code text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_store_order_unique') THEN
    ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_store_order_unique UNIQUE (store_id, order_id);
  END IF;
END $$;

-- Uma entrega operacional ativa por entregador (D-081).
CREATE UNIQUE INDEX IF NOT EXISTS deliveries_one_active_per_courier
  ON public.deliveries (courier_id)
  WHERE courier_id IS NOT NULL
    AND status IN ('atribuida','aceita','coletada','em_rota');

CREATE INDEX IF NOT EXISTS deliveries_store_status_idx ON public.deliveries (store_id, status, created_at DESC);

-- 3. Historico da entrega: responsavel anterior, ator, motivo e versao.
ALTER TABLE public.delivery_events
  ADD COLUMN IF NOT EXISTS previous_courier_id uuid,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS delivery_version integer;

COMMENT ON TABLE public.delivery_events IS 'Historico da entrega. Proibido gravar senha, token, payload integral ou qualquer valor financeiro.';

-- 4. Idempotencia do cadastro de entregador (chave propria, nunca a de pedidos).
CREATE TABLE IF NOT EXISTS public.courier_provisioning_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  courier_id uuid,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courier_intents_store_key_unique UNIQUE (store_id, idempotency_key),
  CONSTRAINT courier_intents_status_check CHECK (status IN ('pendente','concluida','falha')),
  CONSTRAINT courier_intents_courier_same_store_fk
    FOREIGN KEY (courier_id, store_id) REFERENCES public.couriers(id, store_id) ON DELETE SET NULL
);

ALTER TABLE public.courier_provisioning_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_provisioning_intents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.courier_provisioning_intents FROM anon, authenticated;
GRANT ALL ON public.courier_provisioning_intents TO service_role;

-- 5. Envelope Realtime generico (reaproveita a infra minima da Fase 16).
ALTER TABLE public.store_order_realtime_events
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS entity_id uuid;

UPDATE public.store_order_realtime_events SET entity_id = order_id WHERE entity_id IS NULL;
ALTER TABLE public.store_order_realtime_events ALTER COLUMN order_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_realtime_entity_check') THEN
    ALTER TABLE public.store_order_realtime_events
      ADD CONSTRAINT store_realtime_entity_check CHECK (
        entity_id IS NOT NULL
        AND (entity_type <> 'order' OR order_id IS NOT NULL)
      );
  END IF;
END $$;

-- 6. Helpers privados.
CREATE OR REPLACE FUNCTION private.emit_store_event(
  _store_id uuid, _entity_type text, _entity_id uuid, _event_type text, _version integer
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
  WITH inserted AS (
    INSERT INTO public.store_order_realtime_events
      (store_id, order_id, entity_type, entity_id, event_type, status_version)
    VALUES (
      _store_id,
      CASE WHEN _entity_type = 'order' THEN _entity_id ELSE NULL END,
      _entity_type, _entity_id, _event_type, coalesce(_version, 1)
    )
    RETURNING store_id
  )
  DELETE FROM public.store_order_realtime_events e
   WHERE e.store_id = (SELECT store_id FROM inserted) AND e.expires_at < now();
$$;

REVOKE ALL ON FUNCTION private.emit_store_event(uuid, text, uuid, text, integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.courier_active_delivery_id(_courier_id uuid, _store_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
  SELECT d.id FROM public.deliveries d
   WHERE d.courier_id = _courier_id
     AND d.store_id = _store_id
     AND d.status IN ('atribuida','aceita','coletada','em_rota')
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.courier_active_delivery_id(uuid, uuid) FROM PUBLIC;

-- Telefone sempre mascarado nas projecoes administrativas de lista.
CREATE OR REPLACE FUNCTION private.mask_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN _phone IS NULL OR length(_phone) < 4 THEN NULL
    ELSE repeat('•', greatest(length(_phone) - 4, 0)) || right(_phone, 4)
  END
$$;

-- 7. Criacao idempotente da entrega quando o pedido de entrega fica pronto.
CREATE OR REPLACE FUNCTION private.ensure_delivery_for_order(_store_id uuid, _order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  _o public.orders;
  _delivery_id uuid;
BEGIN
  SELECT * INTO _o FROM public.orders o WHERE o.id = _order_id AND o.store_id = _store_id;
  IF NOT FOUND OR _o.fulfillment <> 'entrega' THEN
    RETURN NULL;   -- retirada nunca cria entrega
  END IF;

  SELECT d.id INTO _delivery_id FROM public.deliveries d
   WHERE d.store_id = _store_id AND d.order_id = _order_id;
  IF _delivery_id IS NOT NULL THEN
    RETURN _delivery_id;
  END IF;

  INSERT INTO public.deliveries (store_id, order_id, status)
  VALUES (_store_id, _order_id, 'pendente')
  ON CONFLICT (store_id, order_id) DO NOTHING
  RETURNING id INTO _delivery_id;

  IF _delivery_id IS NULL THEN
    SELECT d.id INTO _delivery_id FROM public.deliveries d
     WHERE d.store_id = _store_id AND d.order_id = _order_id;
    RETURN _delivery_id;
  END IF;

  INSERT INTO public.audit_logs (store_id, actor_user_id, actor_kind, action, entity, entity_id, context)
  VALUES (_store_id, auth.uid(), 'sistema', 'delivery.created', 'deliveries', _delivery_id,
          jsonb_build_object('orderId', _order_id));

  PERFORM private.emit_store_event(_store_id, 'delivery', _delivery_id, 'delivery.created', 1);
  RETURN _delivery_id;
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_delivery_for_order(uuid, uuid) FROM PUBLIC;

-- 8. Backfill seguro: pedidos de entrega ja aguardando entregador ganham a entrega,
--    sem alterar estado, sem atribuir responsavel e sem evento falso.
INSERT INTO public.deliveries (store_id, order_id, status)
SELECT o.store_id, o.id, 'pendente'
  FROM public.orders o
 WHERE o.fulfillment = 'entrega'
   AND o.status IN ('pronto','aguardando_entregador')
   AND NOT EXISTS (SELECT 1 FROM public.deliveries d WHERE d.store_id = o.store_id AND d.order_id = o.id)
ON CONFLICT DO NOTHING;