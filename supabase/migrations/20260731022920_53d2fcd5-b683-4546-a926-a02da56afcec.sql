-- =====================================================================
-- FASE 07 / BLOCO A — Correção do escopo da Fase 06
-- Remove policies e grants que anteciparam as Fases 11, 21, 22, 24 e 25.
-- Preserva: schema private, funções de contexto, RLS habilitada/forçada,
-- isolamento por store_id, chaves estrangeiras compostas.
-- Rollback: reaplicar a migration 20260731021956 (policies da Fase 06).
-- =====================================================================

-- ---------------------------------------------------------------------
-- A.1 — Acesso anônimo ao catálogo real (pertence à Fase 11)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS stores_select_public                ON public.stores;
DROP POLICY IF EXISTS store_settings_select_public        ON public.store_settings;
DROP POLICY IF EXISTS store_hours_select_public           ON public.store_hours;
DROP POLICY IF EXISTS neighborhoods_select_public         ON public.neighborhoods;
DROP POLICY IF EXISTS payment_methods_select_public       ON public.payment_methods;
DROP POLICY IF EXISTS categories_select_public            ON public.categories;
DROP POLICY IF EXISTS products_select_public              ON public.products;
DROP POLICY IF EXISTS product_variants_select_public      ON public.product_variants;
DROP POLICY IF EXISTS option_groups_select_public         ON public.option_groups;
DROP POLICY IF EXISTS option_items_select_public          ON public.option_items;
DROP POLICY IF EXISTS product_option_groups_select_public ON public.product_option_groups;
DROP POLICY IF EXISTS combos_select_public                ON public.combos;
DROP POLICY IF EXISTS combo_items_select_public           ON public.combo_items;
DROP POLICY IF EXISTS promotions_select_public            ON public.promotions;
DROP POLICY IF EXISTS plans_select_active                 ON public.plans;

-- ---------------------------------------------------------------------
-- A.2 — Acesso operacional do entregador (pertence às Fases 21 e 22)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS deliveries_select_courier      ON public.deliveries;
DROP POLICY IF EXISTS deliveries_update_courier      ON public.deliveries;
DROP POLICY IF EXISTS delivery_events_select_courier ON public.delivery_events;
DROP POLICY IF EXISTS delivery_events_insert_courier ON public.delivery_events;
DROP POLICY IF EXISTS orders_select_courier          ON public.orders;
DROP POLICY IF EXISTS order_items_select_courier     ON public.order_items;

-- ---------------------------------------------------------------------
-- A.3 — Acesso global da administração (pertence às Fases 24 e 25)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_select              ON public.audit_logs;
DROP POLICY IF EXISTS store_subscriptions_select     ON public.store_subscriptions;
DROP POLICY IF EXISTS subscription_payments_select   ON public.subscription_payments;
DROP POLICY IF EXISTS stores_admin_manage            ON public.stores;

