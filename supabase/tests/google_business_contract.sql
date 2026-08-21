-- Google Business OAuth security contract.
-- Read-only assertions; safe to run against the deployed database.
DO $$
DECLARE
  _begin regprocedure := 'public.begin_store_google_business_onboarding(uuid,text)'::regprocedure;
  _status regprocedure := 'public.get_store_google_business_connection(uuid)'::regprocedure;
  _claim regprocedure := 'public.claim_google_business_onboarding_session(uuid,text)'::regprocedure;
  _fail regprocedure := 'public.fail_google_business_onboarding_session(uuid,text,text)'::regprocedure;
  _complete regprocedure := 'public.complete_google_business_connection(uuid,text,timestamptz,text[],text,boolean,text,integer)'::regprocedure;
  _credential regprocedure := 'public.service_get_google_business_credential(uuid)'::regprocedure;
  _disconnect regprocedure := 'public.disconnect_store_google_business(uuid)'::regprocedure;
  _rls_enabled boolean;
  _rls_forced boolean;
BEGIN
  IF to_regclass('private.google_business_onboarding_sessions') IS NULL THEN
    RAISE EXCEPTION 'Google Business onboarding table is missing';
  END IF;

  SELECT c.relrowsecurity, c.relforcerowsecurity
  INTO _rls_enabled, _rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='private' AND c.relname='google_business_onboarding_sessions';

  IF NOT coalesce(_rls_enabled,false) OR NOT coalesce(_rls_forced,false) THEN
    RAISE EXCEPTION 'Google Business onboarding storage must enforce RLS';
  END IF;

  IF has_table_privilege('anon','private.google_business_onboarding_sessions','SELECT')
     OR has_table_privilege('authenticated','private.google_business_onboarding_sessions','SELECT')
     OR has_table_privilege('authenticated','private.google_business_onboarding_sessions','INSERT')
     OR has_table_privilege('authenticated','private.google_business_onboarding_sessions','UPDATE')
     OR NOT has_table_privilege('service_role','private.google_business_onboarding_sessions','SELECT') THEN
    RAISE EXCEPTION 'Google Business onboarding storage must remain backend-only';
  END IF;

  IF has_function_privilege('anon',_begin,'EXECUTE')
     OR NOT has_function_privilege('authenticated',_begin,'EXECUTE')
     OR pg_get_functiondef(_begin) NOT ILIKE '%is_store_manager%'
     OR pg_get_functiondef(_begin) NOT ILIKE '%state_hash%'
     OR pg_get_functiondef(_begin) NOT ILIKE '%15 minutes%' THEN
    RAISE EXCEPTION 'Google Business onboarding start must be authenticated, store-scoped and expiring';
  END IF;

  IF has_function_privilege('anon',_status,'EXECUTE')
     OR NOT has_function_privilege('authenticated',_status,'EXECUTE')
     OR pg_get_functiondef(_status) NOT ILIKE '%require_growth_access%'
     OR pg_get_functiondef(_status) ILIKE '%credential_ref%credential%' THEN
    RAISE EXCEPTION 'Google Business status must be authenticated, scoped and must not expose credentials';
  END IF;

  IF has_function_privilege('anon',_disconnect,'EXECUTE')
     OR NOT has_function_privilege('authenticated',_disconnect,'EXECUTE')
     OR pg_get_functiondef(_disconnect) NOT ILIKE '%is_store_manager%'
     OR pg_get_functiondef(_disconnect) NOT ILIKE '%delete from vault.secrets%' THEN
    RAISE EXCEPTION 'Google Business disconnect must be manager-scoped and remove Vault credentials';
  END IF;

  IF has_function_privilege('anon',_claim,'EXECUTE')
     OR has_function_privilege('authenticated',_claim,'EXECUTE')
     OR NOT has_function_privilege('service_role',_claim,'EXECUTE')
     OR pg_get_functiondef(_claim) NOT ILIKE '%status <> ''created''%'
     OR pg_get_functiondef(_claim) NOT ILIKE '%status=''exchanging''%'
     OR pg_get_functiondef(_claim) NOT ILIKE '%for update%' THEN
    RAISE EXCEPTION 'Google Business OAuth state claim must be service-only, locked and single-use';
  END IF;

  IF has_function_privilege('anon',_fail,'EXECUTE')
     OR has_function_privilege('authenticated',_fail,'EXECUTE')
     OR NOT has_function_privilege('service_role',_fail,'EXECUTE')
     OR has_function_privilege('anon',_complete,'EXECUTE')
     OR has_function_privilege('authenticated',_complete,'EXECUTE')
     OR NOT has_function_privilege('service_role',_complete,'EXECUTE')
     OR has_function_privilege('anon',_credential,'EXECUTE')
     OR has_function_privilege('authenticated',_credential,'EXECUTE')
     OR NOT has_function_privilege('service_role',_credential,'EXECUTE') THEN
    RAISE EXCEPTION 'Google Business callback persistence RPCs must remain service-role-only';
  END IF;

  IF pg_get_functiondef(_complete) NOT ILIKE '%vault.create_secret%'
     OR pg_get_functiondef(_complete) NOT ILIKE '%vault.update_secret%'
     OR pg_get_functiondef(_credential) NOT ILIKE '%vault.decrypted_secrets%' THEN
    RAISE EXCEPTION 'Google Business OAuth credentials must remain Vault-backed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='private'
      AND tablename='google_business_onboarding_sessions'
      AND indexname='google_business_onboarding_state_uidx'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='private'
      AND tablename='google_business_onboarding_sessions'
      AND indexname='google_business_onboarding_store_created_idx'
  ) THEN
    RAISE EXCEPTION 'Google Business onboarding indexes are missing';
  END IF;
END $$;

SELECT 'google_business_contract_passed' AS result;
