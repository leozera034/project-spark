-- =====================================================================
-- PEDIU AQUI — FASE 04 — Arquitetura física (parte 2)
-- Clientes, pedidos, entregas, SaaS e auditoria
-- =====================================================================

-- ================================================== CUSTOMERS
CREATE TABLE public.customers (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL,
  first_name    text NOT NULL,
  phone         text NOT NULL,
  notes         text,
  orders_count  integer NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_id_store_key UNIQUE (id, store_id),
  CONSTRAINT customers_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT customers_phone_unique UNIQUE (store_id, phone),
  CONSTRAINT customers_phone_format_check CHECK (phone ~ '^[0-9]{10,13}$'),
  CONSTRAINT customers_first_name_check CHECK (length(btrim(first_name)) BETWEEN 2 AND 60),
  CONSTRAINT customers_orders_count_check CHECK (orders_count >= 0)
);
COMMENT ON TABLE public.customers IS
  'Cliente final NÃO possui conta. Identificação por telefone dentro da loja. Sem e-mail, senha ou CPF.';

CREATE TABLE public.customer_addresses (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL,
  customer_id     uuid NOT NULL,
  neighborhood_id uuid,
  neighborhood_name text NOT NULL,
  street          text NOT NULL,
  number          text,
  has_no_number   boolean NOT NULL DEFAULT false,
  complement      text,
  reference       text,
  label           text,
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_addresses_pkey PRIMARY KEY (id),
  CONSTRAINT customer_addresses_id_store_key UNIQUE (id, store_id),
  CONSTRAINT customer_addresses_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT customer_addresses_customer_same_store_fk FOREIGN KEY (customer_id, store_id)
    REFERENCES public.customers(id, store_id) ON DELETE CASCADE,
  CONSTRAINT customer_addresses_neighborhood_same_store_fk FOREIGN KEY (neighborhood_id, store_id)
    REFERENCES public.neighborhoods(id, store_id) ON DELETE SET NULL,
  CONSTRAINT customer_addresses_number_check CHECK (has_no_number OR number IS NOT NULL)
);
COMMENT ON TABLE public.customer_addresses IS
  'Endereço NUNCA é assumido automaticamente: a confirmação explícita é obrigatória no fluxo do cliente.';

-- ================================================== COURIERS
CREATE TABLE public.couriers (
  id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id           uuid NOT NULL,
  user_id            uuid,
  full_name          text NOT NULL,
  phone              text NOT NULL,
  vehicle            text,
  plate              text,
  status             public.courier_status NOT NULL DEFAULT 'ativo',
  is_online          boolean NOT NULL DEFAULT false,
  completed_deliveries_count integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT couriers_pkey PRIMARY KEY (id),
  CONSTRAINT couriers_id_store_key UNIQUE (id, store_id),
  CONSTRAINT couriers_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT couriers_phone_unique UNIQUE (store_id, phone),
  CONSTRAINT couriers_user_unique UNIQUE (store_id, user_id),
  CONSTRAINT couriers_count_check CHECK (completed_deliveries_count >= 0)
);
COMMENT ON TABLE public.couriers IS
  'Entregador PRÓPRIO da loja. PROIBIDO qualquer campo financeiro (valor por entrega, comissão, saldo, repasse).';
COMMENT ON COLUMN public.couriers.completed_deliveries_count IS
  'Contador simples de entregas concluídas. Não é métrica financeira.';

