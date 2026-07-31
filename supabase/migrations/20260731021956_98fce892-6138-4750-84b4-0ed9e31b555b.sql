-- ============================================================
-- FASE 06 — MULTI-TENANCY, RLS E ISOLAMENTO COMPLETO
-- ============================================================

-- 1. Schema privado (não exposto na Data API)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

-- 2. Funções de contexto (SECURITY DEFINER, search_path fixo)

CREATE OR REPLACE FUNCTION private.current_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT auth.uid() $$;

CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.is_active AND r.role = 'admin_plataforma'
  )
$$;

CREATE OR REPLACE FUNCTION private.is_store_member(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT _store_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid()
      AND r.is_active
      AND r.store_id = _store_id
      AND r.role IN ('proprietario','gerente','atendente','cozinha')
  )
$$;

-- Escrita ampla temporária da Fase 06. A matriz por cargo entra na Fase 07.
CREATE OR REPLACE FUNCTION private.is_store_manager(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT _store_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid()
      AND r.is_active
      AND r.store_id = _store_id
      AND r.role IN ('proprietario','gerente')
  )
$$;

CREATE OR REPLACE FUNCTION private.current_courier_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT i.courier_id
  FROM public.courier_auth_identities i
  JOIN public.couriers c ON c.id = i.courier_id AND c.store_id = i.store_id
  WHERE i.auth_user_id = auth.uid()
    AND i.is_login_enabled
    AND NOT i.requires_password_change
    AND c.status = 'ativo'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.current_courier_store_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT i.store_id
  FROM public.courier_auth_identities i
  JOIN public.couriers c ON c.id = i.courier_id AND c.store_id = i.store_id
  WHERE i.auth_user_id = auth.uid()
    AND i.is_login_enabled
    AND NOT i.requires_password_change
    AND c.status = 'ativo'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_public_store(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.status = 'ativa'
  )
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, anon, service_role;

-- 3. Identidade do próprio usuário
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
CREATE POLICY user_profiles_select_self ON public.user_profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR private.is_platform_admin());
CREATE POLICY user_profiles_update_self ON public.user_profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
CREATE POLICY user_roles_select_self ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_store_manager(store_id) OR private.is_platform_admin());

-- 4. Entidade global: planos
GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
CREATE POLICY plans_select_active ON public.plans
  FOR SELECT TO authenticated, anon USING (is_active OR private.is_platform_admin());

-- 5. Lojas
GRANT SELECT (id, slug, name, status, segment, phone, whatsapp, city, state, timezone,
              address_line, latitude, longitude, accepts_delivery, accepts_pickup,
              created_at, updated_at) ON public.stores TO anon;
GRANT SELECT, UPDATE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
CREATE POLICY stores_select_public ON public.stores
  FOR SELECT TO anon USING (status = 'ativa');
CREATE POLICY stores_select_member ON public.stores
  FOR SELECT TO authenticated
  USING (
    private.is_store_member(id)
    OR id = private.current_courier_store_id()
    OR private.is_platform_admin()
    OR status = 'ativa'
  );
CREATE POLICY stores_update_manager ON public.stores
  FOR UPDATE TO authenticated
  USING (private.is_store_manager(id)) WITH CHECK (private.is_store_manager(id));

-- 6. Tabelas operacionais da loja: leitura para membros, escrita para gestão
DO $do$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'store_settings','store_hours','neighborhoods','payment_methods',
  'categories','products','product_variants','option_groups','option_items',
  'product_option_groups','combos','combo_items','promotions',
  'customers','customer_addresses','couriers',
  'orders','order_items','order_item_options','deliveries','delivery_events'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.is_store_member(store_id))',
      t || '_select_member', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (private.is_store_manager(store_id))',
      t || '_insert_manager', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (private.is_store_manager(store_id)) WITH CHECK (private.is_store_manager(store_id))',
      t || '_update_manager', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (private.is_store_manager(store_id))',
      t || '_delete_manager', t);
  END LOOP;
END
$do$;

-- order_status_history: leitura pela loja, escrita só no servidor
GRANT SELECT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
CREATE POLICY order_status_history_select_member ON public.order_status_history
  FOR SELECT TO authenticated USING (private.is_store_member(store_id));

-- 7. Catálogo público (visitante do cardápio)
GRANT SELECT ON public.store_settings, public.store_hours, public.neighborhoods,
                public.payment_methods, public.categories, public.products,
                public.product_variants, public.option_groups, public.option_items,
                public.product_option_groups, public.combos, public.combo_items,
                public.promotions TO anon;

CREATE POLICY store_settings_select_public ON public.store_settings
  FOR SELECT TO anon USING (private.is_public_store(store_id));
CREATE POLICY store_hours_select_public ON public.store_hours
  FOR SELECT TO anon USING (is_active AND private.is_public_store(store_id));
CREATE POLICY neighborhoods_select_public ON public.neighborhoods
  FOR SELECT TO anon USING (is_active AND private.is_public_store(store_id));
