-- =====================================================================
-- PEDIU AQUI — FASE 04 — Arquitetura física (parte 1)
-- Fundação do tenant + catálogo genérico
-- Isolamento estrutural: store_id + UNIQUE(id, store_id) + FKs compostas
-- Baseline de segurança: RLS habilitada, ZERO policies, sem GRANT a anon/authenticated
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------- ENUMS
CREATE TYPE public.store_status AS ENUM ('em_implantacao','ativa','suspensa','inativa');
CREATE TYPE public.fulfillment_type AS ENUM ('entrega','retirada');
CREATE TYPE public.order_status AS ENUM (
  'aguardando_confirmacao','aceito','em_preparo','pronto',
  'aguardando_entregador','saiu_para_entrega','entregue',
  'aguardando_retirada','retirado','recusado','cancelado'
);
CREATE TYPE public.app_role AS ENUM (
  'admin_plataforma','proprietario','gerente','atendente','cozinha','entregador'
);
CREATE TYPE public.option_selection_type AS ENUM ('unica','multipla');
CREATE TYPE public.pricing_unit AS ENUM ('unidade','quantidade','peso');
CREATE TYPE public.payment_method_kind AS ENUM (
  'dinheiro','cartao_credito','cartao_debito','pix','vale_refeicao','outro'
);
CREATE TYPE public.promotion_type AS ENUM ('percentual','valor_fixo');
CREATE TYPE public.courier_status AS ENUM ('ativo','inativo');
CREATE TYPE public.delivery_status AS ENUM (
  'pendente','atribuida','aceita','coletada','em_rota','concluida','cancelada'
);
CREATE TYPE public.delivery_event_type AS ENUM (
  'atribuida','aceita','chegada_loja','coleta','inicio_entrega',
  'tentativa_falha','ocorrencia','concluida','cancelada'
);
CREATE TYPE public.subscription_status AS ENUM (
  'ativa','inadimplente','suspensa','cortesia','cancelada'
);
CREATE TYPE public.subscription_payment_status AS ENUM ('pago','pendente','cortesia','estornado');

-- --------------------------------------------------- FUNÇÃO updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Atualiza updated_at em UPDATE. SECURITY INVOKER com search_path fixo.';

-- ================================================== TABELA GLOBAL: PLANS
CREATE TABLE public.plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL,
  name             text NOT NULL,
  description      text,
  monthly_price    numeric(10,2) NOT NULL DEFAULT 0,
  max_orders_month integer,
  max_team_members integer,
  max_couriers     integer,
  features         jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_code_key UNIQUE (code),
  CONSTRAINT plans_code_format_check CHECK (code ~ '^[a-z0-9_]{2,40}$'),
  CONSTRAINT plans_monthly_price_check CHECK (monthly_price >= 0)
);
COMMENT ON TABLE public.plans IS 'Entidade global do SaaS. NÃO possui store_id por decisão de arquitetura.';

-- ================================================== TENANT: STORES
CREATE TABLE public.stores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  name          text NOT NULL,
  legal_name    text,
  document      text,
  status        public.store_status NOT NULL DEFAULT 'em_implantacao',
  segment       text,
  phone         text,
  whatsapp      text,
  email         text,
  city          text NOT NULL DEFAULT 'Cidade',
  state         text NOT NULL DEFAULT 'XX',
  timezone      text NOT NULL DEFAULT 'America/Sao_Paulo',
  address_line  text,
  latitude      numeric(10,7),
  longitude     numeric(10,7),
  accepts_delivery boolean NOT NULL DEFAULT true,
  accepts_pickup   boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stores_slug_key UNIQUE (slug),
  CONSTRAINT stores_slug_format_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 60),
  CONSTRAINT stores_state_check CHECK (length(state) = 2)
);
COMMENT ON TABLE public.stores IS 'Raiz do tenant. Toda tabela operacional referencia store_id.';

-- ================================================== STORE SETTINGS
CREATE TABLE public.store_settings (
  store_id            uuid PRIMARY KEY,
  logo_url            text,
  cover_url           text,
  brand_primary       text NOT NULL DEFAULT '#0F1114',
  brand_accent        text NOT NULL DEFAULT '#14B8A6',
  description         text,
  welcome_message     text,
  closed_message      text,
  min_order_amount    numeric(10,2) NOT NULL DEFAULT 0,
  default_prep_minutes integer NOT NULL DEFAULT 30,
  courier_can_accept  boolean NOT NULL DEFAULT true,
  sound_alert_enabled boolean NOT NULL DEFAULT true,
  auto_open_by_hours  boolean NOT NULL DEFAULT true,
  manual_override_open boolean,
  theme_tokens        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_settings_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT store_settings_min_order_check CHECK (min_order_amount >= 0),
  CONSTRAINT store_settings_prep_check CHECK (default_prep_minutes BETWEEN 0 AND 600)
);

