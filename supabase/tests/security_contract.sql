-- Security contract smoke tests for Pediu Aqui / Project Spark.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security_contract.sql

DO $$
DECLARE
  exposed text[];
  missing_rls text[];
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

  IF (SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.oid='public.list_active_category_profiles()'::regprocedure) THEN
    RAISE EXCEPTION 'list_active_category_profiles must remain SECURITY INVOKER';
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
