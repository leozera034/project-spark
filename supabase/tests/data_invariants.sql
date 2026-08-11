-- Non-destructive operational invariants for Project Spark / Pediu Aqui.
-- Run against a staging/QA database with psql -v ON_ERROR_STOP=1.

DO $$
DECLARE failures bigint;
BEGIN
  SELECT count(*) INTO failures
    FROM public.stores s LEFT JOIN public.store_settings ss ON ss.store_id = s.id
   WHERE ss.store_id IS NULL;
  IF failures > 0 THEN RAISE EXCEPTION 'stores_without_settings=%', failures; END IF;

  SELECT count(*) INTO failures
    FROM public.stores s LEFT JOIN public.store_subscriptions ss ON ss.store_id = s.id
   WHERE ss.store_id IS NULL;
  IF failures > 0 THEN RAISE EXCEPTION 'stores_without_subscription=%', failures; END IF;

  SELECT count(*) INTO failures
    FROM public.orders
   WHERE total_amount <> items_subtotal + delivery_fee - discount_total;
  IF failures > 0 THEN RAISE EXCEPTION 'orders_bad_total=%', failures; END IF;

  SELECT count(*) INTO failures
    FROM public.deliveries d JOIN public.orders o ON o.id = d.order_id
   WHERE d.store_id <> o.store_id;
  IF failures > 0 THEN RAISE EXCEPTION 'delivery_wrong_store=%', failures; END IF;

  SELECT count(*) INTO failures
    FROM public.user_roles r LEFT JOIN public.stores s ON s.id = r.store_id
   WHERE r.store_id IS NOT NULL AND s.id IS NULL;
  IF failures > 0 THEN RAISE EXCEPTION 'role_wrong_store_ref=%', failures; END IF;

  SELECT count(*) INTO failures FROM (
    SELECT slug FROM public.stores GROUP BY slug HAVING count(*) > 1
  ) duplicated;
  IF failures > 0 THEN RAISE EXCEPTION 'duplicate_store_slug=%', failures; END IF;

  SELECT count(*) INTO failures
    FROM public.couriers c
    LEFT JOIN public.user_roles r
      ON r.user_id = c.user_id
     AND r.store_id = c.store_id
     AND r.role = 'entregador'
     AND r.is_active
   WHERE c.status = 'ativo'
     AND c.user_id IS NOT NULL
     AND r.user_id IS NULL;
  IF failures > 0 THEN RAISE EXCEPTION 'active_courier_without_role=%', failures; END IF;
END $$;

SELECT 'data_invariants_passed' AS result;