-- ================================================== STORE HOURS
CREATE TABLE public.store_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL,
  weekday     smallint NOT NULL,
  opens_at    time NOT NULL,
  closes_at   time NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_hours_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT store_hours_weekday_check CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT store_hours_range_check CHECK (closes_at <> opens_at),
  CONSTRAINT store_hours_unique_slot UNIQUE (store_id, weekday, opens_at, closes_at)
);
COMMENT ON COLUMN public.store_hours.weekday IS '0=domingo ... 6=sábado, no fuso da loja.';

-- ================================================== NEIGHBORHOODS
CREATE TABLE public.neighborhoods (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL,
  name             text NOT NULL,
  delivery_fee     numeric(10,2) NOT NULL DEFAULT 0,
  min_order_amount numeric(10,2) NOT NULL DEFAULT 0,
  eta_minutes      integer NOT NULL DEFAULT 40,
  notes            text,
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT neighborhoods_pkey PRIMARY KEY (id),
  CONSTRAINT neighborhoods_id_store_key UNIQUE (id, store_id),
  CONSTRAINT neighborhoods_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT neighborhoods_name_unique UNIQUE (store_id, name),
  CONSTRAINT neighborhoods_fee_check CHECK (delivery_fee >= 0),
  CONSTRAINT neighborhoods_min_check CHECK (min_order_amount >= 0),
  CONSTRAINT neighborhoods_eta_check CHECK (eta_minutes BETWEEN 0 AND 600)
);

-- ================================================== PAYMENT METHODS
CREATE TABLE public.payment_methods (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL,
  kind          public.payment_method_kind NOT NULL,
  label         text NOT NULL,
  instructions  text,
  needs_change  boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT payment_methods_id_store_key UNIQUE (id, store_id),
  CONSTRAINT payment_methods_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT payment_methods_label_unique UNIQUE (store_id, label)
);
COMMENT ON TABLE public.payment_methods IS 'Formas de pagamento informativas. Proibido armazenar dado de cartão ou credencial de gateway.';

-- ================================================== USER PROFILES / ROLES
CREATE TABLE public.user_profiles (
  id           uuid PRIMARY KEY,
  full_name    text,
  display_name text,
  phone        text,
  avatar_url   text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.user_profiles IS
  'Perfil do usuário autenticado. PROIBIDO conter papel, permissão ou flag administrativa. Papéis vivem em user_roles.';

CREATE TABLE public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  store_id    uuid,
  role        public.app_role NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_scope_check CHECK (
    (role = 'admin_plataforma' AND store_id IS NULL)
    OR (role <> 'admin_plataforma' AND store_id IS NOT NULL)
  )
);
COMMENT ON TABLE public.user_roles IS
  'Fonte única de papéis. admin_plataforma é global (store_id nulo); os demais são sempre por loja.';

CREATE UNIQUE INDEX user_roles_store_unique_idx
  ON public.user_roles (user_id, store_id, role) WHERE store_id IS NOT NULL;
CREATE UNIQUE INDEX user_roles_global_unique_idx
  ON public.user_roles (user_id, role) WHERE store_id IS NULL;

-- ================================================== CATÁLOGO: CATEGORIES
CREATE TABLE public.categories (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL,
  parent_id   uuid,
  name        text NOT NULL,
  description text,
  image_url   text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_id_store_key UNIQUE (id, store_id),
  CONSTRAINT categories_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT categories_parent_same_store_fk FOREIGN KEY (parent_id, store_id)
    REFERENCES public.categories(id, store_id) ON DELETE SET NULL,
  CONSTRAINT categories_name_unique UNIQUE (store_id, parent_id, name),
  CONSTRAINT categories_not_self_parent_check CHECK (parent_id IS NULL OR parent_id <> id)
);