-- ---------------------------------------------------------------------
-- A.4 — Escrita ampla de proprietário/gerente (autorização por ação: fases funcionais)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS stores_update_manager                  ON public.stores;
DROP POLICY IF EXISTS store_settings_insert_manager          ON public.store_settings;
DROP POLICY IF EXISTS store_settings_update_manager          ON public.store_settings;
DROP POLICY IF EXISTS store_settings_delete_manager          ON public.store_settings;
DROP POLICY IF EXISTS store_hours_insert_manager             ON public.store_hours;
DROP POLICY IF EXISTS store_hours_update_manager             ON public.store_hours;
DROP POLICY IF EXISTS store_hours_delete_manager             ON public.store_hours;
DROP POLICY IF EXISTS neighborhoods_insert_manager           ON public.neighborhoods;
DROP POLICY IF EXISTS neighborhoods_update_manager           ON public.neighborhoods;
DROP POLICY IF EXISTS neighborhoods_delete_manager           ON public.neighborhoods;
DROP POLICY IF EXISTS payment_methods_insert_manager         ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_update_manager         ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_delete_manager         ON public.payment_methods;
DROP POLICY IF EXISTS categories_insert_manager              ON public.categories;
DROP POLICY IF EXISTS categories_update_manager              ON public.categories;
DROP POLICY IF EXISTS categories_delete_manager              ON public.categories;
DROP POLICY IF EXISTS products_insert_manager                ON public.products;
DROP POLICY IF EXISTS products_update_manager                ON public.products;
DROP POLICY IF EXISTS products_delete_manager                ON public.products;
DROP POLICY IF EXISTS product_variants_insert_manager        ON public.product_variants;
DROP POLICY IF EXISTS product_variants_update_manager        ON public.product_variants;
DROP POLICY IF EXISTS product_variants_delete_manager        ON public.product_variants;
DROP POLICY IF EXISTS option_groups_insert_manager           ON public.option_groups;
DROP POLICY IF EXISTS option_groups_update_manager           ON public.option_groups;
DROP POLICY IF EXISTS option_groups_delete_manager           ON public.option_groups;
DROP POLICY IF EXISTS option_items_insert_manager            ON public.option_items;
DROP POLICY IF EXISTS option_items_update_manager            ON public.option_items;
DROP POLICY IF EXISTS option_items_delete_manager            ON public.option_items;
DROP POLICY IF EXISTS product_option_groups_insert_manager   ON public.product_option_groups;
DROP POLICY IF EXISTS product_option_groups_update_manager   ON public.product_option_groups;
DROP POLICY IF EXISTS product_option_groups_delete_manager   ON public.product_option_groups;
DROP POLICY IF EXISTS combos_insert_manager                  ON public.combos;
DROP POLICY IF EXISTS combos_update_manager                  ON public.combos;
DROP POLICY IF EXISTS combos_delete_manager                  ON public.combos;
DROP POLICY IF EXISTS combo_items_insert_manager             ON public.combo_items;
DROP POLICY IF EXISTS combo_items_update_manager             ON public.combo_items;
DROP POLICY IF EXISTS combo_items_delete_manager             ON public.combo_items;
DROP POLICY IF EXISTS promotions_insert_manager              ON public.promotions;
DROP POLICY IF EXISTS promotions_update_manager              ON public.promotions;
DROP POLICY IF EXISTS promotions_delete_manager              ON public.promotions;
DROP POLICY IF EXISTS couriers_insert_manager                ON public.couriers;
DROP POLICY IF EXISTS couriers_update_manager                ON public.couriers;
DROP POLICY IF EXISTS couriers_delete_manager                ON public.couriers;
DROP POLICY IF EXISTS customers_insert_manager               ON public.customers;
DROP POLICY IF EXISTS customers_update_manager               ON public.customers;
DROP POLICY IF EXISTS customers_delete_manager               ON public.customers;
DROP POLICY IF EXISTS customer_addresses_insert_manager      ON public.customer_addresses;
DROP POLICY IF EXISTS customer_addresses_update_manager      ON public.customer_addresses;
DROP POLICY IF EXISTS customer_addresses_delete_manager      ON public.customer_addresses;
DROP POLICY IF EXISTS orders_insert_manager                  ON public.orders;
DROP POLICY IF EXISTS orders_update_manager                  ON public.orders;
DROP POLICY IF EXISTS orders_delete_manager                  ON public.orders;
DROP POLICY IF EXISTS order_items_insert_manager             ON public.order_items;
DROP POLICY IF EXISTS order_items_update_manager             ON public.order_items;
DROP POLICY IF EXISTS order_items_delete_manager             ON public.order_items;
DROP POLICY IF EXISTS order_item_options_insert_manager      ON public.order_item_options;
DROP POLICY IF EXISTS order_item_options_update_manager      ON public.order_item_options;
DROP POLICY IF EXISTS order_item_options_delete_manager      ON public.order_item_options;
DROP POLICY IF EXISTS deliveries_insert_manager              ON public.deliveries;
DROP POLICY IF EXISTS deliveries_update_manager              ON public.deliveries;
DROP POLICY IF EXISTS deliveries_delete_manager              ON public.deliveries;
DROP POLICY IF EXISTS delivery_events_insert_manager         ON public.delivery_events;
DROP POLICY IF EXISTS delivery_events_update_manager         ON public.delivery_events;
DROP POLICY IF EXISTS delivery_events_delete_manager         ON public.delivery_events;

-- ---------------------------------------------------------------------
-- A.5 — Leitura de dados pessoais e operacionais (fases funcionais)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS customers_select_member           ON public.customers;
DROP POLICY IF EXISTS customer_addresses_select_member  ON public.customer_addresses;
DROP POLICY IF EXISTS orders_select_member              ON public.orders;
DROP POLICY IF EXISTS order_items_select_member         ON public.order_items;
DROP POLICY IF EXISTS order_item_options_select_member  ON public.order_item_options;
DROP POLICY IF EXISTS order_status_history_select_member ON public.order_status_history;
DROP POLICY IF EXISTS deliveries_select_member          ON public.deliveries;
DROP POLICY IF EXISTS delivery_events_select_member     ON public.delivery_events;
DROP POLICY IF EXISTS couriers_select_member            ON public.couriers;
DROP POLICY IF EXISTS courier_identities_select_self    ON public.courier_auth_identities;
DROP POLICY IF EXISTS device_push_tokens_own            ON public.device_push_tokens;

-- ---------------------------------------------------------------------
-- A.6 — Grants: zerar e reconceder apenas o mínimo desta fase
-- ---------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM anon;

-- Leitura mínima permitida na Fase 07 (sempre limitada por policy)
GRANT SELECT ON
  public.user_profiles,
  public.user_roles,
  public.stores,
  public.store_settings,
  public.store_hours,
  public.neighborhoods,
  public.payment_methods,
  public.categories,
  public.products,
  public.product_variants,
  public.option_groups,
  public.option_items,
  public.product_option_groups,
  public.combos,
  public.combo_items,
  public.promotions,
  public.couriers
TO authenticated;

-- Autoatendimento de perfil (não altera papéis, que vivem em user_roles)
GRANT UPDATE (full_name, display_name, phone, avatar_url)
  ON public.user_profiles TO authenticated;
