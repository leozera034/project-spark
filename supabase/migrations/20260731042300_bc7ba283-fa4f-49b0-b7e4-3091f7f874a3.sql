-- 1. Snapshot: preserva explicitamente os EXECUTE que 'authenticated' já possui hoje
--    (hoje muitos vêm do default PUBLIC; sem isso, o REVOKE FROM PUBLIC os removeria).
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
  END LOOP;
END
$$;

-- 2. Fecha o schema interno para a role anônima
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA private FROM anon;
REVOKE USAGE ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- 3. Garante que os papéis internos continuam operando
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role;

-- 4. Novas funções internas nascem fechadas
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;