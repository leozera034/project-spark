-- WhatsApp paid add-on provisioning contract.
-- Read-only assertions; safe to run against the deployed database.
DO $$
DECLARE
  _request regprocedure := 'public.request_whatsapp_addon(uuid)'::regprocedure;
  _status regprocedure := 'public.get_whatsapp_addon_provisioning(uuid)'::regprocedure;
  _transition regprocedure := 'public.backend_transition_whatsapp_provisioning(uuid,text,text,text,text,text,text,jsonb)'::regprocedure;
BEGIN
  IF to_regclass('private.whatsapp_provisioning_requests') IS NULL THEN
    RAISE EXCEPTION 'WhatsApp provisioning table is missing';
  END IF;

  IF has_table_privilege('anon','private.whatsapp_provisioning_requests','SELECT')
     OR has_table_privilege('authenticated','private.whatsapp_provisioning_requests','SELECT')
     OR has_table_privilege('authenticated','private.whatsapp_provisioning_requests','INSERT')
     OR has_table_privilege('authenticated','private.whatsapp_provisioning_requests','UPDATE') THEN
    RAISE EXCEPTION 'WhatsApp provisioning storage must remain backend-only';
  END IF;

  IF has_function_privilege('anon',_request,'EXECUTE')
     OR NOT has_function_privilege('authenticated',_request,'EXECUTE')
     OR pg_get_functiondef(_request) NOT ILIKE '%require_growth_access%'
     OR pg_get_functiondef(_request) NOT ILIKE '%awaiting_payment%' THEN
    RAISE EXCEPTION 'Store provisioning request must be authenticated, scoped and payment-gated';
  END IF;

  IF has_function_privilege('anon',_status,'EXECUTE')
     OR NOT has_function_privilege('authenticated',_status,'EXECUTE')
     OR pg_get_functiondef(_status) NOT ILIKE '%require_growth_access%' THEN
    RAISE EXCEPTION 'Provisioning status must be authenticated and store-scoped';
  END IF;

  IF has_function_privilege('anon',_transition,'EXECUTE')
     OR has_function_privilege('authenticated',_transition,'EXECUTE')
     OR NOT has_function_privilege('service_role',_transition,'EXECUTE') THEN
    RAISE EXCEPTION 'Provisioning transitions must remain service-role-only';
  END IF;

  IF pg_get_functiondef(_transition) NOT ILIKE '%INVALID_PROVISIONING_STATUS%'
     OR pg_get_functiondef(_transition) NOT ILIKE '%INVALID_WHATSAPP_PROVIDER%' THEN
    RAISE EXCEPTION 'Backend transition must validate state and provider';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='private'
      AND tablename='whatsapp_provisioning_requests'
      AND indexname='whatsapp_provisioning_one_open_per_store'
  ) THEN
    RAISE EXCEPTION 'Provisioning must enforce one open lifecycle per store';
  END IF;
END $$;

SELECT 'whatsapp_provisioning_contract_passed' AS result;
