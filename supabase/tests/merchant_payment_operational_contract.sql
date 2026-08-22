-- Merchant payment operational contract.
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/merchant_payment_operational_contract.sql

DO $$
DECLARE
  missing_triggers text[];
BEGIN
  IF private.order_payment_operational_ready('stripe_online','pending') THEN
    RAISE EXCEPTION 'stripe_online pending orders must not be operationally visible';
  END IF;

  IF NOT private.order_payment_operational_ready('stripe_online','paid') THEN
    RAISE EXCEPTION 'stripe_online paid orders must be operationally visible';
  END IF;

  IF NOT private.order_payment_operational_ready('pix','not_applicable') THEN
    RAISE EXCEPTION 'offline/non-Stripe methods must keep the existing flow';
  END IF;

  SELECT array_agg(required.name ORDER BY required.name)
    INTO missing_triggers
  FROM (
    VALUES
      ('trg_initialize_order_payment_projection'),
      ('trg_guard_online_order_operational_transition'),
      ('trg_emit_order_payment_realtime_event')
  ) AS required(name)
  WHERE NOT EXISTS (
    SELECT 1
      FROM pg_trigger t
     WHERE t.tgrelid='public.orders'::regclass
       AND NOT t.tgisinternal
       AND t.tgname=required.name
  );

  IF missing_triggers IS NOT NULL THEN
    RAISE EXCEPTION 'Missing merchant payment safety triggers: %', missing_triggers;
  END IF;

  IF pg_get_functiondef('public.list_my_store_orders(uuid,text[],text,text,boolean,timestamp with time zone,timestamp with time zone,integer,timestamp with time zone,uuid)'::regprocedure)
       NOT ILIKE '%private.order_payment_operational_ready%'
     OR pg_get_functiondef('public.get_my_store_order_counts(uuid)'::regprocedure)
       NOT ILIKE '%private.order_payment_operational_ready%'
     OR pg_get_functiondef('public.get_my_store_operational_alerts(uuid)'::regprocedure)
       NOT ILIKE '%private.order_payment_operational_ready%'
     OR pg_get_functiondef('public.get_my_store_order_detail(uuid,uuid)'::regprocedure)
       NOT ILIKE '%private.order_payment_operational_ready%' THEN
    RAISE EXCEPTION 'Merchant order reads must retain the Stripe payment readiness gate';
  END IF;

  IF pg_get_functiondef('private.guard_online_order_operational_transition()'::regprocedure)
       NOT ILIKE '%PAYMENT_NOT_CONFIRMED%'
     OR pg_get_functiondef('private.guard_online_order_operational_transition()'::regprocedure)
       NOT ILIKE '%aguardando_confirmacao%'
     OR pg_get_functiondef('private.guard_online_order_operational_transition()'::regprocedure)
       NOT ILIKE '%stripe_online%' THEN
    RAISE EXCEPTION 'Authoritative unpaid Stripe transition guard is incomplete';
  END IF;
END $$;

SELECT 'merchant_payment_operational_contract_passed' AS result;
