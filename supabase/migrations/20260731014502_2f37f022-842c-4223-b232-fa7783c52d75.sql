-- =====================================================================
-- PEDIU AQUI — FASE 04 — Seed determinístico de validação (desenvolvimento)
-- Prova que o catálogo genérico atende 5 modelos sem tabela específica de segmento.
-- NUNCA aplicar este conteúdo como dado real de produção.
-- =====================================================================

INSERT INTO public.plans (id, code, name, description, monthly_price, max_orders_month, max_team_members, max_couriers, sort_order)
VALUES
  ('00000000-0000-4000-8000-000000000101','essencial','Essencial','Para quem está começando',  99.00,  300,  3, 2, 1),
  ('00000000-0000-4000-8000-000000000102','profissional','Profissional','Operação completa', 189.00, 1500, 10, 8, 2),
  ('00000000-0000-4000-8000-000000000103','avancado','Avançado','Alto volume',               299.00, NULL, NULL, NULL, 3)
ON CONFLICT (id) DO NOTHING;

DO $seed$
DECLARE
  v_store   uuid;
  v_cat     uuid;
  v_prod    uuid;
  v_group   uuid;
  v_sub     uuid;
  v_slug    text;
  r         record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.stores) THEN
    RAISE NOTICE 'Seed ignorado: já existem lojas.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------- LOJAS BASE
  FOR r IN
    SELECT * FROM (VALUES
      ('00000000-0000-4000-8000-000000000201'::uuid,'brasa-urbana','Brasa Urbana','Hamburgueria','#E2574C','00000000-0000-4000-8000-000000000102'::uuid),
      ('00000000-0000-4000-8000-000000000202'::uuid,'forno-di-pietra','Forno di Pietra','Pizzaria','#C1121F','00000000-0000-4000-8000-000000000102'::uuid),
      ('00000000-0000-4000-8000-000000000203'::uuid,'casa-da-marmita','Casa da Marmita','Marmitaria','#2A9D8F','00000000-0000-4000-8000-000000000101'::uuid),
      ('00000000-0000-4000-8000-000000000204'::uuid,'acai-do-cerrado','Açaí do Cerrado','Açaiteria','#6D28D9','00000000-0000-4000-8000-000000000101'::uuid),
      ('00000000-0000-4000-8000-000000000205'::uuid,'mercado-aurora','Mercado Aurora','Mercado','#0F766E','00000000-0000-4000-8000-000000000103'::uuid)
    ) AS s(id,slug,name,segment,accent,plan_id)
  LOOP
    INSERT INTO public.stores (id, slug, name, segment, status, phone, whatsapp, city, state, address_line)
    VALUES (r.id, r.slug, r.name, r.segment, 'ativa', '6330000000', '63990000000', 'Palmas', 'TO', 'Rua Exemplo, 100 — Centro');

    INSERT INTO public.store_settings (store_id, brand_accent, description, welcome_message, closed_message, min_order_amount, default_prep_minutes)
    VALUES (r.id, r.accent, r.segment || ' fictícia usada para validar a arquitetura.',
            'Bem-vindo! Faça seu pedido em poucos passos.',
            'Estamos fechados agora. Confira nossos horários.', 15.00, 35);

    INSERT INTO public.store_hours (store_id, weekday, opens_at, closes_at)
    SELECT r.id, d, '18:00'::time, '23:30'::time FROM generate_series(0,6) AS d;

    INSERT INTO public.neighborhoods (store_id, name, delivery_fee, min_order_amount, eta_minutes, sort_order)
    VALUES
      (r.id,'Centro',        6.00, 20.00, 30, 1),
      (r.id,'Jardim Aurora', 8.00, 25.00, 40, 2),
      (r.id,'Vila Nova',    10.00, 30.00, 50, 3);

    INSERT INTO public.payment_methods (store_id, kind, label, needs_change, sort_order)
    VALUES
      (r.id,'dinheiro','Dinheiro', true, 1),
      (r.id,'pix','Pix na entrega', false, 2),
      (r.id,'cartao_debito','Cartão de débito', false, 3),
      (r.id,'cartao_credito','Cartão de crédito', false, 4);

    INSERT INTO public.store_subscriptions (store_id, plan_id, monthly_price, due_day, current_period_end)
    SELECT r.id, p.id, p.monthly_price, 10, (CURRENT_DATE + INTERVAL '30 days')::date
    FROM public.plans p WHERE p.id = r.plan_id
    RETURNING id INTO v_sub;

    INSERT INTO public.subscription_payments (store_id, subscription_id, reference_month, amount, status, paid_at)
    VALUES (r.id, v_sub, date_trunc('month', CURRENT_DATE)::date,
            (SELECT monthly_price FROM public.plans WHERE id = r.plan_id), 'pago', now());

    INSERT INTO public.couriers (store_id, full_name, phone, vehicle, completed_deliveries_count)
    VALUES (r.id, 'Entregador Demonstração', '63988880000', 'Moto', 0);
  END LOOP;

  -- ================================================ MODELO 1 — HAMBURGUERIA
  v_store := '00000000-0000-4000-8000-000000000201';

  INSERT INTO public.option_groups (store_id, name, selection_type, is_required, min_selections, max_selections, allow_quantity)
  VALUES (v_store,'Adicionais','multipla', false, 0, 5, true) RETURNING id INTO v_group;
  INSERT INTO public.option_items (store_id, option_group_id, name, additional_price, sort_order) VALUES
    (v_store,v_group,'Bacon',        5.00,1),
    (v_store,v_group,'Cheddar extra',4.00,2),
    (v_store,v_group,'Ovo',          3.00,3),
    (v_store,v_group,'Cebola caramelizada',3.50,4);

  INSERT INTO public.categories (store_id, name, sort_order) VALUES (v_store,'Hambúrgueres',1) RETURNING id INTO v_cat;
  INSERT INTO public.products (store_id, category_id, name, description, base_price, is_featured, sort_order)
  VALUES (v_store,v_cat,'Clássico da Casa','Blend 160g, queijo, alface e tomate',28.00,true,1) RETURNING id INTO v_prod;
  INSERT INTO public.product_option_groups (store_id, product_id, option_group_id, sort_order) VALUES (v_store,v_prod,v_group,1);

  INSERT INTO public.categories (store_id, name, sort_order) VALUES (v_store,'Bebidas',2) RETURNING id INTO v_cat;
  INSERT INTO public.products (store_id, category_id, name, base_price, sort_order)
  VALUES (v_store,v_cat,'Refrigerante lata 350ml',7.00,1);

  -- ==================================================== MODELO 2 — PIZZARIA
  v_store := '00000000-0000-4000-8000-000000000202';

  INSERT INTO public.categories (store_id, name, sort_order) VALUES (v_store,'Pizzas salgadas',1) RETURNING id INTO v_cat;
  INSERT INTO public.products (store_id, category_id, name, description, base_price, has_variants, sort_order)
  VALUES (v_store,v_cat,'Pizza montada','Escolha tamanho, sabores e borda',0.00,true,1) RETURNING id INTO v_prod;
  INSERT INTO public.product_variants (store_id, product_id, name, price, is_default, sort_order) VALUES
    (v_store,v_prod,'Média (6 fatias)',49.00,true,1),
    (v_store,v_prod,'Grande (8 fatias)',62.00,false,2),
    (v_store,v_prod,'Família (12 fatias)',79.00,false,3);

  INSERT INTO public.option_groups (store_id, name, selection_type, is_required, min_selections, max_selections)
  VALUES (v_store,'Sabores','multipla', true, 1, 2) RETURNING id INTO v_group;
  INSERT INTO public.option_items (store_id, option_group_id, name, additional_price, sort_order) VALUES
    (v_store,v_group,'Mussarela',0.00,1),
    (v_store,v_group,'Calabresa',0.00,2),
    (v_store,v_group,'Portuguesa',4.00,3),
    (v_store,v_group,'Frango com catupiry',6.00,4);
  INSERT INTO public.product_option_groups (store_id, product_id, option_group_id, sort_order) VALUES (v_store,v_prod,v_group,1);

  INSERT INTO public.option_groups (store_id, name, selection_type, is_required, min_selections, max_selections)
  VALUES (v_store,'Borda','unica', true, 1, 1) RETURNING id INTO v_group;
  INSERT INTO public.option_items (store_id, option_group_id, name, additional_price, sort_order) VALUES
    (v_store,v_group,'Sem borda',0.00,1),
    (v_store,v_group,'Catupiry',8.00,2),
    (v_store,v_group,'Cheddar',8.00,3);
  INSERT INTO public.product_option_groups (store_id, product_id, option_group_id, sort_order) VALUES (v_store,v_prod,v_group,2);

  -- =================================================== MODELO 3 — MARMITARIA
  v_store := '00000000-0000-4000-8000-000000000203';

  INSERT INTO public.categories (store_id, name, sort_order) VALUES (v_store,'Marmitas',1) RETURNING id INTO v_cat;
  INSERT INTO public.products (store_id, category_id, name, description, base_price, has_variants, sort_order)
  VALUES (v_store,v_cat,'Marmita do dia','Arroz, feijão, proteína e acompanhamentos',0.00,true,1) RETURNING id INTO v_prod;
  INSERT INTO public.product_variants (store_id, product_id, name, price, is_default, sort_order) VALUES
    (v_store,v_prod,'P',18.00,false,1),
    (v_store,v_prod,'M',22.00,true,2),
    (v_store,v_prod,'G',26.00,false,3);

  INSERT INTO public.option_groups (store_id, name, selection_type, is_required, min_selections, max_selections)
  VALUES (v_store,'Proteína','unica', true, 1, 1) RETURNING id INTO v_group;
  INSERT INTO public.option_items (store_id, option_group_id, name, additional_price, sort_order) VALUES
    (v_store,v_group,'Frango grelhado',0.00,1),
    (v_store,v_group,'Carne de panela',3.00,2),
    (v_store,v_group,'Peixe',5.00,3);
  INSERT INTO public.product_option_groups (store_id, product_id, option_group_id, sort_order) VALUES (v_store,v_prod,v_group,1);

  INSERT INTO public.option_groups (store_id, name, selection_type, is_required, min_selections, max_selections)
  VALUES (v_store,'Acompanhamentos','multipla', false, 0, 3) RETURNING id INTO v_group;
  INSERT INTO public.option_items (store_id, option_group_id, name, additional_price, sort_order) VALUES
    (v_store,v_group,'Farofa',0.00,1),
    (v_store,v_group,'Vinagrete',0.00,2),
    (v_store,v_group,'Batata frita',4.00,3),
    (v_store,v_group,'Salada',0.00,4);
  INSERT INTO public.product_option_groups (store_id, product_id, option_group_id, sort_order) VALUES (v_store,v_prod,v_group,2);

  -- ======================================================= MODELO 4 — AÇAÍ
  v_store := '00000000-0000-4000-8000-000000000204';

  INSERT INTO public.categories (store_id, name, sort_order) VALUES (v_store,'Açaí',1) RETURNING id INTO v_cat;
  INSERT INTO public.products (store_id, category_id, name, description, base_price, has_variants, sort_order)
  VALUES (v_store,v_cat,'Açaí tradicional','Monte do seu jeito',0.00,true,1) RETURNING id INTO v_prod;
  INSERT INTO public.product_variants (store_id, product_id, name, price, is_default, sort_order) VALUES
    (v_store,v_prod,'300ml',14.00,true,1),
    (v_store,v_prod,'500ml',19.00,false,2),
    (v_store,v_prod,'700ml',24.00,false,3);

  INSERT INTO public.option_groups (store_id, name, selection_type, is_required, min_selections, max_selections, allow_quantity)
  VALUES (v_store,'Complementos','multipla', false, 0, 5, false) RETURNING id INTO v_group;
  INSERT INTO public.option_items (store_id, option_group_id, name, additional_price, sort_order) VALUES
    (v_store,v_group,'Granola',0.00,1),
    (v_store,v_group,'Leite condensado',2.00,2),
    (v_store,v_group,'Banana',2.00,3),
    (v_store,v_group,'Morango',4.00,4),
    (v_store,v_group,'Paçoca',2.50,5);
  INSERT INTO public.product_option_groups (store_id, product_id, option_group_id, sort_order) VALUES (v_store,v_prod,v_group,1);

  -- ==================================================== MODELO 5 — MERCADO
  v_store := '00000000-0000-4000-8000-000000000205';

  INSERT INTO public.categories (store_id, name, sort_order) VALUES (v_store,'Hortifrúti',1) RETURNING id INTO v_cat;
  INSERT INTO public.products (store_id, category_id, name, base_price, pricing_unit, unit_label, sort_order)
  VALUES (v_store,v_cat,'Banana prata',7.90,'peso','kg',1);
  INSERT INTO public.products (store_id, category_id, name, base_price, pricing_unit, unit_label, sort_order)
  VALUES (v_store,v_cat,'Tomate',9.50,'peso','kg',2);

  INSERT INTO public.categories (store_id, name, sort_order) VALUES (v_store,'Mercearia',2) RETURNING id INTO v_cat;
  INSERT INTO public.products (store_id, category_id, name, base_price, pricing_unit, unit_label, max_quantity, sort_order)
  VALUES (v_store,v_cat,'Arroz tipo 1 — 5kg',24.90,'unidade','pacote',10,1);
  INSERT INTO public.products (store_id, category_id, name, base_price, pricing_unit, unit_label, sort_order)
  VALUES (v_store,v_cat,'Feijão carioca — 1kg',8.40,'unidade','pacote',2);

  RAISE NOTICE 'Seed de validação aplicado para 5 modelos de negócio.';
