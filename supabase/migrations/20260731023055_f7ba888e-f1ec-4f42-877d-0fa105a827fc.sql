-- =====================================================================
-- FASE 07 / BLOCO B — Autorização por papel e ação
-- Rollback: DROP das funções/policies criadas aqui e reaplicação das
-- policies mínimas baseadas em private.is_store_member.
-- =====================================================================

-- ---------------------------------------------------------------------
-- B.1 — Catálogo controlado de permissões (enum, não texto livre)
-- ---------------------------------------------------------------------
CREATE TYPE public.app_permission AS ENUM (
  -- loja
  'store.view_basic',
  'store.update_profile',
  'store.manage_settings',
  'store.manage_hours',
  'store.manage_neighborhoods',
  'store.manage_payment_methods',
  -- catálogo
  'catalog.view',
  'catalog.create',
  'catalog.update',
  'catalog.archive',
  -- pedidos
  'orders.view_queue',
  'orders.view_customer_contact',
  'orders.accept',
  'orders.reject',
  'orders.start_preparation',
  'orders.mark_ready',
  'orders.cancel',
  -- cozinha
  'kitchen.view',
  'kitchen.start_preparation',
  'kitchen.mark_ready',
  -- equipe
  'team.view',
  'team.invite',
  'team.change_role',
  'team.disable',
  -- entregadores (gestão pela loja)
  'couriers.view',
  'couriers.create',
  'couriers.update',
  'couriers.assign',
  'couriers.reset_access',
  -- entregador (ações do próprio entregador)
  'courier.view_self',
  'courier.view_offered_deliveries',
  'courier.view_assigned_delivery',
  'courier.update_delivery_status',
  'courier.register_incident',
  -- relatórios e assinatura
  'reports.view_operational',
  'subscription.view',
  -- plataforma
  'platform.stores.view',
  'platform.stores.create',
  'platform.stores.update',
  'platform.stores.suspend',
  'platform.stores.reactivate',
  'platform.plans.view',
  'platform.plans.manage',
  'platform.billing.view',
  'platform.billing.register_payment',
  'platform.audit.view',
  'platform.support.open_context'
);

COMMENT ON TYPE public.app_permission IS
  'Catálogo fechado de ações autorizáveis. Nenhuma permissão pode ser inventada pelo cliente.';

-- ---------------------------------------------------------------------
-- B.2 — Matriz versionada em código: papéis por permissão
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.permission_roles(_permission public.app_permission)
RETURNS public.app_role[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
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
    WHEN 'orders.accept'                 THEN ARRAY['proprietario','gerente','atendente']::public.app_role[]
    WHEN 'orders.reject'                 THEN ARRAY['proprietario','gerente','atendente']::public.app_role[]
    WHEN 'orders.start_preparation'      THEN ARRAY['proprietario','gerente','atendente','cozinha']::public.app_role[]
    WHEN 'orders.mark_ready'             THEN ARRAY['proprietario','gerente','atendente','cozinha']::public.app_role[]
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
$$;

-- ---------------------------------------------------------------------
-- B.3 — Função central de autorização
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.has_permission(
  _permission public.app_permission,
  _target_store_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _uid   uuid := auth.uid();
  _roles public.app_role[];
  _name  text := _permission::text;
BEGIN
  -- Negação por padrão: sem sessão, sem ação.
  IF _uid IS NULL OR _permission IS NULL THEN
    RETURN false;
  END IF;

  -- Perfil precisa existir e estar ativo.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id = _uid AND p.is_active
  ) THEN
    RETURN false;
  END IF;

  _roles := private.permission_roles(_permission);
  IF _roles IS NULL OR cardinality(_roles) = 0 THEN
    RETURN false;  -- permissão sem papel atribuído = negada
  END IF;

  -- Ações globais da plataforma: nunca aceitam loja alvo.
  IF _name LIKE 'platform.%' THEN
    RETURN _target_store_id IS NULL AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = _uid AND r.is_active AND r.role = 'admin_plataforma'
    );
  END IF;

  -- Ações do próprio entregador: identidade resolvida no banco.
  IF _name LIKE 'courier.%' THEN
    RETURN _target_store_id IS NOT NULL
       AND private.current_courier_id() IS NOT NULL
       AND private.current_courier_store_id() = _target_store_id;
  END IF;

  -- Demais ações são sempre de loja e exigem vínculo com a loja alvo.
  IF _target_store_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = _uid
      AND r.is_active
      AND r.store_id = _target_store_id
      AND r.role = ANY (_roles)
  );
END;
$$;

COMMENT ON FUNCTION private.has_permission(public.app_permission, uuid) IS
  'Autorização central. Usa apenas auth.uid(); nunca aceita user_id, papel ou loja declarados pelo cliente. Nega por padrão.';

