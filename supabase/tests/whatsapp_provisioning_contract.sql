-- WhatsApp paid add-on provisioning contract.
-- Read-only assertions; safe to run against the deployed database.
DO $$
DECLARE
  _request regprocedure := 'public.request_whatsapp_addon(uuid)'::regprocedure;
  _status regprocedure := 'public.get_whatsapp_addon_provisioning(uuid)'::regprocedure;
  _transition regprocedure := 'public.backend_transition_whatsapp_provisioning(uuid,text,text,text,text,text,text,jsonb)'::regprocedure;
  _evolution_connection regprocedure := 'public.get_store_evolution_whatsapp_connection(uuid)'::regprocedure;
  _evolution_prepare_manual regprocedure := 'public.prepare_evolution_manual_send(uuid,text,text)'::regprocedure;
  _evolution_backend_state regprocedure := 'public.backend_mark_evolution_whatsapp_state(uuid,text,text,text,text)'::regprocedure;
  _evolution_backend_manual regprocedure := 'public.backend_record_evolution_manual_send(uuid,text,text,text,uuid)'::regprocedure;
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

  IF has_function_privilege('anon',_evolution_connection,'EXECUTE')
     OR NOT has_function_privilege('authenticated',_evolution_connection,'EXECUTE')
     OR pg_get_functiondef(_evolution_connection) NOT ILIKE '%require_growth_access%'
     OR pg_get_functiondef(_evolution_connection) NOT ILIKE '%can_provision%' THEN
    RAISE EXCEPTION 'Evolution connection state must be authenticated, scoped and payment-aware';
  END IF;

  IF has_function_privilege('anon',_evolution_prepare_manual,'EXECUTE')
     OR NOT has_function_privilege('authenticated',_evolution_prepare_manual,'EXECUTE')
     OR pg_get_functiondef(_evolution_prepare_manual) NOT ILIKE '%require_growth_access%'
     OR pg_get_functiondef(_evolution_prepare_manual) NOT ILIKE '%require_store_entitlement%'
     OR pg_get_functiondef(_evolution_prepare_manual) NOT ILIKE '%status=''connected''%' THEN
    RAISE EXCEPTION 'Evolution manual sends must be authenticated, entitled and connected';
  END IF;

  IF has_function_privilege('anon',_evolution_backend_state,'EXECUTE')
     OR has_function_privilege('authenticated',_evolution_backend_state,'EXECUTE')
     OR NOT has_function_privilege('service_role',_evolution_backend_state,'EXECUTE')
     OR has_function_privilege('anon',_evolution_backend_manual,'EXECUTE')
     OR has_function_privilege('authenticated',_evolution_backend_manual,'EXECUTE')
     OR NOT has_function_privilege('service_role',_evolution_backend_manual,'EXECUTE') THEN
    RAISE EXCEPTION 'Evolution provider-state and manual-send recording RPCs must remain service-role-only';
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