-- ================================================== CATÁLOGO: PRODUCTS
CREATE TABLE public.products (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id       uuid NOT NULL,
  category_id    uuid NOT NULL,
  name           text NOT NULL,
  description    text,
  image_url      text,
  base_price     numeric(10,2) NOT NULL DEFAULT 0,
  pricing_unit   public.pricing_unit NOT NULL DEFAULT 'unidade',
  unit_label     text,
  has_variants   boolean NOT NULL DEFAULT false,
  is_available   boolean NOT NULL DEFAULT true,
  is_featured    boolean NOT NULL DEFAULT false,
  is_sold_out    boolean NOT NULL DEFAULT false,
  available_from time,
  available_to   time,
  available_weekdays smallint[],
  max_quantity   integer,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_id_store_key UNIQUE (id, store_id),
  CONSTRAINT products_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT products_category_same_store_fk FOREIGN KEY (category_id, store_id)
    REFERENCES public.categories(id, store_id) ON DELETE RESTRICT,
  CONSTRAINT products_base_price_check CHECK (base_price >= 0),
  CONSTRAINT products_max_quantity_check CHECK (max_quantity IS NULL OR max_quantity > 0)
);
COMMENT ON TABLE public.products IS 'Item vendável genérico. Proibido criar tabelas específicas de segmento (sabores, adicionais, proteínas).';

-- ================================================== CATÁLOGO: VARIANTS
CREATE TABLE public.product_variants (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL,
  product_id  uuid NOT NULL,
  name        text NOT NULL,
  price       numeric(10,2) NOT NULL,
  sku         text,
  is_default  boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_id_store_key UNIQUE (id, store_id),
  CONSTRAINT product_variants_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT product_variants_product_same_store_fk FOREIGN KEY (product_id, store_id)
    REFERENCES public.products(id, store_id) ON DELETE CASCADE,
  CONSTRAINT product_variants_name_unique UNIQUE (product_id, name),
  CONSTRAINT product_variants_price_check CHECK (price >= 0)
);

-- ================================================== CATÁLOGO: OPTION GROUPS
CREATE TABLE public.option_groups (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL,
  name            text NOT NULL,
  description     text,
  selection_type  public.option_selection_type NOT NULL DEFAULT 'unica',
  is_required     boolean NOT NULL DEFAULT false,
  min_selections  integer NOT NULL DEFAULT 0,
  max_selections  integer NOT NULL DEFAULT 1,
  allow_quantity  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT option_groups_pkey PRIMARY KEY (id),
  CONSTRAINT option_groups_id_store_key UNIQUE (id, store_id),
  CONSTRAINT option_groups_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT option_groups_name_unique UNIQUE (store_id, name),
  CONSTRAINT option_groups_min_check CHECK (min_selections >= 0),
  CONSTRAINT option_groups_max_check CHECK (max_selections >= 1),
  CONSTRAINT option_groups_min_max_check CHECK (min_selections <= max_selections),
  CONSTRAINT option_groups_required_check CHECK (NOT is_required OR min_selections >= 1),
  CONSTRAINT option_groups_single_check CHECK (selection_type <> 'unica' OR max_selections = 1)
);

CREATE TABLE public.option_items (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id         uuid NOT NULL,
  option_group_id  uuid NOT NULL,
  name             text NOT NULL,
  description      text,
  additional_price numeric(10,2) NOT NULL DEFAULT 0,
  max_quantity     integer NOT NULL DEFAULT 1,
  is_available     boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT option_items_pkey PRIMARY KEY (id),
  CONSTRAINT option_items_id_store_key UNIQUE (id, store_id),
  CONSTRAINT option_items_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT option_items_group_same_store_fk FOREIGN KEY (option_group_id, store_id)
    REFERENCES public.option_groups(id, store_id) ON DELETE CASCADE,
  CONSTRAINT option_items_name_unique UNIQUE (option_group_id, name),
  CONSTRAINT option_items_price_check CHECK (additional_price >= 0),
  CONSTRAINT option_items_max_quantity_check CHECK (max_quantity >= 1)
);

CREATE TABLE public.product_option_groups (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL,
  product_id      uuid NOT NULL,
  option_group_id uuid NOT NULL,
  is_required     boolean,
  min_selections  integer,
  max_selections  integer,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_option_groups_pkey PRIMARY KEY (id),
  CONSTRAINT product_option_groups_id_store_key UNIQUE (id, store_id),
  CONSTRAINT product_option_groups_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT product_option_groups_product_same_store_fk FOREIGN KEY (product_id, store_id)
    REFERENCES public.products(id, store_id) ON DELETE CASCADE,
  CONSTRAINT product_option_groups_group_same_store_fk FOREIGN KEY (option_group_id, store_id)
    REFERENCES public.option_groups(id, store_id) ON DELETE CASCADE,
  CONSTRAINT product_option_groups_unique UNIQUE (product_id, option_group_id),
  CONSTRAINT product_option_groups_minmax_check CHECK (
    min_selections IS NULL OR max_selections IS NULL OR min_selections <= max_selections
  )
);
COMMENT ON TABLE public.product_option_groups IS
  'Vínculo N-N produto x grupo de opções. FKs compostas impedem vincular grupo de outra loja.';