-- ================================================== ORDERS
CREATE TABLE public.orders (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id              uuid NOT NULL,
  order_number          integer NOT NULL,
  public_tracking_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  customer_id           uuid,
  customer_name         text NOT NULL,
  customer_phone        text NOT NULL,
  fulfillment           public.fulfillment_type NOT NULL,
  status                public.order_status NOT NULL DEFAULT 'aguardando_confirmacao',
  address_id            uuid,
  address_snapshot      jsonb,
  neighborhood_id       uuid,
  neighborhood_snapshot text,
  payment_method_id     uuid,
  payment_method_label  text,
  change_for            numeric(10,2),
  items_subtotal        numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee          numeric(10,2) NOT NULL DEFAULT 0,
  discount_total        numeric(10,2) NOT NULL DEFAULT 0,
  total_amount          numeric(10,2) NOT NULL DEFAULT 0,
  eta_minutes           integer,
  customer_notes        text,
  rejection_reason      text,
  cancellation_reason   text,
  idempotency_key       text,
  accepted_at           timestamptz,
  ready_at              timestamptz,
  finished_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_id_store_key UNIQUE (id, store_id),
  CONSTRAINT orders_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT orders_customer_same_store_fk FOREIGN KEY (customer_id, store_id)
    REFERENCES public.customers(id, store_id) ON DELETE SET NULL,
  CONSTRAINT orders_address_same_store_fk FOREIGN KEY (address_id, store_id)
    REFERENCES public.customer_addresses(id, store_id) ON DELETE SET NULL,
  CONSTRAINT orders_neighborhood_same_store_fk FOREIGN KEY (neighborhood_id, store_id)
    REFERENCES public.neighborhoods(id, store_id) ON DELETE SET NULL,
  CONSTRAINT orders_payment_method_same_store_fk FOREIGN KEY (payment_method_id, store_id)
    REFERENCES public.payment_methods(id, store_id) ON DELETE SET NULL,
  CONSTRAINT orders_number_unique UNIQUE (store_id, order_number),
  CONSTRAINT orders_tracking_token_key UNIQUE (public_tracking_token),
  CONSTRAINT orders_idempotency_unique UNIQUE (store_id, idempotency_key),
  CONSTRAINT orders_amounts_check CHECK (
    items_subtotal >= 0 AND delivery_fee >= 0 AND discount_total >= 0 AND total_amount >= 0
  ),
  CONSTRAINT orders_total_consistency_check CHECK (
    total_amount = items_subtotal + delivery_fee - discount_total
  ),
  CONSTRAINT orders_delivery_requires_address_check CHECK (
    fulfillment <> 'entrega' OR address_snapshot IS NOT NULL
  ),
  CONSTRAINT orders_pickup_no_fee_check CHECK (fulfillment <> 'retirada' OR delivery_fee = 0),
  CONSTRAINT orders_number_positive_check CHECK (order_number > 0)
);
COMMENT ON COLUMN public.orders.public_tracking_token IS
  'Token público de acompanhamento. Aleatório e criptograficamente seguro. NUNCA derivar de telefone, id ou data.';
COMMENT ON COLUMN public.orders.address_snapshot IS
  'Cópia congelada do endereço no momento do pedido. Alterações posteriores não reescrevem o histórico.';

