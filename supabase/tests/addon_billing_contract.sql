-- Add-on billing integrity contract for Comandiva.
-- Read-only assertions; safe to run against production.

DO $$
DECLARE
  _record_payment regprocedure := 'private.record_addon_provider_payment(uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz,text,jsonb)'::regprocedure;
  _addons_rpc regprocedure := 'public.get_my_store_addons(uuid)'::regprocedure;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public'
      AND t.relname='store_addon_subscriptions'
      AND c.conname='store_addon_subscriptions_addon_price_matches_addon_fk'
      AND c.convalidated
  ) THEN
    RAISE EXCEPTION 'Add-on subscriptions must bind price to the same add-on';
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

SELECT 'addon_billing_contract_passed' AS result;