END
$seed$;

-- =====================================================================
-- ASSERÇÕES DE INTEGRIDADE
-- =====================================================================
DO $assert$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.stores;
  IF n <> 5 THEN RAISE EXCEPTION 'Esperadas 5 lojas de validação, encontradas %', n; END IF;

  -- Toda tabela operacional precisa de store_id
  SELECT count(*) INTO n
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT IN ('plans','user_profiles','audit_logs','device_push_tokens','user_roles','store_settings','stores')
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=t.table_name AND c.column_name='store_id');
  IF n > 0 THEN RAISE EXCEPTION 'Existem % tabelas operacionais sem store_id', n; END IF;

  -- RLS habilitada em todas as tabelas do schema public
  SELECT count(*) INTO n FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;
  IF n > 0 THEN RAISE EXCEPTION 'Existem % tabelas sem RLS habilitada', n; END IF;

  -- Nenhuma policy nesta fase (negação por padrão)
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public';
  IF n > 0 THEN RAISE EXCEPTION 'A Fase 04 não deve ter policies; encontradas %', n; END IF;

  -- plans NÃO deve ter store_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='plans' AND column_name='store_id') THEN
    RAISE EXCEPTION 'plans não pode ter store_id';
  END IF;

  -- user_profiles não pode conter papel/permissão
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='user_profiles'
               AND column_name IN ('role','roles','permissions','is_admin')) THEN
    RAISE EXCEPTION 'user_profiles não pode conter papel ou permissão';
  END IF;

  -- Nenhuma tabela específica de segmento
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public'
               AND table_name IN ('pizza_flavors','acai_complements','burger_addons','marmita_proteins')) THEN
    RAISE EXCEPTION 'Tabela específica de segmento detectada';
  END IF;

  -- Nenhum campo financeiro de entregador
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name IN ('couriers','deliveries','delivery_events')
               AND column_name ~ '(pay|salary|commission|fee_courier|wallet|balance|bonus|earning)') THEN
    RAISE EXCEPTION 'Campo financeiro de entregador detectado';
  END IF;

  -- Token de acompanhamento único e longo
  IF EXISTS (SELECT 1 FROM public.orders WHERE length(public_tracking_token) < 32) THEN
    RAISE EXCEPTION 'Token de acompanhamento fraco';
  END IF;

  RAISE NOTICE 'Todas as asserções da Fase 04 passaram.';
END
$assert$;