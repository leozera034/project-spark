-- Prevent client-callable SECURITY DEFINER RPCs from trusting a caller-supplied user id.
-- User identity for browser-facing RPCs must come from auth.uid(); backend-only RPCs may
-- accept an explicit actor id only when EXECUTE is restricted to service_role.

DO $$
DECLARE
  _unsafe text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, E'\n' ORDER BY p.oid::regprocedure::text)
  INTO _unsafe
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND (
      pg_get_function_arguments(p.oid) ILIKE '%actor_user_id%'
      OR pg_get_function_arguments(p.oid) ILIKE '%_user_id%'
    )
    AND (
      has_function_privilege('authenticated', p.oid, 'EXECUTE')
      OR has_function_privilege('anon', p.oid, 'EXECUTE')
    );

  IF _unsafe IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER identity boundary violation. Client-callable functions accept caller-supplied identity:%', E'\n' || _unsafe;
  END IF;
END $$;

SELECT 'security_definer_identity_boundary_contract_passed' AS result;