-- ================================================== COMBOS
CREATE TABLE public.combos (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL,
  name        text NOT NULL,
  description text,
  image_url   text,
  price       numeric(10,2) NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT combos_pkey PRIMARY KEY (id),
  CONSTRAINT combos_id_store_key UNIQUE (id, store_id),
  CONSTRAINT combos_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT combos_name_unique UNIQUE (store_id, name),
  CONSTRAINT combos_price_check CHECK (price >= 0)
);

CREATE TABLE public.combo_items (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL,
  combo_id    uuid NOT NULL,
  product_id  uuid NOT NULL,
  variant_id  uuid,
  quantity    integer NOT NULL DEFAULT 1,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT combo_items_pkey PRIMARY KEY (id),
  CONSTRAINT combo_items_id_store_key UNIQUE (id, store_id),
  CONSTRAINT combo_items_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT combo_items_combo_same_store_fk FOREIGN KEY (combo_id, store_id)
    REFERENCES public.combos(id, store_id) ON DELETE CASCADE,
  CONSTRAINT combo_items_product_same_store_fk FOREIGN KEY (product_id, store_id)
    REFERENCES public.products(id, store_id) ON DELETE RESTRICT,
  CONSTRAINT combo_items_variant_same_store_fk FOREIGN KEY (variant_id, store_id)
    REFERENCES public.product_variants(id, store_id) ON DELETE RESTRICT,
  CONSTRAINT combo_items_quantity_check CHECK (quantity >= 1)
);

-- ================================================== PROMOTIONS
CREATE TABLE public.promotions (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL,
  name          text NOT NULL,
  kind          public.promotion_type NOT NULL,
  value         numeric(10,2) NOT NULL,
  product_id    uuid,
  category_id   uuid,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promotions_pkey PRIMARY KEY (id),
  CONSTRAINT promotions_id_store_key UNIQUE (id, store_id),
  CONSTRAINT promotions_store_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE,
  CONSTRAINT promotions_product_same_store_fk FOREIGN KEY (product_id, store_id)
    REFERENCES public.products(id, store_id) ON DELETE CASCADE,
  CONSTRAINT promotions_category_same_store_fk FOREIGN KEY (category_id, store_id)
    REFERENCES public.categories(id, store_id) ON DELETE CASCADE,
  CONSTRAINT promotions_value_check CHECK (value > 0),
  CONSTRAINT promotions_percent_check CHECK (kind <> 'percentual' OR value <= 100),
  CONSTRAINT promotions_window_check CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

-- ================================================== ÍNDICES
CREATE INDEX stores_status_idx              ON public.stores (status);
CREATE INDEX store_hours_store_idx          ON public.store_hours (store_id, weekday);
CREATE INDEX neighborhoods_store_active_idx ON public.neighborhoods (store_id, is_active);
CREATE INDEX payment_methods_store_idx      ON public.payment_methods (store_id, is_active);
CREATE INDEX user_roles_user_idx            ON public.user_roles (user_id);
CREATE INDEX user_roles_store_idx           ON public.user_roles (store_id);
CREATE INDEX categories_store_sort_idx      ON public.categories (store_id, sort_order);
CREATE INDEX categories_parent_idx          ON public.categories (parent_id);
CREATE INDEX products_store_category_idx    ON public.products (store_id, category_id, sort_order);
CREATE INDEX products_store_available_idx   ON public.products (store_id, is_available);
CREATE INDEX product_variants_product_idx   ON public.product_variants (product_id);
CREATE INDEX option_items_group_idx         ON public.option_items (option_group_id, sort_order);
CREATE INDEX product_option_groups_product_idx ON public.product_option_groups (product_id, sort_order);
CREATE INDEX combo_items_combo_idx          ON public.combo_items (combo_id);
CREATE INDEX promotions_store_active_idx    ON public.promotions (store_id, is_active);

-- ================================================== TRIGGERS updated_at
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'plans','stores','store_settings','store_hours','neighborhoods','payment_methods',
    'user_profiles','user_roles','categories','products','product_variants',
    'option_groups','option_items','product_option_groups','combos','combo_items','promotions'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at_%1$s BEFORE UPDATE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- ================================================== SEGURANÇA (baseline)
-- RLS habilitada e NENHUMA policy: negação por padrão.
-- Nenhum GRANT para anon/authenticated nesta fase (Fase 06 define o acesso fino).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'plans','stores','store_settings','store_hours','neighborhoods','payment_methods',
    'user_profiles','user_roles','categories','products','product_variants',
    'option_groups','option_items','product_option_groups','combos','combo_items','promotions'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;