-- ---------------------------------------------------------------------
-- B.4 — Wrappers de clareza (poucos, sobre a mesma função central)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_view_store(_target_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ SELECT private.has_permission('store.view_basic', _target_store_id) $$;

CREATE OR REPLACE FUNCTION private.can_view_catalog(_target_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ SELECT private.has_permission('catalog.view', _target_store_id) $$;

REVOKE ALL ON FUNCTION private.has_permission(public.app_permission, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.permission_roles(public.app_permission) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_view_store(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_view_catalog(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_permission(public.app_permission, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.permission_roles(public.app_permission) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_view_store(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_view_catalog(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- B.5 — Policies mínimas reescritas sobre a autorização por ação
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS stores_select_member                ON public.stores;
DROP POLICY IF EXISTS store_settings_select_member        ON public.store_settings;
DROP POLICY IF EXISTS store_hours_select_member           ON public.store_hours;
DROP POLICY IF EXISTS neighborhoods_select_member         ON public.neighborhoods;
DROP POLICY IF EXISTS payment_methods_select_member       ON public.payment_methods;
DROP POLICY IF EXISTS categories_select_member            ON public.categories;
DROP POLICY IF EXISTS products_select_member              ON public.products;
DROP POLICY IF EXISTS product_variants_select_member      ON public.product_variants;
DROP POLICY IF EXISTS option_groups_select_member         ON public.option_groups;
DROP POLICY IF EXISTS option_items_select_member          ON public.option_items;
DROP POLICY IF EXISTS product_option_groups_select_member ON public.product_option_groups;
DROP POLICY IF EXISTS combos_select_member                ON public.combos;
DROP POLICY IF EXISTS combo_items_select_member           ON public.combo_items;
DROP POLICY IF EXISTS promotions_select_member            ON public.promotions;
DROP POLICY IF EXISTS couriers_select_self                ON public.couriers;

CREATE POLICY stores_select_view_basic ON public.stores
  FOR SELECT TO authenticated
  USING (private.has_permission('store.view_basic', id));

CREATE POLICY store_settings_select_view_basic ON public.store_settings
  FOR SELECT TO authenticated USING (private.has_permission('store.view_basic', store_id));
CREATE POLICY store_hours_select_view_basic ON public.store_hours
  FOR SELECT TO authenticated USING (private.has_permission('store.view_basic', store_id));
CREATE POLICY neighborhoods_select_view_basic ON public.neighborhoods
  FOR SELECT TO authenticated USING (private.has_permission('store.view_basic', store_id));
CREATE POLICY payment_methods_select_view_basic ON public.payment_methods
  FOR SELECT TO authenticated USING (private.has_permission('store.view_basic', store_id));

CREATE POLICY categories_select_catalog_view ON public.categories
  FOR SELECT TO authenticated USING (private.has_permission('catalog.view', store_id));
CREATE POLICY products_select_catalog_view ON public.products
  FOR SELECT TO authenticated USING (private.has_permission('catalog.view', store_id));
CREATE POLICY product_variants_select_catalog_view ON public.product_variants
  FOR SELECT TO authenticated USING (private.has_permission('catalog.view', store_id));
CREATE POLICY option_groups_select_catalog_view ON public.option_groups
  FOR SELECT TO authenticated USING (private.has_permission('catalog.view', store_id));
CREATE POLICY option_items_select_catalog_view ON public.option_items
  FOR SELECT TO authenticated USING (private.has_permission('catalog.view', store_id));
CREATE POLICY product_option_groups_select_catalog_view ON public.product_option_groups
  FOR SELECT TO authenticated USING (private.has_permission('catalog.view', store_id));
CREATE POLICY combos_select_catalog_view ON public.combos
  FOR SELECT TO authenticated USING (private.has_permission('catalog.view', store_id));
CREATE POLICY combo_items_select_catalog_view ON public.combo_items
  FOR SELECT TO authenticated USING (private.has_permission('catalog.view', store_id));
CREATE POLICY promotions_select_catalog_view ON public.promotions
  FOR SELECT TO authenticated USING (private.has_permission('catalog.view', store_id));

-- Entregador enxerga somente a própria linha de cadastro (bootstrap).
CREATE POLICY couriers_select_self ON public.couriers
  FOR SELECT TO authenticated
  USING (
    id = private.current_courier_id()
    AND private.has_permission('courier.view_self', store_id)
  );

-- ---------------------------------------------------------------------
-- B.6 — Contexto de autorização para a interface (somente do próprio usuário)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_authorization_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _base jsonb;
  _store_ids uuid[];
  _perms jsonb := '[]'::jsonb;
  _sid uuid;
  _p public.app_permission;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'sessao_ausente' USING ERRCODE = '28000';
  END IF;

  _base := public.get_my_auth_context();

  -- Permissões globais (plataforma)
  FOR _p IN SELECT unnest(enum_range(NULL::public.app_permission)) LOOP
    IF _p::text LIKE 'platform.%' AND private.has_permission(_p, NULL) THEN
      _perms := _perms || jsonb_build_object('permission', _p::text, 'store_id', NULL);
    END IF;
  END LOOP;

  -- Permissões por loja vinculada
  SELECT coalesce(array_agg(DISTINCT r.store_id) FILTER (WHERE r.store_id IS NOT NULL), '{}')
    INTO _store_ids
  FROM public.user_roles r
  WHERE r.user_id = _uid AND r.is_active;

  IF private.current_courier_store_id() IS NOT NULL THEN
    _store_ids := _store_ids || private.current_courier_store_id();
  END IF;

  FOREACH _sid IN ARRAY coalesce(_store_ids, '{}'::uuid[]) LOOP
    FOR _p IN SELECT unnest(enum_range(NULL::public.app_permission)) LOOP
      IF _p::text NOT LIKE 'platform.%' AND private.has_permission(_p, _sid) THEN
        _perms := _perms || jsonb_build_object('permission', _p::text, 'store_id', _sid);
      END IF;
    END LOOP;
  END LOOP;

  RETURN _base || jsonb_build_object('permissions', _perms);
END;
$$;

COMMENT ON FUNCTION public.get_my_authorization_context() IS
  'Devolve apenas o contexto e as permissões do próprio usuário, para orientar a interface. Não substitui a verificação no banco.';

REVOKE ALL ON FUNCTION public.get_my_authorization_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_authorization_context() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- B.7 — Índices de apoio à resolução de papéis
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup
  ON public.user_roles (user_id, store_id, role) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_user_profiles_active
  ON public.user_profiles (id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_courier_identities_auth_user
  ON public.courier_auth_identities (auth_user_id);
