-- Restore the hardened access-control state after the external Supabase clone.
-- No business rows are modified by this migration.

-- 1) RLS must protect every table exposed through the public schema.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;

-- 2) Remove the broad grants introduced by the clone, then restore the
-- least-privilege table grants from the previously hardened Spark database.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

GRANT SELECT ON TABLE public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.category_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.category_profiles TO authenticated;
GRANT SELECT ON TABLE public.combo_items TO authenticated;
GRANT SELECT ON TABLE public.combos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.courier_action_intents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.courier_action_intents TO authenticated;
GRANT SELECT ON TABLE public.couriers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.delivery_occurrences TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.delivery_occurrences TO authenticated;
GRANT SELECT ON TABLE public.neighborhoods TO authenticated;
GRANT SELECT ON TABLE public.option_groups TO authenticated;
GRANT SELECT ON TABLE public.option_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.order_transition_reasons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.order_transition_reasons TO authenticated;
GRANT SELECT ON TABLE public.payment_methods TO authenticated;
GRANT SELECT ON TABLE public.product_option_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.product_variant_option_item_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.product_variant_option_item_prices TO authenticated;
GRANT SELECT ON TABLE public.product_variants TO authenticated;
GRANT SELECT ON TABLE public.products TO authenticated;
GRANT SELECT ON TABLE public.promotions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.store_automation_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.store_automation_rules TO authenticated;
GRANT SELECT ON TABLE public.store_hours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.store_marketing_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.store_marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.store_order_realtime_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.store_order_realtime_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.store_provisioning_intents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.store_provisioning_intents TO authenticated;
GRANT SELECT ON TABLE public.store_settings TO authenticated;
GRANT SELECT ON TABLE public.stores TO authenticated;
GRANT SELECT ON TABLE public.user_profiles TO authenticated;
GRANT UPDATE ON TABLE public.user_profiles TO authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;

-- 3) Restore the policies from the previously hardened Spark database.
DROP POLICY IF EXISTS categories_select_catalog_view ON public.categories;
CREATE POLICY categories_select_catalog_view ON public.categories AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('catalog.view'::app_permission, store_id));

DROP POLICY IF EXISTS category_profiles_admin_manage ON public.category_profiles;
CREATE POLICY category_profiles_admin_manage ON public.category_profiles AS PERMISSIVE FOR ALL TO authenticated USING (private.is_platform_admin()) WITH CHECK (private.is_platform_admin());
DROP POLICY IF EXISTS category_profiles_authenticated_read ON public.category_profiles;
CREATE POLICY category_profiles_authenticated_read ON public.category_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active OR private.is_platform_admin()));
DROP POLICY IF EXISTS category_profiles_public_read ON public.category_profiles;
CREATE POLICY category_profiles_public_read ON public.category_profiles AS PERMISSIVE FOR SELECT TO anon USING (is_active);

DROP POLICY IF EXISTS combo_items_select_catalog_view ON public.combo_items;
CREATE POLICY combo_items_select_catalog_view ON public.combo_items AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('catalog.view'::app_permission, store_id));
DROP POLICY IF EXISTS combos_select_catalog_view ON public.combos;
CREATE POLICY combos_select_catalog_view ON public.combos AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('catalog.view'::app_permission, store_id));
DROP POLICY IF EXISTS couriers_select_self ON public.couriers;
CREATE POLICY couriers_select_self ON public.couriers AS PERMISSIVE FOR SELECT TO authenticated USING (((id = private.current_courier_id()) AND private.has_permission('courier.view_self'::app_permission, store_id)));
DROP POLICY IF EXISTS neighborhoods_select_view_basic ON public.neighborhoods;
CREATE POLICY neighborhoods_select_view_basic ON public.neighborhoods AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('store.view_basic'::app_permission, store_id));
DROP POLICY IF EXISTS option_groups_select_catalog_view ON public.option_groups;
CREATE POLICY option_groups_select_catalog_view ON public.option_groups AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('catalog.view'::app_permission, store_id));
DROP POLICY IF EXISTS option_items_select_catalog_view ON public.option_items;
CREATE POLICY option_items_select_catalog_view ON public.option_items AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('catalog.view'::app_permission, store_id));
DROP POLICY IF EXISTS reasons_read_authenticated ON public.order_transition_reasons;
CREATE POLICY reasons_read_authenticated ON public.order_transition_reasons AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND is_active));
DROP POLICY IF EXISTS payment_methods_select_view_basic ON public.payment_methods;
CREATE POLICY payment_methods_select_view_basic ON public.payment_methods AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('store.view_basic'::app_permission, store_id));
DROP POLICY IF EXISTS product_option_groups_select_catalog_view ON public.product_option_groups;
CREATE POLICY product_option_groups_select_catalog_view ON public.product_option_groups AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('catalog.view'::app_permission, store_id));
DROP POLICY IF EXISTS pvoip_select_catalog_view ON public.product_variant_option_item_prices;
CREATE POLICY pvoip_select_catalog_view ON public.product_variant_option_item_prices AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('catalog.view'::app_permission, store_id));
DROP POLICY IF EXISTS product_variants_select_catalog_view ON public.product_variants;
CREATE POLICY product_variants_select_catalog_view ON public.product_variants AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('catalog.view'::app_permission, store_id));
DROP POLICY IF EXISTS products_select_catalog_view ON public.products;
CREATE POLICY products_select_catalog_view ON public.products AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('catalog.view'::app_permission, store_id));
DROP POLICY IF EXISTS promotions_select_catalog_view ON public.promotions;
CREATE POLICY promotions_select_catalog_view ON public.promotions AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('catalog.view'::app_permission, store_id));

