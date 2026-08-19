-- Multi-store scope contract for Comandiva.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/multistore_contract.sql

DO $$
DECLARE
  _fn regprocedure;
BEGIN
  IF to_regprocedure('private.require_delivery_report_store(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing explicit delivery report store guard';
  END IF;

  IF pg_get_functiondef('private.require_delivery_report_store(uuid)'::regprocedure)
       NOT ILIKE '%reports.view_operational%'
     OR pg_get_functiondef('private.require_delivery_report_store(uuid)'::regprocedure)
       NOT ILIKE '%private.resolve_store%'
  THEN
    RAISE EXCEPTION 'Explicit report store guard must resolve membership and require reports permission';
  END IF;

  FOREACH _fn IN ARRAY ARRAY[
    'public.get_my_store_delivery_report_summary(uuid,text,date,date)'::regprocedure,
    'public.get_my_store_delivery_report_series(uuid,text,date,date)'::regprocedure,
    'public.list_my_store_delivery_report_by_courier(uuid,text,date,date)'::regprocedure,
    'public.list_my_store_completed_deliveries(uuid,text,date,date,uuid,integer,integer)'::regprocedure
  ]
  LOOP
    IF pg_get_functiondef(_fn) NOT ILIKE '%private.require_delivery_report_store%'
       OR NOT has_function_privilege('authenticated', _fn, 'EXECUTE')
       OR has_function_privilege('anon', _fn, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'Invalid explicit store report contract for %', _fn;
    END IF;
  END LOOP;

  -- Legacy overloads remain available for single-store clients. With multiple
  -- memberships, private.resolve_store(NULL) must continue to fail closed.
  IF to_regprocedure('public.get_my_store_delivery_report_summary(text,date,date)') IS NULL
     OR to_regprocedure('public.get_my_store_delivery_report_series(text,date,date)') IS NULL
     OR to_regprocedure('public.list_my_store_delivery_report_by_courier(text,date,date)') IS NULL
     OR to_regprocedure('public.list_my_store_completed_deliveries(text,date,date,uuid,integer,integer)') IS NULL
  THEN
    RAISE EXCEPTION 'Legacy single-store delivery report overloads were removed';
  END IF;
END $$;

SELECT 'multistore_contract_passed' AS result;