CREATE TABLE public.order_items (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL,
  order_id      uuid NOT NULL,
  product_id    uuid,
  variant_id    uuid,
  product_name  text NOT NULL,
  variant_name  text,
  unit_price    numeric(10,2) NOT NULL,
  quantity      numeric(10,3) NOT NULL DEFAULT 1,
  pricing_unit  public.pricing_unit NOT NULL DEFAULT 'unidade',
  options_total numeric(10,2) NOT NULL DEFAULT 0,
  line_total    numeric(10,2) NOT NULL,
  notes         text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_id_store_key UNIQUE (id, store_id),
  CONSTRAINT order_items_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT order_items_order_same_store_fk FOREIGN KEY (order_id, store_id)
    REFERENCES public.orders(id, store_id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_same_store_fk FOREIGN KEY (product_id, store_id)
    REFERENCES public.products(id, store_id) ON DELETE SET NULL,
  CONSTRAINT order_items_variant_same_store_fk FOREIGN KEY (variant_id, store_id)
    REFERENCES public.product_variants(id, store_id) ON DELETE SET NULL,
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT order_items_price_check CHECK (unit_price >= 0 AND options_total >= 0 AND line_total >= 0)
);
COMMENT ON TABLE public.order_items IS 'Preços congelados. O backend recalcula tudo na criação; o cliente nunca envia preço confiável.';

CREATE TABLE public.order_item_options (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL,
  order_item_id    uuid NOT NULL,
  option_group_id  uuid,
  option_item_id   uuid,
  group_name       text NOT NULL,
  option_name      text NOT NULL,
  additional_price numeric(10,2) NOT NULL DEFAULT 0,
  quantity         integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_item_options_pkey PRIMARY KEY (id),
  CONSTRAINT order_item_options_id_store_key UNIQUE (id, store_id),
  CONSTRAINT order_item_options_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT order_item_options_item_same_store_fk FOREIGN KEY (order_item_id, store_id)
    REFERENCES public.order_items(id, store_id) ON DELETE CASCADE,
  CONSTRAINT order_item_options_group_same_store_fk FOREIGN KEY (option_group_id, store_id)
    REFERENCES public.option_groups(id, store_id) ON DELETE SET NULL,
  CONSTRAINT order_item_options_option_same_store_fk FOREIGN KEY (option_item_id, store_id)
    REFERENCES public.option_items(id, store_id) ON DELETE SET NULL,
  CONSTRAINT order_item_options_quantity_check CHECK (quantity >= 1),
  CONSTRAINT order_item_options_price_check CHECK (additional_price >= 0)
);

CREATE TABLE public.order_status_history (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL,
  order_id     uuid NOT NULL,
  from_status  public.order_status,
  to_status    public.order_status NOT NULL,
  actor_kind   text NOT NULL DEFAULT 'sistema',
  actor_user_id uuid,
  actor_courier_id uuid,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT order_status_history_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT order_status_history_order_same_store_fk FOREIGN KEY (order_id, store_id)
    REFERENCES public.orders(id, store_id) ON DELETE CASCADE,
  CONSTRAINT order_status_history_courier_same_store_fk FOREIGN KEY (actor_courier_id, store_id)
    REFERENCES public.couriers(id, store_id) ON DELETE SET NULL,
  CONSTRAINT order_status_history_actor_kind_check CHECK (
    actor_kind IN ('sistema','loja','entregador','cliente','admin')
  ),
  CONSTRAINT order_status_history_transition_check CHECK (from_status IS DISTINCT FROM to_status)
);

-- ================================================== DELIVERIES
CREATE TABLE public.deliveries (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL,
  order_id      uuid NOT NULL,
  courier_id    uuid,
  status        public.delivery_status NOT NULL DEFAULT 'pendente',
  assigned_at   timestamptz,
  accepted_at   timestamptz,
  picked_up_at  timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  cancelled_at  timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT deliveries_id_store_key UNIQUE (id, store_id),
  CONSTRAINT deliveries_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT deliveries_order_same_store_fk FOREIGN KEY (order_id, store_id)
    REFERENCES public.orders(id, store_id) ON DELETE CASCADE,
  CONSTRAINT deliveries_courier_same_store_fk FOREIGN KEY (courier_id, store_id)
    REFERENCES public.couriers(id, store_id) ON DELETE SET NULL,
  CONSTRAINT deliveries_order_unique UNIQUE (order_id),
  CONSTRAINT deliveries_accept_requires_courier_check CHECK (
    status IN ('pendente','cancelada') OR courier_id IS NOT NULL
  )
);
COMMENT ON TABLE public.deliveries IS
  'Entrega da PRÓPRIA loja. Não existe frota compartilhada nem despacho global. Sem valores financeiros.';

CREATE TABLE public.delivery_events (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL,
  delivery_id uuid NOT NULL,
  courier_id  uuid,
  kind        public.delivery_event_type NOT NULL,
  description text,
  latitude    numeric(10,7),
  longitude   numeric(10,7),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_events_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_events_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT delivery_events_delivery_same_store_fk FOREIGN KEY (delivery_id, store_id)
    REFERENCES public.deliveries(id, store_id) ON DELETE CASCADE,
  CONSTRAINT delivery_events_courier_same_store_fk FOREIGN KEY (courier_id, store_id)
    REFERENCES public.couriers(id, store_id) ON DELETE SET NULL
);
COMMENT ON TABLE public.delivery_events IS 'Ocorrências operacionais. NÃO alteram o estado do pedido por si só.';

-- ================================================== SAAS
CREATE TABLE public.store_subscriptions (
  id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id           uuid NOT NULL,
  plan_id            uuid NOT NULL,
  status             public.subscription_status NOT NULL DEFAULT 'ativa',
  monthly_price      numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount    numeric(10,2) NOT NULL DEFAULT 0,
  due_day            smallint NOT NULL DEFAULT 10,
  grace_days         smallint NOT NULL DEFAULT 5,
  current_period_end date,
  started_at         date NOT NULL DEFAULT CURRENT_DATE,
  cancelled_at       timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT store_subscriptions_id_store_key UNIQUE (id, store_id),
  CONSTRAINT store_subscriptions_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT store_subscriptions_plan_fk FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE RESTRICT,
  CONSTRAINT store_subscriptions_store_unique UNIQUE (store_id),
  CONSTRAINT store_subscriptions_due_day_check CHECK (due_day BETWEEN 1 AND 28),
  CONSTRAINT store_subscriptions_grace_check CHECK (grace_days BETWEEN 0 AND 30),
  CONSTRAINT store_subscriptions_amount_check CHECK (monthly_price >= 0 AND discount_amount >= 0)
);
COMMENT ON TABLE public.store_subscriptions IS
  'Suspensão NUNCA apaga dados. Ela apenas altera o status da assinatura e da loja.';

CREATE TABLE public.subscription_payments (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL,
  subscription_id uuid NOT NULL,
  reference_month date NOT NULL,
  amount          numeric(10,2) NOT NULL DEFAULT 0,
  status          public.subscription_payment_status NOT NULL DEFAULT 'pendente',
  paid_at         timestamptz,
  method_note     text,
  registered_by   uuid,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_payments_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_payments_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT subscription_payments_subscription_same_store_fk FOREIGN KEY (subscription_id, store_id)
    REFERENCES public.store_subscriptions(id, store_id) ON DELETE CASCADE,
  CONSTRAINT subscription_payments_month_unique UNIQUE (subscription_id, reference_month),
  CONSTRAINT subscription_payments_amount_check CHECK (amount >= 0)
);
COMMENT ON TABLE public.subscription_payments IS
  'Registro MANUAL de mensalidade. Proibido armazenar dado de cartão ou credencial de gateway.';

-- ================================================== AUDITORIA E PUSH
CREATE TABLE public.audit_logs (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id    uuid,
  actor_user_id uuid,
  actor_kind  text NOT NULL DEFAULT 'sistema',
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   uuid,
  context     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL,
  CONSTRAINT audit_logs_actor_kind_check CHECK (actor_kind IN ('sistema','loja','entregador','admin'))
);
COMMENT ON COLUMN public.audit_logs.context IS
  'PROIBIDO gravar: telefone, endereço completo, nome do cliente, token de acompanhamento, segredo, chave, senha ou dado de cartão. Use apenas identificadores e nomes de campo.';

CREATE TABLE public.device_push_tokens (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id    uuid,
  user_id     uuid,
  courier_id  uuid,
  token       text NOT NULL,
  platform    text NOT NULL DEFAULT 'android',
  is_active   boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_push_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT device_push_tokens_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT device_push_tokens_courier_same_store_fk FOREIGN KEY (courier_id, store_id)
    REFERENCES public.couriers(id, store_id) ON DELETE CASCADE,
  CONSTRAINT device_push_tokens_token_key UNIQUE (token),
  CONSTRAINT device_push_tokens_platform_check CHECK (platform IN ('android','ios','web')),
  CONSTRAINT device_push_tokens_owner_check CHECK (user_id IS NOT NULL OR courier_id IS NOT NULL)
);
COMMENT ON COLUMN public.device_push_tokens.token IS
  'SENSÍVEL: credencial de envio de notificação. Nunca expor em views públicas, logs ou respostas de API.';

-- ================================================== ÍNDICES
CREATE INDEX customers_store_phone_idx        ON public.customers (store_id, phone);
CREATE INDEX customer_addresses_customer_idx  ON public.customer_addresses (customer_id);
CREATE INDEX couriers_store_status_idx        ON public.couriers (store_id, status, is_online);
CREATE INDEX orders_store_status_created_idx  ON public.orders (store_id, status, created_at DESC);
CREATE INDEX orders_store_created_idx         ON public.orders (store_id, created_at DESC);
CREATE INDEX orders_customer_idx              ON public.orders (customer_id);
CREATE INDEX order_items_order_idx            ON public.order_items (order_id, sort_order);
CREATE INDEX order_item_options_item_idx      ON public.order_item_options (order_item_id);
CREATE INDEX order_status_history_order_idx   ON public.order_status_history (order_id, created_at);
CREATE INDEX deliveries_store_status_idx      ON public.deliveries (store_id, status);
CREATE INDEX deliveries_courier_idx           ON public.deliveries (courier_id, status);
CREATE INDEX delivery_events_delivery_idx     ON public.delivery_events (delivery_id, created_at);
CREATE INDEX subscription_payments_sub_idx    ON public.subscription_payments (subscription_id, reference_month DESC);
CREATE INDEX audit_logs_store_created_idx     ON public.audit_logs (store_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx            ON public.audit_logs (entity, entity_id);
CREATE INDEX device_push_tokens_courier_idx   ON public.device_push_tokens (courier_id) WHERE is_active;
CREATE INDEX device_push_tokens_user_idx      ON public.device_push_tokens (user_id) WHERE is_active;

-- ================================================== TRIGGERS + SEGURANÇA
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','customer_addresses','couriers','orders','order_items','order_item_options',
    'deliveries','store_subscriptions','subscription_payments','device_push_tokens'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at_%1$s BEFORE UPDATE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'customers','customer_addresses','couriers','orders','order_items','order_item_options',
    'order_status_history','deliveries','delivery_events','store_subscriptions',
    'subscription_payments','audit_logs','device_push_tokens'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;