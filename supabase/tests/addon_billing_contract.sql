-- Add-on billing integrity contract for Comandiva.
-- Read-only assertions; safe to run against production.
--
-- PR jobs point at the currently deployed database. Before this branch's
-- migration is deployed, the new composite FK is absent, so report a pending
-- contract instead of producing a false pre-deploy failure. After deployment,
-- every assertion below becomes mandatory.

DO $$
DECLARE
  _record_payment regprocedure := 'private.record_addon_provider_payment(uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz,text,jsonb)'::regprocedure;
  _addons_rpc regprocedure := 'public.get_my_store_addons(uuid)'::regprocedure;
  _begin_checkout regprocedure := 'public.billing_begin_addon_checkout(uuid,uuid,text,text,text,text)'::regprocedure;
  _complete_provider regprocedure := 'public.billing_complete_addon_checkout_provider_create(uuid,uuid,text,text,text,text)'::regprocedure;
  _complete_session regprocedure := 'public.billing_complete_addon_checkout_session_create(uuid,uuid,text,text,text,text)'::regprocedure;
  _deployed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public'
      AND t.relname='store_addon_subscriptions'
      AND c.conname='store_addon_subscriptions_addon_price_matches_addon_fk'
      AND c.convalidated
  ) INTO _deployed;

  IF NOT _deployed THEN
    RAISE NOTICE 'Add-on billing hardening migration is not deployed yet; contract pending';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public'
      AND t.relname='addon_subscription_payments'
      AND c.conname='addon_subscription_payments_subscription_store_fk'
      AND c.convalidated
  ) THEN
    RAISE EXCEPTION 'Add-on payment ledger must bind subscription to the same store';
  END IF;

  IF pg_get_functiondef(_record_payment) NOT ILIKE '%ADDON_PAYMENT_SUBSCRIPTION_MISMATCH%'
     OR pg_get_functiondef(_record_payment) NOT ILIKE '%ADDON_PROVIDER_EVENT_CONFLICT%'
     OR pg_get_functiondef(_record_payment) NOT ILIKE '%ADDON_PROVIDER_NOT_ATTACHED%'
     OR pg_get_functiondef(_record_payment) NOT ILIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'Add-on payment recorder must fail closed on provider/subscription collisions';
  END IF;

  IF has_function_privilege('anon',_record_payment,'EXECUTE')
     OR has_function_privilege('authenticated',_record_payment,'EXECUTE')
     OR NOT has_function_privilege('service_role',_record_payment,'EXECUTE') THEN
    RAISE EXCEPTION 'Add-on payment recorder must remain service-role-only';
  END IF;

  IF has_function_privilege('anon',_begin_checkout,'EXECUTE')
     OR has_function_privilege('authenticated',_begin_checkout,'EXECUTE')
     OR NOT has_function_privilege('service_role',_begin_checkout,'EXECUTE')
     OR has_function_privilege('anon',_complete_provider,'EXECUTE')
     OR has_function_privilege('authenticated',_complete_provider,'EXECUTE')
     OR NOT has_function_privilege('service_role',_complete_provider,'EXECUTE')
     OR has_function_privilege('anon',_complete_session,'EXECUTE')
     OR has_function_privilege('authenticated',_complete_session,'EXECUTE')
     OR NOT has_function_privilege('service_role',_complete_session,'EXECUTE') THEN
    RAISE EXCEPTION 'Add-on checkout mutation RPCs must remain service-role-only';
  END IF;

  IF pg_get_functiondef(_addons_rpc) NOT ILIKE '%subscription.view%'
     OR pg_get_functiondef(_addons_rpc) NOT ILIKE '%can_view_billing%'
     OR NOT has_function_privilege('authenticated',_addons_rpc,'EXECUTE')
     OR has_function_privilege('anon',_addons_rpc,'EXECUTE') THEN
    RAISE EXCEPTION 'Add-on catalog must redact commercial fields unless subscription.view is granted';
  END IF;

  IF has_table_privilege('authenticated','public.store_addon_subscriptions','SELECT')
     OR has_table_privilege('authenticated','public.store_addon_subscriptions','INSERT')
     OR has_table_privilege('authenticated','public.store_addon_subscriptions','UPDATE')
     OR has_table_privilege('authenticated','public.addon_subscription_payments','SELECT')
     OR has_table_privilege('authenticated','public.addon_subscription_payments','INSERT')
     OR has_table_privilege('authenticated','public.addon_subscription_payments','UPDATE') THEN
    RAISE EXCEPTION 'Authenticated clients must not have direct add-on subscription/payment table access';
  END IF;
END $$;

SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public'
      AND t.relname='store_addon_subscriptions'
      AND c.conname='store_addon_subscriptions_addon_price_matches_addon_fk'
      AND c.convalidated
  ) THEN 'addon_billing_contract_passed'
  ELSE 'addon_billing_contract_pending_migration'
END AS result;
