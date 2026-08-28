-- Legal acceptance audit contract.
-- The acceptance recorder is a privileged backend operation and the underlying
-- evidence table must never be directly exposed to browser roles.

DO $$
DECLARE
  _recorder regprocedure := 'public.backend_record_signup_legal_acceptance(uuid,uuid,text,text,text,text,jsonb)'::regprocedure;
BEGIN
  IF has_function_privilege('anon', _recorder, 'EXECUTE')
     OR has_function_privilege('authenticated', _recorder, 'EXECUTE')
     OR NOT has_function_privilege('service_role', _recorder, 'EXECUTE') THEN
    RAISE EXCEPTION 'Legal acceptance recorder must remain service-role-only';
  END IF;

  IF has_table_privilege('anon', 'private.legal_acceptances', 'SELECT')
     OR has_table_privilege('anon', 'private.legal_acceptances', 'INSERT')
     OR has_table_privilege('anon', 'private.legal_acceptances', 'UPDATE')
     OR has_table_privilege('authenticated', 'private.legal_acceptances', 'SELECT')
     OR has_table_privilege('authenticated', 'private.legal_acceptances', 'INSERT')
     OR has_table_privilege('authenticated', 'private.legal_acceptances', 'UPDATE') THEN
    RAISE EXCEPTION 'Legal acceptance evidence must not be directly accessible to browser roles';
  END IF;

  IF pg_get_functiondef(_recorder) NOT ILIKE '%auth.users%'
     OR pg_get_functiondef(_recorder) NOT ILIKE '%ACTOR_STORE_MISMATCH%'
     OR pg_get_functiondef(_recorder) NOT ILIKE '%legal_acceptances%' THEN
    RAISE EXCEPTION 'Legal acceptance recorder must validate actor identity and store ownership before recording evidence';
  END IF;
END $$;

SELECT 'legal_acceptance_contract_passed' AS result;
