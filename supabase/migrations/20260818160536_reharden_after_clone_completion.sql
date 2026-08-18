-- Re-apply function ACL hardening after the external clone finished creating
-- late public routines. No business rows are modified.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS signature, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.signature);

    IF NOT (
      (r.proname = 'authorize_courier_reset') OR
      (r.proname = 'create_product_starter_group_drafts_legacy') OR
      (r.proname = 'fail_courier_provisioning_admin') OR
      (r.proname = 'fail_store_provisioning') OR
      (r.proname = 'provision_store_courier_admin') OR
      (r.proname = 'provision_store_with_owner') OR
      (r.proname = 'resolve_courier_create_store_admin') OR
      (r.proname LIKE 'storefront_%') OR
      (r.proname = 'update_product_inventory')
    ) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.signature);
    END IF;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.check_public_store_slug(text) TO anon, authenticated, service_role;
