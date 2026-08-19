-- Security contract smoke tests for Pediu Aqui / Project Spark.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security_contract.sql

DO $$
DECLARE
  exposed text[];
  missing_rls text[];
  unexpected_category_definers text[];
  platform_scope_constraint_ok boolean;
BEGIN
  SELECT array_agg(format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)))
    INTO exposed
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef
     AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF exposed IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected anon SECURITY DEFINER exposure: %', exposed;
  END IF;

  IF has_function_privilege(
      'anon',
      'public.check_public_store_slug(text)'::regprocedure,
      'EXECUTE')
     OR has_function_privilege(
      'authenticated',
      'public.check_public_store_slug(text)'::regprocedure,
      'EXECUTE')
     OR NOT has_function_privilege(
      'service_role',
      'public.check_public_store_slug(text)'::regprocedure,
      'EXECUTE') THEN
    RAISE EXCEPTION 'check_public_store_slug must remain service-role-only behind the Edge gateway';
  END IF;

  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
    INTO unexpected_category_definers
    FROM pg_proc p
   WHERE p.oid = ANY (ARRAY[
     'public.list_active_category_profiles()'::regprocedure::oid,
     'public.admin_list_category_profiles()'::regprocedure::oid,
     'public.admin_save_category_profile(uuid,text,text,text,text,jsonb,jsonb,boolean,integer)'::regprocedure::oid
   ])
     AND p.prosecdef;

  IF unexpected_category_definers IS NOT NULL THEN
    RAISE EXCEPTION 'Category profile RPCs must remain SECURITY INVOKER: %', unexpected_category_definers;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_roles'
      AND c.conname = 'user_roles_scope_check'
      AND c.convalidated
      AND pg_get_constraintdef(c.oid) ILIKE '%admin_plataforma%'
      AND pg_get_constraintdef(c.oid) ILIKE '%store_id IS NULL%'
  ) INTO platform_scope_constraint_ok;

  IF NOT platform_scope_constraint_ok THEN
    RAISE EXCEPTION 'user_roles must structurally keep admin_plataforma global (store_id IS NULL)';
  END IF;

  IF pg_get_functiondef('private.is_platform_admin()'::regprocedure) NOT ILIKE '%store_id IS NULL%'
     OR pg_get_functiondef('private.has_permission(public.app_permission,uuid)'::regprocedure) NOT ILIKE '%store_id IS NULL%' THEN
    RAISE EXCEPTION 'Platform authorization helpers must enforce global-role scope';
  END IF;

  IF pg_get_functiondef('public.get_platform_health_summary()'::regprocedure) NOT ILIKE '%platform.stores.view%'
     OR pg_get_functiondef('public.list_platform_stores(text,text,integer,integer)'::regprocedure) NOT ILIKE '%platform.stores.view%'
     OR pg_get_functiondef('public.get_platform_billing_summary()'::regprocedure) NOT ILIKE '%platform.billing.view%'
     OR pg_get_functiondef('public.get_platform_recent_errors(integer)'::regprocedure) NOT ILIKE '%platform.audit.view%'
     OR pg_get_functiondef('public.admin_suspend_store(uuid,text)'::regprocedure) NOT ILIKE '%platform.stores.suspend%'
     OR pg_get_functiondef('public.admin_reactivate_store(uuid)'::regprocedure) NOT ILIKE '%platform.stores.reactivate%' THEN
    RAISE EXCEPTION 'Platform RPCs must retain their explicit permission guards';
  END IF;

  IF pg_get_functiondef('private.is_store_member(uuid)'::regprocedure) NOT ILIKE '%user_profiles%'
     OR pg_get_functiondef('private.is_store_member(uuid)'::regprocedure) NOT ILIKE '%p.is_active%'
     OR pg_get_functiondef('private.is_store_manager(uuid)'::regprocedure) NOT ILIKE '%user_profiles%'
     OR pg_get_functiondef('private.is_store_manager(uuid)'::regprocedure) NOT ILIKE '%p.is_active%' THEN
    RAISE EXCEPTION 'Store membership helpers must reject inactive user profiles';
  END IF;

  IF pg_get_functiondef('private.current_courier_id()'::regprocedure) NOT ILIKE '%user_profiles%'
     OR pg_get_functiondef('private.current_courier_id()'::regprocedure) NOT ILIKE '%p.is_active%'
     OR pg_get_functiondef('private.current_courier_store_id()'::regprocedure) NOT ILIKE '%user_profiles%'
     OR pg_get_functiondef('private.current_courier_store_id()'::regprocedure) NOT ILIKE '%p.is_active%' THEN
    RAISE EXCEPTION 'Courier identity helpers must reject inactive user profiles';
  END IF;

  IF pg_get_functiondef('public.list_my_stores()'::regprocedure) NOT ILIKE '%user_profiles%'
     OR pg_get_functiondef('public.list_my_stores()'::regprocedure) NOT ILIKE '%p.is_active%' THEN
    RAISE EXCEPTION 'list_my_stores must reject inactive user profiles';
  END IF;

  IF pg_get_functiondef('public.get_store_growth_summary(uuid)'::regprocedure) ILIKE '%''rejeitado''%'
     OR pg_get_functiondef('public.get_store_growth_summary(uuid)'::regprocedure) ILIKE '%''concluido''%'
     OR pg_get_functiondef('public.get_store_revenue_series(uuid,integer)'::regprocedure) ILIKE '%''rejeitado''%'
     OR pg_get_functiondef('public.get_store_revenue_series(uuid,integer)'::regprocedure) ILIKE '%''concluido''%'
     OR pg_get_functiondef('public.list_store_customer_insights(uuid,text,text,integer,integer)'::regprocedure) ILIKE '%''concluido''%' THEN
    RAISE EXCEPTION 'Growth RPCs must not reference retired order_status literals';
  END IF;

  IF pg_get_functiondef('public.get_store_growth_summary(uuid)'::regprocedure) NOT ILIKE '%''recusado''%'
     OR pg_get_functiondef('public.get_store_growth_summary(uuid)'::regprocedure) NOT ILIKE '%''entregue''%'
     OR pg_get_functiondef('public.get_store_growth_summary(uuid)'::regprocedure) NOT ILIKE '%''retirado''%'
     OR pg_get_functiondef('public.get_store_revenue_series(uuid,integer)'::regprocedure) NOT ILIKE '%''entregue''%'
     OR pg_get_functiondef('public.get_store_revenue_series(uuid,integer)'::regprocedure) NOT ILIKE '%''retirado''%'
     OR pg_get_functiondef('public.list_store_customer_insights(uuid,text,text,integer,integer)'::regprocedure) NOT ILIKE '%''entregue''%'
     OR pg_get_functiondef('public.list_store_customer_insights(uuid,text,text,integer,integer)'::regprocedure) NOT ILIKE '%''retirado''%' THEN
    RAISE EXCEPTION 'Growth RPCs must use current terminal order_status values';
  END IF;

  IF pg_get_functiondef('private.require_growth_access(uuid)'::regprocedure) NOT ILIKE '%reports.view_operational%'
     OR pg_get_functiondef('private.require_growth_access(uuid)'::regprocedure) NOT ILIKE '%can_use_growth%'
     OR pg_get_functiondef('public.get_store_growth_summary(uuid)'::regprocedure) NOT ILIKE '%private.require_growth_access%'
     OR pg_get_functiondef('public.get_store_revenue_series(uuid,integer)'::regprocedure) NOT ILIKE '%private.require_growth_access%'
     OR pg_get_functiondef('public.list_store_customer_insights(uuid,text,text,integer,integer)'::regprocedure) NOT ILIKE '%private.require_growth_access%'
     OR pg_get_functiondef('public.list_store_marketing_campaigns(uuid)'::regprocedure) NOT ILIKE '%private.require_growth_access%'
     OR pg_get_functiondef('public.list_store_automation_rules(uuid)'::regprocedure) NOT ILIKE '%private.require_growth_access%' THEN
    RAISE EXCEPTION 'Growth reads must require reports permission and billing capability';
  END IF;

  IF to_regprocedure('public.get_my_store_delivery_report_summary(text,date,date)') IS NULL
     OR to_regprocedure('public.get_my_store_delivery_report_series(text,date,date)') IS NULL
     OR to_regprocedure('public.list_my_store_delivery_report_by_courier(text,date,date)') IS NULL
     OR to_regprocedure('public.list_my_store_completed_deliveries(text,date,date,uuid,integer,integer)') IS NULL
     OR to_regprocedure('public.get_my_courier_delivery_counter(date,date)') IS NULL
     OR to_regprocedure('public.list_my_completed_deliveries(integer,integer)') IS NULL THEN
    RAISE EXCEPTION 'Delivery report RPC contract is incomplete';
  END IF;

  IF pg_get_functiondef('private.require_delivery_report_store()'::regprocedure) NOT ILIKE '%reports.view_operational%'
     OR pg_get_functiondef('public.get_my_store_delivery_report_summary(text,date,date)'::regprocedure) NOT ILIKE '%private.require_delivery_report_store%'
     OR pg_get_functiondef('public.get_my_store_delivery_report_series(text,date,date)'::regprocedure) NOT ILIKE '%private.require_delivery_report_store%'
     OR pg_get_functiondef('public.list_my_store_delivery_report_by_courier(text,date,date)'::regprocedure) NOT ILIKE '%private.require_delivery_report_store%'
     OR pg_get_functiondef('public.list_my_store_completed_deliveries(text,date,date,uuid,integer,integer)'::regprocedure) NOT ILIKE '%private.require_delivery_report_store%' THEN
    RAISE EXCEPTION 'Store delivery reports must require reports.view_operational';
  END IF;

  IF pg_get_functiondef('public.get_my_courier_delivery_counter(date,date)'::regprocedure) NOT ILIKE '%private.require_current_courier%'
     OR pg_get_functiondef('public.get_my_courier_delivery_counter(date,date)'::regprocedure) NOT ILIKE '%courier.view_self%'
     OR pg_get_functiondef('public.list_my_completed_deliveries(integer,integer)'::regprocedure) NOT ILIKE '%private.require_current_courier%'
     OR pg_get_functiondef('public.list_my_completed_deliveries(integer,integer)'::regprocedure) NOT ILIKE '%courier.view_self%' THEN
    RAISE EXCEPTION 'Courier delivery reports must be self-scoped and permission-guarded';
  END IF;

  IF pg_get_functiondef('public.get_my_store_delivery_report_summary(text,date,date)'::regprocedure) ILIKE '%fulfillment_type%'
     OR pg_get_functiondef('public.get_my_store_delivery_report_summary(text,date,date)'::regprocedure) ILIKE '%''delivery''%'
     OR pg_get_functiondef('public.get_my_store_delivery_report_summary(text,date,date)'::regprocedure) NOT ILIKE '%o.fulfillment = ''entrega''%'
     OR pg_get_functiondef('public.get_my_store_delivery_report_summary(text,date,date)'::regprocedure) NOT ILIKE '%o.status = ''entregue''%' THEN
    RAISE EXCEPTION 'Delivery reports must use the current order schema and terminal delivery states';
  END IF;

  IF has_function_privilege('anon','public.get_my_store_delivery_report_summary(text,date,date)'::regprocedure,'EXECUTE')
     OR has_function_privilege('anon','public.get_my_store_delivery_report_series(text,date,date)'::regprocedure,'EXECUTE')
     OR has_function_privilege('anon','public.list_my_store_delivery_report_by_courier(text,date,date)'::regprocedure,'EXECUTE')
     OR has_function_privilege('anon','public.list_my_store_completed_deliveries(text,date,date,uuid,integer,integer)'::regprocedure,'EXECUTE')
     OR has_function_privilege('anon','public.get_my_courier_delivery_counter(date,date)'::regprocedure,'EXECUTE')
     OR has_function_privilege('anon','public.list_my_completed_deliveries(integer,integer)'::regprocedure,'EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_my_store_delivery_report_summary(text,date,date)'::regprocedure,'EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_my_store_delivery_report_series(text,date,date)'::regprocedure,'EXECUTE')
     OR NOT has_function_privilege('authenticated','public.list_my_store_delivery_report_by_courier(text,date,date)'::regprocedure,'EXECUTE')
     OR NOT has_function_privilege('authenticated','public.list_my_store_completed_deliveries(text,date,date,uuid,integer,integer)'::regprocedure,'EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_my_courier_delivery_counter(date,date)'::regprocedure,'EXECUTE')
     OR NOT has_function_privilege('authenticated','public.list_my_completed_deliveries(integer,integer)'::regprocedure,'EXECUTE') THEN
    RAISE EXCEPTION 'Delivery report RPC ACLs must remain authenticated-only';
  END IF;

  IF has_function_privilege(
      'authenticated',
      'public.provision_store_with_owner(text,text,uuid,text,text,text,text,text,text,text,text,text,uuid)'::regprocedure,
      'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute provision_store_with_owner';
  END IF;

  IF has_function_privilege(
      'authenticated',
      'public.fail_store_provisioning(text,text)'::regprocedure,
      'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute fail_store_provisioning';
  END IF;

  IF has_function_privilege(
      'anon',
      'public.consume_edge_rate_limit(text,integer,integer)'::regprocedure,
      'EXECUTE')
     OR has_function_privilege(
      'authenticated',
      'public.consume_edge_rate_limit(text,integer,integer)'::regprocedure,
      'EXECUTE') THEN
    RAISE EXCEPTION 'consume_edge_rate_limit must remain service-only';
  END IF;

  SELECT array_agg(format('%I.%I', n.nspname, c.relname))
    INTO missing_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND NOT c.relrowsecurity;

  IF missing_rls IS NOT NULL THEN
    RAISE EXCEPTION 'Public tables without RLS: %', missing_rls;
  END IF;
END $$;

SELECT 'security_contract_passed' AS result;