DROP POLICY IF EXISTS store_automation_rules_manager_write ON public.store_automation_rules;
CREATE POLICY store_automation_rules_manager_write ON public.store_automation_rules AS PERMISSIVE FOR ALL TO authenticated USING (private.is_store_manager(store_id)) WITH CHECK (private.is_store_manager(store_id));
DROP POLICY IF EXISTS store_automation_rules_member_select ON public.store_automation_rules;
CREATE POLICY store_automation_rules_member_select ON public.store_automation_rules AS PERMISSIVE FOR SELECT TO authenticated USING (private.is_store_member(store_id));
DROP POLICY IF EXISTS store_hours_select_view_basic ON public.store_hours;
CREATE POLICY store_hours_select_view_basic ON public.store_hours AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('store.view_basic'::app_permission, store_id));
DROP POLICY IF EXISTS store_marketing_campaigns_manager_write ON public.store_marketing_campaigns;
CREATE POLICY store_marketing_campaigns_manager_write ON public.store_marketing_campaigns AS PERMISSIVE FOR ALL TO authenticated USING (private.is_store_manager(store_id)) WITH CHECK (private.is_store_manager(store_id));
DROP POLICY IF EXISTS store_marketing_campaigns_member_select ON public.store_marketing_campaigns;
CREATE POLICY store_marketing_campaigns_member_select ON public.store_marketing_campaigns AS PERMISSIVE FOR SELECT TO authenticated USING (private.is_store_member(store_id));
DROP POLICY IF EXISTS realtime_events_read_own_store ON public.store_order_realtime_events;
CREATE POLICY realtime_events_read_own_store ON public.store_order_realtime_events AS PERMISSIVE FOR SELECT TO authenticated USING ((private.has_permission('orders.view_queue'::app_permission, store_id) OR private.has_permission('kitchen.view'::app_permission, store_id)));
DROP POLICY IF EXISTS provisioning_intents_admin_read ON public.store_provisioning_intents;
CREATE POLICY provisioning_intents_admin_read ON public.store_provisioning_intents AS PERMISSIVE FOR SELECT TO authenticated USING (private.is_platform_admin());
DROP POLICY IF EXISTS store_settings_select_view_basic ON public.store_settings;
CREATE POLICY store_settings_select_view_basic ON public.store_settings AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('store.view_basic'::app_permission, store_id));
DROP POLICY IF EXISTS stores_select_view_basic ON public.stores;
CREATE POLICY stores_select_view_basic ON public.stores AS PERMISSIVE FOR SELECT TO authenticated USING (private.has_permission('store.view_basic'::app_permission, id));
DROP POLICY IF EXISTS user_profiles_select_self ON public.user_profiles;
CREATE POLICY user_profiles_select_self ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (((id = auth.uid()) OR private.is_platform_admin()));
DROP POLICY IF EXISTS user_profiles_update_self ON public.user_profiles;
CREATE POLICY user_profiles_update_self ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
DROP POLICY IF EXISTS user_roles_select_self ON public.user_roles;
CREATE POLICY user_roles_select_self ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR private.is_store_manager(store_id) OR private.is_platform_admin()));

-- 4) SECURITY DEFINER functions: remove inherited PUBLIC/anon execution.
-- Preserve authenticated access for application RPCs, except the server-only
-- routines that were already restricted in the hardened Spark database.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS signature, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.signature);

    IF NOT (
      (r.proname = 'authorize_courier_reset') OR
      (r.proname = 'create_product_starter_group_drafts_legacy') OR
      (r.proname = 'fail_courier_provisioning_admin') OR
      (r.proname = 'fail_store_provisioning') OR
      (r.proname = 'provision_store_courier_admin') OR
      (r.proname = 'provision_store_with_owner') OR
      (r.proname = 'resolve_courier_create_store_admin') OR
      (r.proname LIKE 'storefront_%') OR
      (r.proname = 'update_product_inventory')
    ) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.signature);
    END IF;
  END LOOP;
END $$;

-- The only SECURITY DEFINER RPC intentionally callable directly by anon.
GRANT EXECUTE ON FUNCTION public.check_public_store_slug(text) TO anon, authenticated, service_role;