CREATE POLICY payment_methods_select_public ON public.payment_methods
  FOR SELECT TO anon USING (is_active AND private.is_public_store(store_id));
CREATE POLICY categories_select_public ON public.categories
  FOR SELECT TO anon USING (is_active AND private.is_public_store(store_id));
CREATE POLICY products_select_public ON public.products
  FOR SELECT TO anon USING (is_available AND private.is_public_store(store_id));
CREATE POLICY product_variants_select_public ON public.product_variants
  FOR SELECT TO anon USING (is_available AND private.is_public_store(store_id));
CREATE POLICY option_groups_select_public ON public.option_groups
  FOR SELECT TO anon USING (private.is_public_store(store_id));
CREATE POLICY option_items_select_public ON public.option_items
  FOR SELECT TO anon USING (is_available AND private.is_public_store(store_id));
CREATE POLICY product_option_groups_select_public ON public.product_option_groups
  FOR SELECT TO anon USING (private.is_public_store(store_id));
CREATE POLICY combos_select_public ON public.combos
  FOR SELECT TO anon USING (is_active AND private.is_public_store(store_id));
CREATE POLICY combo_items_select_public ON public.combo_items
  FOR SELECT TO anon USING (private.is_public_store(store_id));
CREATE POLICY promotions_select_public ON public.promotions
  FOR SELECT TO anon
  USING (
    is_active
    AND private.is_public_store(store_id)
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

-- 8. Entregador
CREATE POLICY couriers_select_self ON public.couriers
  FOR SELECT TO authenticated USING (id = private.current_courier_id());

CREATE POLICY deliveries_select_courier ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    store_id = private.current_courier_store_id()
    AND (courier_id = private.current_courier_id() OR courier_id IS NULL)
  );
CREATE POLICY deliveries_update_courier ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    store_id = private.current_courier_store_id()
    AND (courier_id = private.current_courier_id() OR courier_id IS NULL)
  )
  WITH CHECK (
    store_id = private.current_courier_store_id()
    AND courier_id = private.current_courier_id()
  );

CREATE POLICY delivery_events_select_courier ON public.delivery_events
  FOR SELECT TO authenticated
  USING (store_id = private.current_courier_store_id() AND courier_id = private.current_courier_id());
CREATE POLICY delivery_events_insert_courier ON public.delivery_events
  FOR INSERT TO authenticated
  WITH CHECK (
    store_id = private.current_courier_store_id()
    AND courier_id = private.current_courier_id()
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
        AND d.store_id = delivery_events.store_id
        AND d.courier_id = private.current_courier_id()
    )
  );

CREATE POLICY orders_select_courier ON public.orders
  FOR SELECT TO authenticated
  USING (
    store_id = private.current_courier_store_id()
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.order_id = orders.id
        AND d.store_id = orders.store_id
        AND d.courier_id = private.current_courier_id()
    )
  );
CREATE POLICY order_items_select_courier ON public.order_items
  FOR SELECT TO authenticated
  USING (
    store_id = private.current_courier_store_id()
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.order_id = order_items.order_id
        AND d.store_id = order_items.store_id
        AND d.courier_id = private.current_courier_id()
    )
  );

-- Credenciais de entregador: nunca para anon, nunca escrita pelo aplicativo
GRANT SELECT ON public.courier_auth_identities TO authenticated;
GRANT ALL ON public.courier_auth_identities TO service_role;
CREATE POLICY courier_identities_select_self ON public.courier_auth_identities
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR private.is_store_manager(store_id));

-- 9. Tokens de push: somente o próprio dono
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT ALL ON public.device_push_tokens TO service_role;
CREATE POLICY device_push_tokens_own ON public.device_push_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR courier_id = private.current_courier_id())
  WITH CHECK (user_id = auth.uid() OR courier_id = private.current_courier_id());

-- 10. Assinaturas e cobranças: loja lê a sua, plataforma lê todas
GRANT SELECT ON public.store_subscriptions, public.subscription_payments TO authenticated;
GRANT ALL ON public.store_subscriptions, public.subscription_payments TO service_role;
CREATE POLICY store_subscriptions_select ON public.store_subscriptions
  FOR SELECT TO authenticated
  USING (private.is_store_manager(store_id) OR private.is_platform_admin());
CREATE POLICY subscription_payments_select ON public.subscription_payments
  FOR SELECT TO authenticated
  USING (private.is_store_manager(store_id) OR private.is_platform_admin());

-- 11. Auditoria: somente leitura, sem escrita pelo aplicativo
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (private.is_platform_admin() OR private.is_store_manager(store_id));

-- 12. Administração da plataforma: institucional e financeiro, nunca dado de cliente
CREATE POLICY stores_admin_manage ON public.stores
  FOR ALL TO authenticated
  USING (private.is_platform_admin()) WITH CHECK (private.is_platform_admin());

-- 13. View de contagem derivada respeita o RLS de quem consulta
ALTER VIEW IF EXISTS public.courier_delivery_counts SET (security_invoker = true);
